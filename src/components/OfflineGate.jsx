import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Real reachability check: navigator.onLine can say "true" on wifi with no data.
async function canReachNetwork() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (!SUPABASE_URL) return true;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/health`, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function OfflineGate({ children }) {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [checking, setChecking] = useState(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    const ok = await canReachNetwork();
    setOffline(!ok);
    setChecking(false);
  }, []);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', recheck);
    const initial = setTimeout(recheck, 0);
    return () => {
      clearTimeout(initial);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', recheck);
    };
  }, [recheck]);

  // While offline, poll so the app resumes by itself once the connection is back.
  useEffect(() => {
    if (!offline) return undefined;
    const id = setInterval(recheck, 4000);
    return () => clearInterval(id);
  }, [offline, recheck]);

  if (!offline) return children;

  return (
    <div role="alert" style={{
      position: 'fixed', inset: 0, zIndex: 99999, background: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center', fontFamily: 'inherit', color: '#1f2937',
    }}>
      <WifiOff size={64} color="#ef4444" />
      <h2 style={{ margin: '20px 0 8px', fontSize: '1.4rem' }}>Walang internet connection</h2>
      <p style={{ margin: 0, maxWidth: 320, color: '#6b7280', lineHeight: 1.5 }}>
        Kailangan ng internet o mobile data para magamit ang Budget Rent PH. Paki-check ang WiFi o mobile data mo at subukan ulit.
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
