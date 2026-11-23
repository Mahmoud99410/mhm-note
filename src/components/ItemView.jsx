import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pin, PinOff, Star, StarOff, Lock, Unlock, FolderInput, Archive, ArchiveRestore, Trash2, Check, Save, Bell, BellRing, Info, FileDown, Share2, FileText } from 'lucide-react';
import { useT } from '../settings';
import { useNav } from '../App';
import * as V from '../vault';
import { htmlToText, FOLDER_ICONS } from '../constants';
import { LockGate, MenuSheet, SetLockSheet, Sheet, toast } from './ui';
import { BackBtn } from './Folder';
import NoteEditor from './NoteEditor';
import { AccountEditor, ContactEditor, FileItemView, EventEditor } from './Editors';
import { useExporter, ReminderSheet, DetailsSheet } from './Actions';
import { syncNow } from '../sync';

function isEmpty(it) {
  if (!it) return false;
  if (it.type === 'note') return !it.title?.trim() && !htmlToText(it.html) && !(it.attachments || []).length;
  if (it.type === 'account') return !it.title?.trim() && !it.email && !it.username && !it.password && !it.notes;
  if (it.type === 'contact') return !it.title?.trim() && !(it.phones || []).some((p) => p.number) && !it.notes;
  if (it.type === 'file') return !(it.attachments || []).length;
  if (it.type === 'event') return !it.title?.trim() && !it.notes;
  return false;
}

