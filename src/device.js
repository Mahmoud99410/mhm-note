// Files, sharing, PDF export and reminders across Android / Windows / web.
import { platform } from './native';

const E = () => window.mhm;

function b64FromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const safeName = (n) => (n || 'MHM NOTE').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'MHM NOTE';

function downloadInBrowser(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Save bytes as a file the user keeps. Returns { path, uri } (Android) / { path } (Windows) or null if cancelled.
export async function saveFile(bytes, name, type) {
  if (platform === 'android') {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const data = b64FromBytes(bytes);
    try {
      const r = await Filesystem.writeFile({ path: 'MHM NOTE/' + name, data, directory: Directory.Documents, recursive: true });
      return { uri: r.uri, where: 'Documents/MHM NOTE' };
    } catch {
      const r = await Filesystem.writeFile({ path: name, data, directory: Directory.External, recursive: true });
      return { uri: r.uri, where: 'Android/data/com.mhm.note' };
    }
  }
  if (platform === 'electron') return E().saveFile({ name, base64: b64FromBytes(bytes) });
  downloadInBrowser(bytes, name, type);
  return { where: 'Downloads' };
}

async function cacheFile(bytes, name) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const r = await Filesystem.writeFile({ path: 'share/' + name, data: b64FromBytes(bytes), directory: Directory.Cache, recursive: true });
  return r.uri;
}

export async function shareFile(bytes, name, type, title) {
  if (platform === 'android') {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, files: [await cacheFile(bytes, name)], dialogTitle: title });
    return true;
  }
  if (platform === 'electron') return !!(await E().saveFile({ name, base64: b64FromBytes(bytes) }));
  if (navigator.canShare?.({ files: [new File([bytes], name, { type })] })) {
    await navigator.share({ files: [new File([bytes], name, { type })], title });
    return true;
  }
  downloadInBrowser(bytes, name, type);
  return true;
}

export async function shareText(text, title) {
  if (platform === 'android') {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, dialogTitle: title });
    return 'shared';
  }
  if (navigator.share && platform === 'web') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {}
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

export async function openFile(bytes, name, type) {
  if (platform === 'android') {
    const uri = await cacheFile(bytes, name);
    const { FileOpener } = await import('@capacitor-community/file-opener');
    await FileOpener.open({ filePath: uri, contentType: type });
    return;
  }
  if (platform === 'electron') return E().openTemp({ name, base64: b64FromBytes(bytes) });
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  window.open(url, '_blank');
}

// ---------- PDF ----------
// html: a full printable document body (inline styles + data: images)
export async function htmlToPdf(html) {
  if (platform === 'electron') {
    const b64 = await E().printPdf(html);
    const s = atob(b64);
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#111;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await Promise.all([...host.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r)))));
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const pages = host.querySelectorAll('.pdf-page');
    let first = true;
    for (const page of pages.length ? pages : [host]) {
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pxPerPt = canvas.width / pw;
      const sliceH = Math.floor(ph * pxPerPt);
      for (let y = 0; y < canvas.height; y += sliceH) {
        const h = Math.min(sliceH, canvas.height - y);
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = h;
        c.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, h / pxPerPt);
      }
    }
    return new Uint8Array(pdf.output('arraybuffer'));
  } finally {
    host.remove();
  }
}

// ---------- reminders ----------
const REPEAT_EVERY = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };
export const reminderNumId = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000;
};

// next fire time for a reminder (handles repeats)
export function nextFire(r, now = Date.now()) {
  if (!r?.at) return null;
  let t = r.at;
  if (!r.repeat || r.repeat === 'none') return t > now ? t : null;
  const d = new Date(t);
  let guard = 0;
  while (d.getTime() <= now && guard++ < 5000) {
    if (r.repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (r.repeat === 'weekly') d.setDate(d.getDate() + 7);
    else if (r.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (r.repeat === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else return null;
  }
  return d.getTime();
}

let desktopTimer = null;
let fired = new Set();

// Re-schedule every reminder from the (synced) item data
export async function scheduleReminders(items, t, onOpen) {
  const list = items.filter((i) => i.reminder?.at && !i.deletedAt);
  const label = (i) => (i.lock ? t.reminder : i.title || t.reminder);
  if (platform === 'android') {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') await LocalNotifications.requestPermissions();
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      const notifs = [];
      for (const i of list) {
        const at = nextFire(i.reminder);
        if (!at) continue;
        const d = new Date(at);
        const rep = i.reminder.repeat;
        const schedule =
          rep && rep !== 'none'
            ? {
                on:
                  rep === 'daily' ? { hour: d.getHours(), minute: d.getMinutes() }
                  : rep === 'weekly' ? { weekday: d.getDay() + 1, hour: d.getHours(), minute: d.getMinutes() }
                  : rep === 'monthly' ? { day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() }
                  : { month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() },
                allowWhileIdle: true,
              }
            : { at: d, allowWhileIdle: true };
        notifs.push({ id: reminderNumId(i.id), title: '⏰ ' + label(i), body: i.reminder.note || t.appName, schedule, extra: { itemId: i.id } });
      }
      if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
    } catch (e) {
      console.warn('reminders', e);
    }
    if (!scheduleReminders.listening) {
      scheduleReminders.listening = true;
      LocalNotifications.addListener('localNotificationActionPerformed', (a) => onOpen?.(a.notification?.extra?.itemId));
    }
    return;
  }
  // Windows / web: check every 20 s while the app is running (it keeps running in the tray)
  clearInterval(desktopTimer);
  const tick = () => {
    const now = Date.now();
    for (const i of list) {
      const due = lastDue(i.reminder, now);
      if (!due || now - due > 10 * 60000) continue;
      const key = i.id + ':' + due;
      if (fired.has(key) || localStorage.getItem('mhm-fired-' + key)) continue;
      fired.add(key);
      localStorage.setItem('mhm-fired-' + key, '1');
      try {
        const n = new Notification('⏰ ' + label(i), { body: i.reminder.note || t.appName, requireInteraction: true });
        n.onclick = () => {
          window.focus();
          onOpen?.(i.id);
        };
      } catch {}
      E()?.flash?.();
    }
  };
  if (platform === 'web' && Notification.permission === 'default') Notification.requestPermission();
  tick();
  desktopTimer = setInterval(tick, 20000);
}

// most recent fire time <= now
function lastDue(r, now) {
  if (!r?.at || r.at > now) return null;
  if (!r.repeat || r.repeat === 'none') return r.at;
  const d = new Date(r.at);
  let prev = d.getTime();
  let guard = 0;
  while (d.getTime() <= now && guard++ < 5000) {
    prev = d.getTime();
    if (r.repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (r.repeat === 'weekly') d.setDate(d.getDate() + 7);
    else if (r.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  return prev;
}
export const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
export { REPEAT_EVERY };
