// Goku sync server (Cloudflare Worker + D1).
// Zero-knowledge: phones encrypt everything before sending it. The server only checks sign-in keys
// (as salted hashes) and stores encrypted blobs under opaque ids. It cannot read, reset or recover data.
//
// All routes are POST with a JSON body. Signed-in routes send "Authorization: Bearer <token>".
//   /v1/signup   {user, auth, recAuth, wrapPw, wrapRec, kdf}      -> {token}
//   /v1/login    {user, auth}                                     -> {token, wrapPw, kdf}
//   /v1/recover  {user, recAuth}                                  -> {wrapRec, kdf}
//                {user, recAuth, auth, wrapPw}                    -> {token}   (sets a new password, signs out other phones)
//   /v1/sync     {since, push: [{rid, v, del, blob}]}             -> {pull: [{rid, v, del, blob, seq}], more}
//   /v1/password {auth, newAuth, wrapPw}                          -> {ok}      (signs out other phones)
//   /v1/logout   {}                                               -> {ok}
//   /v1/delete   {auth}                                           -> {ok}      (erases the account and all its data)

const MAX_BODY = 2 * 1024 * 1024;     // one request (the free plan allows 10 ms of work per request)
const MAX_BLOB = 1024 * 1024;         // one encrypted record (a profile photo can be large)
const MAX_PUSH = 200;                 // records per request; the phone sends more in further requests
const MAX_PULL = 500;
const MAX_RECORDS = 50000;            // per account, years of daily logging
const MAX_FAILS = 10, LOCK_MS = 15 * 60000;
const SIGNUPS_PER_DAY = 5;            // per network
const TOKEN_IDLE_MS = 400 * 86400000; // a phone unused for over a year signs in again

const USER = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const B64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

class Fail extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const key32 = (v, name) => { if (typeof v !== 'string' || v.length < 40 || v.length > 64 || !B64.test(v)) throw new Fail(400, `Bad ${name}.`); return v; };
const wrapped = (v, name) => {
  if (!v || typeof v.iv !== 'string' || typeof v.ct !== 'string' || !B64.test(v.iv) || !B64.test(v.ct) || v.iv.length > 32 || v.ct.length > 200) throw new Fail(400, `Bad ${name}.`);
  return JSON.stringify({ iv: v.iv, ct: v.ct });
};
// Compare two hex strings in constant time.
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

