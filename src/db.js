// Tiny IndexedDB wrapper. Only encrypted boxes are stored here.
const DB_NAME = 'mhm-note';
const VERSION = 1;
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        Promise.resolve(fn(s)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  getMeta: (k) => tx('meta', 'readonly', (s) => reqP(s.get(k))),
  setMeta: (k, v) => tx('meta', 'readwrite', (s) => s.put(v, k)),
  allRecords: () => tx('records', 'readonly', (s) => reqP(s.getAll())),
  putRecord: (r) => tx('records', 'readwrite', (s) => s.put(r)),
  putRecords: (rs) => tx('records', 'readwrite', (s) => rs.forEach((r) => s.put(r))),
  deleteRecord: (id) => tx('records', 'readwrite', (s) => s.delete(id)),
  getBlob: (id) => tx('blobs', 'readonly', (s) => reqP(s.get(id))),
  putBlob: (b) => tx('blobs', 'readwrite', (s) => s.put(b)),
  deleteBlob: (id) => tx('blobs', 'readwrite', (s) => s.delete(id)),
};
