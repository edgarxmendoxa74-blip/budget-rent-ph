import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

const isNative = () => Boolean(window.Capacitor?.isNativePlatform?.());
let listening = false;
let currentUserId = null;

// Android: kailangang tugma sa channel_id na ginagamit ng send-push Edge Function
const ensureChannel = () => PushNotifications.createChannel({
  id: 'budgetrent-alerts', name: 'Alerts', description: 'Announcements, bookings and chats',
  importance: 5, visibility: 1, vibration: true, lights: true,
}).catch(() => {});

const saveToken = async (token) => {
  if (!token || !currentUserId) return;
  await supabase.rpc('register_device_token', { p_token: token, p_platform: window.Capacitor?.getPlatform?.() || 'android' });
};

// Kunin ang FCM token ng phone at i-save sa Supabase para makapag-push ang server kahit nakasara ang app.
// Tahimik na lalaktawan kung hindi native app o hindi pa na-allow ang notifications.
export const registerPush = async (userId = currentUserId) => {
  if (!isNative() || !userId) return;
  try {
    currentUserId = userId;
    if (!listening) {
      listening = true;
      await PushNotifications.addListener('registration', (t) => { saveToken(t.value); });
      await PushNotifications.addListener('registrationError', (e) => console.warn('Push registration failed', e));
    }
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') return;
    await ensureChannel();
    await PushNotifications.register();
  } catch (e) {
    console.warn('Push setup skipped', e);
  }
};

// Sa logout: tanggalin ang token ng phone na ito para hindi makatanggap ang susunod na user ng push ng iba
export const unregisterPush = async () => {
  if (!isNative()) return;
  try {
    currentUserId = null;
    await PushNotifications.unregister();
  } catch { /* okay lang */ }
};
