import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { ArrowRight, Plus, Lock, Pin, Star, MoreVertical, Mail, KeyRound, Phone, Copy, Search, X, ArrowUpDown, Check, Bell, FileText } from 'lucide-react';
import { fmtSize } from './Actions';
import { KindIcon, kindColor } from './FileViewer';
import { countdown } from './Editors';
import { alertLabel } from '../device';
import { toast } from './ui';
import { useT, useSettings, setSettings } from '../settings';
import { useNav } from '../App';
import * as V from '../vault';
import { platformColor, htmlToText, fmtFull, FOLDER_ICONS, pageStyle, sortList } from '../constants';
import { LockGate, copyText, Sheet } from './ui';
import { useFolderMenu } from './Home';
import { isDark } from '../settings';

export function BackBtn() {
  const nav = useNav();
  return (
    <button className="icon-btn" onClick={nav.back} aria-label="back">
      <ArrowRight size={22} className="flip-ltr" style={{ transform: document.documentElement.dir === 'rtl' ? 'none' : 'scaleX(-1)' }} />
    </button>
  );
}

export function newItemFor(folder) {
  const base = { id: V.uid(), folderId: folder.id, createdAt: Date.now(), pinned: false, favorite: false, archived: false };
  if (folder.kind === 'accounts') return { ...base, type: 'account', title: '', email: '', username: '', password: '', url: '', notes: '', fresh: true };
  if (folder.kind === 'contacts') return { ...base, type: 'contact', title: '', phones: [{ number: '' }], notes: '', fresh: true };
  if (folder.kind === 'files') return { ...base, type: 'file', title: '', notes: '', attachments: [] };
  if (folder.kind === 'events') {
    const d = new Date(Date.now() + 86400000);
    d.setMinutes(0, 0, 0);
    d.setHours(20);
    return { ...base, type: 'event', title: '', at: d.getTime(), duration: 120, alerts: [60], autoDelete: true, notes: '', fresh: true };
  }
  return { ...base, type: 'note', title: '', html: '', pageColor: 'default', lines: false, fontSize: 17, attachments: [], fresh: true };
}

function Thumb({ id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    V.imageURL(id).then((u) => live && setUrl(u));
    return () => (live = false);
  }, [id]);
  return url ? <img src={url} alt="" /> : <span style={{ width: 46, height: 46, borderRadius: 10, background: 'var(--surface-2)' }} />;
}

