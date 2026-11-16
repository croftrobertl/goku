// End-to-end test of the sync server, run against `wrangler dev` (local database only).
// Uses the app's own encryption code (js/synccrypto.js), acting as two phones.
import * as K from '../js/synccrypto.js';
const BASE = process.env.SYNC_URL || 'http://127.0.0.1:8787', ORIGIN = 'http://127.0.0.1:8768';
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
ok((await call('delete', { auth: P3.auth }, C2)).status === 403, 'deleting needs the current password');
ok((await call('delete', { auth: P4.auth }, C2)).status === 200, 'the account can be deleted');
ok((await call('login', { user, auth: P4.auth })).status === 403, 'after deleting, nothing is left to sign in to');

// 8 junk is refused
ok((await call('sync', { since: 0, push: [{ rid: 'x', v: 1, blob: 'a' }] }, 'f'.repeat(64))).status === 401, 'a made-up token is refused');
ok((await call('nope', {})).status === 404 && (await call('signup', { user: 'A!', auth: 'x' })).status === 400, 'bad routes and bad usernames are refused');

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
