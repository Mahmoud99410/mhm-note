// Native glue: Android back button (Capacitor) — the web build works without it.
export async function initPlatform() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => window.dispatchEvent(new Event('mhm-back')));
    window.addEventListener('mhm-exit', () => App.minimizeApp());
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
      const id = a.notification?.extra?.itemId;
      if (id) sessionStorage.setItem('mhm-open-item', id);
    });
  } catch (e) {
    console.warn(e);
  }
}
