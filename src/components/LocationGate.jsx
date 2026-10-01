import { useEffect, useState, useCallback } from 'react';
import { MapPinOff, RefreshCw } from 'lucide-react';
import { getCurrentPosition } from '../lib/geo';
import { isInstalledApp } from '../lib/tour';
import { isAdminPath } from '../lib/admin';

// Gate lang para sa naka-install na app (APK/PWA); hindi apektado ang website at ang admin pages.
const shouldGate = () => isInstalledApp() && !isAdminPath();

// code 1 = naka-block ang permission, code 2 = naka-off ang location ng phone.
// Timeout (3) ay hindi ibinabawal para hindi mag-false alarm sa mahinang GPS signal.
async function locationBlocked() {
  try {
    await getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 0 });
    return null;
  } catch (err) {
    if (err?.code === 1) return 'denied';
    if (err?.code === 2) return 'off';
    return null;
  }
}

export default function LocationGate({ children }) {
  const [block, setBlock] = useState(null); // null | 'denied' | 'off'
  const [checking, setChecking] = useState(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    setBlock(await locationBlocked());
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!shouldGate()) return undefined;
    const initial = setTimeout(recheck, 0);
    // Tuloy-tuloy na pagbabantay para mahuli kapag pinatay ang location habang gamit ang app.
    const id = setInterval(recheck, block ? 3000 : 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') recheck(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [recheck, block]);

  if (!block) return children;

  return (
    <div role="alert" style={{
      position: 'fixed', inset: 0, zIndex: 99998, background: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center', fontFamily: 'inherit', color: '#1f2937',
    }}>
      <MapPinOff size={64} color="#f59e0b" />
      <h2 style={{ margin: '20px 0 8px', fontSize: '1.4rem' }}>
        {block === 'denied' ? 'Naka-block ang location' : 'Naka-off ang location'}
      </h2>
      <p style={{ margin: 0, maxWidth: 320, color: '#6b7280', lineHeight: 1.5 }}>
        {block === 'denied'
          ? 'Payagan ang Budget Rent PH na gamitin ang location mo: Settings > Apps > Budget Rent PH > Permissions > Location > Allow.'
          : 'I-on ang Location (GPS) ng phone mo para makita ang mga malapit na paupahan, tapos subukan ulit.'}
      </p>
      <button
        onClick={recheck}
        disabled={checking}
        style={{
          marginTop: 24, padding: '12px 24px', borderRadius: 999, border: 'none',
          background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '1rem',
          display: 'inline-flex', alignItems: 'center', gap: 8, opacity: checking ? 0.7 : 1,
        }}
      >
        <RefreshCw size={18} /> {checking ? 'Chine-check...' : 'Subukan ulit'}
      </button>
    </div>
  );
}
