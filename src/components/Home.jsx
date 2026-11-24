import { useState, useRef, useEffect } from 'react';
import { NotebookPen, Search, Lock, Settings, Star, Archive, Trash2, Plus, Pin, MoreVertical, Pencil, Unlock, ArchiveRestore, PinOff, FileDown, Share2, Bell, LayoutGrid, Grid3x3, Rows3, FolderInput, FolderPlus, Move, Check, GripVertical, Home as HomeIco } from 'lucide-react';
import { useSettings, setSettings } from '../settings';
import { useExporter } from './Actions';
import { sortList, folderHelpers } from '../constants';
import { useT } from '../settings';
import { useNav } from '../App';
import * as V from '../vault';
import { FOLDER_ICONS, COLORS } from '../constants';
import { Sheet, MenuSheet, SetLockSheet, toast } from './ui';
import { ItemRow } from './Folder';
import { SyncBadge } from './Cloud';

export function FolderSheet({ folder, parentId = null, onClose }) {
  const t = useT();
  const nav = useNav();
  const [name, setName] = useState(folder?.name || '');
  const parent = parentId ? V.getState().folders.find((x) => x.id === parentId) : null;
  const [kind, setKind] = useState(folder?.kind || parent?.kind || 'notes');
  const [icon, setIcon] = useState(folder?.icon || 'folder');
  const [color, setColor] = useState(folder?.color || COLORS[0]);
  const save = () => {
    if (!name.trim()) return;
    if (folder) V.saveFolder({ ...folder, name: name.trim(), kind, icon, color });
    else {
      const f = { id: V.uid(), name: name.trim(), kind, icon, color, parentId: parentId || null, order: Date.now(), createdAt: Date.now(), pinned: false, archived: false };
      V.saveFolder(f);
      nav.go({ name: 'folder', id: f.id });
    }
    onClose();
  };
  return (
    <Sheet title={folder ? t.rename : parent ? `${t.newSubfolder} — ${parent.name}` : t.newFolder} onClose={onClose}>
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
  const [sub, setSub] = useState(null);
  const [moving, setMoving] = useState(null);
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
            { icon: FolderPlus, label: t.newSubfolder, onClick: () => setSub(menu) },
            { icon: FolderInput, label: t.moveFolder, onClick: () => setMoving(menu) },
            menu.lock
              ? { icon: Unlock, label: t.removeLock, onClick: () => V.saveFolder({ ...menu, lock: null }) }
              : { icon: Lock, label: t.lockIt, onClick: () => setLocking(menu) },
            { icon: menu.archived ? ArchiveRestore : Archive, label: menu.archived ? t.unarchive : t.archiveIt, onClick: () => { V.saveFolder({ ...menu, archived: !menu.archived }); toast(t.done); } },
            { icon: Trash2, label: t.moveToTrash, danger: true, onClick: () => { V.saveFolder({ ...menu, deletedAt: Date.now() }); toast(t.done); } },
          ]}
        />
      )}
      {edit && <FolderSheet folder={edit} onClose={() => setEdit(null)} />}
      {sub && <FolderSheet parentId={sub.id} onClose={() => setSub(null)} />}
      {moving && <MoveFolderSheet folder={moving} onClose={() => setMoving(null)} />}
      {ex.el}
      {locking && <SetLockSheet onClose={() => setLocking(null)} onSet={(lock) => { V.saveFolder({ ...locking, lock }); V.markOpened(locking.id); }} />}
    </>
  );
  return [open, el];
}

export function FolderCard({ f, count, onMenu, disabled }) {
  const nav = useNav();
  const t = useT();
  const Icon = FOLDER_ICONS[f.icon] || FOLDER_ICONS.folder;
  return (
    <div
      className="folder-card"
      role="button"
      tabIndex={0}
      style={{ '--fc': f.color, cursor: 'pointer' }}
      onClick={() => !disabled && nav.go({ name: 'folder', id: f.id })}
      onContextMenu={(e) => { e.preventDefault(); if (!disabled) onMenu(f); }}
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
        <div className="count">{f.lock ? t.locked : typeof count === 'object' ? `${count.items} ${t.items}${count.subs ? ` • ${count.subs} ${t.subfolders}` : ''}` : `${count} ${t.items}`}</div>
      </div>
    </div>
  );
}

