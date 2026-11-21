import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, HardDrive, AlertTriangle, CheckCircle2, LogOut, Fingerprint } from 'lucide-react';
import { useT, useSettings } from '../settings';
import * as V from '../vault';
import * as N from '../native';
import { googleDrive, pcloud, pcloudLogin } from '../cloud';
import { syncNow, useSyncStatus, readRemote } from '../sync';
import { Sheet, PasswordInput, Confirm, toast } from './ui';
import { fmtDate } from '../constants';

const GoogleG = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
  </svg>
);
const PcloudIcon = ({ size = 20 }) => <Cloud size={size} style={{ color: '#17bed0' }} />;

export function errText(t, e) {
  const c = e?.code || e?.message || e;
  if (c === 'NEED_LOGIN' || c === 'AUTH') return t.needLogin;
  if (c === 'VAULT_MISMATCH') return t.vaultMismatch;
  if (c === 'GOOGLE_NOT_CONFIGURED') return t.googleNotReady;
  if (c === 'TFA') return t.pcloudTfa;
  if (c === 'LOGIN') return t.loginFailed;
  if (c === 'PCLOUD') return t.loginFailed + ' — ' + (e.detail || '');
  return t.syncError + (typeof c === 'string' ? ': ' + c.slice(0, 80) : '');
}

export function PcloudLoginSheet({ onDone, onClose }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      const creds = await pcloudLogin(email.trim(), pw);
      setPw('');
      await onDone(creds);
      onClose();
    } catch (e) {
      setErr(errText(t, e));
      setBusy(false);
    }
  };
  return (
    <Sheet title={t.pcloud} onClose={onClose}>
      <div className="field"><label>{t.pcloudEmail}</label><div className="input-wrap"><input className="ltr" style={{ textAlign: 'start' }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" /></div></div>
      <div className="field"><label>{t.pcloudPassword}</label><PasswordInput value={pw} onChange={setPw} onEnter={go} /></div>
      <p className="hint" style={{ marginTop: -4 }}>🔒 {t.pcloudHint}</p>
      {err && <div className="error">{err}</div>}
      <button className="btn block" disabled={busy || !email || !pw} onClick={go}>{busy ? '…' : t.connect}</button>
    </Sheet>
  );
}

// Ask for the cloud vault's master password and adopt it on this device
function AdoptVault({ remote, wipeLocal, after, onClose }) {
  const t = useT();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      await V.restoreFromCloud(remote, pw, wipeLocal);
      await after?.();
      onClose();
      syncNow();
    } catch (e) {
      setErr(e.message === 'WRONG_PASSWORD' ? t.wrongPassword : String(e.message || e));
      setBusy(false);
    }
  };
  return (
    <Sheet title={t.vaultFound} onClose={onClose}>
      <div className="field"><label>{t.masterPassword}</label><PasswordInput value={pw} onChange={setPw} autoFocus onEnter={go} /></div>
      {err && <div className="error">{err}</div>}
      <button className="btn block" disabled={busy || !pw} onClick={go}>{busy ? t.unlocking : t.restore}</button>
    </Sheet>
  );
}

// ---------- first launch: restore a vault from the cloud ----------
export function RestoreFromCloud({ onDone, onBack }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [remote, setRemote] = useState(null);
  const [pcSheet, setPcSheet] = useState(false);
  const [pcCreds, setPcCreds] = useState(null);
  const find = async (adapter) => {
    const r = await readRemote(adapter);
    if (!r) throw new Error(t.noVaultInCloud);
    setRemote(r);
  };
  const viaGoogle = async () => {
    setBusy(true);
    setErr('');
    try {
      await N.googleSignIn();
      await find(googleDrive({ interactive: true }));
    } catch (e) {
      setErr(e.message === t.noVaultInCloud ? e.message : errText(t, e));
    }
    setBusy(false);
  };
  return (
    <>
      <h1 style={{ fontSize: 20 }}>{t.restoreTitle}</h1>
      <p className="sub">{t.restoreHint}</p>
      <button className="btn ghost block" style={{ marginBottom: 10 }} disabled={busy} onClick={viaGoogle}><GoogleG />{t.googleDrive}</button>
      <button className="btn ghost block" disabled={busy} onClick={() => setPcSheet(true)}><PcloudIcon />{t.pcloud}</button>
      {err && <div className="error" style={{ marginTop: 12 }}>{err}</div>}
      <button className="link-btn" onClick={onBack}>{t.back}</button>
      {pcSheet && (
        <PcloudLoginSheet
          onClose={() => setPcSheet(false)}
          onDone={async (creds) => {
            setPcCreds(creds);
            try {
              await find(pcloud(creds));
            } catch (e) {
              setErr(e.message === t.noVaultInCloud ? e.message : errText(t, e));
            }
          }}
        />
      )}
      {remote && (
        <AdoptVault
          remote={remote}
          onClose={() => setRemote(null)}
          after={async () => {
            if (pcCreds) await V.saveSecret('pcloud', pcCreds);
            onDone();
          }}
        />
      )}
    </>
  );
}

