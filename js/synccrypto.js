// Sync encryption (zero-knowledge), WebCrypto only. Works in the browser and in Node (for tests).
//
// Password  --PBKDF2 (600,000 rounds, salted with the username)-->  master
// master    --HKDF "auth"-->  login key (the server keeps only a salted hash of it)
// master    --HKDF "wrap"-->  key that locks the data key
// Recovery key (random, shown once) gives its own login key and lock, the same way.
// Data key (random)  --HKDF-->  AES-GCM key for every record, and an HMAC key that turns entry ids into opaque ids.
// The server never sees the password, the recovery key, the data key or any entry.
const C = globalThis.crypto, te = new TextEncoder(), td = new TextDecoder();
export const KDF_ITER = 600000;

export const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
export const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = buf => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hkdf(raw, info, usage) {
  const base = await C.subtle.importKey('raw', raw, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const params = { name: 'HKDF', hash: 'SHA-256', salt: te.encode('goku-sync-v1'), info: te.encode(info) };
  if (usage === 'bits') return new Uint8Array(await C.subtle.deriveBits(params, base, 256));
  if (usage === 'hmac') return C.subtle.deriveKey(params, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  return C.subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const normUser = u => String(u || '').trim().toLowerCase();

// Password -> { auth, lock }. Slow on purpose (about a second on a phone).
export async function fromPassword(user, password, iter = KDF_ITER) {
  const base = await C.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  const master = new Uint8Array(await C.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode('goku-sync-v1|' + normUser(user)), iterations: iter }, base, 256));
  return { auth: b64(await hkdf(master, 'auth', 'bits')), lock: await hkdf(master, 'wrap') };
}

// Recovery key: 20 random bytes written as 32 letters and digits in groups of four (no 0/O or 1/I mix-ups).
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function newRecoveryKey() {
  const bytes = C.getRandomValues(new Uint8Array(20)); let bits = 0, val = 0, out = '';
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += ALPHA[(val >> (bits - 5)) & 31]; bits -= 5; } }
  return out.match(/.{4}/g).join('-');
}
export function parseRecoveryKey(text) {
  const s = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 32 || [...s].some(c => !ALPHA.includes(c))) return null;
  let bits = 0, val = 0; const out = [];
  for (const c of s) { val = (val << 5) | ALPHA.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export async function fromRecovery(bytes) { return { auth: b64(await hkdf(bytes, 'rec-auth', 'bits')), lock: await hkdf(bytes, 'rec-wrap') }; }

// The data key: made once per account, stored on the server only in locked form.
export const newDataKey = () => C.getRandomValues(new Uint8Array(32));
export async function lockKey(raw, lock) { const iv = C.getRandomValues(new Uint8Array(12)); return { iv: b64(iv), ct: b64(await C.subtle.encrypt({ name: 'AES-GCM', iv }, lock, raw)) }; }
export async function unlockKey(w, lock) { return new Uint8Array(await C.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, lock, unb64(w.ct))); }
export async function dataKeys(raw) { return { aes: await hkdf(raw, 'records'), ids: await hkdf(raw, 'ids', 'hmac') }; }

// An entry id like "abc:food:2026-11-16" becomes an opaque id, so the server can't see types or dates.
export async function rid(keys, id) { return b64url((await C.subtle.sign('HMAC', keys.ids, te.encode(id))).slice(0, 24)); }
export async function seal(keys, obj) {
  const iv = C.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await C.subtle.encrypt({ name: 'AES-GCM', iv }, keys.aes, te.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return b64(out);
}
export async function open(keys, blob) {
  const u = unb64(blob);
  return JSON.parse(td.decode(await C.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, keys.aes, u.subarray(12))));
}
