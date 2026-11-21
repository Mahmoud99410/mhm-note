import { useSyncExternalStore, createContext, useContext } from 'react';
import { strings } from './i18n';

const KEY = 'mhm-note-settings';
const defaults = { lang: 'ar', theme: 'system', accent: 'green', autoLock: 5 };
let settings = { ...defaults };
try {
  settings = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {}
const ls = new Set();

export function setSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
  applyDocument();
  ls.forEach((l) => l());
}
export function useSettings() {
  return useSyncExternalStore(
    (l) => (ls.add(l), () => ls.delete(l)),
    () => settings
  );
}
export const getSettings = () => settings;

const mq = window.matchMedia('(prefers-color-scheme: dark)');
export function isDark(s = settings) {
  return s.theme === 'dark' || (s.theme === 'system' && mq.matches);
}
export function applyDocument() {
  const el = document.documentElement;
  el.lang = settings.lang;
  el.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
  el.dataset.theme = isDark() ? 'dark' : 'light';
  el.dataset.accent = settings.accent;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark() ? '#0f1714' : settings.accent === 'yellow' ? '#f6c437' : '#17845a';
}
mq.addEventListener?.('change', () => {
  applyDocument();
  ls.forEach((l) => l());
});
applyDocument();

export const LangCtx = createContext(strings.ar);
export function useT() {
  return useContext(LangCtx);
}
