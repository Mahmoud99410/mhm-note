import { useState } from 'react';
import { Copy, Eye, EyeOff, ExternalLink, Phone, Plus, X, FileText, Share2, Download, Trash2 } from 'lucide-react';
import * as V from '../vault';
import * as D from '../device';
import { fmtSize } from './Actions';
import { showFile, viewable, KindIcon, kindColor } from './FileViewer';
import { useT, useSettings } from '../settings';
import { PLATFORMS, platformColor, COLORS, fmtFull } from '../constants';
import { copyText, Confirm, toast } from './ui';
import { alertLabel } from '../device';

function Dates({ it }) {
  const t = useT();
  const s = useSettings();
  return (
    <p className="hint" style={{ textAlign: 'center', marginTop: 18 }}>
      🕒 {t.createdAt}: {fmtFull(it.createdAt, s.lang)}<br />✎ {t.modifiedAt}: {fmtFull(it.updatedAt, s.lang)}
    </p>
  );
}

function CopyField({ kind, label, value, onChange, secret, ltr = true, type = 'text', extra }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label><span className={'field-kind ' + kind}>{label}</span></label>
      <div className="input-wrap">
        <input
          className={ltr ? 'ltr' : 'auto-dir'}
          style={{ textAlign: 'start', fontFamily: secret && show ? 'ui-monospace, Menlo, Consolas, monospace' : undefined }}
          type={secret && !show ? 'password' : type}
          value={value || ''}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        {secret && (
          <button className="icon-btn sm" title={show ? t.hide : t.show} onClick={() => setShow(!show)}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {extra}
        <button className="icon-btn sm" title={t.copy} disabled={!value} style={!value ? { opacity: 0.35 } : null} onClick={() => copyText(value, t)}>
          <Copy size={18} />
        </button>
      </div>
    </div>
  );
}

export function AccountEditor({ it, update }) {
  const t = useT();
  const color = it.color || platformColor(it.title);
  return (
    <div className="scroll">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="detail-head">
          <div className="badge" style={{ '--bc': color }}>{(it.title || '?').trim().charAt(0).toUpperCase()}</div>
          <input
            autoFocus={it.fresh}
            placeholder={t.platform}
            value={it.title}
            onChange={(e) => update({ title: e.target.value, color: PLATFORMS.find((p) => p.name.toLowerCase() === e.target.value.trim().toLowerCase())?.color || it.color })}
          />
        </div>
        <div className="platforms">
          {PLATFORMS.map((p) => (
            <button key={p.name} className="platform-chip" onClick={() => update({ title: p.name, color: p.color })}>
              <i style={{ background: p.color, color: p.name === 'Snapchat' ? '#222' : '#fff' }}>{p.name[0]}</i>
              {p.name}
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: '18px 16px 4px' }}>
          <CopyField kind="email" label={t.email} type="email" value={it.email} onChange={(v) => update({ email: v })} />
          <CopyField kind="user" label={t.username} value={it.username} onChange={(v) => update({ username: v })} />
          <CopyField kind="pass" label={t.password} secret value={it.password} onChange={(v) => update({ password: v })} />
          <CopyField
            kind="phone"
            label={t.link}
            type="url"
            value={it.url}
            onChange={(v) => update({ url: v })}
            extra={
              it.url ? (
                <a className="icon-btn sm" href={/^https?:\/\//i.test(it.url) ? it.url : 'https://' + it.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={18} />
                </a>
              ) : null
            }
          />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>{t.notes}</label>
          <div className="input-wrap">
            <textarea className="auto-dir" value={it.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={4} />
          </div>
        </div>
        <div className="field">
          <label>{t.folderColor}</label>
          <div className="swatches">
            {COLORS.map((c) => <button key={c} className={'swatch' + (it.color === c ? ' on' : '')} style={{ background: c }} onClick={() => update({ color: c })} />)}
          </div>
        </div>
        <Dates it={it} />
      </div>
    </div>
  );
}

export function ContactEditor({ it, update }) {
  const t = useT();
  const phones = it.phones?.length ? it.phones : [{ number: '' }];
  const setPhone = (i, patch) => update({ phones: phones.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div className="scroll">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="detail-head">
          <div className="badge" style={{ '--bc': it.color || '#17845a' }}>{(it.title || '#').trim().charAt(0).toUpperCase()}</div>
          <div className="grow" style={{ fontSize: 21, fontWeight: 700 }}>{it.title || <span className="muted">{t.newContact}</span>}</div>
        </div>
        <div className="card" style={{ padding: '18px 16px 4px' }}>
          <div className="field">
            <label><span className="field-kind user">👤 {t.name}</span></label>
            <div className="input-wrap"><input className="auto-dir" autoFocus={it.fresh} placeholder={t.namePh} value={it.title} onChange={(e) => update({ title: e.target.value })} /></div>
          </div>
          {phones.map((p, i) => (
            <div className="field" key={i}>
              <label className="row" style={{ justifyContent: 'space-between' }}>
                <span className="field-kind phone">📞 {t.phone}{phones.length > 1 ? ` ${i + 1}` : ''}</span>
              </label>
              <div className="input-wrap">
                <input className="ltr" style={{ textAlign: 'start' }} type="tel" inputMode="tel" placeholder="07X XXX XXXX" value={p.number} onChange={(e) => setPhone(i, { number: e.target.value })} />
                {p.number && (
                  <a className="icon-btn sm" href={'tel:' + p.number.replace(/[^\d+]/g, '')} title={t.call}><Phone size={18} /></a>
                )}
                <button className="icon-btn sm" disabled={!p.number} style={!p.number ? { opacity: 0.35 } : null} onClick={() => copyText(p.number, t)}><Copy size={18} /></button>
                {phones.length > 1 && (
                  <button className="icon-btn sm" onClick={() => update({ phones: phones.filter((_, j) => j !== i) })}><X size={18} /></button>
                )}
              </div>
            </div>
          ))}
          <button className="chip-btn" style={{ marginBottom: 16 }} onClick={() => update({ phones: [...phones, { number: '' }] })}>
            <Plus size={16} /> {t.addPhone}
          </button>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>{t.notes}</label>
          <div className="input-wrap">
            <textarea className="auto-dir" value={it.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={4} />
          </div>
        </div>
        <Dates it={it} />
      </div>
    </div>
  );
}

// ---------- encrypted file attachments (PDF) ----------
async function withBytes(a, fn, t) {
  try {
    const bytes = await V.blobBytes(a.id);
    if (!bytes) throw new Error('missing');
    await fn(bytes);
  } catch (e) {
    if (!/cancel/i.test(String(e?.message))) toast('⚠️ ' + (e?.message || e));
  }
}
export const fileOpen = (a, t) => withBytes(a, async (b) => (viewable(a.name, a.type) ? showFile(a.name, b) : D.openFile(b, a.name, a.type)), t);
export const fileShare = (a, t) => withBytes(a, (b) => D.shareFile(b, a.name, a.type, a.name), t);
export const fileSave = (a, t) =>
  withBytes(a, async (b) => {
    const r = await D.saveFile(b, a.name, a.type);
    if (r) toast(t.savedTo + ' ' + (r.where || ''));
  }, t);

export function FileChips({ it, update }) {
  const t = useT();
  const [del, setDel] = useState(null);
  const files = (it.attachments || []).filter((a) => a.type && !a.type.startsWith('image/'));
  if (!files.length) return null;
  return (
    <>
      <div className="hint" style={{ marginTop: 22, fontWeight: 700 }}>🔒 {t.attachments}</div>
      <div className="list" style={{ marginTop: 8 }}>
        {files.map((a) => (
          <div key={a.id} className="item" style={{ padding: '10px 12px' }}>
            <button className="badge" style={{ '--bc': kindColor(a.name, a.type), width: 40, height: 40 }} onClick={() => fileOpen(a, t)}><KindIcon name={a.name} type={a.type} /></button>
            <button className="grow" style={{ textAlign: 'start' }} onClick={() => fileOpen(a, t)}>
              <div className="t ellipsis auto-dir" style={{ fontSize: 14 }}>{a.name}</div>
              <div className="s">{fmtSize(a.size)}</div>
            </button>
            <button className="icon-btn sm" title={t.share} onClick={() => fileShare(a, t)}><Share2 size={17} /></button>
            <button className="icon-btn sm" title={t.saveFileTo} onClick={() => fileSave(a, t)}><Download size={17} /></button>
            <button className="icon-btn sm" title={t.delete} onClick={() => setDel(a)}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      {del && (
        <Confirm
          text={t.delete + ': ' + del.name + '؟'}
          onClose={() => setDel(null)}
          onYes={async () => {
            await V.removeImage(del.id);
            update({ attachments: it.attachments.filter((x) => x.id !== del.id) });
          }}
        />
      )}
    </>
  );
}

export function FileItemView({ it, update }) {
  const t = useT();
  const a = it.attachments?.[0];
  return (
    <div className="scroll">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card" style={{ padding: 22, textAlign: 'center', marginTop: 10 }}>
          <button className="badge" style={{ '--bc': a ? kindColor(a.name, a.type) : '#e0473e', width: 84, height: 84, borderRadius: 26, margin: '0 auto 12px' }} onClick={() => a && fileOpen(a, t)}>
            {a ? <KindIcon name={a.name} type={a.type} size={42} /> : <FileText size={42} />}
          </button>
          <input
            className="title-input"
            style={{ textAlign: 'center', fontSize: 19 }}
            value={it.title}
            placeholder={t.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          {a && <div className="hint ltr">{a.name} • {fmtSize(a.size)}</div>}
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn grow" onClick={() => a && fileOpen(a, t)}><FileText size={18} />{t.openFile}</button>
            <button className="btn ghost" title={t.share} onClick={() => a && fileShare(a, t)}><Share2 size={18} /></button>
            <button className="btn ghost" title={t.saveFileTo} onClick={() => a && fileSave(a, t)}><Download size={18} /></button>
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>{t.notes}</label>
          <div className="input-wrap">
            <textarea className="auto-dir" value={it.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={4} />
          </div>
        </div>
        <Dates it={it} />
      </div>
    </div>
  );
}

// ---------- match / appointment ----------
export const ALERT_CHOICES = [0, 15, 30, 60, 120, 180, 1440, 2880];
export const DURATIONS = [60, 90, 120, 150, 180, 240];
function toLocalInput(ts) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
export function countdown(it, t, now = Date.now()) {
  const start = it.at;
  const end = start + (it.duration || 120) * 60000;
  if (now >= end) return { text: t.eventEnded, state: 'ended' };
  if (now >= start) return { text: t.eventLive, state: 'live' };
  const m = Math.round((start - now) / 60000);
  if (m < 60) return { text: `${t.startsIn} ${m} ${t.minutesShort}`, state: 'soon' };
  const h = Math.round(m / 60);
  if (h < 48) return { text: `${t.startsIn} ${h} ${t.hours}`, state: 'soon' };
  return { text: `${t.startsIn} ${Math.round(h / 24)} ${t.days}`, state: 'later' };
}

export function EventEditor({ it, update }) {
  const t = useT();
  const s = useSettings();
  const alerts = it.alerts || [];
  const toggle = (m) => update({ alerts: alerts.includes(m) ? alerts.filter((x) => x !== m) : [...alerts, m].sort((a, b) => b - a) });
  const cd = countdown(it, t);
  return (
    <div className="scroll">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="detail-head">
          <div className="badge" style={{ '--bc': '#17845a', fontSize: 26 }}>⚽</div>
          <input autoFocus={it.fresh} placeholder={t.eventTitlePh} value={it.title} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div className={'event-banner ' + cd.state}>{cd.text}</div>
        <div className="card" style={{ padding: '18px 16px 4px' }}>
          <div className="field">
            <label>{t.eventStart}</label>
            <div className="input-wrap">
              <input type="datetime-local" className="ltr" style={{ textAlign: 'start' }} value={toLocalInput(it.at)} onChange={(e) => e.target.value && update({ at: new Date(e.target.value).getTime() })} />
            </div>
          </div>
          <div className="field">
            <label>{t.eventDuration}</label>
            <div className="input-wrap">
              <select value={it.duration || 120} onChange={(e) => update({ duration: Number(e.target.value) })}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d % 60 ? `${(d / 60).toFixed(1)} ${t.hours}` : `${d / 60} ${d / 60 >= 3 ? t.hoursFew || t.hours : t.hours}`}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>🔔 {t.remindMe}</label>
            <div className="chips">
              {ALERT_CHOICES.map((m) => (
                <button key={m} className={'chip' + (alerts.includes(m) ? ' on' : '')} onClick={() => toggle(m)}>{alertLabel(m, t)}</button>
              ))}
            </div>
          </div>
          <div className="setting" style={{ borderBottom: 0 }}>
            <span className="lbl" style={{ fontWeight: 500 }}>{t.autoDeleteEvent}</span>
            <button className={'switch' + (it.autoDelete !== false ? ' on' : '')} onClick={() => update({ autoDelete: it.autoDelete === false })} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>{t.notes}</label>
          <div className="input-wrap">
            <textarea className="auto-dir" placeholder={t.eventNotesPh} value={it.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={3} />
          </div>
        </div>
        <Dates it={it} />
        {s.lang && null}
      </div>
    </div>
  );
}
