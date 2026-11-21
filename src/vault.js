// Vault: session key, decrypted in-memory state, encrypted persistence.
import { useSyncExternalStore } from 'react';
import { db } from './db';
import * as C from './crypto';

const TRASH_DAYS = 30;
let DEK = null;
let state = { folders: [], items: [], ready: false };
const listeners = new Set();
const pending = new Map();
const urlCache = new Map();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
export function useVault() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state
  );
}
export const getState = () => state;
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : C.b64(C.randomBytes(16)).replace(/[+/=]/g, ''));

// ---------- vault lifecycle ----------
export async function vaultExists() {
  return !!(await db.getMeta('vault'));
}

export async function createVault(password, seed) {
  const salt = C.randomBytes(16);
  const rsalt = C.randomBytes(16);
  const kek = await C.deriveFromPassword(password, salt);
  const { key, raw } = await C.newDEK();
  const recoveryKey = C.newRecoveryKey();
  const rkek = await C.deriveFromRecovery(recoveryKey, rsalt);
  await db.setMeta('vault', {
    v: 1,
    argon: C.ARGON,
    salt: C.b64(salt),
    wrapped: await C.wrapDEK(kek, raw),
    rsalt: C.b64(rsalt),
    rwrapped: await C.wrapDEK(rkek, raw),
    createdAt: Date.now(),
  });
  DEK = key;
  state = { folders: [], items: [], ready: true };
  if (seed) for (const f of seed) await saveFolder(f, true);
  await flush();
  emit();
  return recoveryKey;
}

