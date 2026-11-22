// Platform bridge: Google sign-in, biometrics, secure storage and HTTP for Android (Capacitor),
// Windows (Electron) and the plain web build used for testing.
import { GOOGLE } from './config';

export const platform = window.Capacitor?.isNativePlatform?.() ? 'android' : window.mhm ? 'electron' : 'web';
const E = () => window.mhm;

// ---------------- HTTP (text bodies only) ----------------
export async function http(url, { method = 'GET', headers = {}, body } = {}) {
  if (platform === 'electron') return E().http({ url, method, headers, body });
  if (platform === 'android') {
    // native HTTP: no CORS limits, and form bodies are encoded by Android itself
    const { CapacitorHttp } = await import('@capacitor/core');
    const ct = (Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type') || [])[1] || '';
    let data = body;
    if (typeof body === 'string' && ct.includes('x-www-form-urlencoded')) data = Object.fromEntries(new URLSearchParams(body));
    else if (typeof body === 'string' && ct.includes('application/json')) data = JSON.parse(body);
    const r = await CapacitorHttp.request({ url, method, headers, data, responseType: 'text', connectTimeout: 30000, readTimeout: 120000 });
    return { status: r.status, text: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) };
  }
  const r = await fetch(url, { method, headers, body });
  return { status: r.status, text: await r.text() };
}

// ---------------- Google ----------------
const LS_GOOGLE = 'mhm-google';
let tok = null; // { accessToken, expiresAt }
export const googleAccount = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_GOOGLE) || 'null');
  } catch {
    return null;
  }
};
const setAccount = (a) => (a ? localStorage.setItem(LS_GOOGLE, JSON.stringify(a)) : localStorage.removeItem(LS_GOOGLE));

let socialReady;
async function social() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!socialReady) socialReady = SocialLogin.initialize({ google: { webClientId: GOOGLE.webClientId, mode: 'online' } });
  await socialReady;
  return SocialLogin;
}

export function googleConfigured() {
  if (platform === 'android') return !!GOOGLE.webClientId;
  if (platform === 'electron') return !!GOOGLE.desktopClientId;
  return false;
}

async function androidLogin(silent) {
  const S = await social();
  const options = { scopes: [GOOGLE.scope] };
  // silent: reuse the account that already approved MHM NOTE, without showing the account picker
  if (silent) Object.assign(options, { filterByAuthorizedAccounts: true, autoSelectEnabled: true });
  const res = await S.login({ provider: 'google', options });
  return { email: res.result?.profile?.email, accessToken: res.result?.accessToken?.token };
}

export async function googleSignIn() {
  if (!googleConfigured()) throw new Error('GOOGLE_NOT_CONFIGURED');
  let email, accessToken, expiresIn = 3300;
  if (platform === 'android') {
    ({ email, accessToken } = await androidLogin(false));
  } else {
    const r = await E().googleSignIn({ clientId: GOOGLE.desktopClientId, clientSecret: GOOGLE.desktopClientSecret, scope: GOOGLE.scope });
    email = r.email;
    accessToken = r.accessToken;
    expiresIn = r.expiresIn - 120;
  }
  if (!accessToken) throw new Error('NO_TOKEN');
  tok = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  setAccount({ email });
  return { email };
}

// interactive=false never shows UI (used by background sync)
export async function googleToken(interactive = false) {
  if (!googleAccount()) throw new Error('NEED_LOGIN');
  if (tok && tok.expiresAt > Date.now()) return tok.accessToken;
  if (platform === 'android') {
    try {
      const r = await androidLogin(true);
      if (r.accessToken) {
        tok = { accessToken: r.accessToken, expiresAt: Date.now() + 50 * 60000 };
        return tok.accessToken;
      }
    } catch {}
    if (!interactive) throw new Error('NEED_LOGIN');
    await googleSignIn();
    return tok.accessToken;
  }
  if (platform === 'electron') {
    const r = await E().googleToken({ clientId: GOOGLE.desktopClientId, clientSecret: GOOGLE.desktopClientSecret });
    if (!r) {
      if (!interactive) throw new Error('NEED_LOGIN');
      await googleSignIn();
      return tok.accessToken;
    }
    tok = { accessToken: r.accessToken, expiresAt: Date.now() + (r.expiresIn - 120) * 1000 };
    return tok.accessToken;
  }
  throw new Error('NEED_LOGIN');
}
export function dropGoogleToken() {
  tok = null;
}

export async function googleSignOut() {
  tok = null;
  setAccount(null);
  try {
    if (platform === 'android') await (await social()).logout({ provider: 'google' });
    if (platform === 'electron') await E().googleSignOut();
  } catch {}
}

// ---------------- Biometrics ----------------
const BIO_SERVER = 'com.mhm.note.vault';
const LS_BIO = 'mhm-bio';
export const bioEnabled = () => localStorage.getItem(LS_BIO) === '1';

export async function bioAvailable() {
  try {
    if (platform === 'android') {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      return (await NativeBiometric.isAvailable({ useFallback: false })).isAvailable;
    }
    if (platform === 'electron') return await E().bioAvailable();
  } catch {}
  return false;
}

export async function bioEnable(secret, t) {
  if (platform === 'android') {
    const { NativeBiometric, AccessControl } = await import('@capgo/capacitor-native-biometric');
    await NativeBiometric.setCredentials({
      username: 'mhm', password: secret, server: BIO_SERVER, accessControl: AccessControl.BIOMETRY_ANY,
      title: t.appName, reason: t.bioReason, subtitle: t.bioEnable,
    });
  } else if (platform === 'electron') {
    if (!(await E().bioVerify(t.bioReason))) throw new Error('CANCELLED');
    await E().secureSet('bio-key', secret);
  } else throw new Error('UNSUPPORTED');
  localStorage.setItem(LS_BIO, '1');
}

export async function bioGet(t) {
  if (platform === 'android') {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    const c = await NativeBiometric.getSecureCredentials({ server: BIO_SERVER, title: t.appName, reason: t.bioReason, negativeButtonText: t.cancel });
    return c.password;
  }
  if (platform === 'electron') {
    if (!(await E().bioVerify(t.bioReason))) throw new Error('CANCELLED');
    return await E().secureGet('bio-key');
  }
  throw new Error('UNSUPPORTED');
}

// Just confirm the user's fingerprint (used for locked folders / pages)
export async function bioVerify(t) {
  if (platform === 'android') {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({ reason: t.bioReason, title: t.appName, negativeButtonText: t.cancel });
    return true;
  }
  if (platform === 'electron') return !!(await E().bioVerify(t.bioReason));
  return false;
}

export async function bioDisable() {
  localStorage.removeItem(LS_BIO);
  try {
    if (platform === 'android') {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      await NativeBiometric.deleteCredentials({ server: BIO_SERVER });
    }
    if (platform === 'electron') await E().secureDel('bio-key');
  } catch {}
}

export async function openExternal(url) {
  if (platform === 'android') {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else window.open(url, '_blank');
}
