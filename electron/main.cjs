const { app, BrowserWindow, Menu, shell, ipcMain, safeStorage, net, dialog, Tray, nativeImage } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('com.mhm.note');
let win;
let tray;
let quitting = false;

function create() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 420, minHeight: 600,
    backgroundColor: '#0d1512', show: false, title: 'MHM NOTE',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // closing the window keeps MHM NOTE in the tray so reminders still fire
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('MHM NOTE');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'فتح MHM NOTE', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      { label: 'خروج', click: () => { quitting = true; app.quit(); } },
    ])
  );
  tray.on('click', () => { win.show(); win.focus(); });
}
app.whenReady().then(create);
app.on('before-quit', () => (quitting = true));
app.on('second-instance', () => {
  if (win) {
    win.show();
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on('window-all-closed', () => {});

// ---------- secure storage (Windows DPAPI via safeStorage) ----------
const store = (k) => path.join(app.getPath('userData'), 'secure-' + k.replace(/[^a-z0-9-]/gi, '') + '.bin');
function secureSet(k, v) {
  fs.writeFileSync(store(k), safeStorage.encryptString(String(v)));
}
function secureGet(k) {
  try {
    return safeStorage.decryptString(fs.readFileSync(store(k)));
  } catch {
    return null;
  }
}
function secureDel(k) {
  try {
    fs.unlinkSync(store(k));
  } catch {}
}
ipcMain.handle('secure-set', (_e, k, v) => secureSet(k, v));
ipcMain.handle('secure-get', (_e, k) => secureGet(k));
ipcMain.handle('secure-del', (_e, k) => secureDel(k));

// ---------- HTTP for the renderer (avoids CORS from file://) ----------
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|pcloud\.com|pcloud\.link)\//i;
ipcMain.handle('http', async (_e, { url, method = 'GET', headers = {}, body }) => {
  if (!ALLOWED.test(url)) throw new Error('Blocked URL');
  const r = await net.fetch(url, { method, headers, body });
  return { status: r.status, text: await r.text() };
});

// ---------- Google sign-in (loopback + PKCE, desktop client) ----------
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let cached = null; // { accessToken, exp }

async function tokenRequest(params) {
  const r = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.error || 'token error');
  return d;
}

ipcMain.handle('google-signin', async (_e, { clientId, clientSecret, scope }) => {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const stateParam = b64url(crypto.randomBytes(16));
  const { code, redirect } = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') return res.end();
      const ok = u.searchParams.get('code') && u.searchParams.get('state') === stateParam;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body style="font-family:system-ui;text-align:center;padding-top:80px;background:#f3f6f4"><h2 style="color:#17845a">${
          ok ? '✔ تم تسجيل الدخول — يمكنك العودة إلى MHM NOTE' : 'لم يكتمل تسجيل الدخول'
        }</h2></body></html>`
      );
      server.close();
      clearTimeout(timer);
      if (ok) resolve({ code: u.searchParams.get('code'), redirect: `http://127.0.0.1:${server.address()?.port || port}` });
      else reject(new Error(u.searchParams.get('error') || 'CANCELLED'));
    });
    let port;
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('TIMEOUT'));
    }, 5 * 60000);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://127.0.0.1:${port}`,
        response_type: 'code',
        scope: `openid email ${scope}`,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
        state: stateParam,
      });
      shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + q.toString());
    });
  });
  const t = await tokenRequest({ client_id: clientId, client_secret: clientSecret, code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' });
  if (!String(t.scope || '').includes(scope)) throw new Error('SCOPE');
  if (t.refresh_token) secureSet('google-refresh', t.refresh_token);
  cached = { accessToken: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  let email = null;
  try {
    email = JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64').toString()).email;
  } catch {}
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  return { email, accessToken: t.access_token, expiresIn: t.expires_in };
});

ipcMain.handle('google-token', async (_e, { clientId, clientSecret }) => {
  if (cached && cached.exp > Date.now() + 120000) return { accessToken: cached.accessToken, expiresIn: Math.floor((cached.exp - Date.now()) / 1000) };
  const rt = secureGet('google-refresh');
  if (!rt) return null;
  try {
    const t = await tokenRequest({ client_id: clientId, client_secret: clientSecret, refresh_token: rt, grant_type: 'refresh_token' });
    cached = { accessToken: t.access_token, exp: Date.now() + t.expires_in * 1000 };
    return { accessToken: t.access_token, expiresIn: t.expires_in };
  } catch {
    return null;
  }
});

ipcMain.handle('google-signout', async () => {
  const rt = secureGet('google-refresh');
  cached = null;
  secureDel('google-refresh');
  if (rt) {
    try {
      await net.fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(rt), { method: 'POST' });
    } catch {}
  }
});

// ---------- Windows Hello ----------
const PS_PRELUDE = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime] | Out-Null
`;
function ps(script) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve('');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_PRELUDE + script], { windowsHide: true, timeout: 120000 }, (err, out) =>
      resolve(err ? '' : String(out).trim())
    );
  });
}
ipcMain.handle('bio-available', async () => {
  const r = await ps(`Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])`);
  return r === 'Available';
});
ipcMain.handle('bio-verify', async (_e, reason) => {
  const msg = String(reason || 'MHM NOTE').replace(/'/g, "''");
  const r = await ps(`Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('${msg}')) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])`);
  if (win) win.focus();
  return r === 'Verified';
});

// ---------- files, PDF ----------
ipcMain.handle('save-file', async (_e, { name, base64 }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name) });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'));
  shell.showItemInFolder(r.filePath);
  return { path: r.filePath, where: r.filePath };
});
ipcMain.handle('open-temp', async (_e, { name, base64 }) => {
  const dir = path.join(os.tmpdir(), 'mhm-note');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name.replace(/[\\/:*?"<>|]+/g, ' '));
  fs.writeFileSync(f, Buffer.from(base64, 'base64'));
  await shell.openPath(f);
  setTimeout(() => { try { fs.unlinkSync(f); } catch {} }, 10 * 60000);
});
ipcMain.handle('print-pdf', async (_e, html) => {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    const f = path.join(os.tmpdir(), 'mhm-print-' + crypto.randomBytes(6).toString('hex') + '.html');
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm} body{margin:0;font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#111} .pdf-page{page-break-after:always} .pdf-page:last-child{page-break-after:auto}</style></head><body>' + html + '</body></html>');
    await w.loadFile(f);
    const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'default' } });
    fs.unlinkSync(f);
    return pdf.toString('base64');
  } finally {
    w.destroy();
  }
});
ipcMain.handle('flash', () => { if (win && !win.isFocused()) win.flashFrame(true); });
