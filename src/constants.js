import {
  Users, StickyNote, Phone, KeyRound, Moon, Briefcase, CalendarDays, Star, Folder, Heart,
  Shield, BookOpen, Trophy, Home, Wallet, Lightbulb,
} from 'lucide-react';

export const FOLDER_ICONS = {
  users: Users, note: StickyNote, phone: Phone, key: KeyRound, moon: Moon, briefcase: Briefcase,
  calendar: CalendarDays, star: Star, folder: Folder, heart: Heart, shield: Shield, book: BookOpen,
  trophy: Trophy, home: Home, wallet: Wallet, idea: Lightbulb,
};

export const COLORS = ['#17845a', '#e5a800', '#1f9d8f', '#2578e2', '#7c5cf0', '#d94a8c', '#ef7a2d', '#e0473e', '#5b6b75'];

export const PLATFORMS = [
  { name: 'Facebook', color: '#1877F2' },
  { name: 'Instagram', color: '#D62976' },
  { name: 'Snapchat', color: '#E8C400' },
  { name: 'TikTok', color: '#111111' },
  { name: 'X', color: '#222222' },
  { name: 'WhatsApp', color: '#25D366' },
  { name: 'Telegram', color: '#229ED9' },
  { name: 'Gmail', color: '#EA4335' },
  { name: 'YouTube', color: '#FF0000' },
  { name: 'LinkedIn', color: '#0A66C2' },
  { name: 'Microsoft', color: '#5E5E5E' },
  { name: 'Apple', color: '#333333' },
];

export function platformColor(title, fallback) {
  const p = PLATFORMS.find((x) => x.name.toLowerCase() === (title || '').trim().toLowerCase());
  return p ? p.color : fallback || '#17845a';
}

export const PAGE_COLORS = [
  { id: 'default' },
  { id: 'cream', c: '#fff8e1' }, { id: 'lemon', c: '#fff3b0' }, { id: 'peach', c: '#ffe5d0' }, { id: 'apricot', c: '#ffd8b1' },
  { id: 'coral', c: '#ffc9c2' }, { id: 'rose', c: '#fde2e7' }, { id: 'pink', c: '#ffd1e8' }, { id: 'lilac', c: '#f1dcff' },
  { id: 'lavender', c: '#e6e1ff' }, { id: 'periwinkle', c: '#d9e4ff' }, { id: 'sky', c: '#dcefff' }, { id: 'ice', c: '#e3f7fb' },
  { id: 'aqua', c: '#ccf3ee' }, { id: 'mint', c: '#d9f5e5' }, { id: 'sage', c: '#e3ecd9' }, { id: 'lime', c: '#ecf7c8' },
  { id: 'sand', c: '#f5efe6' }, { id: 'beige', c: '#efe3cf' }, { id: 'stone', c: '#e9e7e2' }, { id: 'gray', c: '#e5e9ec' },
  { id: 'night', c: '#1b2420', text: '#e7efeb' }, { id: 'navy', c: '#16213e', text: '#e6ecff' }, { id: 'forest', c: '#143326', text: '#e3f5ea' },
  { id: 'wine', c: '#3a1520', text: '#ffe6ec' }, { id: 'cocoa', c: '#3b2a20', text: '#f7eadf' }, { id: 'slate', c: '#2a3440', text: '#e8eef5' },
  { id: 'purple', c: '#2b1d47', text: '#efe8ff' }, { id: 'black', c: '#0b0d0c', text: '#f0f0f0' },
];

