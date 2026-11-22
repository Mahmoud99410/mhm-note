// Google OAuth client IDs (from Google Cloud Console → Clients). These are public identifiers, not secrets
// that protect your data — your notes stay encrypted with your master password.
export const GOOGLE = {
  webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '',
  desktopClientId: import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID || '',
  desktopClientSecret: import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET || '',
  scope: 'https://www.googleapis.com/auth/drive.file',
};
export const DRIVE_FOLDER = 'MHM NOTE';
export const PCLOUD_FOLDER = '/MHM NOTE';

// pCloud app (docs.pcloud.com → My applications). Used for "sign in on pCloud's page".
export const PCLOUD = { clientId: import.meta.env.VITE_PCLOUD_CLIENT_ID || '', clientSecret: import.meta.env.VITE_PCLOUD_CLIENT_SECRET || '' };
