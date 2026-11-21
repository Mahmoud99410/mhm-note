// Cloud storage adapters. Each stores one encrypted vault file plus one file per encrypted image.
import { http, googleToken, dropGoogleToken } from './native';
import { DRIVE_FOLDER, PCLOUD_FOLDER } from './config';

const VAULT_FILE = 'mhm-vault.json';
const BLOB_PREFIX = 'blob-';
const enc = encodeURIComponent;

async function json(res, what) {
  let data = null;
  try {
    data = res.text ? JSON.parse(res.text) : null;
  } catch {}
  if (res.status === 401) throw Object.assign(new Error('AUTH'), { code: 'AUTH' });
  if (res.status >= 400) throw new Error(`${what} ${res.status} ${res.text?.slice(0, 200)}`);
  return data;
}

// ---------------- Google Drive (visible folder "MHM NOTE", drive.file scope) ----------------
export function googleDrive({ interactive = false } = {}) {
  const API = 'https://www.googleapis.com/drive/v3';
  const UP = 'https://www.googleapis.com/upload/drive/v3';
  let folderId = null;
  const call = async (url, opts = {}, what = 'drive', retry = true) => {
    const token = await googleToken(interactive);
    const res = await http(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
    if (res.status === 401 && retry) {
      dropGoogleToken();
      return call(url, opts, what, false);
    }
    return res;
  };
  const list = async (q) => {
    const out = [];
    let page = '';
    do {
      const r = await json(await call(`${API}/files?q=${enc(q)}&fields=${enc('nextPageToken,files(id,name)')}&pageSize=1000${page ? '&pageToken=' + enc(page) : ''}`), 'list');
      out.push(...(r.files || []));
      page = r.nextPageToken;
    } while (page);
    return out;
  };
  const folder = async () => {
    if (folderId) return folderId;
    const f = await list(`name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    if (f[0]) return (folderId = f[0].id);
    const r = await json(
      await call(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
      }),
      'mkdir'
    );
    return (folderId = r.id);
  };
  const create = async (name, text) => {
    const boundary = 'mhm' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name, parents: [await folder()] });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
    return json(await call(`${UP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }), 'upload');
  };
  return {
    id: 'gdrive',
    async readVault() {
      const f = (await list(`'${await folder()}' in parents and name='${VAULT_FILE}' and trashed=false`))[0];
      if (!f) return null;
      const r = await call(`${API}/files/${f.id}?alt=media`);
      if (r.status >= 400) await json(r, 'read');
      return { text: r.text, ref: f.id };
    },
    async writeVault(text, ref) {
      if (ref) return json(await call(`${UP}/files/${ref}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'text/plain; charset=UTF-8' }, body: text }), 'write');
      return create(VAULT_FILE, text);
    },
    async listBlobs() {
      const files = await list(`'${await folder()}' in parents and name contains '${BLOB_PREFIX}' and trashed=false`);
      return new Map(files.map((f) => [f.name.slice(BLOB_PREFIX.length), f.id]));
    },
    async getBlob(ref) {
      const r = await call(`${API}/files/${ref}?alt=media`);
      if (r.status >= 400) await json(r, 'blob');
      return r.text;
    },
    putBlob: (id, text) => create(BLOB_PREFIX + id, text),
    async deleteBlob(ref) {
      await call(`${API}/files/${ref}`, { method: 'DELETE' });
    },
  };
}

// ---------------- pCloud ----------------
const PC_HOSTS = ['https://api.pcloud.com', 'https://eapi.pcloud.com'];

// Exchanges email + password for a long-lived auth token. The password itself is never stored.
export async function pcloudLogin(email, password) {
  let last = null;
  for (const host of PC_HOSTS) {
    const body = `getauth=1&logout=1&device=${enc('MHM NOTE')}&username=${enc(email)}&password=${enc(password)}`;
    let d;
    try {
      const r = await http(`${host}/userinfo`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      d = await json(r, 'pcloud');
    } catch (e) {
      last = { error: 'network: ' + (e.message || e), result: 'NET' };
      continue;
    }
    if (d?.result === 0 && d.auth) return { host, auth: d.auth, email: d.email || email };
    last = d;
  }
  const code = last?.result;
  if (code === 2297 || code === 2064) throw Object.assign(new Error('TFA'), { code: 'TFA' });
  throw Object.assign(new Error(`pCloud: ${last?.error || 'login failed'} (${code ?? '?'})`), { code: 'PCLOUD', detail: `${last?.error || ''} (${code ?? '?'})` });
}

export function pcloud(creds) {
  const { host, auth } = creds;
  let folderId = null;
  const call = async (method, params = {}, opts = {}) => {
    const qs = Object.entries({ auth, ...params }).map(([k, v]) => `${k}=${enc(v)}`).join('&');
    const d = await json(await http(`${host}/${method}?${qs}`, opts), 'pcloud ' + method);
    if (d?.result === 1000 || d?.result === 2000) throw Object.assign(new Error('AUTH'), { code: 'AUTH' });
    if (d?.result !== 0) throw new Error(`pcloud ${method}: ${d?.result} ${d?.error}`);
    return d;
  };
  const folder = async () => {
    if (folderId) return folderId;
    const d = await call('createfolderifnotexists', { path: PCLOUD_FOLDER });
    return (folderId = d.metadata.folderid);
  };
  const contents = async () => (await call('listfolder', { folderid: await folder() })).metadata.contents || [];
  const download = async (fileid) => {
    const l = await call('getfilelink', { fileid });
    const r = await http('https://' + l.hosts[0] + l.path);
    if (r.status >= 400) throw new Error('pcloud download ' + r.status);
    return r.text;
  };
  const upload = async (filename, text) =>
    call('uploadfile', { folderid: await folder(), filename, nopartial: 1 }, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: text });
  return {
    id: 'pcloud',
    async readVault() {
      const f = (await contents()).find((x) => x.name === VAULT_FILE && !x.isfolder);
      if (!f) return null;
      return { text: await download(f.fileid), ref: f.fileid };
    },
    writeVault: (text) => upload(VAULT_FILE, text),
    async listBlobs() {
      return new Map((await contents()).filter((x) => x.name.startsWith(BLOB_PREFIX)).map((x) => [x.name.slice(BLOB_PREFIX.length), x.fileid]));
    },
    getBlob: download,
    putBlob: (id, text) => upload(BLOB_PREFIX + id, text),
    async deleteBlob(ref) {
      await call('deletefile', { fileid: ref });
    },
  };
}