async function newToken(env, userId) {
  const token = randomHex(32), now = Date.now();
  await env.DB.prepare('INSERT INTO tokens (hash, user_id, created, last_used) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, now, now).run();
  return token;
}
async function signedIn(req, env) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('Authorization') || '');
  if (!m) throw new Fail(401, 'Sign in again.');
  const h = await sha256(m[1]), now = Date.now();
  const row = await env.DB.prepare('SELECT user_id, last_used FROM tokens WHERE hash = ?').bind(h).first();
  if (!row || now - row.last_used > TOKEN_IDLE_MS) throw new Fail(401, 'Sign in again.');
  if (now - row.last_used > 3600000) await env.DB.prepare('UPDATE tokens SET last_used = ? WHERE hash = ?').bind(now, h).run();
  return { userId: row.user_id, tokenHash: h };
}
async function findUser(env, name) {
  if (typeof name !== 'string' || !USER.test(name)) throw new Fail(400, 'Usernames are 3 to 30 letters, numbers, dots, dashes or underscores.');
  return env.DB.prepare('SELECT * FROM users WHERE name = ?').bind(name).first();
}
// Checks a sign-in or recovery key against its stored hash, counting wrong tries.
async function checkKey(env, u, field, value) {
  const now = Date.now();
  if (!u) { await sha256('x' + value); throw new Fail(403, 'Wrong username or password.'); } // same work either way
  // Wrong passwords lock sign-in for a while. A recovery key (160 random bits) can't be guessed, so it is never
  // locked: nobody can keep the real owner out by typing wrong passwords on purpose.
  if (field === 'auth' && u.locked_until > now) throw new Fail(429, `Too many tries. Wait ${Math.ceil((u.locked_until - now) / 60000)} minutes.`);
  const good = same(await sha256(u[field + '_salt'] + value), u[field + '_hash']);
  if (good) { if (field === 'auth' && u.fails) await env.DB.prepare('UPDATE users SET fails = 0 WHERE id = ?').bind(u.id).run(); return; }
  if (field === 'rec') throw new Fail(403, 'That recovery key is not right.');
  const fails = u.fails + 1, lock = fails >= MAX_FAILS ? now + LOCK_MS : 0;
  await env.DB.prepare('UPDATE users SET fails = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : fails, lock, u.id).run();
  throw new Fail(403, field === 'rec' ? 'That recovery key is not right.' : 'Wrong username or password.');
}

const routes = {
  async signup(b, env, req) {
    if (await findUser(env, b.user)) throw new Fail(409, 'That username is taken.');
    const auth = key32(b.auth, 'auth'), rec = key32(b.recAuth, 'recAuth'), wrapPw = wrapped(b.wrapPw, 'wrapPw'), wrapRec = wrapped(b.wrapRec, 'wrapRec');
    const kdf = { v: 1, iter: Number.isInteger(b.kdf?.iter) && b.kdf.iter >= 300000 && b.kdf.iter <= 5000000 ? b.kdf.iter : 0 };
    if (!kdf.iter) throw new Fail(400, 'Bad kdf.');
    const day = new Date().toISOString().slice(0, 10), ip = await sha256('goku|' + (req.headers.get('CF-Connecting-IP') || 'local'));
    const hits = await env.DB.prepare('SELECT n FROM signups WHERE ip_hash = ? AND day = ?').bind(ip, day).first();
    if (hits && hits.n >= SIGNUPS_PER_DAY) throw new Fail(429, 'Too many new accounts from this network today. Try tomorrow.');
    const aSalt = randomHex(16), rSalt = randomHex(16);
    const r = await env.DB.prepare(`INSERT INTO users (name, auth_salt, auth_hash, rec_salt, rec_hash, wrap_pw, wrap_rec, kdf, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .bind(b.user, aSalt, await sha256(aSalt + auth), rSalt, await sha256(rSalt + rec), wrapPw, wrapRec, JSON.stringify(kdf), Date.now()).first();
    await env.DB.prepare('INSERT INTO signups (ip_hash, day, n) VALUES (?, ?, 1) ON CONFLICT(ip_hash, day) DO UPDATE SET n = n + 1').bind(ip, day).run();
    await env.DB.prepare('DELETE FROM signups WHERE day < ?').bind(day).run();
    return { token: await newToken(env, r.id) };
  },

  async login(b, env) {
    const u = await findUser(env, b.user);
    await checkKey(env, u, 'auth', key32(b.auth, 'auth'));
    return { token: await newToken(env, u.id), wrapPw: JSON.parse(u.wrap_pw), kdf: JSON.parse(u.kdf) };
  },

  async recover(b, env) {
    const u = await findUser(env, b.user);
    await checkKey(env, u, 'rec', key32(b.recAuth, 'recAuth'));
    if (b.auth == null) return { wrapRec: JSON.parse(u.wrap_rec), kdf: JSON.parse(u.kdf) };
    const auth = key32(b.auth, 'auth'), wrapPw = wrapped(b.wrapPw, 'wrapPw'), salt = randomHex(16);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET auth_salt = ?, auth_hash = ?, wrap_pw = ?, fails = 0, locked_until = 0 WHERE id = ?').bind(salt, await sha256(salt + auth), wrapPw, u.id),
      env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(u.id),
    ]);
    return { token: await newToken(env, u.id) };
  },

  async sync(b, env, req) {
    const { userId } = await signedIn(req, env);
    const since = Number.isInteger(b.since) && b.since >= 0 ? b.since : 0;
    const push = Array.isArray(b.push) ? b.push : [];
    if (push.length > MAX_PUSH) throw new Fail(413, 'Too many records at once.');
    const seen = new Set();
    for (const x of push) {
      if (!x || typeof x.rid !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(x.rid) || seen.has(x.rid)) throw new Fail(400, 'Bad record id.');
      if (!Number.isSafeInteger(x.v) || x.v < 0) throw new Fail(400, 'Bad record time.');
      if (typeof x.blob !== 'string' || x.blob.length > MAX_BLOB || !B64.test(x.blob)) throw new Fail(400, 'Bad record.');
      seen.add(x.rid);
    }
    if (push.length) {
      const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE user_id = ?').bind(userId).first();
      if (n + push.length > MAX_RECORDS) throw new Fail(507, 'This account is full.');
      // One transaction: reserve change numbers, then write. A copy only replaces an older one (v), so two phones can't undo each other.
      const N = push.length;
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET seq = seq + ? WHERE id = ?').bind(N, userId),
        ...push.map((x, i) => env.DB.prepare(`INSERT INTO records (user_id, rid, v, seq, del, blob) VALUES (?1, ?2, ?3, (SELECT seq FROM users WHERE id = ?1) - ?4, ?5, ?6)
          ON CONFLICT(user_id, rid) DO UPDATE SET v = excluded.v, seq = excluded.seq, del = excluded.del, blob = excluded.blob WHERE excluded.v > records.v`)
          .bind(userId, x.rid, x.v, N - 1 - i, x.del ? 1 : 0, x.blob)),
      ]);
    }
    const { results } = await env.DB.prepare('SELECT rid, v, del, blob, seq FROM records WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?').bind(userId, since, MAX_PULL + 1).all();
    const more = results.length > MAX_PULL;
    return { pull: results.slice(0, MAX_PULL).map(r => ({ ...r, del: !!r.del })), more };
  },

  async password(b, env, req) {
    const { userId, tokenHash } = await signedIn(req, env);
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    await checkKey(env, u, 'auth', key32(b.auth, 'auth'));
    const auth = key32(b.newAuth, 'newAuth'), wrapPw = wrapped(b.wrapPw, 'wrapPw'), salt = randomHex(16);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET auth_salt = ?, auth_hash = ?, wrap_pw = ? WHERE id = ?').bind(salt, await sha256(salt + auth), wrapPw, userId),
      env.DB.prepare('DELETE FROM tokens WHERE user_id = ? AND hash != ?').bind(userId, tokenHash),
    ]);
    return { ok: true };
  },

  async logout(b, env, req) {
    const { tokenHash } = await signedIn(req, env);
    await env.DB.prepare('DELETE FROM tokens WHERE hash = ?').bind(tokenHash).run();
    return { ok: true };
  },

  async delete(b, env, req) {
    const { userId } = await signedIn(req, env);
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    await checkKey(env, u, 'auth', key32(b.auth, 'auth'));
    await env.DB.batch([
      env.DB.prepare('DELETE FROM records WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
    ]);
    return { ok: true };
  },
};

export default {
  async fetch(req, env) {
    const headers = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: headers['Access-Control-Allow-Origin'] ? 204 : 403, headers });
    try {
      const m = /^\/v1\/(\w+)$/.exec(new URL(req.url).pathname);
      if (req.method !== 'POST' || !m || !Object.hasOwn(routes, m[1])) throw new Fail(404, 'Not found.');
      if (Number(req.headers.get('Content-Length') || 0) > MAX_BODY) throw new Fail(413, 'Too large.');
      const text = await req.text();
      if (text.length > MAX_BODY) throw new Fail(413, 'Too large.');
      let body; try { body = JSON.parse(text || '{}'); } catch { throw new Fail(400, 'Bad JSON.'); }
      if (!body || typeof body !== 'object') throw new Fail(400, 'Bad JSON.');
      return json(await routes[m[1]](body, env, req), 200, headers);
    } catch (e) {
      if (e instanceof Fail) return json({ error: e.message }, e.status, headers);
      console.error(e);
      return json({ error: 'Something went wrong on the server.' }, 500, headers);
    }
  },
};