export default function ItemView({ id }) {
  const t = useT();
  const nav = useNav();
  const { items, folders } = V.useVault();
  const it = items.find((x) => x.id === id);
  const [, force] = useState(0);
  const [menu, setMenu] = useState(false);
  const [locking, setLocking] = useState(false);
  const [moving, setMoving] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [remind, setRemind] = useState(false);
  const [details, setDetails] = useState(false);
  const ex = useExporter();
  const saveTimer = useRef(null);
  const latest = useRef(it);
  latest.current = it;

  // discard brand-new items that were left empty
  useEffect(() => () => {
    const cur = V.getState().items.find((x) => x.id === id);
    if (cur && cur.fresh && isEmpty(cur)) V.deleteForever(id);
    else V.flush().then(() => syncNow());
  }, [id]);

  if (!it) return <div className="topbar"><BackBtn /></div>;
  const folder = folders.find((f) => f.id === it.folderId);
  const locked = it.lock && !V.isOpened(it.id);
  const folderLocked = folder?.lock && !V.isOpened(folder.id);

  const update = (patch) => {
    const cur = latest.current;
    const next = { ...cur, ...patch, fresh: cur.fresh && isEmpty({ ...cur, ...patch }) };
    latest.current = next;
    V.saveItem(next);
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState('saved'), 700);
  };
  const saveNow = async () => {
    await V.flush();
    setSaveState('saved');
    toast(t.saved);
  };

  const gate = folderLocked ? folder : locked ? it : null;
  const title = it.title || t.untitled;
  return (
    <>
      <div className="topbar" style={it.type === 'note' ? { background: 'var(--page, var(--bg))' } : null}>
        <BackBtn />
        <div className="grow row" style={{ gap: 6 }}>
          {folder && <span className="muted ellipsis" style={{ fontSize: 13, fontWeight: 600, color: folder.color }}>{folder.name}</span>}
        </div>
        {!gate && (
          <>
            <span className="save-state hide-mobile">{saveState === 'saved' ? <><Check size={14} />{t.saved}</> : t.saving}</span>
            <button className={'icon-btn' + (it.reminder?.at ? ' active' : '')} title={t.reminder} onClick={() => setRemind(true)}>
              {it.reminder?.at ? <BellRing size={20} /> : <Bell size={20} />}
            </button>
            <button className="icon-btn" title={t.save} onClick={saveNow}><Save size={20} /></button>
            <button className={'icon-btn' + (it.favorite ? ' active' : '')} title={t.favorite} onClick={() => update({ favorite: !it.favorite })}>
              <Star size={20} fill={it.favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="icon-btn" onClick={() => setMenu(true)}><MoreVertical size={20} /></button>
          </>
        )}
      </div>
      {gate ? (
        <LockGate target={gate} title={gate === it ? title : gate.name} onOpen={() => force((x) => x + 1)} />
      ) : it.type === 'note' ? (
        <NoteEditor it={it} update={update} />
      ) : it.type === 'account' ? (
        <AccountEditor it={it} update={update} />
      ) : it.type === 'file' ? (
        <FileItemView it={it} update={update} />
      ) : it.type === 'event' ? (
        <EventEditor it={it} update={update} />
      ) : (
        <ContactEditor it={it} update={update} />
      )}
      {menu && (
        <MenuSheet
          title={title}
          onClose={() => setMenu(false)}
          items={[
            { icon: Info, label: t.details, onClick: () => setDetails(true) },
            { icon: Bell, label: it.reminder?.at ? t.editReminder : t.setReminder, onClick: () => setRemind(true) },
            { icon: FileDown, label: t.exportPdf, onClick: () => ex.exportPdf([it], it.title || t.untitled, 'save') },
            { icon: Share2, label: t.sharePdf, onClick: () => ex.exportPdf([it], it.title || t.untitled, 'share') },
            it.type !== 'file' && { icon: FileText, label: t.shareText, onClick: () => ex.shareText(it) },
            { icon: it.pinned ? PinOff : Pin, label: it.pinned ? t.unpin : t.pin, onClick: () => update({ pinned: !it.pinned }) },
            { icon: it.favorite ? StarOff : Star, label: it.favorite ? t.unfavorite : t.favorite, onClick: () => update({ favorite: !it.favorite }) },
            it.lock
              ? { icon: Unlock, label: t.removeLock, onClick: () => update({ lock: null }) }
              : { icon: Lock, label: t.lockIt, onClick: () => setLocking(true) },
            { icon: FolderInput, label: t.moveTo, onClick: () => setMoving(true) },
            { icon: it.archived ? ArchiveRestore : Archive, label: it.archived ? t.unarchive : t.archiveIt, onClick: () => { update({ archived: !it.archived }); toast(t.done); if (!it.archived) nav.back(); } },
            { icon: Trash2, label: t.moveToTrash, danger: true, onClick: () => { update({ deletedAt: Date.now(), fresh: false }); toast(t.done); nav.back(); } },
          ]}
        />
      )}
      {remind && <ReminderSheet it={it} update={update} onClose={() => setRemind(false)} />}
      {details && <DetailsSheet it={it} onClose={() => setDetails(false)} />}
      {ex.el}
      {locking && <SetLockSheet onClose={() => setLocking(false)} onSet={(lock) => { V.markOpened(it.id); update({ lock }); toast(t.done); }} />}
      {moving && (
        <Sheet title={t.moveTo} onClose={() => setMoving(false)}>
          <div className="menu-list">
            {folders
              .filter((f) => !f.deletedAt && f.id !== it.folderId && kindFits(f.kind, it.type))
              .map((f) => {
                const Icon = FOLDER_ICONS[f.icon] || FOLDER_ICONS.folder;
                return (
                  <button key={f.id} className="menu-item" onClick={() => { update({ folderId: f.id }); setMoving(false); toast(t.done); }}>
                    <span className="folder-ico" style={{ '--fc': f.color, width: 34, height: 34, borderRadius: 10 }}><Icon size={17} /></span>
                    {f.name}
                  </button>
                );
              })}
          </div>
        </Sheet>
      )}
    </>
  );
}

function kindFits(kind, type) {
  return (kind === 'notes' && type === 'note') || (kind === 'accounts' && type === 'account') || (kind === 'contacts' && type === 'contact') || (kind === 'files' && type === 'file') || (kind === 'events' && type === 'event');
}
