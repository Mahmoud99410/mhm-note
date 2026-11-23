import { useState } from 'react';
import { useEffect } from 'react';
import { NotebookPen, Copy, ShieldCheck, Languages, Fingerprint, CloudDownload } from 'lucide-react';
import * as N from '../native';
import { RestoreFromCloud } from './Cloud';
import { useT, useSettings, setSettings } from '../settings';
import { PasswordInput, copyText } from './ui';
import * as V from '../vault';
import { seedFolders } from '../constants';

function Shell({ children }) {
  const s = useSettings();
  return (
    <div className="auth">
      <button
        className="icon-btn"
        style={{ position: 'absolute', top: 'calc(12px + var(--safe-top))', insetInlineEnd: 12, zIndex: 2, color: '#fff' }}
        onClick={() => setSettings({ lang: s.lang === 'ar' ? 'en' : 'ar' })}
        title="Language"
      >
        <Languages size={20} />
      </button>
      <div className="auth-card">
        <div className="auth-logo"><NotebookPen size={34} /><span className="dot" /></div>
        {children}
      </div>
    </div>
  );
}

export function Setup({ onCreated, onRestored }) {
  const t = useT();
  const s = useSettings();
  const [restore, setRestore] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (pw.length < 8) return setErr(t.pwTooShort);
    if (pw !== pw2) return setErr(t.pwMismatch);
    setBusy(true);
    const key = await V.createVault(pw, seedFolders(s.lang));
    onCreated(key);
  };
  if (restore) return <Shell><RestoreFromCloud onDone={onRestored} onBack={() => setRestore(false)} /></Shell>;
  return (
    <Shell>
      <h1>{t.appName}</h1>
      <p className="sub">{t.tagline}</p>
      <p className="hint" style={{ margin: '0 4px 16px' }}>{t.createVaultHint}</p>
      <div className="field"><label>{t.masterPassword}</label><PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(''); }} autoFocus autoComplete="new-password" /></div>
      <div className="field"><label>{t.confirmPassword}</label><PasswordInput value={pw2} onChange={(v) => { setPw2(v); setErr(''); }} onEnter={go} autoComplete="new-password" /></div>
      {err && <div className="error">{err}</div>}
      <button className="btn block" disabled={busy} onClick={go}>{busy ? t.creating : t.createVault}</button>
      {(
        <button className="link-btn" onClick={() => setRestore(true)}><CloudDownload size={16} style={{ verticalAlign: -3, marginInlineEnd: 6 }} />{t.restoreFromCloud}</button>
      )}
    </Shell>
  );
}

export function RecoveryKeyScreen({ recoveryKey, onDone }) {
  const t = useT();
  return (
    <Shell>
      <h1 style={{ fontSize: 20 }}>{t.recoveryTitle}</h1>
      <p className="hint" style={{ textAlign: 'center', margin: '8px 4px 0' }}>{t.recoveryHint}</p>
      <div className="recovery-box">{recoveryKey}</div>
      <button className="btn ghost block" style={{ marginBottom: 10 }} onClick={() => copyText(recoveryKey, t)}><Copy size={18} /> {t.copy}</button>
      <button className="btn block" onClick={onDone}><ShieldCheck size={18} /> {t.recoverySaved}</button>
    </Shell>
  );
}

export function Unlock({ onUnlocked }) {
  const t = useT();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('pw');
  const [rk, setRk] = useState('');
  const [npw, setNpw] = useState('');
  const bio = N.bioEnabled() && N.platform !== 'web';
  const tryBio = async () => {
    setErr('');
    try {
      const key = await N.bioGet(t);
      setBusy(true);
      await V.unlockWithRawKey(key);
      onUnlocked();
    } catch {
      setBusy(false);
      setErr(t.bioFailed);
    }
  };
  useEffect(() => {
    if (bio) tryBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = async () => {
    if (!pw) return;
    setBusy(true);
    setErr('');
    try {
      await V.unlock(pw);
      onUnlocked();
    } catch {
      setErr(t.wrongPassword);
      setBusy(false);
    }
  };
  const doRecover = async () => {
    if (npw.length < 8) return setErr(t.pwTooShort);
    setBusy(true);
    setErr('');
    try {
      await V.recover(rk, npw);
      onUnlocked();
    } catch {
      setErr(t.wrongKey);
      setBusy(false);
    }
  };
  if (mode === 'recover')
    return (
      <Shell>
        <h1 style={{ fontSize: 20 }}>{t.recoveryKey}</h1>
        <p className="sub">{t.enterRecovery}</p>
        <div className="field"><label>{t.recoveryKey}</label><div className="input-wrap"><input className="ltr" value={rk} onChange={(e) => setRk(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autoFocus /></div></div>
        <div className="field"><label>{t.newPassword}</label><PasswordInput value={npw} onChange={setNpw} onEnter={doRecover} autoComplete="new-password" /></div>
        {err && <div className="error">{err}</div>}
        <button className="btn block" disabled={busy} onClick={doRecover}>{busy ? t.unlocking : t.restore}</button>
        <button className="link-btn" onClick={() => { setMode('pw'); setErr(''); }}>{t.back}</button>
      </Shell>
    );
  return (
    <Shell>
      <h1>{t.appName}</h1>
      <p className="sub">{t.tagline}</p>
      <div className="field"><label>{t.masterPassword}</label><PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(''); }} autoFocus onEnter={go} autoComplete="current-password" /></div>
      {err && <div className="error">{err}</div>}
      <button className="btn block" disabled={busy || !pw} onClick={go}>{busy ? t.unlocking : t.unlock}</button>
      {bio && <button className="bio-btn" title={t.bioUnlock} onClick={tryBio}><Fingerprint size={34} /></button>}
      <button className="link-btn" onClick={() => { setMode('recover'); setErr(''); }}>{t.forgotPassword}</button>
    </Shell>
  );
}
