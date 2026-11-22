// Google OAuth client IDs (from Google Cloud Console → Clients). These are public identifiers, not secrets
// that protect your data — your notes stay encrypted with your master password.
export const GOOGLE = {
  webClientId: '',
  desktopClientId: '',
  desktopClientSecret: '',
  scope: 'https://www.googleapis.com/auth/drive.file',
};
export const DRIVE_FOLDER = 'MHM NOTE';
export const PCLOUD_FOLDER = '/MHM NOTE';

// pCloud app (docs.pcloud.com → My applications). Used for "sign in on pCloud's page".
export const PCLOUD = { clientId: '', clientSecret: '' };
