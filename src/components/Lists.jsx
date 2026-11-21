import { useMemo, useState } from 'react';
import { Search, X, Star, Archive, Trash2, RotateCcw, Folder as FolderIco } from 'lucide-react';
import { useT } from '../settings';
import { useNav } from '../App';
import * as V from '../vault';
import { htmlToText, FOLDER_ICONS } from '../constants';
import { BackBtn, ItemRow, sortItems } from './Folder';
import { FolderCard, useFolderMenu } from './Home';
import { Confirm, toast } from './ui';

function Page({ title, icon: Icon, children, right }) {
  const nav = useNav();
  return (
    <>
      <div className="topbar">
        {nav.canBack && <BackBtn />}
        {Icon && <Icon size={20} style={{ color: 'var(--primary)', marginInline: 6 }} />}
        <h1>{title}</h1>
        {right}
      </div>
      <div className="scroll"><div className="container" style={{ paddingTop: 6 }}>{children}</div></div>
    </>
  );
}

function Empty({ icon: Icon, text, hint }) {
  return (
    <div className="empty">
      <div className="ico"><Icon size={34} /></div>
      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{text}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}

export function SearchView() {
  const t = useT();
  const nav = useNav();
  const { folders, items } = V.useVault();
  const [q, setQ] = useState('');
  const [openMenu, menuEl] = useFolderMenu();
  const index = useMemo(() => {
    const fmap = Object.fromEntries(folders.map((f) => [f.id, f]));
    return items
      .filter((i) => !i.deletedAt && !fmap[i.folderId]?.deletedAt)
      .map((i) => {
        const f = fmap[i.folderId];
        const hidden = (i.lock && !V.isOpened(i.id)) || (f?.lock && !V.isOpened(f.id));
        const text = hidden
          ? i.title || ''
          : [i.title, i.email, i.username, i.url, i.notes, htmlToText(i.html), ...(i.phones || []).flatMap((p) => [p.label, p.number])].filter(Boolean).join(' • ');
        return { it: i, text: text.toLowerCase() };
      });
  }, [folders, items]);
  const n = q.trim().toLowerCase();
  const resItems = n ? sortItems(index.filter((x) => x.text.includes(n)).map((x) => x.it)) : [];
  const resFolders = n ? folders.filter((f) => !f.deletedAt && f.name.toLowerCase().includes(n)) : [];
  const count = (id) => items.filter((i) => i.folderId === id && !i.deletedAt).length;
  return (
    <>
      <div className="topbar">
        {nav.canBack && <BackBtn />}
        <div className="input-wrap grow">
          <Search size={18} className="muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} style={{ height: 46 }} />
          {q && <button className="icon-btn sm" onClick={() => setQ('')}><X size={18} /></button>}
        </div>
      </div>
      <div className="scroll">
        <div className="container" style={{ paddingTop: 6 }}>
          {!n ? (
            <Empty icon={Search} text={t.search} hint={t.searchPlaceholder} />
          ) : resItems.length + resFolders.length === 0 ? (
            <Empty icon={Search} text={t.noResults} />
          ) : (
            <>
              {resFolders.length > 0 && (
                <>
                  <div className="section-title"><h3>{t.folders}</h3></div>
                  <div className="folder-grid">{resFolders.map((f) => <FolderCard key={f.id} f={f} count={count(f.id)} onMenu={openMenu} />)}</div>
                </>
              )}
              {resItems.length > 0 && (
                <>
                  <div className="section-title"><h3>{resItems.length} {t.items}</h3></div>
                  <div className="list">{resItems.map((it) => <ItemRow key={it.id} it={it} showFolder />)}</div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {menuEl}
    </>
  );
}

export function FavoritesView() {
  const t = useT();
  const { folders, items } = V.useVault();
  const dead = new Set(folders.filter((f) => f.deletedAt).map((f) => f.id));
  const list = sortItems(items.filter((i) => i.favorite && !i.deletedAt && !dead.has(i.folderId)));
  return (
    <Page title={t.favorites} icon={Star}>
      {list.length === 0 ? <Empty icon={Star} text={t.empty} /> : <div className="list">{list.map((it) => <ItemRow key={it.id} it={it} showFolder />)}</div>}
    </Page>
  );
}

export function ArchiveView() {
  const t = useT();
  const { folders, items } = V.useVault();
  const [openMenu, menuEl] = useFolderMenu();
  const af = folders.filter((f) => f.archived && !f.deletedAt);
  const deadOrArchived = new Set(folders.filter((f) => f.deletedAt || f.archived).map((f) => f.id));
  const ai = sortItems(items.filter((i) => i.archived && !i.deletedAt && !deadOrArchived.has(i.folderId)));
  const count = (id) => items.filter((i) => i.folderId === id && !i.deletedAt).length;
  return (
    <Page title={t.archive} icon={Archive}>
      {af.length + ai.length === 0 && <Empty icon={Archive} text={t.empty} />}
      {af.length > 0 && (
        <>
          <div className="section-title"><h3>{t.folders}</h3></div>
          <div className="folder-grid">{af.map((f) => <FolderCard key={f.id} f={f} count={count(f.id)} onMenu={openMenu} />)}</div>
        </>
      )}
      {ai.length > 0 && (
        <>
          <div className="section-title"><h3>{t.items}</h3></div>
          <div className="list">{ai.map((it) => <ItemRow key={it.id} it={it} showFolder />)}</div>
        </>
      )}
      {menuEl}
    </Page>
  );
}

export function TrashView() {
  const t = useT();
  const { folders, items } = V.useVault();
  const [confirm, setConfirm] = useState(null);
  const df = folders.filter((f) => f.deletedAt);
  const deadIds = new Set(df.map((f) => f.id));
  const di = items.filter((i) => i.deletedAt && !deadIds.has(i.folderId)).sort((a, b) => b.deletedAt - a.deletedAt);
  const daysLeft = (ts) => Math.max(0, V.TRASH_KEEP_DAYS - Math.floor((Date.now() - ts) / 864e5));
  const row = (key, icon, color, title, sub, onRestore, id) => (
    <div className="item" key={key}>
      <div className="badge" style={{ '--bc': color }}>{icon}</div>
      <div className="grow">
        <div className="t ellipsis auto-dir">{title}</div>
        <div className="s">{sub}</div>
      </div>
      <div className="quick-copy">
        <button className="qc" onClick={onRestore} title={t.restoreItem}><RotateCcw size={15} /><span className="hide-mobile">{t.restoreItem}</span></button>
        <button className="qc" style={{ color: 'var(--danger)' }} onClick={() => setConfirm({ id })} title={t.deleteForever}><Trash2 size={15} /></button>
      </div>
    </div>
  );
  return (
    <Page
      title={t.trash}
      icon={Trash2}
      right={(df.length + di.length > 0) && <button className="chip-btn" style={{ color: 'var(--danger)', background: 'rgba(224,71,62,.1)' }} onClick={() => setConfirm({ all: true })}>{t.emptyTrash}</button>}
    >
      <p className="hint" style={{ textAlign: 'center', margin: '4px 0 16px' }}>{t.trashHint}</p>
      {df.length + di.length === 0 ? (
        <Empty icon={Trash2} text={t.empty} />
      ) : (
        <div className="list">
          {df.map((f) => {
            const Icon = FOLDER_ICONS[f.icon] || FolderIco;
            return row(f.id, <Icon size={20} />, f.color, f.name, `${t.folder} • ${daysLeft(f.deletedAt)} ${t.daysLeft}`, () => { V.saveFolder({ ...f, deletedAt: null }); toast(t.done); }, f.id);
          })}
          {di.map((i) => {
            const f = folders.find((x) => x.id === i.folderId);
            return row(
              i.id,
              (i.title || '•').trim().charAt(0).toUpperCase(),
              i.color || f?.color || '#6a7a72',
              i.title || htmlToText(i.html).slice(0, 40) || t.untitled,
              `${f ? f.name + ' • ' : ''}${daysLeft(i.deletedAt)} ${t.daysLeft}`,
              () => { V.saveItem({ ...i, deletedAt: null }); toast(t.done); },
              i.id
            );
          })}
        </div>
      )}
      {confirm && (
        <Confirm
          text={confirm.all ? t.confirmEmptyTrash : t.confirmDeleteForever}
          onClose={() => setConfirm(null)}
          onYes={() => (confirm.all ? V.emptyTrash() : V.deleteForever(confirm.id)).then(() => toast(t.done))}
        />
      )}
    </Page>
  );
}
