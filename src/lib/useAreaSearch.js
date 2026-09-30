import { useEffect, useState } from 'react';
import { geocodeAddress } from './geo';

const cache = new Map();

// Hinahanap ang tunay na hugis ng lugar (city/probinsya/barangay) na tinype ng user,
// para makita ang listings sa loob nito kahit hindi nakasulat ang pangalan sa address.
// Mga lugar lang ang tinatanggap (hindi pangalan ng gusali o random na salita).
export const useAreaSearch = (query, enabled = true) => {
  const [area, setArea] = useState(null);

  useEffect(() => {
    const q = String(query || '').trim();
    if (!enabled || q.length < 3) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const key = q.toLowerCase();
        let result = cache.get(key);
        if (result === undefined) {
          result = await geocodeAddress(q, { withPolygon: true });
          cache.set(key, result);
        }
        const isPlace = result && (result.kind === 'boundary' || result.kind === 'place');
        if (!cancelled) setArea(isPlace ? { bounds: result.bounds, geometry: result.geometry, query: q } : null);
      } catch {
        if (!cancelled) setArea(null);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  // Ibalik lang ang area kung tugma pa sa kasalukuyang tinype (iwas lumang resulta)
  const current = String(query || '').trim();
  return enabled && current.length >= 3 && area?.query === current ? area : null;
};
