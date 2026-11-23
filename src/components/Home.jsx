import { useState } from 'react';
import { NotebookPen, Search, Lock, Settings, Star, Archive, Trash2, Plus, Pin, MoreVertical, Pencil, Unlock, ArchiveRestore, PinOff, FileDown, Share2, Bell, LayoutGrid, Grid3x3, Rows3 } from 'lucide-react';
import { useSettings, setSettings } from '../settings';
import { useExporter } from './Actions';
import { sortList } from '../constants';
import { useT } from '../settings';
import { useNav } from '../App';
import * as V from '../vault';
import { FOLDER_ICONS, COLORS } from '../constants';
import { Sheet, MenuSheet, SetLockSheet, toast } from './ui';
import { ItemRow } from './Folder';
import { SyncBadge } from './Cloud';

export function FolderSheet({ folder, onClose }) {
  const t = useT();
  const nav = useNav();
  const [name, setName] = useState(folder?.name || '');
  const [kind, setKind] = useState(folder?.kind || 'notes');
  const [icon, setIcon] = useState(folder?.icon || 'folder');
  const [color, setColor] = useState(folder?.color || COLORS[0]);
  const save = () => {
    if (!name.trim()) return;
    if (folder) V.saveFolder({ ...folder, name: name.trim(), kind, icon, color });
    else {
      const f = { id: V.uid(), name: name.trim(), kind, icon, color, order: Date.now(), createdAt: Date.now(), pinned: false, archived: false };
      V.saveFolder(f);
      nav.go({ name: 'folder', id: f.id });
    }
    onClose();
  };
  return (
    <Sheet title={folder ? t.rename : t.newFolder} onClose={onClose}>
      <div className="field">
        <label>{t.folderName}</label>
        <div className="input-wrap"><input className="auto-dir" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
      </div>
      <div className="field">
        <label>{t.folderType}</label>
        <div className="seg grid2">
          {['notes', 'accounts', 'contacts', 'files', 'events'].map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)} style={{ fontSize: 12.5 }}>{t['kind_' + k]}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t.folderIcon}</label>
        <div className="icon-pick">
          {Object.entries(FOLDER_ICONS).map(([k, Icon]) => (
            <button key={k} className={icon === k ? 'on' : ''} onClick={() => setIcon(k)}><Icon size={19} /></button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t.folderColor}</label>
        <div className="swatches">
          {COLORS.map((c) => <button key={c} className={'swatch' + (color === c ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />)}
        </div>
      </div>
      <button className="btn block" style={{ marginTop: 6 }} disabled={!name.trim()} onClick={save}>{folder ? t.save : t.create}</button>
    </Sheet>
  );
}

export function useFolderMenu() {
  const t = useT();
  const [menu, setMenu] = useState(null);
  const [edit, setEdit] = useState(null);
  const [locking, setLocking] = useState(null);
  const ex = useExporter();
  const open = (f) => setMenu(f);
  const folderItems = (f) => sortList(V.getState().items.filter((i) => i.folderId === f.id && !i.deletedAt && !i.archived), 'created');
  const canExport = (f) => !f.lock || V.isOpened(f.id);
  const el = (
    <>
      {menu && (
        <MenuSheet
          title={menu.name}
          onClose={() => setMenu(null)}
          items={[
            { icon: Pencil, label: t.rename, onClick: () => setEdit(menu) },
            canExport(menu) && { icon: FileDown, label: t.exportFolderPdf, onClick: () => ex.exportPdf(folderItems(menu), menu.name, 'save') },
            canExport(menu) && { icon: Share2, label: t.shareFolder, onClick: () => ex.exportPdf(folderItems(menu), menu.name, 'share') },
            { icon: menu.pinned ? PinOff : Pin, label: menu.pinned ? t.unpin : t.pin, onClick: () => V.saveFolder({ ...menu, pinned: !menu.pinned }) },
            menu.lock
              ? { icon: Unlock, label: t.removeLock, onClick: () => V.saveFolder({ ...menu, lock: null }) }
              : { icon: Lock, label: t.lockIt, onClick: () => setLocking(menu) },
            { icon: menu.archived ? ArchiveRestore : Archive, label: menu.archived ? t.unarchive : t.archiveIt, onClick: () => { V.saveFolder({ ...menu, archived: !menu.archived }); toast(t.done); } },
            { icon: Trash2, label: t.moveToTrash, danger: true, onClick: () => { V.saveFolder({ ...menu, deletedAt: Date.now() }); toast(t.done); } },
          ]}
        />
      )}
      {edit && <FolderSheet folder={edit} onClose={() => setEdit(null)} />}
      {ex.el}
      {locking && <SetLockSheet onClose={() => setLocking(null)} onSet={(lock) => { V.saveFolder({ ...locking, lock }); V.markOpened(locking.id); }} />}
    </>
  );
  return [open, el];
}

export function FolderCard({ f, count, onMenu }) {
  const nav = useNav();
  const t = useT();
  const Icon = FOLDER_ICONS[f.icon] || FOLDER_ICONS.folder;
  return (
    <div
      className="folder-card"
      role="button"
      tabIndex={0}
      style={{ '--fc': f.color, cursor: 'pointer' }}
      onClick={() => nav.go({ name: 'folder', id: f.id })}
      onContextMenu={(e) => { e.preventDefault(); onMenu(f); }}
    >
      <span className="big-ico"><Icon size={30} /></span>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="folder-ico"><Icon size={22} /></div>
        <div className="grow" />
        <div className="row" style={{ gap: 2, color: 'var(--muted)' }}>
          {f.pinned && <Pin size={14} />}
          {f.lock && <Lock size={14} />}
          <button className="icon-btn sm" style={{ marginInlineEnd: -8, marginTop: -6 }} onClick={(e) => { e.stopPropagation(); onMenu(f); }}>
            <MoreVertical size={18} />
          </button>
        </div>
      </div>
      <div>
        <div className="name">{f.name}</div>
        <div className="count">{f.lock ? t.locked : `${count} ${t.items}`}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const t = useT();
  const st = useSettings();
  const grid = st.grid || 'md';
  const nav = useNav();
  const { folders, items } = V.useVault();
  const [newFolder, setNewFolder] = useState(false);
  const [openMenu, menuEl] = useFolderMenu();
  const live = folders.filter((f) => !f.deletedAt && !f.archived).sort((a, b) => (b.pinned - a.pinned) || (a.order ?? 0) - (b.order ?? 0));
  const deadFolders = new Set(folders.filter((f) => f.deletedAt || f.archived).map((f) => f.id));
  const visible = items.filter((i) => !i.deletedAt && !i.archived && !deadFolders.has(i.folderId));
  const count = (id) => visible.filter((i) => i.folderId === id).length;
  const pinned = visible.filter((i) => i.pinned).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const pinnedIds = new Set(pinned.map((i) => i.id));
  const recent = visible.filter((i) => !pinnedIds.has(i.id)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  return (
    <div className="scroll">
      <header className="hero">
        <div className="container">
          <div className="row">
            <div className="brand grow"><span className="logo"><NotebookPen size={20} /></span>{t.appName}</div>
            <SyncBadge />
            <button className="icon-btn hide-desktop" onClick={() => nav.go({ name: 'settings' })} title={t.settings}><Settings size={21} /></button>
            <button className="icon-btn" onClick={nav.lock} title={t.lockNow}><Lock size={21} /></button>
          </div>
          <h2>{t.hello} 👋</h2>
          <p>{t.tagline}</p>
        </div>
      </header>
      <div className="container">
        <div className="searchbox" onClick={() => nav.go({ name: 'search' })}>
          <Search size={20} />
          <input readOnly placeholder={t.searchPlaceholder} />
        </div>
        <div className="quick-row hide-desktop">
          <button className="quick" onClick={() => nav.go({ name: 'favorites' })}><Star size={22} />{t.favorites}</button>
          <button className="quick" onClick={() => nav.go({ name: 'reminders' })}><Bell size={22} />{t.reminders}</button>
          <button className="quick" onClick={() => nav.go({ name: 'archive' })}><Archive size={22} />{t.archive}</button>
          <button className="quick" onClick={() => nav.go({ name: 'trash' })}><Trash2 size={22} />{t.trash}</button>
        </div>

        <div className="section-title">
          <h3>{t.folders}</h3>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="icon-btn sm"
              title={t.iconSize}
              onClick={() => setSettings({ grid: grid === 'sm' ? 'md' : grid === 'md' ? 'lg' : 'sm' })}
            >
              {grid === 'sm' ? <Grid3x3 size={19} /> : grid === 'md' ? <LayoutGrid size={19} /> : <Rows3 size={19} />}
            </button>
            <button className="chip-btn" onClick={() => setNewFolder(true)}><Plus size={16} />{t.newFolder}</button>
          </div>
        </div>
        <div className={'folder-grid ' + grid}>
          {live.map((f) => <FolderCard key={f.id} f={f} count={count(f.id)} onMenu={openMenu} />)}
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: 26 }}>🔒 {t.encryptedNote}</p>
      </div>
      {newFolder && <FolderSheet onClose={() => setNewFolder(false)} />}
      {menuEl}
    </div>
  );
}