export function ItemRow({ it, showFolder }) {
  const t = useT();
  const s = useSettings();
  const nav = useNav();
  const { folders } = V.useVault();
  const folder = showFolder ? folders.find((f) => f.id === it.folderId) : null;
  const locked = !!it.lock && !V.isOpened(it.id);
  const open = () => nav.go({ name: 'item', id: it.id });
  const icons = (
    <span className="meta">
      {it.pinned && <Pin size={14} />}
      {it.favorite && <Star size={14} fill="currentColor" style={{ color: 'var(--gold)' }} />}
      {it.lock && <Lock size={14} />}
      {it.reminder?.at && <Bell size={14} style={{ color: 'var(--primary)' }} />}
    </span>
  );
  const folderTag = folder && (
    <span className="ellipsis" style={{ fontSize: 12, color: folder.color, fontWeight: 600 }}>{folder.name}</span>
  );

  if (it.type === 'account') {
    const color = it.color || platformColor(it.title);
    return (
      <div className="item" role="button" tabIndex={0} onClick={open} style={{ cursor: 'pointer' }}>
        <div className="badge" style={{ '--bc': color }}>{(it.title || '?').trim().charAt(0).toUpperCase()}</div>
        <div className="grow">
          <div className="t ellipsis auto-dir">{it.title || t.untitled}</div>
          <div className="s ellipsis ltr" style={{ textAlign: 'start' }}>{locked ? '••••••••' : it.email || it.username || ''}</div>
          <div className="date-line">✎ {fmtFull(it.updatedAt, s.lang)}</div>
          {folderTag}
        </div>
        {icons}
        {!locked && (it.email || it.password) && (
          <div className="quick-copy" onClick={(e) => e.stopPropagation()}>
            {(it.email || it.username) && <button className="qc" title={t.email} onClick={() => copyText(it.email || it.username, t)}><Mail size={14} /><span className="hide-mobile">{t.email}</span></button>}
            {it.password && <button className="qc" title={t.password} onClick={() => copyText(it.password, t)}><KeyRound size={14} /><span className="hide-mobile">{t.password}</span></button>}
          </div>
        )}
      </div>
    );
  }
  if (it.type === 'contact') {
    const num = it.phones?.[0]?.number || '';
    return (
      <div className="item" role="button" tabIndex={0} onClick={open} style={{ cursor: 'pointer' }}>
        <div className="badge" style={{ '--bc': it.color || '#17845a' }}>{(it.title || '#').trim().charAt(0).toUpperCase()}</div>
        <div className="grow">
          <div className="t ellipsis auto-dir">{it.title || t.untitled}</div>
          <div className="s ellipsis ltr" style={{ textAlign: 'start' }}>{locked ? '••• ••• ••••' : num}</div>
          <div className="date-line">✎ {fmtFull(it.updatedAt, s.lang)}</div>
          {folderTag}
        </div>
        {icons}
        {!locked && num && (
          <div className="quick-copy" onClick={(e) => e.stopPropagation()}>
            <a className="qc" href={'tel:' + num.replace(/[^\d+]/g, '')}><Phone size={14} /></a>
            <button className="qc" onClick={() => copyText(num, t)}><Copy size={14} /></button>
          </div>
        )}
      </div>
    );
  }
  if (it.type === 'event') {
    const d = new Date(it.at);
    const cd = countdown(it, t);
    const loc = s.lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB';
    return (
      <div className={'item event-row ' + cd.state} role="button" tabIndex={0} onClick={open} style={{ cursor: 'pointer' }}>
        <div className="date-badge">
          <b>{d.getDate()}</b>
          <span>{d.toLocaleDateString(loc, { month: 'short' })}</span>
        </div>
        <div className="grow">
          <div className="t ellipsis auto-dir">{it.title || t.untitled}</div>
          <div className="s">
            🕒 {d.toLocaleDateString(loc, { weekday: 'long' })} {d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div className={'cd ' + cd.state}>{cd.text}{(it.alerts || []).length > 0 && <span className="muted"> • 🔔 {(it.alerts || []).map((m) => alertLabel(m, t)).join('، ')}</span>}</div>
          {folderTag}
        </div>
        {icons}
      </div>
    );
  }
  if (it.type === 'file') {
    const a = it.attachments?.[0];
    return (
      <div className="item" role="button" tabIndex={0} onClick={open} style={{ cursor: 'pointer' }}>
        <div className="badge" style={{ '--bc': a ? kindColor(a.name, a.type) : '#e0473e' }}>{a ? <KindIcon name={a.name} type={a.type} size={22} /> : <FileText size={22} />}</div>
        <div className="grow">
          <div className="t ellipsis auto-dir">{it.title || a?.name || t.untitled}</div>
          <div className="s"><span className="ltr">{a ? fmtSize(a.size) : ''}</span> • 🕒 {fmtFull(it.createdAt, s.lang)}</div>
          {folderTag}
        </div>
        {icons}
      </div>
    );
  }
  const ps = pageStyle(it.pageColor, isDark(s));
  const text = locked ? '' : htmlToText(it.html).slice(0, 220);
  const thumbs = (it.attachments || []).filter((a) => a.w != null || (a.type || '').startsWith('image/'));
  const files = (it.attachments || []).length - thumbs.length;
  return (
    <div
      className={'item note-card' + (ps ? ' tinted' + (ps.darkBg ? ' on-dark' : '') : '')}
      role="button"
      tabIndex={0}
      onClick={open}
      style={{ cursor: 'pointer', ...(ps ? { background: ps.bg, color: ps.text || undefined, borderColor: 'transparent' } : null) }}
    >
      <div className="row">
        <div className="t ellipsis grow auto-dir">{it.title || (text ? text.slice(0, 40) : t.untitled)}</div>
        {icons}
      </div>
      {locked ? <div className="snippet">🔒 {t.locked}</div> : text && <div className="snippet auto-dir">{text}</div>}
      {!locked && thumbs.length > 0 && <div className="thumbs">{thumbs.slice(0, 4).map((a) => <Thumb key={a.id} id={a.id} />)}</div>}
      {!locked && files > 0 && <div className="snippet">📎 {files}</div>}
      <div className="foot">{folderTag}<span>🕒 {fmtFull(it.createdAt, s.lang)}</span>{it.updatedAt - (it.createdAt || 0) > 60000 && <span>✎ {fmtFull(it.updatedAt, s.lang)}</span>}</div>
    </div>
  );
}

export function sortItems(list) {
  return sortList(list, 'updated');
}

export function SortSheet({ onClose }) {
  const t = useT();
  const s = useSettings();
  return (
    <Sheet title={t.sortBy} onClose={onClose}>
      <div className="menu-list">
        {['updated', 'created', 'oldest', 'name'].map((k) => (
          <button key={k} className="menu-item" onClick={() => { setSettings({ sortBy: k }); onClose(); }}>
            <span className="grow">{t['sort_' + k]}</span>
            {(s.sortBy || 'updated') === k && <Check size={18} style={{ color: 'var(--primary)' }} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export default function FolderView({ id }) {
  const t = useT();
  const nav = useNav();
  const { folders, items } = V.useVault();
  const [, force] = useState(0);
  const [q, setQ] = useState(null);
  const [openMenu, menuEl] = useFolderMenu();
  const [sorting, setSorting] = useState(false);
  const st = useSettings();
  const f = folders.find((x) => x.id === id);
  if (!f) return <div className="scroll"><div className="topbar"><BackBtn /></div></div>;
  const Icon = FOLDER_ICONS[f.icon] || FOLDER_ICONS.folder;
  const locked = f.lock && !V.isOpened(f.id);
  let list = items.filter((i) => i.folderId === id && !i.deletedAt && !i.archived);
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((i) => [i.title, i.email, i.username, htmlToText(i.html), i.notes, ...(i.phones || []).map((p) => p.number)].join(' ').toLowerCase().includes(n));
  }
  list = f.kind === 'events' ? [...list].sort((a, b) => (a.at || 0) - (b.at || 0)) : sortList(list, st.sortBy);
  const pickRef = useRef(null);
  const onPick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    for (const file of files) {
      try {
        const a = await V.addFile(file);
        V.saveItem({ ...newItemFor(f), title: file.name.replace(/\.[a-z0-9]+$/i, ''), attachments: [a] });
      } catch (err) {
        toast(err.message === 'TOO_BIG' ? t.fileTooBig : '⚠️ ' + err.message);
      }
    }
  };
  const add = () => {
    if (f.kind === 'files') return pickRef.current.click();
    const it = newItemFor(f);
    V.saveItem(it);
    nav.go({ name: 'item', id: it.id });
  };
  const addLabel = f.kind === 'accounts' ? t.newAccount : f.kind === 'contacts' ? t.newContact : f.kind === 'files' ? t.newFile : f.kind === 'events' ? t.newEvent : t.newNote;
  return (
    <>
      <div className="topbar">
        {nav.canBack && <BackBtn />}
        {q === null ? (
          <>
            <span className="folder-ico" style={{ '--fc': f.color, width: 34, height: 34, borderRadius: 11 }}><Icon size={18} /></span>
            <h1 style={{ marginInlineStart: 6 }}>{f.name}</h1>
            {!locked && <button className="icon-btn" title={t.sortBy} onClick={() => setSorting(true)}><ArrowUpDown size={20} /></button>}
            {!locked && <button className="icon-btn" onClick={() => setQ('')}><Search size={20} /></button>}
            <button className="icon-btn" onClick={() => openMenu(f)}><MoreVertical size={20} /></button>
          </>
        ) : (
          <>
            <div className="input-wrap grow" style={{ height: 44 }}>
              <Search size={18} className="muted" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} style={{ height: 42 }} />
            </div>
            <button className="icon-btn" onClick={() => setQ(null)}><X size={20} /></button>
          </>
        )}
      </div>
      {locked ? (
        <LockGate target={f} title={f.name} onOpen={() => force((x) => x + 1)} />
      ) : (
        <div className="scroll">
          <div className="container" style={{ paddingTop: 6 }}>
            {list.length === 0 ? (
              <div className="empty">
                <div className="ico"><Icon size={34} /></div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{q ? t.noResults : t.empty}</div>
                {!q && <div>{t.emptyHint}</div>}
              </div>
            ) : (
              <div className="list">{list.map((it) => <ItemRow key={it.id} it={it} />)}</div>
            )}
          </div>
        </div>
      )}
      {!locked && (
        <button className="fab" onClick={add}><Plus size={24} /><span>{addLabel}</span></button>
      )}
      {!locked && f.kind === 'files' && (
        <input ref={pickRef} type="file" accept="*/*" multiple hidden onChange={onPick} />
      )}
      {menuEl}
      {sorting && <SortSheet onClose={() => setSorting(false)} />}
    </>
  );
}
