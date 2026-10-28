// Tiny IndexedDB wrapper. One database for the whole app; every record
// carries a profileId so profiles never mix.
export const DB_NAME = 'goku';
export const DB_VERSION = 1;

// Each entry in MIGRATIONS upgrades the schema from version i to i + 1.
const MIGRATIONS = [
  db => {
    db.createObjectStore('profiles', { keyPath: 'id' });
    const e = db.createObjectStore('entries', { keyPath: 'id' });
    e.createIndex('profile', 'profileId');
    e.createIndex('profileType', ['profileId', 'type']);
    e.createIndex('profileDay', ['profileId', 'day']);
    db.createObjectStore('meta', { keyPath: 'key' });
  },
];

// The connection is reopened if the browser closes it (WebKit can drop it while
// the app is in the background), and a failed open is never cached.
let dbp = null;
export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ev => {
      for (let v = ev.oldVersion; v < DB_VERSION; v++) MIGRATIONS[v](req.result, req.transaction);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbp = null; };
      db.onversionchange = () => { db.close(); dbp = null; };
      resolve(db);
    };
    req.onerror = () => { dbp = null; reject(req.error); };
    req.onblocked = () => { dbp = null; reject(new Error('Close other Goku windows and try again.')); };
  });
  return dbp;
}

// Runs fn(db) and, if the connection turned out to be dead, reopens once and retries.
async function withDb(fn) {
  try { return await fn(await open()); }
  catch (e) {
    if (e?.name !== 'InvalidStateError' && !/connection|closing|closed/i.test(e?.message || '')) throw e;
    dbp = null;
    return fn(await open());
  }
}

function run(db, stores, mode, body) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Save cancelled'));
    try { body(tx, v => { result = v; }); } catch (e) { try { tx.abort(); } catch { /* already finished */ } reject(e); }
  });
}

const req1 = (s, mode, op) => withDb(db => run(db, s, mode, (tx, set) => {
  const r = op(tx.objectStore(s)); r.onsuccess = () => set(r.result);
}));

export const get = (s, key) => req1(s, 'readonly', os => os.get(key));
export const all = s => req1(s, 'readonly', os => os.getAll());
export const put = (s, val) => req1(s, 'readwrite', os => os.put(val));
export const del = (s, key) => req1(s, 'readwrite', os => os.delete(key));
export const byIndex = (s, index, key) => req1(s, 'readonly', os => os.index(index).getAll(key));
export const byIndexRange = (s, index, lo, hi) => req1(s, 'readonly', os => os.index(index).getAll(IDBKeyRange.bound(lo, hi)));

export const putMany = (s, vals) => withDb(db => run(db, s, 'readwrite', tx => {
  const os = tx.objectStore(s);
  for (const v of vals) os.put(v);
}));

// Deletes a profile's entries and writes the new ones in ONE transaction:
// if any write fails, nothing is deleted.
export const replaceProfileEntries = (profileId, vals) => withDb(db => run(db, 'entries', 'readwrite', tx => {
  const os = tx.objectStore('entries');
  const cur = os.index('profile').openKeyCursor(IDBKeyRange.only(profileId));
  cur.onsuccess = () => {
    const c = cur.result;
    if (c) { os.delete(c.primaryKey); c.continue(); }
    else for (const v of vals) os.put(v);
  };
}));

// Removes a profile, all its entries and its meta keys, in one transaction.
export const deleteProfile = profileId => withDb(db => run(db, ['profiles', 'entries', 'meta'], 'readwrite', tx => {
  tx.objectStore('profiles').delete(profileId);
  const os = tx.objectStore('entries');
  const cur = os.index('profile').openKeyCursor(IDBKeyRange.only(profileId));
  cur.onsuccess = () => { const c = cur.result; if (c) { os.delete(c.primaryKey); c.continue(); } };
  for (const k of ['run:', 'seeded:']) tx.objectStore('meta').delete(k + profileId);
}));

export const getMeta = async key => (await get('meta', key))?.value;
export const setMeta = (key, value) => put('meta', { key, value });

export async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist();
    return true;
  } catch { return false; }
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() :
  Date.now().toString(36) + Math.random().toString(36).slice(2));
