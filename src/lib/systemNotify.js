import { LocalNotifications } from '@capacitor/local-notifications';

const ASKED_KEY = 'budgetrent_notif_asked';
const isNative = () => Boolean(window.Capacitor?.isNativePlatform?.());

export const notifSupported = () => isNative() || (typeof Notification !== 'undefined');

// 'granted' | 'denied' | 'default'
export const notifStatus = async () => {
  try {
    if (isNative()) {
      const r = await LocalNotifications.checkPermissions();
      return r.display === 'prompt' || r.display === 'prompt-with-rationale' ? 'default' : r.display;
    }
    return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  } catch {
    return 'denied';
  }
};

export const requestNotifPermission = async () => {
  try {
    if (isNative()) {
      const r = await LocalNotifications.requestPermissions();
      return r.display;
    }
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

export const wasNotifAsked = () => {
  try { return localStorage.getItem(ASKED_KEY) === '1'; } catch { return true; }
};
export const markNotifAsked = () => {
  try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* okay lang */ }
};

// Lalabas sa mismong notification tray ng phone (hindi lang sa loob ng app)
export const showSystemNotification = async (title, body) => {
  try {
    if (!title || (await notifStatus()) !== 'granted') return;
    if (isNative()) {
      await LocalNotifications.schedule({
        notifications: [{ id: Math.floor(Date.now() % 2147483647), title, body: body || '' }],
      });
      return;
    }
    const reg = await navigator.serviceWorker?.ready;
    const opts = { body: body || '', icon: 'logo.png', badge: 'logo.png' };
    if (reg?.showNotification) reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* okay lang kung hindi gumana */ }
};
