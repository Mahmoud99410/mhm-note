import { useState } from 'react';
import { Settings, KeyRound, ShieldCheck, Lock, ChevronLeft, Copy } from 'lucide-react';
import { useT, useSettings, setSettings } from '../settings';
import { useNav } from '../App';
import * as V from '../vault';
import { BackBtn } from './Folder';
import { Sheet, PasswordInput, copyText, toast } from './ui';
import { SyncSection, BiometricRow } from './Cloud';

export const APP_VERSION = '0.5.0';

function ChangePassword({ onClose }) {
  const t = useT();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (b.length < 8) return setErr(t.pwTooShort);
    if (b !== c) return setErr(t.pwMismatch);
    setBusy(true);
    try {
      await V.changePassword(a, b);
      toast(t.passwordChanged);
      onClose();
    } catch {
      setErr(t.wrongPassword);
      setBusy(false);
    }
  };
  return (
    <Sheet title={t.changePassword} onClose={onClose}>
      <div className="field"><label>{t.currentPassword}</label><PasswordInput value={a} onChange={setA} autoFocus /></div>
      <div className="field"><label>{t.newPassword}</label><PasswordInput value={b} onChange={setB} /></div>
      <div className="field"><label>{t.confirmPassword}</label><PasswordInput value={c} onChange={setC} onEnter={go} /></div>
      {err && <div className="error">{err}</div>}
      <button className="btn block" disabled={busy} onClick={go}>{t.save}</button>
    </Sheet>
  );
}

function NewRecovery({ onClose }) {
  const t = useT();
  const [pw, setPw] = useState('');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const go = async () => {
    try {
      setKey(await V.newRecoveryKey(pw));
    } catch {
      setErr(t.wrongPassword);
    }
  };
  return (
    <Sheet title={t.newRecovery} onClose={onClose}>
      {key ? (
        <>
          <p className="hint">{t.recoveryHint}</p>
          <div className="recovery-box">{key}</div>
          <div className="row">
            <button className="btn ghost grow" onClick={() => copyText(key, t)}><Copy size={18} />{t.copy}</button>
            <button className="btn grow" onClick={onClose}>{t.recoverySaved}</button>
          </div>
        </>
      ) : (
        <>
          <div className="field"><label>{t.masterPassword}</label><PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(''); }} autoFocus onEnter={go} /></div>
          {err && <div className="error">{err}</div>}
          <button className="btn block" onClick={go}>{t.confirm}</button>
        </>
      )}
    </Sheet>
  );
}

export default function SettingsView() {
  const t = useT();
  const s = useSettings();
  const nav = useNav();
  const [sheet, setSheet] = useState(null);
  const chev = <ChevronLeft size={18} className="muted" style={{ transform: s.lang === 'ar' ? 'none' : 'scaleX(-1)' }} />;
  return (
    <>
      <div className="topbar">
        {nav.canBack && <BackBtn />}
        <Settings size={20} style={{ color: 'var(--primary)', marginInline: 6 }} />
        <h1>{t.settings}</h1>
      </div>
      <div className="scroll">
        <div className="container" style={{ maxWidth: 640, paddingTop: 8 }}>
          <div className="side-label" style={{ paddingInline: 4 }}>{t.appearance}</div>
          <div className="settings-group">
            <div className="setting">
              <span className="lbl">{t.language}</span>
              <div className="seg" style={{ width: 190 }}>
                <button className={s.lang === 'ar' ? 'on' : ''} onClick={() => setSettings({ lang: 'ar' })}>العربية</button>
                <button className={s.lang === 'en' ? 'on' : ''} onClick={() => setSettings({ lang: 'en' })}>English</button>
              </div>
            </div>
            <div className="setting" style={{ flexWrap: 'wrap' }}>
              <span className="lbl">{t.theme}</span>
              <div className="seg" style={{ width: 260 }}>
                {['light', 'dark', 'system'].map((k) => (
                  <button key={k} className={s.theme === k ? 'on' : ''} onClick={() => setSettings({ theme: k })}>{t[k]}</button>
                ))}
              </div>
            </div>
            <div className="setting" style={{ flexWrap: 'wrap' }}>
              <span className="lbl">{t.uiFontSize}</span>
              <div className="seg" style={{ width: 300 }}>
                {[[0.9, 's'], [1, 'm'], [1.12, 'l'], [1.25, 'xl']].map(([v, k]) => (
                  <button key={k} className={(s.scale || 1) === v ? 'on' : ''} onClick={() => setSettings({ scale: v })} style={{ fontSize: 11 + v * 3 }}>{t['font_' + k]}</button>
                ))}
              </div>
            </div>
            <div className="setting" style={{ flexWrap: 'wrap' }}>
              <span className="lbl">{t.iconSize}</span>
              <div className="seg" style={{ width: 240 }}>
                {['sm', 'md', 'lg'].map((k) => (
                  <button key={k} className={(s.grid || 'md') === k ? 'on' : ''} onClick={() => setSettings({ grid: k })}>{t[{ sm: 'small', md: 'medium', lg: 'large' }[k]]}</button>
                ))}
              </div>
            </div>
            <div className="setting">
              <span className="lbl">{t.accent}</span>
              <div className="swatches">
                <button className={'swatch' + (s.accent === 'green' ? ' on' : '')} style={{ background: '#17845a' }} title={t.green} onClick={() => setSettings({ accent: 'green' })} />
                <button className={'swatch' + (s.accent === 'yellow' ? ' on' : '')} style={{ background: '#f6c437' }} title={t.yellow} onClick={() => setSettings({ accent: 'yellow' })} />
              </div>
            </div>
          </div>

          <SyncSection />

          <div className="side-label" style={{ paddingInline: 4 }}>{t.security}</div>
          <div className="settings-group">
            <BiometricRow />
            <div className="setting">
              <Lock size={19} className="muted" />
              <span className="lbl">{t.autoLock}</span>
              <select value={s.autoLock} onChange={(e) => setSettings({ autoLock: Number(e.target.value) })}>
                {[1, 2, 5, 10, 30, 0].map((m) => (
                  <option key={m} value={m}>{m === 0 ? t.never : `${m} ${m === 1 ? t.minute : t.minutes}`}</option>
                ))}
              </select>
            </div>
            <button className="setting" style={{ width: '100%', textAlign: 'start' }} onClick={() => setSheet('pw')}>
              <KeyRound size={19} className="muted" /><span className="lbl">{t.changePassword}</span>{chev}
            </button>
            <button className="setting" style={{ width: '100%', textAlign: 'start' }} onClick={() => setSheet('rk')}>
              <ShieldCheck size={19} className="muted" /><span className="lbl">{t.newRecovery}</span>{chev}
            </button>
          </div>

          <div className="side-label" style={{ paddingInline: 4 }}>{t.about}</div>
          <div className="settings-group">
            <div className="setting"><span className="lbl">{t.appName}</span><span className="muted ltr">{t.version} {APP_VERSION}</span></div>
            <div className="setting"><span className="hint">🔒 {t.encryptedNote}</span></div>
          </div>
          <button className="btn ghost block" style={{ marginTop: 6 }} onClick={nav.lock}><Lock size={18} />{t.lockNow}</button>
        </div>
      </div>
      {sheet === 'pw' && <ChangePassword onClose={() => setSheet(null)} />}
      {sheet === 'rk' && <NewRecovery onClose={() => setSheet(null)} />}
    </>
  );
}
