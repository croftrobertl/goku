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

let dbp = null;
export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ev => {
      for (let v = ev.oldVersion; v < DB_VERSION; v++) MIGRATIONS[v](req.result, req.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close other Goku windows and try again.'));
  });
  return dbp;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name);
}

export const get = async (s, key) => wrap((await store(s)).get(key));
export const all = async s => wrap((await store(s)).getAll());
export const put = async (s, val) => wrap((await store(s, 'readwrite')).put(val));
export const del = async (s, key) => wrap((await store(s, 'readwrite')).delete(key));
export const byIndex = async (s, index, key) => wrap((await store(s)).index(index).getAll(key));

export async function putMany(s, vals) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(s, 'readwrite');
    const os = tx.objectStore(s);
    for (const v of vals) os.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProfileEntries(profileId) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    const idx = tx.objectStore('entries').index('profile');
    const req = idx.openKeyCursor(IDBKeyRange.only(profileId));
    req.onsuccess = () => {
      const c = req.result;
      if (c) { tx.objectStore('entries').delete(c.primaryKey); c.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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