function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('');
}
const isDarkHex = (h) => {
  const c = hexToRgb(h);
  return c ? (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 < 0.5 : false;
};

// page background + text colour for a note's page colour (preset id or custom #hex)
export function pageStyle(pageColor, dark) {
  if (!pageColor || pageColor === 'default') return null;
  if (pageColor.startsWith('#')) return { bg: pageColor, text: isDarkHex(pageColor) ? '#eef3f0' : '#14201b', darkBg: isDarkHex(pageColor) };
  const p = PAGE_COLORS.find((x) => x.id === pageColor);
  if (!p || !p.c) return null;
  if (p.text) return { bg: p.c, text: p.text, darkBg: true };
  return dark ? { bg: mix(p.c, '#0f1714', 0.78), text: null, darkBg: true } : { bg: p.c, text: '#14201b', darkBg: false };
}
export function printBg(pageColor) {
  const st = pageStyle(pageColor, false);
  return st ? st.bg : '#ffffff';
}
export const HIGHLIGHTS = ['#fff176', '#ffcc80', '#a5d6a7', '#80deea', '#90caf9', '#ce93d8', '#f48fb1', '#ef9a9a'];

export const TEXT_COLORS = [null, '#e0473e', '#ef7a2d', '#c99400', '#17845a', '#1f9d8f', '#2578e2', '#7c5cf0', '#d94a8c', '#6a7a72'];
export const FONT_SIZES = [14, 16, 18, 22, 26, 32];

export function seedFolders(lang) {
  const ar = lang === 'ar';
  const now = Date.now();
  const mk = (i, name, kind, icon, color) => ({
    id: crypto.randomUUID(), name, kind, icon, color, order: i, pinned: false, archived: false, createdAt: now + i,
  });
  return [
    mk(0, ar ? 'التواصل الاجتماعي' : 'Social media', 'accounts', 'users', '#2578e2'),
    mk(1, ar ? 'ملاحظاتي' : 'My notes', 'notes', 'note', '#e5a800'),
    mk(2, ar ? 'أرقام الهواتف' : 'Phone numbers', 'contacts', 'phone', '#17845a'),
    mk(3, ar ? 'أدعية وأذكار' : 'Duas & adhkar', 'notes', 'moon', '#7c5cf0'),
    mk(4, ar ? 'كلمات مرور احتياطية' : 'Backup passwords', 'accounts', 'key', '#ef7a2d'),
    mk(5, ar ? 'مشاريعي' : 'My projects', 'notes', 'briefcase', '#1f9d8f'),
    mk(6, ar ? 'ملفات ودروس' : 'Files & lessons', 'files', 'book', '#e0473e'),
    { ...mk(7, ar ? 'مواعيد المباريات' : 'Match times', 'events', 'trophy', '#e5a800'), id: 'events-default' },
  ];
}

export function htmlToText(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html.replace(/<(div|p|br|li)[^>]*>/gi, ' $&');
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

export function fmtDate(ts, lang) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const loc = lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB';
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

// Full date + time, e.g. "22 نوفمبر 2026، 1:39 م"
export function fmtFull(ts, lang) {
  if (!ts) return '';
  const loc = lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB';
  const d = new Date(ts);
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
}

export function sortList(list, by = 'updated') {
  const pin = (a, b) => b.pinned - a.pinned;
  const cmp = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    created: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    oldest: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    name: (a, b) => (a.title || '').localeCompare(b.title || '', 'ar'),
  }[by] || ((a, b) => b.updatedAt - a.updatedAt);
  return [...list].sort((a, b) => pin(a, b) || cmp(a, b));
}

// ---------- nested folders ----------
const sortByOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || 0) - (b.createdAt || 0);
export function folderHelpers(folders) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain = (id) => {
    const out = [];
    let f = byId.get(id);
    let guard = 0;
    while (f && guard++ < 50) {
      out.unshift(f);
      f = f.parentId ? byId.get(f.parentId) : null;
    }
    return out;
  };
  return {
    byId,
    chain,
    // hidden from normal views: the folder or any parent is deleted or archived
    hidden: (id) => chain(id).some((f) => f.deletedAt || f.archived),
    deleted: (id) => chain(id).some((f) => f.deletedAt),
    path: (id) => chain(id).map((f) => f.name).join(' › '),
    children: (id) => folders.filter((f) => (f.parentId || null) === (id || null) && !f.deletedAt && !f.archived).sort(sortByOrder),
    descendants: (id) => {
      const out = [];
      const walk = (pid) => folders.filter((f) => f.parentId === pid).forEach((f) => (out.push(f), walk(f.id)));
      walk(id);
      return out;
    },
  };
}
