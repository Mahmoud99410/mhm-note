import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { NotebookPen, Home as HomeIco, Star, Archive as ArchiveIco, Trash2, Settings as SetIco, Lock, Bell } from 'lucide-react';
import { LangCtx, useSettings, getSettings } from './settings';
import { strings } from './i18n';
import * as V from './vault';
import { Setup, Unlock, RecoveryKeyScreen } from './components/Auth';
import { ToastHost } from './components/ui';
import Home from './components/Home';
import FolderView from './components/Folder';
import ItemView from './components/ItemView';
import { SearchView, TrashView, ArchiveView, FavoritesView, RemindersView } from './components/Lists';
import { scheduleReminders } from './device';
import SettingsView from './components/SettingsView';
import { FOLDER_ICONS, folderHelpers } from './constants';
import { syncNow, syncSoon, resetSyncStatus } from './sync';
import { SyncBadge } from './components/Cloud';
import { ViewerHost } from './components/FileViewer';

const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);

export default function App() {
  const settings = useSettings();
  const t = strings[settings.lang] || strings.ar;
  const [phase, setPhase] = useState('loading'); // loading | setup | recovery | locked | open
  const [recoveryKey, setRecoveryKey] = useState('');

  useEffect(() => {
    V.vaultExists().then((x) => setPhase(x ? 'locked' : 'setup'));
  }, []);

  const doLock = useCallback(async () => {
    V.clearOpened();
    try {
      await syncNow();
    } catch {}
    await V.lock();
    resetSyncStatus();
    setPhase('locked');
  }, []);

  // auto-lock after inactivity / while in background
  useEffect(() => {
    if (phase !== 'open') return;
    let last = Date.now();
    let hiddenAt = 0;
    const bump = () => (last = Date.now());
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const vis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        V.flush().then(() => syncNow());
      } else if (hiddenAt) {
        const mins = getSettings().autoLock;
        if (mins > 0 && Date.now() - hiddenAt > mins * 60000) doLock();
        hiddenAt = 0;
        bump();
      }
    };
    document.addEventListener('visibilitychange', vis);
    syncNow();
    const syncIv = setInterval(() => syncNow(), 120000);
    const iv = setInterval(() => {
      const mins = getSettings().autoLock;
      if (mins > 0 && Date.now() - last > mins * 60000) doLock();
    }, 15000);
    const unload = () => V.flush();
    window.addEventListener('beforeunload', unload);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('beforeunload', unload);
      clearInterval(iv);
      clearInterval(syncIv);
    };
  }, [phase, doLock]);

  let body;
  if (phase === 'loading') body = <div className="auth" />;
  else if (phase === 'setup') body = <Setup onCreated={(k) => { setRecoveryKey(k); setPhase('recovery'); }} onRestored={() => setPhase('open')} />;
  else if (phase === 'recovery') body = <RecoveryKeyScreen recoveryKey={recoveryKey} onDone={() => { setRecoveryKey(''); setPhase('open'); }} />;
  else if (phase === 'locked') body = <Unlock onUnlocked={() => setPhase('open')} />;
  else body = <Shell onLock={doLock} />;

  return (
    <LangCtx.Provider value={t}>
      {body}
      <ToastHost />
    </LangCtx.Provider>
  );
}

