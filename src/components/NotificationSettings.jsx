import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { notifSupported, notifStatus, requestNotifPermission, markNotifAsked, showSystemNotification } from '../lib/systemNotify';
import { playNotifySound, unlockNotifySound } from '../lib/notifySound';

const box = { margin: '0 0 14px', padding: '12px 14px', borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#f8fafc' };
const btn = (bg, color) => ({ padding: '9px 14px', borderRadius: 10, border: 0, background: bg, color, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' });

// Settings: i-on ang notification alarms ng phone, at subukan ang tunog
const NotificationSettings = () => {
  const [status, setStatus] = useState('default'); // 'granted' | 'denied' | 'default'
  const refresh = useCallback(() => { notifStatus().then(setStatus); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  if (!notifSupported()) return null;

  const enable = async () => {
    markNotifAsked();
    unlockNotifySound();
    const result = await requestNotifPermission();
    setStatus(result === 'prompt' ? 'default' : result);
  };
  const test = () => {
    unlockNotifySound();
    playNotifySound(3);
    showSystemNotification('BudgetRentPH', 'Notifications are working. You will get alerts like this.');
  };

  const Icon = status === 'granted' ? BellRing : status === 'denied' ? BellOff : Bell;
  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={20} color={status === 'granted' ? '#16a34a' : status === 'denied' ? '#dc2626' : '#003366'} />
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', fontSize: '0.9rem', color: '#0f172a' }}>Notification alerts</strong>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {status === 'granted' ? 'On. You will get alerts for announcements, bookings and chats.' : status === 'denied' ? 'Blocked on this device.' : 'Off. Turn on to get alerts with sound.'}
          </span>
        </div>
      </div>
      {status === 'denied' && (
        <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: '#92400e', lineHeight: 1.45 }}>
          To allow it again, open your phone <strong>Settings → Apps → BudgetRentPH → Notifications</strong> and turn them on. In a browser, tap the lock icon beside the address and allow Notifications. Also make sure the phone is not on silent.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {status !== 'granted' && status !== 'denied' && <button type="button" onClick={enable} style={btn('#003366', '#fff')}>Turn on</button>}
        {status === 'denied' && <button type="button" onClick={() => { refresh(); }} style={btn('#e2e8f0', '#0f172a')}>I allowed it, check again</button>}
        {status === 'granted' && <button type="button" onClick={test} style={btn('#FFD700', '#003366')}>Test sound</button>}
      </div>
    </div>
  );
};

export default NotificationSettings;
