import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Lock, Delete, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { bioEnabled, bioVerify, platform } from '../native';
import { useT } from '../settings';
import { hashSecret, verifySecret, markOpened } from '../vault';

// ---------- toast ----------
let toastMsg = null;
let toastTimer;
const tl = new Set();
export function toast(msg) {
  toastMsg = msg;
  tl.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg = null;
    tl.forEach((l) => l());
  }, 1800);
}
export function ToastHost() {
  const m = useSyncExternalStore((l) => (tl.add(l), () => tl.delete(l)), () => toastMsg);
  if (!m) return null;
  return (
    <div className="toast">
      <Check size={16} /> {m}
    </div>
  );
}

export async function copyText(text, t) {
  try {
    await navigator.clipboard.writeText(text || '');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text || '';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(t.copied);
}

// ---------- sheet ----------
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog">
        <div className="grab" />
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function MenuSheet({ title, items, onClose }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="menu-list">
        {items.filter(Boolean).map((it, i) => (
          <button
            key={i}
            className={'menu-item' + (it.danger ? ' danger' : '')}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            {it.icon && <it.icon size={20} />}
            {it.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function Confirm({ text, onYes, onClose, danger = true }) {
  const t = useT();
  return (
    <Sheet onClose={onClose}>
      <p style={{ fontSize: 16, fontWeight: 600, margin: '6px 4px 20px' }}>{text}</p>
      <div className="row">
        <button className="btn ghost grow" onClick={onClose}>{t.cancel}</button>
        <button className={'btn grow ' + (danger ? 'danger' : '')} onClick={() => { onClose(); onYes(); }}>{t.confirm}</button>
      </div>
    </Sheet>
  );
}

export function PasswordInput({ value, onChange, placeholder, autoFocus, onEnter, autoComplete = 'off' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input
        className="ltr"
        style={{ textAlign: 'start' }}
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
      <button type="button" className="icon-btn sm" onClick={() => setShow(!show)}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

// ---------- PIN pad ----------
export function PinPad({ onComplete, error }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (error) {
      setShake(true);
      setPin('');
      const id = setTimeout(() => setShake(false), 400);
      return () => clearTimeout(id);
    }
  }, [error]);
  const press = (d) => {
    if (pin.length >= 4) return;
    const p = pin + d;
    setPin(p);
    if (p.length === 4) setTimeout(() => { onComplete(p); setPin(''); }, 120);
  };
  useEffect(() => {
    const k = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div>
      <div className={'pin-dots' + (shake ? ' shake' : '')}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <span />
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => setPin(pin.slice(0, -1))}><Delete size={22} /></button>
      </div>
    </div>
  );
}

// Unlock screen for a locked folder / page
export function LockGate({ target, onOpen, title }) {
  const t = useT();
  const [err, setErr] = useState(0);
  const [pw, setPw] = useState('');
  const check = async (secret) => {
    if (await verifySecret(secret, target.lock)) {
      markOpened(target.id);
      onOpen();
    } else setErr((e) => e + 1);
  };
  const bio = platform !== 'web' && bioEnabled();
  const tryBio = async () => {
    try {
      if (await bioVerify(t)) {
        markOpened(target.id);
        onOpen();
      }
    } catch {}
  };
  useEffect(() => {
    if (bio) tryBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="lock-screen">
      <div className="lock-ico"><Lock size={32} /></div>
      <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
      <p className="muted" style={{ marginTop: 0 }}>{target.lock.type === 'pin' ? t.enterPin : t.enterLockPassword}</p>
      {target.lock.type === 'pin' ? (
        <PinPad onComplete={check} error={err} />
      ) : (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <PasswordInput value={pw} onChange={setPw} autoFocus onEnter={() => check(pw)} />
          {err > 0 && <div className="error" style={{ marginTop: 8 }}>{t.wrongPassword}</div>}
          <button className="btn block" style={{ marginTop: 12 }} onClick={() => check(pw)}>{t.open}</button>
        </div>
      )}
      {bio && (
        <button className="bio-btn" title={t.bioOpen} onClick={tryBio}><Fingerprint size={34} /></button>
      )}
    </div>
  );
}

export function SetLockSheet({ onSet, onClose }) {
  const t = useT();
  const [type, setType] = useState('pin');
  const [first, setFirst] = useState(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(0);
  const finish = async (secret) => {
    const h = await hashSecret(secret);
    onSet({ type, ...h });
    onClose();
  };
  return (
    <Sheet title={t.lockIt} onClose={onClose}>
      <div className="seg" style={{ marginBottom: 18 }}>
        <button className={type === 'pin' ? 'on' : ''} onClick={() => { setType('pin'); setFirst(null); }}>{t.pin4}</button>
        <button className={type === 'password' ? 'on' : ''} onClick={() => setType('password')}>{t.passwordLock}</button>
      </div>
      {type === 'pin' ? (
        <>
          <p className="muted" style={{ textAlign: 'center', margin: 0 }}>{first ? t.confirmPassword : t.setPin}</p>
          {err > 0 && <div className="error" style={{ textAlign: 'center', margin: '4px 0 0' }}>{t.pwMismatch}</div>}
          <PinPad
            key={first ? 'b' : 'a'}
            error={err}
            onComplete={(p) => {
              if (!first) return setFirst(p);
              if (p === first) finish(p);
              else { setFirst(null); setErr((e) => e + 1); }
            }}
          />
        </>
      ) : (
        <>
          <div className="field">
            <label>{t.setLockPassword}</label>
            <PasswordInput value={pw} onChange={setPw} autoFocus onEnter={() => pw.length >= 4 && finish(pw)} />
          </div>
          <button className="btn block" disabled={pw.length < 4} onClick={() => finish(pw)}>{t.save}</button>
        </>
      )}
    </Sheet>
  );
}