function Shell({ onLock }) {
  const [stack, setStack] = useState([{ name: 'home' }]);
  const vstate = V.useVault();
  const t = useContext(LangCtx);
  const toneRev = useSettings().toneRev;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    syncSoon();
  }, [vstate]);
  // (re)schedule reminders whenever reminder data changes
  const remKey = vstate.items
    .filter((i) => (i.reminder?.at || (i.type === 'event' && i.at)) && !i.deletedAt)
    .map((i) => [i.id, i.title, i.reminder?.at, i.reminder?.repeat, i.reminder?.note, i.at, (i.alerts || []).join(',')].join('~'))
    .join('|');
  useEffect(() => {
    const id = setTimeout(
      () => scheduleReminders(V.getState().items, t, (itemId) => itemId && setStack([{ name: 'home' }, { name: 'item', id: itemId }])),
      800
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remKey, t, toneRev]);
  // matches: remove finished events automatically (to the trash), and add the matches folder once
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      for (const i of V.getState().items) {
        if (i.type === 'event' && !i.deletedAt && i.autoDelete !== false && i.at && now > i.at + (i.duration || 120) * 60000) {
          V.saveItem({ ...i, deletedAt: now });
        }
      }
    };
    sweep();
    const iv = setInterval(sweep, 60000);
    if (!localStorage.getItem('mhm-events-seeded')) {
      localStorage.setItem('mhm-events-seeded', '1');
      if (!V.getState().folders.some((f) => f.kind === 'events')) {
        const ar = document.documentElement.lang === 'ar';
        V.saveFolder({ id: 'events-default', name: ar ? 'مواعيد المباريات' : 'Match times', kind: 'events', icon: 'trophy', color: '#e5a800', order: 7, pinned: false, archived: false, createdAt: Date.now() });
      }
    }
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const pendingOpen = sessionStorage.getItem('mhm-open-item');
    if (pendingOpen) {
      sessionStorage.removeItem('mhm-open-item');
      setStack([{ name: 'home' }, { name: 'item', id: pendingOpen }]);
    }
  }, []);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const nav = {
    route: stack[stack.length - 1],
    go: (r) => setStack((s) => [...s, r]),
    replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
    reset: (r) => setStack(r.name === 'home' ? [r] : [{ name: 'home' }, r]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    canBack: stack.length > 1,
    lock: onLock,
  };

  // hardware back button (Android) and Escape / mouse back on desktop
  useEffect(() => {
    const onBack = () => {
      if (document.querySelector('.scrim, .viewer, .file-viewer')) return; // sheets handle themselves
      if (stackRef.current.length > 1) setStack((s) => s.slice(0, -1));
      else window.dispatchEvent(new Event('mhm-exit'));
    };
    window.addEventListener('mhm-back', onBack);
    const mouse = (e) => e.button === 3 && onBack();
    window.addEventListener('mouseup', mouse);
    return () => {
      window.removeEventListener('mhm-back', onBack);
      window.removeEventListener('mouseup', mouse);
    };
  }, []);

  const r = nav.route;
  let view;
  switch (r.name) {
    case 'folder': view = <FolderView key={r.id} id={r.id} />; break;
    case 'item': view = <ItemView key={r.id} id={r.id} />; break;
    case 'search': view = <SearchView />; break;
    case 'trash': view = <TrashView />; break;
    case 'archive': view = <ArchiveView />; break;
    case 'favorites': view = <FavoritesView />; break;
    case 'settings': view = <SettingsView />; break;
    case 'reminders': view = <RemindersView />; break;
    default: view = <Home />;
  }
  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        <Sidebar />
        <main className="main">{view}</main>
      </div>
      <ViewerHost />
    </NavCtx.Provider>
  );
}

function Sidebar() {
  const t = useContext(LangCtx);
  const nav = useNav();
  const { folders, items } = V.useVault();
  const r = nav.route;
  const live = folderHelpers(folders).children(null);
  const count = (id) => items.filter((i) => i.folderId === id && !i.deletedAt && !i.archived).length;
  const link = (name, Icon, label) => (
    <button className={'side-link' + (r.name === name ? ' on' : '')} onClick={() => nav.reset({ name })}>
      <span className="dot"><Icon size={16} /></span>{label}
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="side-brand"><span className="logo"><NotebookPen size={20} /></span>{t.appName}</div>
      <nav className="side-nav">
        {link('home', HomeIco, t.hello)}
        {link('favorites', Star, t.favorites)}
        {link('reminders', Bell, t.reminders)}
        <div className="side-label">{t.folders}</div>
        {live.map((f) => {
          const Icon = FOLDER_ICONS[f.icon] || FOLDER_ICONS.folder;
          const on = (r.name === 'folder' && r.id === f.id) || (r.name === 'item' && items.find((i) => i.id === r.id)?.folderId === f.id);
          return (
            <button key={f.id} className={'side-link' + (on ? ' on' : '')} style={{ '--fc': f.color }} onClick={() => nav.reset({ name: 'folder', id: f.id })}>
              <span className="dot"><Icon size={15} /></span>
              <span className="ellipsis">{f.name}</span>
              <span className="n">{f.lock ? <Lock size={12} /> : count(f.id)}</span>
            </button>
          );
        })}
        <div className="side-label" />
        {link('archive', ArchiveIco, t.archive)}
        {link('trash', Trash2, t.trash)}
        {link('settings', SetIco, t.settings)}
      </nav>
      <button className="side-link" onClick={nav.lock}><span className="dot"><Lock size={16} /></span>{t.lockNow}</button>
    </aside>
  );
}
