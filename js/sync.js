// Cloud sync (2.24): one account per profile, zero-knowledge, automatic once signed in.
// Off until someone signs in: with no account linked, this file makes no network requests at all.
//
// Each phone keeps a link per profile in meta "sync:<profileId>":
//   { user, token, key (the data key), since (last change number seen), known: { entryId: updatedAt }, profileHash, lastAt, error }
// "known" is what this phone and the server last agreed on, so changes are found by comparing, with no hooks:
//   an entry whose updatedAt differs is sent; an id in "known" that's gone from the phone is sent as deleted.
// The newest edit wins (by updatedAt). The server can't read anything; see synccrypto.js.
import * as db from './db.js';
import * as K from './synccrypto.js';
import { S, newProfile } from './state.js';

const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
export const SYNC_URL = LOCAL ? 'http://127.0.0.1:8787' : 'https://goku-sync.croftrobertl.workers.dev';
const PROFILE_ID = '~profile'; // the profile's own settings travel as one record under this id
const MAX_BATCH = 150, MAX_BATCH_BYTES = 900 * 1024;
const linkKey = pid => 'sync:' + pid;

export class SyncError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
async function call(path, body, token) {
  let r;
  try {
    r = await fetch(SYNC_URL + '/v1/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), cache: 'no-store' });
  } catch { throw new SyncError('No connection. Your data is safe on this phone and will sync later.', 0); }
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new SyncError(out.error || 'The sync server had a problem. Try again later.', r.status);
  return out;
}

export const getLink = pid => db.getMeta(linkKey(pid));
const setLink = (pid, link) => db.setMeta(linkKey(pid), link);
export const isLinked = async pid => !!(await getLink(pid))?.token;

// What of a profile travels: everything except this phone's passcode lock.
const shareable = p => { const { lock, updatedAt, ...rest } = p; return rest; };
const hashOf = async obj => K.b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(obj))));
const entryOut = e => ({ id: e.id, type: e.type, day: e.day, ts: e.ts, updatedAt: e.updatedAt, data: e.data });

// ---------- Account ----------
// New account for this profile: uploads everything on it. Resolves with the recovery key to show once.
export async function signUp(p, user, password) {
  user = K.normUser(user);
  const recovery = K.newRecoveryKey(), raw = K.newDataKey();
  const P = await K.fromPassword(user, password), R = await K.fromRecovery(K.parseRecoveryKey(recovery));
  const { token } = await call('signup', { user, auth: P.auth, recAuth: R.auth, wrapPw: await K.lockKey(raw, P.lock), wrapRec: await K.lockKey(raw, R.lock), kdf: { iter: K.KDF_ITER } });
  await setLink(p.id, { user, token, key: K.b64(raw), since: 0, known: {}, profileHash: '', lastAt: 0, error: '' });
  syncSoon(p.id, 0);
  return recovery;
}

// Signs in to an existing account and brings its profile onto this phone (new, or the same profile if it's already here).
// Resolves with the profile id. The caller sets a passcode for it if the phone needs one.
export async function signIn(user, password, { recovery = null, newPassword = null } = {}) {
  user = K.normUser(user);
  let token, raw;
  if (recovery) { // forgot the password: the recovery key unlocks the data key, then a new password is set
    const bytes = K.parseRecoveryKey(recovery); if (!bytes) throw new SyncError('That recovery key is not complete. It has 32 letters and numbers.', 400);
    const R = await K.fromRecovery(bytes), r1 = await call('recover', { user, recAuth: R.auth });
    raw = await K.unlockKey(r1.wrapRec, R.lock);
    const P = await K.fromPassword(user, newPassword, r1.kdf.iter);
    ({ token } = await call('recover', { user, recAuth: R.auth, auth: P.auth, wrapPw: await K.lockKey(raw, P.lock) }));
  } else {
    const P = await K.fromPassword(user, password), r = await call('login', { user, auth: P.auth });
    raw = await K.unlockKey(r.wrapPw, P.lock); token = r.token;
  }
  const keys = await K.dataKeys(raw), profRid = await K.rid(keys, PROFILE_ID);
  let prof = null, since = 0, more = true;
  while (!prof && more) { // page through until the profile's own record turns up
    const res = await call('sync', { since, push: [] }, token);
    const hit = res.pull.find(x => x.rid === profRid && !x.del);
    if (hit) prof = await K.open(keys, hit.blob);
    since = Math.max(since, ...res.pull.map(x => x.seq)); more = res.more;
  }
  if (!prof) throw new SyncError('This account has no profile yet. Sign in on the phone that made it and let it sync first.', 404);
  const pid = prof.profile.id, existing = S.profiles.find(x => x.id === pid);
  if (!existing) {
    const fresh = newProfile(prof.profile.kind, prof.profile.name);
    const p = { ...fresh, ...prof.profile, id: pid, lock: fresh.lock, updatedAt: prof.updatedAt };
    await db.put('profiles', p); S.profiles.push(p);
  }
  await setLink(pid, { user, token, key: K.b64(raw), since: 0, known: {}, profileHash: '', lastAt: 0, error: '' });
  await syncNow(pid);
  return pid;
}

