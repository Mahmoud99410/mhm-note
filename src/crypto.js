// MHM NOTE — encryption layer
// Master password --(Argon2id)--> KEK --wraps--> DEK (random AES-256 key)
// Recovery key   --(SHA-256)----> KEK2 --wraps--> same DEK
// Every record and attachment is encrypted with the DEK using AES-256-GCM.
import { argon2id } from 'hash-wasm';

const enc = new TextEncoder();
const dec = new TextDecoder();

export const ARGON = { iterations: 3, memorySize: 32768, parallelism: 1, hashLength: 32 };

export function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export function b64(bytes) {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) {
  const s = atob(str);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

async function importAes(raw, extractable = false) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
}

export async function deriveFromPassword(password, salt, params = ARGON) {
  const raw = await argon2id({
    password: password.normalize('NFC'),
    salt,
    iterations: params.iterations,
    memorySize: params.memorySize,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: 'binary',
  });
  return importAes(raw);
}

// Recovery key: 25 chars in 5 groups, from an alphabet without look-alike characters
const RK_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRecoveryKey() {
  const bytes = randomBytes(25);
  let out = '';
  for (let i = 0; i < 25; i++) {
    out += RK_ALPHA[bytes[i] % 32];
    if (i % 5 === 4 && i < 24) out += '-';
  }
  return out;
}
export function normalizeRecoveryKey(k) {
  return k.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export async function deriveFromRecovery(key, salt) {
  const data = new Uint8Array([...enc.encode(normalizeRecoveryKey(key)), ...salt]);
  const raw = await crypto.subtle.digest('SHA-256', data);
  return importAes(raw);
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv, ct: new Uint8Array(ct) };
}
export async function decryptBytes(key, iv, ct) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}

export async function encryptJSON(key, obj) {
  const { iv, ct } = await encryptBytes(key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}
export async function decryptJSON(key, box) {
  const pt = await decryptBytes(key, unb64(box.iv), unb64(box.ct));
  return JSON.parse(dec.decode(pt));
}

// Data-encryption key helpers
export async function newDEK() {
  const raw = randomBytes(32);
  const key = await importAes(raw, true);
  return { key, raw };
}
export async function wrapDEK(kek, raw) {
  const { iv, ct } = await encryptBytes(kek, raw);
  return { iv: b64(iv), ct: b64(ct) };
}
export async function unwrapDEK(kek, box) {
  const raw = await decryptBytes(kek, unb64(box.iv), unb64(box.ct)); // throws if wrong key
  return { key: await importAes(raw, true), raw };
}

// Small secondary locks (PIN / page password) for folders and pages
export async function hashSecret(secret, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : randomBytes(16);
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, base, 256);
  return { salt: b64(salt), hash: b64(new Uint8Array(bits)) };
}
export async function verifySecret(secret, lock) {
  const { hash } = await hashSecret(secret, lock.salt);
  return hash === lock.hash;
}
