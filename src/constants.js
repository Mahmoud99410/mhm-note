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
  { id: 'default', light: null, dark: null },
  { id: 'cream', light: '#fff8e1', dark: '#2a2614' },
  { id: 'mint', light: '#e8f6ee', dark: '#14271e' },
  { id: 'sky', light: '#e7f1fd', dark: '#142030' },
  { id: 'rose', light: '#fdecef', dark: '#2c171c' },
  { id: 'lavender', light: '#f0ecfd', dark: '#1f1a33' },
  { id: 'sand', light: '#f5efe6', dark: '#29231b' },
  { id: 'night', light: '#1b2420', dark: '#090d0b', text: '#e7efeb' },
];

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