export async function changePassword(pid, oldPassword, newPassword) {
  const link = await getLink(pid), raw = K.unb64(link.key);
  const O = await K.fromPassword(link.user, oldPassword), N = await K.fromPassword(link.user, newPassword);
  await call('password', { auth: O.auth, newAuth: N.auth, wrapPw: await K.lockKey(raw, N.lock) }, link.token);
}
// Stops syncing on this phone. Nothing is deleted, here or in the cloud.
export async function signOut(pid) {
  const link = await getLink(pid); if (!link) return;
  await call('logout', {}, link.token).catch(() => {}); // signed out locally even when offline
  await db.setMeta(linkKey(pid), null);
}
// Erases the cloud copy for good. This phone keeps its data.
export async function deleteAccount(pid, password) {
  const link = await getLink(pid), P = await K.fromPassword(link.user, password);
  await call('delete', { auth: P.auth }, link.token);
  await db.setMeta(linkKey(pid), null);
}

// ---------- Syncing ----------
const running = new Map();
export function syncNow(pid) {
  if (running.has(pid)) return running.get(pid).then(() => syncNow(pid)); // one at a time; changes made meanwhile get the next run
  const job = run(pid).finally(() => running.delete(pid));
  running.set(pid, job); return job;
}

let applying = false; // while writing what came from the cloud, those writes don't schedule another sync
async function run(pid) {
  const link = await getLink(pid); if (!link?.token) return;
  const p = S.profiles.find(x => x.id === pid); if (!p) return;
  const keys = await K.dataKeys(K.unb64(link.key));
  try {
    // 1 what changed here since the last agreement
    const local = await db.byIndex('entries', 'profile', pid), byId = new Map(local.map(e => [e.id, e]));
    const out = [];
    for (const e of local) if (link.known[e.id] !== e.updatedAt) out.push(entryOut(e));
    const now = Date.now();
    for (const id of Object.keys(link.known)) if (!byId.has(id)) out.push({ id, updatedAt: Math.max(now, link.known[id] + 1), deleted: true });
    const shared = shareable(p), hash = await hashOf(shared);
    if (hash !== link.profileHash) out.push({ id: PROFILE_ID, updatedAt: p.updatedAt || now, profile: shared });
    // 2 send in batches; every reply also brings what other phones changed
    let i = 0, more = true, got = 0;
    while (i < out.length || more) {
      const batch = []; let bytes = 0;
      while (i < out.length && batch.length < MAX_BATCH && bytes < MAX_BATCH_BYTES) {
        const o = out[i++], blob = await K.seal(keys, o); bytes += blob.length;
        batch.push({ rid: await K.rid(keys, o.id), v: o.updatedAt, del: !!o.deleted, blob, _o: o });
      }
      const res = await call('sync', { since: link.since, push: batch.map(({ _o, ...x }) => x) }, link.token);
      for (const b of batch) { const o = b._o; if (o.id === PROFILE_ID) link.profileHash = hash; else if (o.deleted) delete link.known[o.id]; else link.known[o.id] = o.updatedAt; }
      got += await apply(pid, keys, link, res.pull);
      more = res.more;
    }
    link.lastAt = Date.now(); link.error = '';
    if (got) window.goku?.render?.(); // only when another phone's changes arrived, so typing isn't interrupted
  } catch (e) {
    link.error = e instanceof SyncError ? e.message : 'Sync stopped: ' + (e.message || 'unknown problem');
    if (e.status === 401) link.token = ''; // signed out elsewhere (password reset): sign in again
  }
  await setLink(pid, link);
  dispatchEvent(new CustomEvent('goku-sync', { detail: { pid, error: link.error, lastAt: link.lastAt } })); // for a status line on screen
}

// Writes what came from the cloud, keeping whichever copy was edited last.
async function apply(pid, keys, link, pull) {
  applying = true; let n = 0;
  try {
    for (const x of pull) {
      link.since = Math.max(link.since, x.seq);
      const o = await K.open(keys, x.blob).catch(() => null); if (!o || typeof o.id !== 'string') continue;
      if (o.id === PROFILE_ID) {
        const p = S.profiles.find(q => q.id === pid);
        if (p && (o.updatedAt || 0) > (p.updatedAt || 0)) {
          const next = { ...p, ...o.profile, id: pid, lock: p.lock, updatedAt: o.updatedAt };
          await db.put('profiles', next); S.profiles[S.profiles.indexOf(p)] = next;
          link.profileHash = await hashOf(shareable(next)); n++;
        }
        continue;
      }
      const mine = await db.get('entries', o.id);
      if (o.deleted) {
        if (mine && mine.updatedAt <= o.updatedAt) { await db.del('entries', o.id); n++; }
        if (!mine || mine.updatedAt <= o.updatedAt) delete link.known[o.id];
      } else if (!mine || mine.updatedAt < o.updatedAt) {
        await db.put('entries', { ...entryOut(o), profileId: pid });
        link.known[o.id] = o.updatedAt; n++;
      } else if (mine.updatedAt === o.updatedAt) link.known[o.id] = o.updatedAt;
      // a newer copy here stays, and goes up on the next run
    }
  } finally { applying = false; }
  return n;
}

// ---------- When to sync ----------
const timers = new Map();
export function syncSoon(pid, ms = 4000) {
  clearTimeout(timers.get(pid));
  timers.set(pid, setTimeout(() => { timers.delete(pid); syncNow(pid); }, ms));
}
// On start: sync every linked profile now, the open one again a few seconds after each change, and when the phone comes back online.
export async function startSync() {
  const linked = [];
  for (const p of S.profiles) if (await isLinked(p.id)) linked.push(p.id);
  db.onChange(() => { if (!applying && S.current) isLinked(S.current).then(on => on && syncSoon(S.current)); });
  addEventListener('online', () => { if (S.current) isLinked(S.current).then(on => on && syncSoon(S.current, 500)); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.current) isLinked(S.current).then(on => on && syncSoon(S.current, 500)); });
  for (const pid of linked) syncSoon(pid, 300);
}