function MoveFolderSheet({ folder, onClose }) {
  const t = useT();
  const { folders } = V.useVault();
  const h = folderHelpers(folders);
  const banned = new Set([folder.id, ...h.descendants(folder.id).map((f) => f.id)]);
  const targets = folders.filter((f) => !f.deletedAt && !banned.has(f.id)).sort((a, b) => h.path(a.id).localeCompare(h.path(b.id)));
  const move = (parentId) => {
    V.saveFolder({ ...folder, parentId, order: Date.now() });
    toast(t.done);
    onClose();
  };
  return (
    <Sheet title={t.moveFolder + ': ' + folder.name} onClose={onClose}>
      <div className="menu-list">
        {folder.parentId && (
          <button className="menu-item" onClick={() => move(null)}><HomeIco size={20} />{t.mainScreen}</button>
        )}
        {targets.filter((f) => f.id !== folder.parentId).map((f) => {
          const Icon = FOLDER_ICONS[f.icon] || FOLDER_ICONS.folder;
          return (
            <button key={f.id} className="menu-item" onClick={() => move(f.id)}>
              <span className="folder-ico" style={{ '--fc': f.color, width: 32, height: 32, borderRadius: 10 }}><Icon size={16} /></span>
              <span className="ellipsis">{h.path(f.id)}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// Folder grid with drag-to-reorder (pointer events: works with touch and mouse)
export function FolderGrid({ list, count, onMenu, grid, sorting }) {
  const [order, setOrder] = useState(null);
  const [dragId, setDragId] = useState(null);
  const ref = useRef(null);
  const ids = order || list.map((f) => f.id);
  const byId = new Map(list.map((f) => [f.id, f]));
  const shown = ids.map((id) => byId.get(id)).filter(Boolean);
  for (const f of list) if (!ids.includes(f.id)) shown.push(f);
  useEffect(() => {
    if (!sorting) setOrder(null);
  }, [sorting]);

  const start = (e, id) => {
    if (!sorting) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setOrder(shown.map((f) => f.id));
    setDragId(id);
  };
  const move = (e) => {
    if (!dragId) return;
    const scroller = ref.current?.closest('.scroll');
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (e.clientY < r.top + 60) scroller.scrollTop -= 12;
      else if (e.clientY > r.bottom - 60) scroller.scrollTop += 12;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-fid]');
    const over = el?.dataset.fid;
    if (!over || over === dragId) return;
    setOrder((cur) => {
      const a = [...(cur || shown.map((f) => f.id))];
      const from = a.indexOf(dragId);
      const to = a.indexOf(over);
      if (from < 0 || to < 0) return cur;
      a.splice(from, 1);
      a.splice(to, 0, dragId);
      return a;
    });
  };
  const end = () => {
    if (!dragId) return;
    setDragId(null);
    (order || []).forEach((id, i) => {
      const f = byId.get(id);
      if (f && f.order !== i) V.saveFolder({ ...f, order: i });
    });
  };
  return (
    <div ref={ref} className={'folder-grid ' + grid + (sorting ? ' sorting' : '')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {shown.map((f) => (
        <div key={f.id} data-fid={f.id} className={'sort-cell' + (dragId === f.id ? ' dragging' : '')} onPointerDown={(e) => start(e, f.id)}>
          <FolderCard f={f} count={count(f.id)} onMenu={onMenu} disabled={sorting} />
          {sorting && <span className="grip"><GripVertical size={18} /></span>}
        </div>
      ))}
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
  const [sorting, setSorting] = useState(false);
  const [openMenu, menuEl] = useFolderMenu();
  const h = folderHelpers(folders);
  const live = h.children(null);
  const visible = items.filter((i) => !i.deletedAt && !i.archived && !h.hidden(i.folderId));
  const count = (id) => ({ items: visible.filter((i) => i.folderId === id).length, subs: h.children(id).length });
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
            <button className={'icon-btn sm' + (sorting ? ' active' : '')} title={t.reorder} onClick={() => setSorting(!sorting)}>{sorting ? <Check size={19} /> : <Move size={18} />}</button>
            {!sorting && <button className="chip-btn" onClick={() => setNewFolder(true)}><Plus size={16} />{t.newFolder}</button>}
          </div>
        </div>
        {sorting && <p className="hint sort-hint">✋ {t.reorderHint}</p>}
        <FolderGrid list={live} count={count} onMenu={openMenu} grid={grid} sorting={sorting} />
        <p className="hint" style={{ textAlign: 'center', marginTop: 26 }}>🔒 {t.encryptedNote}</p>
      </div>
      {newFolder && <FolderSheet onClose={() => setNewFolder(false)} />}
      {menuEl}
    </div>
  );
}