export async function unlock(password) {
  const v = await db.getMeta('vault');
  const kek = await C.deriveFromPassword(password, C.unb64(v.salt), v.argon);
  try {
    DEK = (await C.unwrapDEK(kek, v.wrapped)).key;
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
  await loadAll();
}

export async function recover(recoveryKey, newPassword) {
  const v = await db.getMeta('vault');
  const rkek = await C.deriveFromRecovery(recoveryKey, C.unb64(v.rsalt));
  let raw;
  try {
    ({ raw } = await C.unwrapDEK(rkek, v.rwrapped));
  } catch {
    throw new Error('WRONG_KEY');
  }
  const salt = C.randomBytes(16);
  const kek = await C.deriveFromPassword(newPassword, salt);
  await db.setMeta('vault', { ...v, argon: C.ARGON, salt: C.b64(salt), wrapped: await C.wrapDEK(kek, raw) });
  await unlock(newPassword);
}

export async function changePassword(oldPw, newPw) {
  const v = await db.getMeta('vault');
  const oldKek = await C.deriveFromPassword(oldPw, C.unb64(v.salt), v.argon);
  let raw;
  try {
    ({ raw } = await C.unwrapDEK(oldKek, v.wrapped));
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
  const salt = C.randomBytes(16);
  const kek = await C.deriveFromPassword(newPw, salt);
  await db.setMeta('vault', { ...v, argon: C.ARGON, salt: C.b64(salt), wrapped: await C.wrapDEK(kek, raw) });
}

export async function newRecoveryKey(password) {
  const v = await db.getMeta('vault');
  const kek = await C.deriveFromPassword(password, C.unb64(v.salt), v.argon);
  let raw;
  try {
    ({ raw } = await C.unwrapDEK(kek, v.wrapped));
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
  const recoveryKey = C.newRecoveryKey();
  const rsalt = C.randomBytes(16);
  const rkek = await C.deriveFromRecovery(recoveryKey, rsalt);
  await db.setMeta('vault', { ...v, rsalt: C.b64(rsalt), rwrapped: await C.wrapDEK(rkek, raw) });
  return recoveryKey;
}

export async function lock() {
  await flush();
  DEK = null;
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  state = { folders: [], items: [], ready: false };
  emit();
}
export const isUnlocked = () => !!DEK;

async function loadAll() {
  const recs = await db.allRecords();
  const folders = [];
  const items = [];
  for (const r of recs) {
    try {
      const obj = await C.decryptJSON(DEK, r);
      (r.kind === 'folder' ? folders : items).push(obj);
    } catch (e) {
      console.warn('Could not decrypt record', r.id, e);
    }
  }
  state = { folders, items, ready: true };
  await purgeTrash();
  emit();
}

// ---------- persistence ----------
async function persist(obj, kind) {
  const box = await C.encryptJSON(DEK, obj);
  await db.putRecord({ id: obj.id, kind, updatedAt: obj.updatedAt, ...box });
}
function schedule(obj, kind, now) {
  clearTimeout(pending.get(obj.id)?.t);
  if (now) {
    pending.delete(obj.id);
    return persist(obj, kind);
  }
  const t = setTimeout(() => {
    pending.delete(obj.id);
    persist(obj, kind);
  }, 400);
  pending.set(obj.id, { t, obj, kind });
}
export async function flush() {
  const jobs = [...pending.values()];
  pending.clear();
  for (const j of jobs) {
    clearTimeout(j.t);
    await persist(j.obj, j.kind);
  }
}

export function saveFolder(f, now = false) {
  const obj = { ...f, updatedAt: Date.now() };
  const i = state.folders.findIndex((x) => x.id === f.id);
  state.folders = i < 0 ? [...state.folders, obj] : state.folders.map((x) => (x.id === f.id ? obj : x));
  emit();
  return schedule(obj, 'folder', now);
}
export function saveItem(it, now = false) {
  const obj = { ...it, updatedAt: Date.now() };
  const i = state.items.findIndex((x) => x.id === it.id);
  state.items = i < 0 ? [obj, ...state.items] : state.items.map((x) => (x.id === it.id ? obj : x));
  emit();
  return schedule(obj, 'item', now);
}

async function destroyItem(it) {
  for (const a of it.attachments || []) await db.deleteBlob(a.id);
  await db.deleteRecord(it.id);
}
export async function deleteForever(id) {
  const it = state.items.find((x) => x.id === id);
  const f = state.folders.find((x) => x.id === id);
  if (it) {
    await destroyItem(it);
    state.items = state.items.filter((x) => x.id !== id);
  }
  if (f) {
    for (const child of state.items.filter((x) => x.folderId === id)) await destroyItem(child);
    state.items = state.items.filter((x) => x.folderId !== id);
    await db.deleteRecord(id);
    state.folders = state.folders.filter((x) => x.id !== id);
  }
  emit();
}
export async function emptyTrash() {
  for (const f of state.folders.filter((x) => x.deletedAt)) await deleteForever(f.id);
  for (const it of state.items.filter((x) => x.deletedAt)) await deleteForever(it.id);
}
async function purgeTrash() {
  const limit = Date.now() - TRASH_DAYS * 864e5;
  for (const f of state.folders.filter((x) => x.deletedAt && x.deletedAt < limit)) await deleteForever(f.id);
  for (const it of state.items.filter((x) => x.deletedAt && x.deletedAt < limit)) await deleteForever(it.id);
}
export const TRASH_KEEP_DAYS = TRASH_DAYS;

// ---------- encrypted image attachments ----------
async function compressImage(file, maxSide = 2000) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function addImage(file) {
  const { bytes, w, h } = await compressImage(file);
  const id = uid();
  const { iv, ct } = await C.encryptBytes(DEK, bytes);
  await db.putBlob({ id, iv, ct });
  return { id, name: file.name || 'image.jpg', w, h, size: bytes.length, type: 'image/jpeg' };
}
export async function imageURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await db.getBlob(id);
  if (!b) return null;
  const bytes = await C.decryptBytes(DEK, b.iv, b.ct);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  urlCache.set(id, url);
  return url;
}
export async function removeImage(id) {
  await db.deleteBlob(id);
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
}

// ---------- secondary locks ----------
const opened = new Set();
export const isOpened = (id) => opened.has(id);
export const markOpened = (id) => opened.add(id);
export const clearOpened = () => opened.clear();
export { hashSecret, verifySecret } from './crypto';
