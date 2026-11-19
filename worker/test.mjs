// End-to-end test of the sync server, run against `wrangler dev` (local database only).
// Uses the app's own encryption code (js/synccrypto.js), acting as two phones.
import * as K from '../js/synccrypto.js';
const BASE = process.env.SYNC_URL || 'http://127.0.0.1:8787', ORIGIN = process.env.SYNC_ORIGIN || 'http://127.0.0.1:8768';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', m); };
async function call(path, body, token, origin = ORIGIN) {
  const r = await fetch(BASE + '/v1/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null), allow: r.headers.get('Access-Control-Allow-Origin') };
}
const ITER = 300000; // the server's minimum, to keep the test quick
const user = 'test' + Date.now().toString(36), pw = 'correct horse battery', rk = K.newRecoveryKey();

// 1 sign up (phone A)
const P = await K.fromPassword(user, pw, ITER), R = await K.fromRecovery(K.parseRecoveryKey(rk)), raw = K.newDataKey(), keys = await K.dataKeys(raw);
const up = await call('signup', { user, auth: P.auth, recAuth: R.auth, wrapPw: await K.lockKey(raw, P.lock), wrapRec: await K.lockKey(raw, R.lock), kdf: { iter: ITER } });
ok(up.status === 200 && /^[0-9a-f]{64}$/.test(up.body?.token), 'sign up gives a token');
ok(up.allow === ORIGIN, 'the app is allowed to call it (CORS)');
const A = up.body.token;
ok((await call('signup', { user, auth: P.auth, recAuth: R.auth, wrapPw: await K.lockKey(raw, P.lock), wrapRec: await K.lockKey(raw, R.lock), kdf: { iter: ITER } })).status === 409, 'the same username can\'t be taken twice');
ok((await call('login', { user, auth: P.auth }, null, 'https://evil.example')).allow === null, 'another website is not allowed (CORS)');

// 2 phone A pushes three entries
const entries = [{ id: 'p1:food:2026-11-16', updatedAt: 1000, data: { kcal: 1250 } }, { id: 'p1:weigh:2026-11-16', updatedAt: 1000, data: { lb: 181.4 } }, { id: 'profile', updatedAt: 1000, data: { name: 'Rob' } }];
const push = await Promise.all(entries.map(async e => ({ rid: await K.rid(keys, e.id), v: e.updatedAt, del: false, blob: await K.seal(keys, e) })));
const s1 = await call('sync', { since: 0, push }, A);
ok(s1.status === 200 && s1.body.pull.length === 3, 'phone A uploads 3 entries');
ok(!JSON.stringify(s1.body).includes('food') && !JSON.stringify(s1.body).includes('1250') && !JSON.stringify(s1.body).includes('Rob'), 'the server holds no readable ids, numbers or names');

// 3 phone B signs in with the password and reads everything
const P2 = await K.fromPassword(user.toUpperCase(), pw, ITER); // usernames ignore case
const lg = await call('login', { user, auth: P2.auth });
ok(lg.status === 200, 'phone B signs in');
const keysB = await K.dataKeys(await K.unlockKey(lg.body.wrapPw, P2.lock)), B = lg.body.token;
const sB = await call('sync', { since: 0, push: [] }, B);
const got = await Promise.all(sB.body.pull.map(r => K.open(keysB, r.blob)));
ok(got.length === 3 && got.find(e => e.id === 'p1:food:2026-11-16')?.data.kcal === 1250, 'phone B decrypts the same entries');
const seqB = Math.max(...sB.body.pull.map(r => r.seq));

// 4 an older copy never replaces a newer one; a newer one does; a deletion travels
const ridFood = await K.rid(keys, 'p1:food:2026-11-16');
await call('sync', { since: seqB, push: [{ rid: ridFood, v: 2000, del: false, blob: await K.seal(keys, { ...entries[0], updatedAt: 2000, data: { kcal: 1300 } }) }] }, A);
await call('sync', { since: seqB, push: [{ rid: ridFood, v: 1500, del: false, blob: await K.seal(keysB, { ...entries[0], updatedAt: 1500, data: { kcal: 999 } }) }] }, B);
const s4 = await call('sync', { since: seqB, push: [] }, B);
const food = s4.body.pull.find(r => r.rid === ridFood);
ok(food && (await K.open(keysB, food.blob)).data.kcal === 1300, 'the newest edit wins (1,300 kept, the older 999 ignored)');
const ridW = await K.rid(keys, 'p1:weigh:2026-11-16');
await call('sync', { since: 0, push: [{ rid: ridW, v: 3000, del: true, blob: await K.seal(keys, { id: 'p1:weigh:2026-11-16', updatedAt: 3000, deleted: true }) }] }, A);
const s5 = await call('sync', { since: 0, push: [] }, B);
ok(s5.body.pull.find(r => r.rid === ridW)?.del === true, 'a deletion reaches the other phone');

// 5 wrong password, lockout after 10 tries
const bad = await K.fromPassword(user, 'wrong password', ITER);
ok((await call('login', { user, auth: bad.auth })).status === 403, 'a wrong password is refused');
ok((await call('login', { user: 'nobody' + Date.now(), auth: bad.auth })).body.error === 'Wrong username or password.', 'an unknown user gets the same message (no guessing usernames)');
for (let i = 0; i < 9; i++) await call('login', { user, auth: bad.auth });
const locked = await call('login', { user, auth: P.auth });
ok(locked.status === 429, 'after 10 wrong tries even the right password waits 15 minutes');

// 6 recovery key resets the password (works while locked out? no: recovery has its own lock count)
const r1 = await call('recover', { user, recAuth: R.auth });
ok(r1.status === 200, 'the recovery key is accepted');
const rawR = await K.unlockKey(r1.body.wrapRec, R.lock);
ok(K.b64(rawR) === K.b64(raw), 'the recovery key unlocks the same data key');
const P3 = await K.fromPassword(user, 'brand new password', ITER);
const r2 = await call('recover', { user, recAuth: R.auth, auth: P3.auth, wrapPw: await K.lockKey(rawR, P3.lock) });
ok(r2.status === 200 && r2.body.token, 'a new password is set with the recovery key');
ok((await call('sync', { since: 0, push: [] }, A)).status === 401, 'other phones are signed out after a reset');
const C2 = r2.body.token;
ok((await call('login', { user, auth: P3.auth })).status === 200, 'the new password signs in');
ok(K.parseRecoveryKey(rk.toLowerCase().replace(/-/g, ' ')) !== null && K.parseRecoveryKey('ABCD') === null, 'recovery keys can be typed in any case, with or without dashes');

// 7 change password keeps this phone signed in, then delete the account
const P4 = await K.fromPassword(user, 'fourth password!', ITER);
ok((await call('password', { auth: P3.auth, newAuth: P4.auth, wrapPw: await K.lockKey(rawR, P4.lock) }, C2)).status === 200, 'password change works');
ok((await call('sync', { since: 0, push: [] }, C2)).status === 200, 'this phone stays signed in after changing the password');
// 7b backup history: encrypted copies in R2
const file = (path, headers, body, token) => fetch(BASE + '/v1/' + path, { method: 'POST', headers: { Origin: ORIGIN, Authorization: 'Bearer ' + token, ...headers }, body });
const keysC = await K.dataKeys(rawR), day = new Date().toISOString().slice(0, 10);
const copy = { app: 'goku', profile: { name: 'Rob' }, entries: [{ id: 'p1:food:2026-11-16', data: { kcal: 1250 } }] };
const put = (d, pre, token = C2, body) => K.sealFile(keysC, copy).then(async b => file('snapput', { 'Content-Type': 'application/octet-stream', 'X-Snap-Day': d, 'X-Snap-Meta': await K.seal(keysC, { n: 1 }), ...(pre ? { 'X-Snap-Pre': '1' } : {}) }, body || b, token));
ok((await put(day)).status === 200 && (await put(day)).status === 200, 'a backup copy is stored (and the same day can be sent again)');
let hist = (await call('snaps', {}, C2)).body.snaps;
ok(hist.length === 1 && hist[0].id === day && !hist[0].pre && (await K.open(keysC, hist[0].meta)).n === 1, 'the list shows one copy for the day, with its locked label');
const got1 = await file('snapget', { 'Content-Type': 'application/json' }, JSON.stringify({ id: day }), C2), bytes1 = new Uint8Array(await got1.arrayBuffer());
ok(got1.status === 200 && (await K.openFile(keysC, bytes1)).entries[0].data.kcal === 1250, 'the copy comes back and opens with the data key');
ok(!new TextDecoder().decode(bytes1).includes('Rob') && !new TextDecoder().decode(bytes1).includes('kcal'), 'the stored copy holds nothing readable');
ok((await put('2026-01-01')).status === 400 && (await put('nonsense')).status === 400, 'a copy for a made-up day is refused');
ok((await put(day, false, 'f'.repeat(64))).status === 401, 'a copy needs a signed-in phone');
ok((await put(day, false, C2, new Uint8Array(8 * 1024 * 1024 + 1))).status === 413, 'a copy over 8 MB is refused');
for (let i = 0; i < 7; i++) await put(day, true);
hist = (await call('snaps', {}, C2)).body.snaps;
ok(hist.filter(s => s.pre).length === 5 && hist.filter(s => !s.pre).length === 1, 'only the newest 5 "before a restore" copies are kept');
ok((await file('snapget', { 'Content-Type': 'application/json' }, JSON.stringify({ id: '../../x' }), C2)).status === 400, 'a copy id can\'t reach outside the account');
// a second account can't see the first one's copies
const u2 = 'other' + Date.now().toString(36), Q = await K.fromPassword(u2, pw, ITER), raw2 = K.newDataKey();
const T2 = (await call('signup', { user: u2, auth: Q.auth, recAuth: R.auth, wrapPw: await K.lockKey(raw2, Q.lock), wrapRec: await K.lockKey(raw2, R.lock), kdf: { iter: ITER } })).body.token;
ok((await call('snaps', {}, T2)).body.snaps.length === 0 && (await file('snapget', { 'Content-Type': 'application/json' }, JSON.stringify({ id: day }), T2)).status === 404, 'another account sees none of them');
await call('delete', { auth: Q.auth }, T2);

ok((await call('delete', { auth: P3.auth }, C2)).status === 403, 'deleting needs the current password');
ok((await call('delete', { auth: P4.auth }, C2)).status === 200, 'the account can be deleted');
ok((await call('login', { user, auth: P4.auth })).status === 403, 'after deleting, nothing is left to sign in to');
// the copies went with the account: a new account with the same number of none; check the bucket through a fresh sign-up of the same name
const again = (await call('signup', { user, auth: P4.auth, recAuth: R.auth, wrapPw: await K.lockKey(rawR, P4.lock), wrapRec: await K.lockKey(rawR, R.lock), kdf: { iter: ITER } })).body.token;
ok((await call('snaps', {}, again)).body.snaps.length === 0, 'deleting the account deleted its backup copies');
await call('delete', { auth: P4.auth }, again);

// 8 junk is refused
ok((await call('sync', { since: 0, push: [{ rid: 'x', v: 1, blob: 'a' }] }, 'f'.repeat(64))).status === 401, 'a made-up token is refused');
ok((await call('nope', {})).status === 404 && (await call('signup', { user: 'A!', auth: 'x' })).status === 400, 'bad routes and bad usernames are refused');

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
