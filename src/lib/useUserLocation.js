import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentPosition, isDeviceLocationOn, openDeviceLocationSettings } from './geo';

// Lokasyon ng tenant para makita ang layo ng bawat listing.
// Kusang kumukuha kung pinayagan na ang location dati; kung hindi, hihintayin ang request() (button).
// Naka-memory lang — hindi sine-save o ipinapadala kahit saan.
// status: idle | loading | granted | denied (blocked ang permission) | off (naka-off ang GPS ng phone) | unavailable
export const useUserLocation = () => {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle');
  const statusRef = useRef('idle');
  const update = useCallback((next) => { statusRef.current = next; setStatus(next); }, []);

  const request = useCallback(async () => {
    update('loading');
    if ((await isDeviceLocationOn()) === false) { update('off'); return; }
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
      setCoords({ lat: pos.lat, lng: pos.lng });
      update('granted');
    } catch (err) {
      update(err?.code === 1 ? 'denied' : err?.code === 2 ? 'off' : 'unavailable');
    }
  }, [update]);

  // Binubuksan ang Location settings ng phone (native app); sa browser, susubukan lang ulit humingi
  const openSettings = useCallback(async () => {
    if (!(await openDeviceLocationSettings())) request();
  }, [request]);

  useEffect(() => {
    let alive = true;
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (!alive) return;
        if (result.state === 'granted') request();
        else if (result.state === 'denied') update('denied');
      }).catch(() => {});
    }
    // Pagbalik mula sa Settings: i-check ulit kung naayos na, nang hindi na pinipindot ang kahit ano
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      if (['denied', 'off', 'unavailable'].includes(statusRef.current)) request();
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [request, update]);

  return { coords, status, request, openSettings };
};