// ---------- settings section ----------
export function SyncSection() {
  const t = useT();
  const s = useSettings();
  const st = useSyncStatus();
  const [, force] = useState(0);
  const [pcSheet, setPcSheet] = useState(false);
  const [pcInfo, setPcInfo] = useState(undefined);
  const [mismatch, setMismatch] = useState(null); // { remote, onCancel, after }
  const [adopt, setAdopt] = useState(null);
  const [confirmOut, setConfirmOut] = useState(null);
  const g = N.googleAccount();
  if (pcInfo === undefined) V.loadSecret('pcloud').then((x) => setPcInfo(x));

  // before linking an account, make sure it doesn't already hold a *different* vault
  const checkAndSync = async (adapter, onCancel, after) => {
    const remote = await readRemote(adapter);
    const local = (await V.syncSnapshot()).vault;
    if (remote && remote.vault.vid && remote.vault.vid !== local.vid) {
      setMismatch({ remote, onCancel, after });
      return;
    }
    await after?.();
    await syncNow(true);
    toast(t.done);
  };
  const linkGoogle = async () => {
    try {
      await N.googleSignIn();
      force((x) => x + 1);
      await checkAndSync(googleDrive({ interactive: true }), async () => {
        await N.googleSignOut();
        force((x) => x + 1);
      });
    } catch (e) {
      toast(errText(t, e));
    }
  };
  const row = (icon, name, account, info, onConnect, onDisconnect) => (
    <div className="setting" style={{ alignItems: 'flex-start' }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div className="grow">
        <div className="lbl">{name}</div>
        {account ? (
          <>
            <div className="hint ltr ellipsis" style={{ textAlign: 'start' }}>{account}</div>
            {info?.error ? (
              <div className="hint" style={{ color: 'var(--danger)', display: 'flex', gap: 4, alignItems: 'center' }}><AlertTriangle size={13} />{errText(t, info.error)}</div>
            ) : (
              <div className="hint" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--primary)' }} />
                {t.lastSync}: {info?.at ? fmtDate(info.at, s.lang) : t.notSynced}
              </div>
            )}
          </>
        ) : null}
      </div>
      {account ? (
        <button className="icon-btn sm" title={t.disconnect} onClick={onDisconnect}><LogOut size={18} /></button>
      ) : (
        <button className="chip-btn" onClick={onConnect}>{t.connect}</button>
      )}
    </div>
  );
  return (
    <>
      <div className="side-label" style={{ paddingInline: 4 }}>{t.syncBackup}</div>
      <div className="settings-group">
        {row(<GoogleG />, t.googleDrive, g?.email, st.gdrive, linkGoogle, () => setConfirmOut('g'))}
        {row(<PcloudIcon />, t.pcloud, pcInfo?.email, st.pcloud, () => setPcSheet(true), () => setConfirmOut('p'))}
        <div className="setting">
          <button className="btn ghost block sm" disabled={st.running || (!g && !pcInfo)} onClick={() => syncNow(true)}>
            <RefreshCw size={17} className={st.running ? 'spin' : ''} />
            {st.running ? t.syncing : t.syncNow}
          </button>
        </div>
      </div>
      {pcSheet && (
        <PcloudLoginSheet
          onClose={() => setPcSheet(false)}
          onDone={async (creds) => {
            await checkAndSync(pcloud(creds), null, async () => {
              await V.saveSecret('pcloud', creds);
              setPcInfo(creds);
            });
          }}
        />
      )}
      {mismatch && (
        <Sheet title={t.vaultMismatch} onClose={() => { mismatch.onCancel?.(); setMismatch(null); }}>
          <p className="hint">{t.vaultMismatchHint}</p>
          <div className="row">
            <button className="btn ghost grow" onClick={() => { mismatch.onCancel?.(); setMismatch(null); }}>{t.cancel}</button>
            <button className="btn danger grow" onClick={() => { setAdopt(mismatch); setMismatch(null); }}>{t.replaceLocal}</button>
          </div>
        </Sheet>
      )}
      {adopt && <AdoptVault remote={adopt.remote} wipeLocal after={adopt.after} onClose={() => setAdopt(null)} />}
      {confirmOut && (
        <Confirm
          danger={false}
          text={t.disconnect + ' ' + (confirmOut === 'g' ? t.googleDrive : t.pcloud) + '؟'}
          onClose={() => setConfirmOut(null)}
          onYes={async () => {
            if (confirmOut === 'g') await N.googleSignOut();
            else {
              await V.saveSecret('pcloud', null);
              setPcInfo(null);
            }
            force((x) => x + 1);
          }}
        />
      )}
    </>
  );
}

export function BiometricRow() {
  const t = useT();
  const [on, setOn] = useState(N.bioEnabled());
  const [busy, setBusy] = useState(false);
  if (N.platform === 'web') return null;
  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await N.bioDisable();
        setOn(false);
      } else {
        if (!(await N.bioAvailable())) throw new Error(t.bioUnavailable);
        await N.bioEnable(V.rawKeyB64(), t);
        setOn(true);
        toast(t.bioOn);
      }
    } catch (e) {
      toast(e.message === t.bioUnavailable ? e.message : t.bioFailed);
    }
    setBusy(false);
  };
  return (
    <div className="setting">
      <Fingerprint size={19} className="muted" />
      <span className="lbl">{t.biometric}</span>
      <button className={'switch' + (on ? ' on' : '')} disabled={busy} onClick={toggle} aria-pressed={on} />
    </div>
  );
}

export function SyncBadge() {
  const t = useT();
  const st = useSyncStatus();
  const linked = !!N.googleAccount() || !!st.pcloud;
  const err = st.gdrive?.error || st.pcloud?.error;
  if (!linked && !st.running) return null;
  return (
    <button className="icon-btn" title={st.running ? t.syncing : err ? errText(t, err) : t.syncNow} onClick={() => syncNow(true)}>
      {st.running ? <RefreshCw size={20} className="spin" /> : err ? <CloudOff size={21} /> : <Cloud size={21} />}
    </button>
  );
}
export { HardDrive };
