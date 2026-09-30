// Geo helpers para sa map / radar feature.
// Free mapping stack: OpenStreetMap tiles (display) + Nominatim (address search).
// Pang-simula lang ang OSM tile server (light usage policy); lumipat sa OpenFreeMap o sariling PH tiles kapag lumaki ang traffic.

export const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 }; // Manila

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_OPTIONS = {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  minZoom: 5
};

// Naka-lock ang mapa sa Pilipinas (SW, NE)
export const PH_BOUNDS = [[4.2, 116.0], [21.4, 127.2]];
export const MAP_OPTIONS = {
  maxBounds: PH_BOUNDS,
  maxBoundsViscosity: 1.0,
  minZoom: 5
};

export const toCoords = (item) => {
  const lat = Number(item?.latitude);
  const lng = Number(item?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

// Haversine distance sa kilometers
export const distanceKm = (a, b) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatDistance = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// Address -> coordinates (Philippines lang). Returns null kapag walang nahanap.
export const geocodeAddress = async (query, { withPolygon = false } = {}) => {
  const q = String(query || '').trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph${withPolygon ? '&polygon_geojson=1&polygon_threshold=0.005' : ''}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Location search failed');
  const data = await res.json();
  if (!data?.[0]) return null;
  // boundingbox = [south, north, west, east] — ang buong sakop ng lugar (hal. buong Pangasinan)
  const [s, n, w, e] = (data[0].boundingbox || []).map(Number);
  const bounds = [s, n, w, e].every(Number.isFinite) ? [[s, w], [n, e]] : null;
  // Tunay na hugis ng lugar (hindi lang kahon), para hindi mapasama ang kalapit na probinsya/city
  const gj = data[0].geojson;
  const geometry = gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon') ? gj : null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name, bounds, geometry, kind: data[0].class };
};

// Ray casting: nasa loob ba ng GeoJSON Polygon/MultiPolygon ang punto? (coordinates ay [lng, lat])
const inRing = (lat, lng, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const inPolygon = (lat, lng, rings) => inRing(lat, lng, rings[0]) && !rings.slice(1).some((hole) => inRing(lat, lng, hole));

export const inGeometry = (coords, geometry) => {
  if (!coords || !geometry) return false;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.some((rings) => inPolygon(coords.lat, coords.lng, rings));
};

// Kung may tunay na hugis ng lugar, iyon ang gamitin; kung wala, ang kahon (bounding box)
export const inArea = (coords, area) =>
  area?.geometry ? inGeometry(coords, area.geometry) : inBounds(coords, area?.bounds);

export const inBounds = (coords, bounds) =>
  Boolean(coords && bounds) &&
  coords.lat >= bounds[0][0] && coords.lat <= bounds[1][0] &&
  coords.lng >= bounds[0][1] && coords.lng <= bounds[1][1];

export const getCurrentPosition = (options = {}) =>
  new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(Object.assign(new Error('Geolocation not supported'), { code: 2 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000, ...options }
    );
  });

// ---- Tinatayang lokasyon para sa listings na wala pang pin ----
// Hinahanap mula sa address text ng listing; naka-cache sa browser para hindi paulit-ulit ang request.
const GEO_CACHE_KEY = 'budgetrent_geo_cache_v1';
const normalizeKey = (text) => String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');

const readGeoCache = () => {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

// undefined = hindi pa nahahanap; null = walang nahanap; {lat,lng} = nahanap
export const getCachedGeocode = (text) => readGeoCache()[normalizeKey(text)];

export const geocodeListingLocation = async (text) => {
  const key = normalizeKey(text);
  if (!key) return null;
  const cache = readGeoCache();
  if (key in cache) return cache[key];

  const parts = String(text).split(',').map((p) => p.trim()).filter(Boolean);
  const attempts = [...new Set([parts.join(', '), parts.slice(-2).join(', ')])];
  let found = null;
  for (let i = 0; i < attempts.length && !found; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100)); // Nominatim: max 1 request/second
    const result = await geocodeAddress(attempts[i]);
    if (result) found = { lat: result.lat, lng: result.lng };
  }
  try {
    cache[key] = found;
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch { /* puno ang storage o naka-block — okay lang */ }
  return found;
};
