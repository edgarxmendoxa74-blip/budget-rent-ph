import { useEffect, useState } from 'react';
import { toCoords, getCachedGeocode, geocodeListingLocation } from './geo';

// Tinatayang lokasyon (id -> {lat,lng}) para sa listings na wala pang pin, galing sa address text.
// Naka-cache sa browser; pinakabagong listing muna, hanggang 12 bagong lookup bawat load, 1 request kada segundo.
export const useApproxCoords = (listings, enabled = true) => {
  const [approx, setApprox] = useState({});

  useEffect(() => {
    if (!enabled) return undefined;
    const unpinned = listings
      .filter((item) => item?.user_id && !toCoords(item) && item.location)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Naka-cache na: ilagay agad (hindi kumakain ng slot sa 12)
    const fromCache = {};
    const pending = [];
    unpinned.forEach((item) => {
      const cached = getCachedGeocode(item.location);
      if (cached) fromCache[item.id] = cached;
      else if (cached === undefined) pending.push(item);
    });
    if (Object.keys(fromCache).length) setApprox((prev) => ({ ...fromCache, ...prev }));

    let cancelled = false;
    (async () => {
      for (const item of pending.slice(0, 12)) {
        if (cancelled) return;
        let coords;
        try {
          coords = await geocodeListingLocation(item.location);
        } catch {
          coords = null;
        }
        if (cancelled) return;
        if (coords) setApprox((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: coords }));
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => { cancelled = true; };
  }, [listings, enabled]);

  return approx;
};
