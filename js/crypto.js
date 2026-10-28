// Passcode hashing and optional encrypted exports, using WebCrypto only.
const enc = new TextEncoder();
const dec = new TextDecoder();
export const PIN_ITERATIONS = 150000;
export const EXPORT_ITERATIONS = 310000;

export function b64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));

async function pbkdf2Bits(secret, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPin(pin, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : randomBytes(16);
  const bits = await pbkdf2Bits(pin, salt, PIN_ITERATIONS);
  return { salt: b64(salt), hash: b64(bits), iterations: PIN_ITERATIONS };
}

export async function checkPin(pin, rec) {
  if (!rec) return false;
  const bits = await pbkdf2Bits(pin, unb64(rec.salt), rec.iterations || PIN_ITERATIONS);
  return b64(bits) === rec.hash;
}

async function aesKey(pass, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(obj, pass) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = await aesKey(pass, salt, EXPORT_ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { app: 'goku', encrypted: true, cipher: 'AES-GCM-256', kdf: 'PBKDF2-SHA256',
    iterations: EXPORT_ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

export async function decryptJSON(wrapper, pass) {
  const key = await aesKey(pass, unb64(wrapper.salt), wrapper.iterations);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(wrapper.iv) }, key, unb64(wrapper.data));
  return JSON.parse(dec.decode(data));
}
