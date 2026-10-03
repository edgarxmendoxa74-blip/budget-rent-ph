import { useEffect, useState } from 'react';
import { toCoords, getCachedGeocode, geocodeListingLocation } from './geo';

// Tinatayang lokasyon (id -> {lat,lng}) para sa listings na wala pang pin, galing sa address text.
// Naka-cache sa browser; hanggang 12 listing lang bawat load, 1 request kada segundo.
export const useApproxCoords = (listings, enabled = true) => {
  const [approx, setApprox] = useState({});

  useEffect(() => {
    if (!enabled) return undefined;
    const pending = listings
      .filter((item) => item?.user_id && !toCoords(item) && item.location)
      .slice(0, 12);
    let cancelled = false;
    (async () => {
      for (const item of pending) {
        if (cancelled) return;
        let coords = getCachedGeocode(item.location);
        if (coords === undefined) {
          try {
            coords = await geocodeListingLocation(item.location);
          } catch {
            coords = null;
          }
          await new Promise((r) => setTimeout(r, 1100));
        }
        if (cancelled) return;
        if (coords) setApprox((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: coords }));
      }
    })();
    return () => { cancelled = true; };
  }, [listings, enabled]);

  return approx;
};
