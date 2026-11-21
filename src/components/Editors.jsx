import { useState } from 'react';
import { Copy, Eye, EyeOff, ExternalLink, Phone, Plus, X } from 'lucide-react';
import { useT, useSettings } from '../settings';
import { PLATFORMS, platformColor, COLORS, fmtFull } from '../constants';
import { copyText } from './ui';

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
          <input autoFocus={it.fresh} placeholder={t.name} value={it.title} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div className="card" style={{ padding: '18px 16px 4px' }}>
          {phones.map((p, i) => (
            <div className="field" key={i}>
              <label className="row" style={{ justifyContent: 'space-between' }}>
                <span className="field-kind phone">{t.phone}{phones.length > 1 ? ` ${i + 1}` : ''}</span>
              </label>
              <div className="input-wrap">
                <input
                  className="auto-dir"
                  style={{ width: 90, flex: '0 0 90px', fontSize: 13.5 }}
                  placeholder={t.title}
                  value={p.label || ''}
                  onChange={(e) => setPhone(i, { label: e.target.value })}
                />
                <span style={{ width: 1, height: 26, background: 'var(--border)' }} />
                <input className="ltr" style={{ textAlign: 'start' }} type="tel" value={p.number} onChange={(e) => setPhone(i, { number: e.target.value })} />
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
