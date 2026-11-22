import { useState } from 'react';
import { Bell, Trash2, Info } from 'lucide-react';
import { useT, useSettings } from '../settings';
import * as V from '../vault';
import * as D from '../device';
import { itemsHtml, itemText } from '../printable';
import { Sheet, toast } from './ui';
import { fmtFull, htmlToText } from '../constants';

// ---------- busy overlay ----------
export function Busy({ text }) {
  return (
    <div className="scrim" style={{ alignItems: 'center' }}>
      <div className="card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="spinner" /> <b>{text}</b>
      </div>
    </div>
  );
}

// ---------- PDF / share actions ----------
export function useExporter() {
  const t = useT();
  const s = useSettings();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const folderName = (it) => V.getState().folders.find((f) => f.id === it.folderId)?.name || '';

  const run = async (items, title, mode) => {
    setBusy(true);
    try {
      const html = await itemsHtml(items, t, s.lang, items.length === 1 ? folderName(items[0]) : title);
      const bytes = await D.htmlToPdf(html);
      const name = D.safeName(title) + '.pdf';
      if (mode === 'share') await D.shareFile(bytes, name, 'application/pdf', title);
      else {
        const r = await D.saveFile(bytes, name, 'application/pdf');
        if (r) toast(t.savedTo + ' ' + (r.where || ''));
      }
    } catch (e) {
      if (!/cancel/i.test(String(e?.message))) toast('⚠️ ' + (e?.message || e));
    }
    setBusy(false);
  };
  const exportPdf = (items, title, mode = 'save') => {
    const sensitive = items.some((i) => i.type === 'account' && i.password);
    if (sensitive) setConfirm({ items, title, mode });
    else run(items, title, mode);
  };
  const shareText = async (it) => {
    const r = await D.shareText(itemText(it, t), it.title || t.appName);
    if (r === 'copied') toast(t.copiedToClipboard);
  };
  const el = (
    <>
      {busy && <Busy text={t.exporting} />}
      {confirm && (
        <Sheet onClose={() => setConfirm(null)}>
          <p style={{ fontWeight: 600, margin: '6px 4px 20px' }}>⚠️ {t.pdfWarn}</p>
          <div className="row">
            <button className="btn ghost grow" onClick={() => setConfirm(null)}>{t.cancel}</button>
            <button className="btn grow" onClick={() => { const c = confirm; setConfirm(null); run(c.items, c.title, c.mode); }}>{t.confirm}</button>
          </div>
        </Sheet>
      )}
    </>
  );
  return { exportPdf, shareText, el };
}

// ---------- reminders ----------
function toLocalInput(ts) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
export function ReminderSheet({ it, update, onClose }) {
  const t = useT();
  const r = it.reminder || {};
  const [when, setWhen] = useState(toLocalInput(r.at || Date.now() + 3600000));
  const [repeat, setRepeat] = useState(r.repeat || 'none');
  const [note, setNote] = useState(r.note || '');
  const [err, setErr] = useState('');
  const save = () => {
    const at = new Date(when).getTime();
    if (!at || (repeat === 'none' && at <= Date.now())) return setErr(t.reminderPast);
    update({ reminder: { at, repeat, note: note.trim() } });
    toast(t.reminderSet);
    onClose();
  };
  return (
    <Sheet title={r.at ? t.editReminder : t.setReminder} onClose={onClose}>
      <div className="field">
        <label>{t.reminderWhen}</label>
        <div className="input-wrap"><input type="datetime-local" className="ltr" style={{ textAlign: 'start' }} value={when} onChange={(e) => { setWhen(e.target.value); setErr(''); }} /></div>
      </div>
      <div className="field">
        <label>{t.repeat}</label>
        <div className="input-wrap">
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {D.REPEATS.map((k) => <option key={k} value={k}>{t['repeat_' + k]}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t.reminderNote}</label>
        <div className="input-wrap"><input className="auto-dir" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      {err && <div className="error">{err}</div>}
      <p className="hint hide-mobile">{t.trayHint}</p>
      <div className="row">
        {r.at && (
          <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={() => { update({ reminder: null }); onClose(); toast(t.done); }}>
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn grow" onClick={save}><Bell size={18} />{t.save}</button>
      </div>
    </Sheet>
  );
}

export function reminderLabel(r, t, lang) {
  if (!r?.at) return '';
  const next = D.nextFire(r) || r.at;
  return fmtFull(next, lang) + (r.repeat && r.repeat !== 'none' ? ' • ' + t['repeat_' + r.repeat] : '');
}

// ---------- details ----------
function fmtSize(n) {
  if (!n) return '0';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
export { fmtSize };

export function DetailsSheet({ it, onClose }) {
  const t = useT();
  const s = useSettings();
  const folder = V.getState().folders.find((f) => f.id === it.folderId);
  const text = it.type === 'note' ? htmlToText(it.html) : '';
  const rows = [
    [t.folder, folder?.name],
    [t.createdAt, fmtFull(it.createdAt, s.lang)],
    [t.modifiedAt, fmtFull(it.updatedAt, s.lang)],
    it.reminder?.at && [t.reminder, reminderLabel(it.reminder, t, s.lang)],
    it.type === 'note' && [t.words, text ? text.split(/\s+/).filter(Boolean).length : 0],
    it.type === 'note' && [t.characters, text.length],
    (it.attachments || []).length > 0 && [t.attachments, `${it.attachments.length} (${fmtSize(it.attachments.reduce((a, b) => a + (b.size || 0), 0))})`],
  ].filter(Boolean);
  return (
    <Sheet title={<><Info size={18} style={{ verticalAlign: -3, marginInlineEnd: 6 }} />{t.details}</>} onClose={onClose}>
      <div className="settings-group" style={{ boxShadow: 'none' }}>
        {rows.map(([k, v]) => (
          <div className="setting" key={k}>
            <span className="lbl muted" style={{ fontWeight: 500 }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
