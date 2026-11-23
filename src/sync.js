// Two-way sync between this device and Google Drive / pCloud.
// Only encrypted records travel; merging is per record (newest edit wins), deletions travel as tombstones.
import { useSyncExternalStore } from 'react';
import * as V from './vault';
import { googleDrive, pcloud } from './cloud';
import { googleAccount } from './native';

let status = { running: false, gdrive: null, pcloud: null };
const ls = new Set();
const set = (patch) => {
  status = { ...status, ...patch };
  ls.forEach((l) => l());
};
export const useSyncStatus = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => status);

export async function targets(interactive = false) {
  const out = [];
  if (googleAccount()) out.push(googleDrive({ interactive }));
  const pc = await V.loadSecret('pcloud');
  if (pc) out.push(pcloud(pc));
  return out;
}

export async function readRemote(adapter) {
  const rv = await adapter.readVault();
  if (!rv) return null;
  const remote = JSON.parse(rv.text);
  return remote?.vault ? remote : null;
}

const sig = (o) =>
  JSON.stringify([o?.vault?.metaAt || 0, Object.keys(o?.tombs || {}).length, (o?.records || []).map((r) => r.id + ':' + r.updatedAt).sort()]);

export async function syncWith(adapter) {
  const local = await V.syncSnapshot();
  const rv = await adapter.readVault();
  const remote = rv ? JSON.parse(rv.text) : null;
  if (remote?.vault?.vid && local.vault?.vid && remote.vault.vid !== local.vault.vid) {
    throw Object.assign(new Error('VAULT_MISMATCH'), { code: 'VAULT_MISMATCH' });
  }

  const tombs = { ...(remote?.tombs || {}) };
  for (const [k, v] of Object.entries(local.tombs)) tombs[k] = Math.max(v, tombs[k] || 0);

  const map = new Map();
  for (const r of remote?.records || []) map.set(r.id, r);
  for (const r of local.records) {
    const cur = map.get(r.id);
    if (!cur || r.updatedAt >= cur.updatedAt) map.set(r.id, r);
  }
  for (const id of Object.keys(tombs)) map.delete(id);
  const merged = [...map.values()];

  const localById = new Map(local.records.map((r) => [r.id, r]));
  const put = merged.filter((r) => {
    const l = localById.get(r.id);
    return !l || l.updatedAt < r.updatedAt;
  });
  const del = local.records.filter((r) => tombs[r.id]).map((r) => r.id);
  let vault = local.vault;
  let newLocalVault = null;
  if (remote?.vault && (remote.vault.metaAt || 0) > (local.vault.metaAt || 0)) {
    vault = remote.vault;
    newLocalVault = remote.vault;
  }
  await V.applySync({ put, del, tombs, vault: newLocalVault });

  // images
  const needed = new Set(V.getState().items.flatMap((i) => (i.attachments || []).map((a) => a.id)));
  const remoteBlobs = await adapter.listBlobs();
  const localBlobs = new Set(await V.localBlobIds());
  for (const id of localBlobs) {
    if (tombs['b:' + id]) await V.dropLocalBlob(id);
    else if (needed.has(id) && !remoteBlobs.has(id)) await adapter.putBlob(id, await V.blobToText(id));
  }
  for (const [id, ref] of remoteBlobs) {
    if (tombs['b:' + id]) await adapter.deleteBlob(ref);
    else if (needed.has(id) && !localBlobs.has(id)) await V.blobFromText(id, await adapter.getBlob(ref));
  }

  const out = { v: 1, app: 'MHM NOTE', savedAt: Date.now(), vault, records: merged, tombs };
  if (!remote || sig(out) !== sig(remote)) await adapter.writeVault(JSON.stringify(out), rv?.ref);
}

let running = null;
let again = false;
export function syncNow(interactive = false) {
  if (!V.isUnlocked()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    set({ running: true });
    try {
      for (const a of await targets(interactive)) {
        try {
          await syncWith(a);
          set({ [a.id]: { at: Date.now(), error: null } });
        } catch (e) {
          console.warn('sync', a.id, e);
          set({ [a.id]: { at: status[a.id]?.at || 0, error: e.code || e.message || String(e) } });
        }
      }
    } finally {
      set({ running: false });
      running = null;
      if (again) {
        again = false;
        setTimeout(() => syncNow(), 500);
      }
    }
  })();
  return running;
}

let debounce;
export function syncSoon(ms = 2500) {
  clearTimeout(debounce);
  debounce = setTimeout(() => syncNow(), ms);
}
export function resetSyncStatus() {
  set({ running: false, gdrive: null, pcloud: null });
}

// ---------- manual backup file ----------
export async function buildBackup() {
  const snap = await V.syncSnapshot();
  const blobs = {};
  for (const id of await V.localBlobIds()) blobs[id] = await V.blobToText(id);
  return { v: 1, app: 'MHM NOTE', kind: 'backup', savedAt: Date.now(), vault: snap.vault, records: snap.records, tombs: snap.tombs, blobs };
}
export function parseBackup(text) {
  const o = JSON.parse(text);
  if (!o?.vault?.wrapped || !Array.isArray(o.records)) throw new Error('BAD_BACKUP');
  return o;
}
// in-memory adapter: lets the normal merge logic import a backup file
export function backupAdapter(obj) {
  return {
    id: 'file',
    readVault: async () => ({ text: JSON.stringify(obj), ref: null }),
    writeVault: async () => {},
    listBlobs: async () => new Map(Object.keys(obj.blobs || {}).map((k) => [k, k])),
    getBlob: async (ref) => obj.blobs[ref],
    putBlob: async () => {},
    deleteBlob: async () => {},
  };
}
export async function importBlobs(obj) {
  for (const [id, text] of Object.entries(obj.blobs || {})) if (text) await V.blobFromText(id, text);
}
