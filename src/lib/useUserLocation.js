import { useCallback, useEffect, useState } from 'react';
import { getCurrentPosition } from './geo';

// Lokasyon ng tenant para makita ang layo ng bawat listing.
// Kusang kumukuha kung pinayagan na ang location dati; kung hindi, hihintayin ang request() (button).
// Naka-memory lang — hindi sine-save o ipinapadala kahit saan.
export const useUserLocation = () => {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | granted | denied | unavailable

  const request = useCallback(async () => {
    setStatus('loading');
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
      setCoords({ lat: pos.lat, lng: pos.lng });
      setStatus('granted');
    } catch (err) {
      setStatus(err?.code === 1 ? 'denied' : 'unavailable');
    }
  }, []);

  useEffect(() => {
    if (!('permissions' in navigator)) return undefined;
    let alive = true;
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (!alive) return;
      if (result.state === 'granted') request();
      else if (result.state === 'denied') setStatus('denied');
    }).catch(() => {});
    return () => { alive = false; };
  }, [request]);

  return { coords, status, request };
};
