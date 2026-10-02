import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Loader2, MapPin, Star, X, Search, AlertCircle, Signal, LocateFixed, Radar, BadgeCheck, House, TreePalm, Route as RouteIcon, Car, Bus, Bike, Footprints, ChevronDown, ChevronUp, WifiOff, CalendarCheck, Lightbulb } from 'lucide-react';
import { TILE_URL, TILE_OPTIONS, MAP_OPTIONS, toCoords, distanceKm, formatDistance, geocodeAddress, inArea, getCurrentPosition, openDeviceLocationSettings } from '../lib/geo';
import { useApproxCoords } from '../lib/useApproxCoords';
import ListingActionSheet from './ListingActionSheet';
import { HeroBudi } from './MascotSplash';
import { fetchRoute, getEstimates, formatDuration, formatStepDistance, stepText, routeProgress } from '../lib/routing';
import './FindNearbyPage.css';
import { ikImage } from '../lib/imagekit';

// three.js is heavy: i-load lang kapag may Directions na
const BudiScene = lazy(() => import('./BudiScene.jsx'));

const RADIUS_OPTIONS = [1, 3, 5, 10];

const isStay = (item) => String(item?.type || item?.category || '').toLowerCase().includes('staycation');

// 3D tilt: sumusunod ang card sa daliri/mouse (CSS variables --rx/--ry)
const tiltMove = (e) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--ry', `${(x * 22).toFixed(1)}deg`);
  el.style.setProperty('--rx', `${(-y * 18).toFixed(1)}deg`);
};
const tiltReset = (e) => {
  e.currentTarget.style.setProperty('--ry', '0deg');
  e.currentTarget.style.setProperty('--rx', '0deg');
};

const INTENTS = {
  rent: { Icon: House, label: 'Find Rent', title: 'Rentals', tag: 'rentals' },
  staycation: { Icon: TreePalm, label: 'Staycation', title: 'Staycations', tag: 'staycations' }
};

// Lucide icon paths (para sa map markers na HTML string, hindi React)
const MARKER_ICONS = {
  rent: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  stay: '<path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/>'
};
const markerIcon = (item) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${isStay(item) ? MARKER_ICONS.stay : MARKER_ICONS.rent}</svg>`;

// Device detection para sa tamang location instructions (phone vs desktop browser)
const getDeviceInfo = () => {
  const ua = navigator.userAgent || '';
  const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
  const isMobile = isNativeApp || /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const os = /Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS X/i.test(ua) ? 'mac' : 'other';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox/i.test(ua) ? 'Firefox' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'browser';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return { isDesktop: !isMobile, isIOS, os, browser };
};

// Paalala sa mobile users: i-ON muna ang location ng phone bago mag-activate ng Live GPS
const MobileLocationTip = ({ isIOS }) => (
  <div className="near-reminder">
    <div className="near-reminder-head">
      <span className="near-reminder-icon"><Lightbulb size={16} /></span>
      <strong>Turn on your phone's Location first</strong>
    </div>
    <ol className="near-reminder-steps">
      <li>
        {isIOS
          ? <>Open <b>Settings</b> &gt; <b>Privacy &amp; Security</b> &gt; <b>Location Services</b> and turn it <b>ON</b>.</>
          : <>Swipe down the notification bar and tap the <b>Location</b> icon, or go to <b>Settings</b> &gt; <b>Location</b> and turn it <b>ON</b>.</>}
      </li>
      <li>Come back here and wait while we scan your area.</li>
    </ol>
  </div>
);

const DesktopLocationSteps = ({ os, browser }) => (
  <ol className="desktop-steps">
    <li>
      Click the <b>🔒 lock / site settings icon</b> to the left of the {browser} address bar, then set <b>Location</b> to <b>Allow</b>.
    </li>
    {os === 'windows' && (
      <li>
        On Windows: <b>Settings</b> &gt; <b>Privacy &amp; security</b> &gt; <b>Location</b> — turn on <b>Location services</b> and <b>Let desktop apps access your location</b>.
      </li>
    )}
    {os === 'mac' && (
      <li>
        On Mac: <b>System Settings</b> &gt; <b>Privacy &amp; Security</b> &gt; <b>Location Services</b> — turn it on and check <b>{browser}</b>.
      </li>
    )}
    <li>Reload the page and wait for the location scan.</li>
  </ol>
);
const SCAN_MS = 2400;
const OFF_ROUTE_KM = 0.05; // lampas 50m sa linya = lumiko ka sa ibang daan, kumuha ng bagong ruta
const ARRIVE_KM = 0.03; // 30m sa destinasyon = nakarating na
const REROUTE_GAP_MS = 12000; // huwag mag-reroute nang mas madalas dito

// Si Budi (teddy bear mascot) bilang icon ng "Ikaw" sa mapa
const BUDI_FACE = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 48 48" aria-hidden="true"><circle cx="10" cy="11" r="7" fill="#A8642A"/><circle cx="38" cy="11" r="7" fill="#A8642A"/><circle cx="10" cy="11" r="3.5" fill="#F7CFA5"/><circle cx="38" cy="11" r="3.5" fill="#F7CFA5"/><circle cx="24" cy="26" r="18" fill="#C98545" stroke="#8A501F" stroke-width="1.5"/><ellipse cx="24" cy="32" rx="9" ry="7" fill="#F6D9B0"/><ellipse cx="24" cy="29" rx="3.5" ry="2.6" fill="#1E1206"/><circle cx="17" cy="22" r="2.4" fill="#1E1206"/><circle cx="31" cy="22" r="2.4" fill="#1E1206"/><path d="M20 34q4 3.5 8 0" stroke="#1E1206" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
const MIN_MOVE_KM = 0.02; // huwag i-update ang radar sa GPS jitter na < 20m


// Registered landlord = may account (user_id) sa app. May pin sa mapa.
// Occupied na rent (hindi staycation, na puwede pa ring i-reserve): nasa mapa pa rin pero may "Occupied" badge
const isOccupied = (item) => {
  const value = String(item?.availability || '').toLowerCase().trim();
  return !isStay(item) && (value === 'occupied' || value === 'accommodated' || value === 'rented' || value === 'unavailable');
};

// Kahit occupied na, nasa mapa pa rin.
const isRadarEligible = (item) => Boolean(item?.user_id) && Boolean(toCoords(item));

const shortPrice = (price) => {
  const n = Number(price) || 0;
  return n >= 1000 ? `₱${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `₱${n}`;
};

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const radiusToPixels = (map, center, radiusKm) => {
  const a = map.latLngToContainerPoint([center.lat, center.lng]);
  const b = map.latLngToContainerPoint([center.lat + radiusKm / 111.32, center.lng]);
  return Math.max(24, Math.abs(a.y - b.y));
};

const RadarMap = ({ center, radiusKm, results, scanning, selectedId, onSelect, isLive, recenterKey, areaBounds, route, me }) => {
  const routeItemId = route?.status === 'ready' ? route.item.id : null;
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layers = useRef({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const followRef = useRef(true);
  const meMarker = useRef(null);
  const meRef = useRef(me);
  meRef.current = me;

  // Init map once
  useEffect(() => {
    const map = L.map(mapEl.current, { ...MAP_OPTIONS, zoomControl: false, attributionControl: true })
      .setView([center.lat, center.lng], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
    map.createPane('radarPane');
    map.getPane('radarPane').style.zIndex = 350;
    map.getPane('radarPane').style.pointerEvents = 'none';

    layers.current.listings = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      layers.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User dot + radius circle + radar sweep (GPS mode lang; sa area search, buong lugar ang ipinapakita)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (areaBounds) {
      ['radar', 'circle', 'user'].forEach((key) => {
        layers.current[key]?.remove();
        layers.current[key] = null;
      });
      return;
    }
    const { lat, lng } = center;
    const userIcon = L.divIcon({
      className: 'user-dot-wrap',
      html: `<div class="user-dot ${isLive ? 'live' : 'manual'}"><span></span></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const radarIcon = () => {
      const r = radiusToPixels(map, center, radiusKm);
      return L.divIcon({
        className: 'radar-overlay',
        html: `<div class="radar ${scanning ? 'scanning' : ''}" style="width:${r * 2}px;height:${r * 2}px"><div class="radar-sweep"></div><div class="radar-ring r1"></div><div class="radar-ring r2"></div><div class="radar-ring r3"></div></div>`,
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r]
      });
    };

    if (!layers.current.radar) {
      layers.current.radar = L.marker([lat, lng], { icon: radarIcon(), pane: 'radarPane', interactive: false, keyboard: false }).addTo(map);
      layers.current.circle = L.circle([lat, lng], {
        radius: radiusKm * 1000, color: '#003B7A', weight: 1.5, opacity: 0.5, fillColor: '#003B7A', fillOpacity: 0.05, interactive: false
      }).addTo(map);
      layers.current.user = L.marker([lat, lng], {
        icon: userIcon,
        zIndexOffset: 1000,
        keyboard: false
      }).addTo(map);
    } else {
      layers.current.radar.setLatLng([lat, lng]).setIcon(radarIcon());
      layers.current.circle.setLatLng([lat, lng]).setRadius(radiusKm * 1000);
      layers.current.user.setLatLng([lat, lng]).setIcon(userIcon);
    }

    const onZoom = () => layers.current.radar?.setIcon(radarIcon());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [center, radiusKm, scanning, isLive, areaBounds]);

  // Fit the searched area o ang radar circle kapag nagbago ang radius/area o pinindot ang recenter
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (areaBounds) {
      map.fitBounds(areaBounds, { padding: [16, 16] });
      return;
    }
    if (!layers.current.circle || routeItemId) return;
    map.fitBounds(layers.current.circle.getBounds(), { padding: [16, 16] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, recenterKey, areaBounds]);

  // Listing markers
  useEffect(() => {
    const group = layers.current.listings;
    if (!group) return;
    group.clearLayers();
    if (scanning) return;
    results.filter((item) => item.coords && item.id !== routeItemId).forEach((item, i) => {
      const icon = L.divIcon({
        className: 'house-marker-wrap',
        html: `<div class="house-marker ${item.id === selectedId ? 'selected' : ''} ${item.is_verified ? 'verified' : ''} ${item.approx ? 'approx' : ''} ${isStay(item) ? 'stay' : ''} ${isOccupied(item) ? 'occupied' : ''}" style="animation-delay:${Math.min(i * 90, 1200)}ms"><span class="hm-icon">${markerIcon(item)}</span><span class="hm-price">${escapeHtml(shortPrice(item.price))}</span></div>`,
        iconSize: [78, 32],
        iconAnchor: [39, 32]
      });
      L.marker([item.coords.lat, item.coords.lng], { icon, zIndexOffset: item.id === selectedId ? 900 : 0, title: item.name || item.location || 'Listing' })
        .on('click', () => onSelectRef.current(item.id))
        .addTo(group);
    });
  }, [results, scanning, selectedId, routeItemId]);

  // Ruta: linya ng daan, "Ikaw" (simula) at ang bahay (destinasyon)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (!route || route.status !== 'ready') return undefined;
    const group = L.layerGroup();
    L.polyline(route.data.coords, { color: '#ffffff', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(group);
    L.polyline(route.data.coords, { color: '#0a63ff', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(group);
    const endSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${isStay(route.item) ? MARKER_ICONS.stay : MARKER_ICONS.rent}</svg>`;
    L.marker([route.to.lat, route.to.lng], {
      icon: L.divIcon({ className: 'route-marker-wrap', html: `<div class="route-end ${isStay(route.item) ? 'stay' : ''}"><span>${endSvg}</span></div>`, iconSize: [38, 46], iconAnchor: [19, 46] }),
      zIndexOffset: 1100, interactive: false
    }).addTo(group);
    group.addTo(map);
    if (route.fit) {
      followRef.current = true;
      map.fitBounds(L.latLngBounds(route.data.coords), { padding: [44, 44] });
    }
    return () => { group.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.status, route?.data, route?.to, route?.item]);

  // "Ikaw" = si Budi: sumusunod sa live GPS habang bumibiyahe
  useEffect(() => {
    const map = mapRef.current;
    if (!map || route?.status !== 'ready') return undefined;
    const pos = meRef.current || route.from;
    meMarker.current = L.marker([pos.lat, pos.lng], {
      icon: L.divIcon({
        className: 'route-marker-wrap',
        // 2D na mukha ang pansamantala/fallback; papalitan ng 3D Budi kapag handa na ang WebGL
        html: `<div class="route-start"><span class="rs-dot"><span class="rs-face">${BUDI_FACE}</span><span class="rs-3d"></span></span><span class="rs-label">You</span></div>`,
        iconSize: [130, 84],
        iconAnchor: [36, 76]
      }),
      zIndexOffset: 1200,
      interactive: false
    }).addTo(map);
    const dot = meMarker.current.getElement()?.querySelector('.rs-dot');
    const mount = dot?.querySelector('.rs-3d');
    const budiRoot = mount ? createRoot(mount) : null;
    budiRoot?.render(
      <Suspense fallback={null}>
        <BudiScene phase="travel" onReady={() => dot.classList.add('has3d')} />
      </Suspense>
    );
    const stopFollow = () => { followRef.current = false; };
    map.on('dragstart', stopFollow);
    return () => {
      map.off('dragstart', stopFollow);
      // i-unmount pagkatapos ng kasalukuyang render para iwas warning
      setTimeout(() => budiRoot?.unmount(), 0);
      meMarker.current?.remove();
      meMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.status, route?.item]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me || !meMarker.current) return;
    meMarker.current.setLatLng([me.lat, me.lng]);
    if (followRef.current) map.panTo([me.lat, me.lng], { animate: true });
  }, [me]);

  // Recenter habang may ruta: balik sa pagsunod kay Budi
  useEffect(() => {
    const map = mapRef.current;
    if (!map || route?.status !== 'ready' || !meRef.current) return;
    followRef.current = true;
    map.setView([meRef.current.lat, meRef.current.lng], Math.max(map.getZoom(), 16), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  // Pan sa napiling listing
  useEffect(() => {
    const map = mapRef.current;
    const item = results.find((r) => r.id === selectedId);
    if (map && item?.coords) map.panTo([item.coords.lat, item.coords.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={mapEl} className="radar-map" />;
};

const MODE_ICONS = { walk: Footprints, tricycle: Bike, jeep: Bus, car: Car };

const RoutePanel = ({ route, activeMode, onMode, onClose, showSteps, onToggleSteps, progress }) => {
  const name = route.item.name || route.item.location?.split(',')[0] || 'the property';

  if (route.status === 'loading') {
    return (
      <div className="route-panel">
        <div className="route-loading"><Loader2 size={18} className="animate-spin" /> Finding a route to {name}...</div>
      </div>
    );
  }

  if (route.status === 'error') {
    return (
      <div className="route-panel error">
        <p><AlertCircle size={16} /> {route.message}</p>
        <button type="button" className="route-close-inline" onClick={onClose}>Close</button>
      </div>
    );
  }

  const { data } = route;
  // Lakad: lalabas lang kung malapit (hanggang 2 km)
  // Habang bumibiyahe: natitirang distansya/oras na lang ang ipapakita
  const ratio = progress && data.distanceKm > 0 ? Math.min(1, progress.remainingKm / data.distanceKm) : 1;
  const remainingKm = progress ? progress.remainingKm : data.distanceKm;
  const estimates = getEstimates(data)
    .filter((e) => e.key !== 'walk' || e.available)
    .map((e) => ({ ...e, minutes: e.minutes * ratio }));
  const active = estimates.find((e) => e.key === activeMode) || estimates[estimates.length - 1];
  const note = data.distanceKm > 150
    ? 'This is a long trip — it may involve a ferry or a flight. Times are only estimates.'
    : data.distanceKm > 60
      ? 'This is far — a bus, van, or car is usually used. Tricycles and jeepneys don\'t usually go this far.'
      : data.distanceKm > 15
        ? 'Too far for a tricycle — a jeepney or car is more common.'
        : 'Times are only estimates; they vary with traffic and stops.';

  return (
    <div className="route-panel animate-slide-up">
      <div className="route-head">
        <div>
          <strong>{route.arrived ? `You've arrived at ${name}! 🎉` : `Heading to ${name}`}</strong>
          {!route.arrived && <span>{progress ? 'Remaining: ' : ''}{formatDistance(remainingKm)} • ≈ {formatDuration(active.minutes)} by {active.label}</span>}
        </div>
        <button type="button" className="route-close" aria-label="Close route" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="route-modes" role="group" aria-label="Mode of transport">
        {estimates.map((e) => {
          const Icon = MODE_ICONS[e.key];
          return (
            <button
              key={e.key}
              type="button"
              className={`route-mode ${e.key === active.key ? 'active' : ''} ${e.available ? '' : 'far'}`}
              disabled={!e.available}
              onClick={() => onMode(e.key)}
            >
              <Icon size={18} />
              <strong>{e.label}</strong>
              <span>{e.available ? `≈ ${formatDuration(e.minutes)}` : 'Too far'}</span>
            </button>
          );
        })}
      </div>

      <p className="route-note">{note}{route.item.approx ? ' The destination is also an approximate location of the property.' : ''}</p>

      <div className="route-actions">
        <button type="button" className="route-steps-toggle" onClick={onToggleSteps} aria-expanded={showSteps}>
          {showSteps ? 'Hide' : 'Show'} steps <ChevronDown size={15} className={showSteps ? 'flip' : ''} />
        </button>
      </div>

      {showSteps && (
        <ol className="route-steps">
          {data.steps.map((step, i) => (
            <li key={i}>
              <span>{stepText(step)}</span>
              {step.distance > 0 && <em>{formatStepDistance(step.distance)}</em>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const FindNearbyPage = ({ listings, reviewStats, onSelectProperty, isLandlord, userLocation }) => {
  const [locating, setLocating] = useState(false);
  const [center, setCenter] = useState(null); // { lat, lng }
  const [intent, setIntent] = useState(null); // null (hindi pa pumipili) | 'rent' | 'staycation'
  const [mode, setMode] = useState(null); // 'live' (GPS radar, malapit lang) | 'search' (buong lugar na hinanap)
  const [placeLabel, setPlaceLabel] = useState('');
  const [area, setArea] = useState(null); // { bounds, geometry, query } ng hinanap na lugar
  const [radiusKm, setRadiusKm] = useState(3);
  const [scanning, setScanning] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [errorType, setErrorType] = useState(null);
  const [manualQuery, setManualQuery] = useState('');
  const [route, setRoute] = useState(null); // { status: loading|ready|error, item, from, to, data, message }
  const [routeMode, setRouteMode] = useState('car');
  const [showSteps, setShowSteps] = useState(false);
  const [actionSheet, setActionSheet] = useState(null); // { item, kind: 'book' | 'inquire' }
  const routeSeq = useRef(0);
  const watchId = useRef(null);
  const scanTimer = useRef(null);
  const device = useMemo(getDeviceInfo, []);

  // Internet check: kailangan ang net para sa mapa at sa paghahanap ng lugar
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const locationFound = Boolean(center);

  const clearRoute = () => {
    routeSeq.current += 1;
    setRoute(null);
    setShowSteps(false);
  };

  // Directions: magsisimula sa kinaroroonan ng tenant papunta sa napiling bahay
  const startDirections = async (item) => {
    if (!item?.coords) return;
    const seq = ++routeSeq.current;
    setShowSteps(false);
    setRoute({ status: 'loading', item });
    try {
      let from = mode === 'live' && center ? center : userLocation;
      if (!from) {
        const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        from = { lat: pos.lat, lng: pos.lng };
      }
      const data = await fetchRoute(from, item.coords);
      if (seq !== routeSeq.current) return;
      const first = getEstimates(data).find((e) => e.available);
      setRouteMode(first ? first.key : 'car');
      setRoute({ status: 'ready', item, from, to: item.coords, data, fit: true });
    } catch (err) {
      if (seq !== routeSeq.current) return;
      const message = err?.code === 1
        ? 'Location is blocked. Allow it in your browser/phone settings so we can find where you are.'
        : err?.code === 2 || err?.code === 3
          ? 'Couldn\'t get your location. Make sure location is on, then try again.'
          : err?.message === 'NoRoute'
            ? 'There\'s no drivable road to this place.'
            : 'Couldn\'t get a route right now. Please try again later.';
      setRoute({ status: 'error', item, message });
    }
  };

  // Live na biyahe: natitirang layo, auto-reroute kapag lumihis, at pagdating
  const progress = useMemo(
    () => (route?.status === 'ready' && mode === 'live' && center ? routeProgress(route.data.coords, center) : null),
    [route, mode, center]
  );
  const lastReroute = useRef(0);
  useEffect(() => {
    if (!progress || route.arrived) return;
    if (distanceKm(center, route.to) <= ARRIVE_KM) {
      setRoute((r) => (r && r.status === 'ready' ? { ...r, arrived: true } : r));
      return;
    }
    if (progress.offKm <= OFF_ROUTE_KM || Date.now() - lastReroute.current < REROUTE_GAP_MS) return;
    lastReroute.current = Date.now();
    const seq = routeSeq.current;
    fetchRoute(center, route.to).then((data) => {
      if (seq !== routeSeq.current) return;
      setRoute((r) => (r && r.status === 'ready' ? { ...r, from: center, data, fit: false } : r));
    }).catch(() => {}); // kung pumalya, susubukan ulit sa susunod na GPS update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const runScan = () => {
    clearRoute();
    clearTimeout(scanTimer.current);
    setScanning(true);
    setSelectedId(null);
    scanTimer.current = setTimeout(() => setScanning(false), SCAN_MS);
  };

  const stopWatch = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  };

  const startLiveTracking = () => {
    setLocating(true);
    setErrorType(null);
    stopWatch();

    if (!window.isSecureContext) {
      setLocating(false);
      setErrorType('insecure');
      return;
    }
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (policy?.allowsFeature && !policy.allowsFeature('geolocation')) {
      // Naka-block ng Permissions-Policy header ng server (hindi ng user)
      setLocating(false);
      setErrorType('policy');
      return;
    }
    if (!('geolocation' in navigator)) {
      setLocating(false);
      setErrorType('unavailable');
      return;
    }

    let firstFix = true;
    const watch = (highAccuracy) => navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocating(false);
        setMode('live');
        setPlaceLabel('');
        setArea(null);
        setCenter((prev) => (prev && !firstFix && distanceKm(prev, next) < MIN_MOVE_KM ? prev : next));
        if (firstFix) {
          firstFix = false;
          setRecenterKey((k) => k + 1);
          runScan();
        }
      },
      (error) => {
        // Walang GPS ang karamihan ng desktop/laptop: ulitin gamit ang Wi-Fi/network location
        if (highAccuracy && firstFix && error.code !== error.PERMISSION_DENIED) {
          stopWatch();
          watchId.current = watch(false);
          return;
        }
        if (!firstFix) return; // pansamantalang signal loss habang live na — panatilihin ang huling location
        setLocating(false);
        setErrorType(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      highAccuracy
        ? { enableHighAccuracy: true, timeout: device.isDesktop ? 8000 : 15000, maximumAge: 5000 }
        : { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );
    watchId.current = watch(true);
  };

  // Auto-track on mount kung may permission na (Grab-like)
  useEffect(() => {
    let permStatus;
    startLiveTracking();
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        permStatus = result;
        result.onchange = () => {
          if (result.state === 'granted') startLiveTracking();
        };
      }).catch(() => {});
    }
    return () => {
      stopWatch();
      clearTimeout(scanTimer.current);
      if (permStatus) permStatus.onchange = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pagbalik mula sa Settings: subukan ulit kusa kung may location error
  const errorTypeRef = useRef(null);
  errorTypeRef.current = errorType;
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible' && (errorTypeRef.current === 'denied' || errorTypeRef.current === 'unavailable')) startLiveTracking();
    };
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSearch = async (e) => {
    e?.preventDefault();
    const q = manualQuery.trim();
    if (!q) return;
    setLocating(true);
    setErrorType(null);
    try {
      const result = await geocodeAddress(q, { withPolygon: true });
      if (!result) {
        setErrorType('notfound');
        return;
      }
      stopWatch();
      setMode('search');
      setPlaceLabel(q);
      setArea({ bounds: result.bounds, geometry: result.geometry, query: q });
      setCenter({ lat: result.lat, lng: result.lng });
      setRecenterKey((k) => k + 1);
      runScan();
    } catch {
      setErrorType('notfound');
    } finally {
      setLocating(false);
    }
  };

  const stopGps = () => {
    clearRoute();
    stopWatch();
    setCenter(null);
    setMode(null);
    setArea(null);
    setErrorType(null);
    setSelectedId(null);
  };

  const changeRadius = (km) => {
    setRadiusKm(km);
    runScan();
  };

  // Listings na wala pang pin: tinatayang lokasyon mula sa address para may emoji pa rin sa mapa
  // Listings ayon sa pinili ng tenant: Find Rent (Paupahan) o Staycation. Landlords ay Paupahan lang ang default.
  const typeListings = useMemo(
    () => listings.filter((item) => (intent === 'staycation' ? isStay(item) : !isStay(item))),
    [listings, intent]
  );
  const approx = useApproxCoords(typeListings, Boolean(center) && Boolean(intent || isLandlord));

  const mapListings = useMemo(
    () => typeListings.map((item) => (!toCoords(item) && approx[item.id]
      ? { ...item, latitude: approx[item.id].lat, longitude: approx[item.id].lng, approx: true }
      : item)),
    [typeListings, approx]
  );

  const results = useMemo(() => {
    if (!center) return [];

    // Area search: lahat ng available sa buong lugar (nasa loob ng boundary, o tugma ang address text)
    if (mode === 'search' && area) {
      const place = area.query.split(',')[0].toLowerCase().replace(/\b(city|province|of)\b/g, '').trim();
      return mapListings
        .filter((item) => Boolean(item?.user_id))
        .map((item) => {
          const coords = toCoords(item);
          // Layo mula sa mismong lokasyon ng tenant (hindi mula sa gitna ng hinanap na lugar)
          return { ...item, coords, distance: coords && userLocation ? distanceKm(userLocation, coords) : null };
        })
        .filter((item) => inArea(item.coords, area) || (place && String(item.location || '').toLowerCase().includes(place)))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    // GPS radar: malapit lang sa kinaroroonan
    return mapListings
      .filter(isRadarEligible)
      .map((item) => {
        const coords = toCoords(item);
        return { ...item, coords, distance: distanceKm(center, coords) };
      })
      .filter((item) => item.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [mapListings, center, radiusKm, mode, area, userLocation]);

  const isSearch = mode === 'search';

  const nextRadius = RADIUS_OPTIONS.find((r) => r > radiusKm);
  const selected = results.find((r) => r.id === selectedId);

  const cfg = INTENTS[intent || 'rent'];
  const chooseIntent = (next) => {
    if (next === intent) return;
    clearRoute();
    setIntent(next);
    setSelectedId(null);
    if (center) runScan();
  };

  const offlineModal = isOffline && (
    <div className="modal-overlay" style={{ zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="modal-content animate-slide-up" role="alertdialog" aria-modal="true" aria-labelledby="offline-title" style={{ maxWidth: '380px', borderRadius: '24px', padding: '32px 24px', textAlign: 'center' }}>
        <div className="near-confirm-icon"><WifiOff size={34} /></div>
        <h2 id="offline-title" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '10px', fontWeight: 800 }}>Oops! No internet connection</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '24px' }}>
          Oops! You have no internet connection. Connect to the internet (Wi-Fi or mobile data) and try again.
        </p>
        <button type="button" className="near-confirm-allow" onClick={() => setIsOffline(navigator.onLine === false)}>Try Again</button>
      </div>
    </div>
  );

  if (!isLandlord && !intent) {
    return (
      <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', backgroundColor: 'white' }}>
        <header className="hero nearby-hero">
          <HeroBudi message="First, pick what you're looking for: Find Rent for rentals or Staycation for a getaway." />
          <div className="hero-content">
            <div className="nearby-title-row">
              <h2>What are you looking for?</h2>
            </div>
            <p className="nearby-sub">Choose one so we can show the right listings on the map</p>
          </div>
        </header>
        <main className="info-page-container" style={{ width: '100%', maxWidth: '800px', padding: '6px' }}>
          <div className="intent-choices">
            <button type="button" className="intent-card rent" onClick={() => chooseIntent('rent')} onPointerMove={tiltMove} onPointerLeave={tiltReset} onPointerUp={tiltReset}>
              <span className="intent-icon rent"><span className="intent-glyph"><House size={34} strokeWidth={2.2} /></span></span>
              <strong>Find Rent</strong>
              <span>Rentals, boarding houses, bed spaces — monthly rent</span>
            </button>
            <button type="button" className="intent-card stay" onClick={() => chooseIntent('staycation')} onPointerMove={tiltMove} onPointerLeave={tiltReset} onPointerUp={tiltReset}>
              <span className="intent-icon stay"><span className="intent-glyph"><TreePalm size={34} strokeWidth={2.2} /></span></span>
              <strong>Staycation</strong>
              <span>Getaways or overnight stays — priced per night</span>
            </button>
          </div>
        </main>
        {offlineModal}
      </div>
    );
  }

  return (
    <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', backgroundColor: 'white' }}>
      <header className="hero nearby-hero">
        <HeroBudi message={locationFound
            ? 'Here are the places near you! Tap a pin on the map to see the details.'
            : device.isDesktop
              ? 'Allow location in your browser, or type a place in the search to see nearby rentals.'
              : 'Turn on your phone\'s Location to see places near you.'} />
        <div className="hero-content">
          {!isLandlord && (
            <>
              <div className="nearby-title-row">
                <span className="nearby-icon"><Navigation size={22} /></span>
                <h2>{isSearch ? `${cfg.title} in ${placeLabel}` : `${cfg.title} Near You`}</h2>
                {mode === 'live' && <span className="live-pill"><Signal size={12} className="pulse" /> LIVE</span>}
              </div>
              <p className="nearby-sub">
                {mode === 'live' ? `Scanning your area for available ${cfg.tag}` : isSearch ? `All available ${cfg.tag} across ${placeLabel}` : 'Search for a place to move to, or scan the area near you'}
              </p>

              <form onSubmit={handleManualSearch} className="search-bar nearby-search">
                <Search className="search-icon" size={20} />
                <input type="text" placeholder="Where are you moving? (e.g. Dagupan, Pangasinan)" value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} />
                <button type="submit" className="nearby-search-btn" disabled={locating}>Search</button>
              </form>
            </>
          )}
        </div>
      </header>

      <main className="info-page-container" style={{ width: '100%', maxWidth: '800px', padding: '6px' }}>
        {errorType === 'notfound' && (
          <p className="near-inline-error"><AlertCircle size={15} /> Couldn't find that place. Try a different city or barangay.</p>
        )}

        {!locationFound ? (
          <div className="near-empty">
            {errorType === 'denied' || errorType === 'insecure' || errorType === 'policy' ? (
              <div className="near-error-card animate-fade-in">
                <AlertCircle size={44} />
                <h3>Location Access Required</h3>
                {errorType === 'policy' ? (
                  <p>This website can't use location right now. Use the search above to find a city or barangay instead.</p>
                ) : errorType === 'insecure' ? (
                  <p>Location only works on a secure link (<b>https://</b>). Open the app using an https link, or use the search above.</p>
                ) : device.isDesktop ? (
                  <>
                    <p>Location is blocked in your browser. To see places near you:</p>
                    <DesktopLocationSteps os={device.os} browser={device.browser} />
                    <button type="button" className="near-cta" onClick={startLiveTracking}><MapPin size={20} /> Try again</button>
                  </>
                ) : (
                  <>
                    <p>
                      Please enable "Location" in your <b>Phone Settings</b> for this app to see properties near you automatically. Or use the manual search above.
                    </p>
                    <button type="button" className="near-cta" onClick={async () => { if (!(await openDeviceLocationSettings())) startLiveTracking(); }}><MapPin size={20} /> Open Location Settings</button>
                  </>
                )}
              </div>
            ) : (
              <div>
                <div className="near-pin"><Radar size={42} /></div>
                <h3>Scan your area</h3>

                {locating && <p className="near-inline-error"><Loader2 size={15} className="animate-spin" /> Finding you...</p>}

                {errorType === 'unavailable' && (
                  <>
                    <p className="near-inline-error"><AlertCircle size={15} /> {device.isDesktop ? 'Couldn\'t get your location. Make sure Wi-Fi and Location services are on, or use the search.' : 'Couldn\'t get a GPS signal. Make sure your phone\'s Location is on, then try again or use the search.'}</p>
                    {!device.isDesktop && (
                      <button type="button" className="near-cta" onClick={async () => { if (!(await openDeviceLocationSettings())) startLiveTracking(); }}><MapPin size={20} /> Open Location Settings</button>
                    )}
                    <button type="button" className="near-cta" onClick={startLiveTracking}><MapPin size={20} /> Try again</button>
                  </>
                )}

                {device.isDesktop ? (
                  <div className="near-reminder">
                    <div className="near-reminder-head">
                      <span className="near-reminder-icon"><Lightbulb size={16} /></span>
                      <strong>Reminder for Desktop / Laptop</strong>
                    </div>
                    <p className="near-reminder-text">After pressing the button, click <b>Allow</b> on the {device.browser} popup. If nothing appears or it's blocked:</p>
                    <DesktopLocationSteps os={device.os} browser={device.browser} />
                    <span className="near-reminder-note">On desktop, Wi-Fi is used to find you, so it may be off by a few meters. You can also type a city or barangay in the search.</span>
                  </div>
                ) : (
                  <MobileLocationTip isIOS={device.isIOS} />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="listings">
            <div className="nearby-head">
              <div>
                <h3>{scanning ? 'Scanning...' : isSearch ? `${results.length} available in ${placeLabel}` : `${results.length} available within ${radiusKm} km`}</h3>
                <p className="gps-status">
                  <span className={`gps-dot ${isSearch ? 'manual' : ''}`} />
                  {mode === 'live' ? (device.isDesktop ? 'Location Connected • Updating Live' : 'GPS Connected • Updating Live') : `Search area: ${placeLabel}`}
                </p>
              </div>
              <div className="nearby-head-actions">
                {isSearch && (
                  <button className="stop-gps-btn near-me-btn" onClick={startLiveTracking} disabled={locating}>
                    {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />} Near me
                  </button>
                )}
                <button className="stop-gps-btn stop-yellow" onClick={stopGps}>{mode === 'live' ? (device.isDesktop ? 'Stop Location' : 'Stop GPS') : 'Clear'}</button>
              </div>
            </div>

            <div className="radar-card">
              <RadarMap
                center={center}
                radiusKm={radiusKm}
                results={results}
                scanning={scanning}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isLive={mode === 'live'}
                recenterKey={recenterKey}
                areaBounds={isSearch ? area?.bounds : null}
                route={route}
                me={mode === 'live' ? center : null}
              />

              {!isSearch && (
                <div className="radius-chips" role="group" aria-label="Search radius">
                  {RADIUS_OPTIONS.map((km) => (
                    <button key={km} type="button" className={km === radiusKm ? 'active' : ''} onClick={() => changeRadius(km)}>
                      {km} km
                    </button>
                  ))}
                </div>
              )}

              <button type="button" className="recenter-btn" aria-label="Recenter map" title="Recenter" onClick={() => setRecenterKey((k) => k + 1)}>
                <LocateFixed size={18} />
              </button>

              {scanning && (
                <div className="scan-banner"><Radar size={15} className="spin-slow" /> {isSearch ? `Finding available places in ${placeLabel}...` : 'Finding available places...'}</div>
              )}

              {!scanning && selected && !route && (
                <div className="map-peek animate-slide-up" onClick={() => onSelectProperty(selected)}>
                  <img src={ikImage(selected.image, 640) || '/placeholder.png'} alt={selected.name || 'Listing'} />
                  <div className="map-peek-info">
                    <strong>
                      {selected.name || selected.location?.split(',')[0]}
                      {selected.is_verified && <BadgeCheck size={14} fill="#0066ff" color="white" />}
                    </strong>
                    {isOccupied(selected) && <span className="occupied-badge">Occupied</span>}
                    <span>{selected.location}</span>
                    {selected.approx && <span className="map-peek-approx">≈ Approximate location (not yet pinned by the landlord)</span>}
                    <span className="map-peek-meta">₱{Number(selected.price || 0).toLocaleString()}{isStay(selected) ? '/night' : '/mo'}{selected.distance != null && <> • {selected.approx ? '≈ ' : ''}{formatDistance(selected.distance)}{isSearch ? ' from you' : ''}</>}</span>
                    <div className="peek-actions">
                      <button type="button" className="peek-directions" onClick={(e) => { e.stopPropagation(); startDirections(selected); }}>
                        <RouteIcon size={14} /> Directions
                      </button>
                      <button
                        type="button"
                        className={`peek-action ${isStay(selected) ? 'stay' : 'rent'}`}
                        onClick={(e) => { e.stopPropagation(); setActionSheet({ item: selected, kind: isStay(selected) ? 'book' : 'inquire' }); }}
                      >
                        <CalendarCheck size={14} /> Book Here
                      </button>
                    </div>
                  </div>
                  <button type="button" className="map-peek-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); setSelectedId(null); }}><X size={16} /></button>
                </div>
              )}

              {!scanning && results.length === 0 && (
                <div className="radar-empty">
                  <strong>{isSearch ? `Nothing available in ${placeLabel} yet` : 'No available places here'}</strong>
                  <span>{isSearch ? 'No registered landlords have vacant listings in this area yet. Try a nearby town or city.' : `No registered landlords have vacant listings within ${radiusKm} km yet.`}</span>
                  {!isSearch && nextRadius && (
                    <button type="button" onClick={() => changeRadius(nextRadius)}>Expand to {nextRadius} km</button>
                  )}
                </div>
              )}
            </div>

            {route && (
              <RoutePanel
                route={route}
                activeMode={routeMode}
                onMode={setRouteMode}
                onClose={clearRoute}
                showSteps={showSteps}
                onToggleSteps={() => setShowSteps((v) => !v)}
                progress={progress}
              />
            )}

            {!scanning && results.length > 0 && (
              <div className="listing-grid">
                {results.map((item) => (
                  <div
                    key={item.id}
                    className={`listing-card animate-slide-up ${item.id === selectedId ? 'radar-selected' : ''}`}
                    onClick={() => onSelectProperty(item)}
                  >
                    <div className="image-container">
                      <img src={ikImage(item.image, 480) || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
                      {isOccupied(item) && <span className="occupied-badge on-image">Occupied</span>}
                      {item.distance != null && (
                        <span className="near-distance">
                          <MapPin size={11} /> {item.approx ? '≈ ' : ''}{formatDistance(item.distance)}
                        </span>
                      )}
                    </div>
                    <div className="card-info">
                      <div className="card-header-row">
                        <div className="card-title-group">
                          <h4 className="card-title">{item.location?.split(',')[0] || item.name}</h4>
                          <p className="card-subtitle">
                            {item.type || 'Rental'} • {item.distance != null ? `${item.approx ? '≈ ' : ''}${formatDistance(item.distance)} ${isSearch ? 'from you' : 'away'}` : (item.location || placeLabel)}
                          </p>
                        </div>
                        {reviewStats?.get(item.id)?.count > 0 && (
                          <span className="card-rating" title={`${reviewStats.get(item.id).avg.toFixed(1)} out of 3`}>
                            <Star size={11} fill="currentColor" strokeWidth={0} />
                            {reviewStats.get(item.id).avg.toFixed(1)}
                            <em>({reviewStats.get(item.id).count})</em>
                          </span>
                        )}
                      </div>

                      <div className="card-price-row">
                        <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
                        <span className="price-period">{isStay(item) ? '/night' : '/month'}</span>
                      </div>

                      <div className="card-action-row">
                        <button
                          type="button"
                          className={`card-action-btn ${isStay(item) ? 'stay' : 'rent'}`}
                          onClick={(e) => { e.stopPropagation(); setActionSheet({ item, kind: isStay(item) ? 'book' : 'inquire' }); }}
                        >
                          <CalendarCheck size={15} /> Book Here
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {actionSheet && (
        <ListingActionSheet
          item={actionSheet.item}
          kind={actionSheet.kind}
          onClose={() => setActionSheet(null)}
          onViewDetails={onSelectProperty}
        />
      )}

      <div className="near-scroll-arrows">
        <button type="button" aria-label="Scroll up" onClick={() => window.scrollBy({ top: -window.innerHeight * 0.7, behavior: 'smooth' })}><ChevronUp size={22} /></button>
        <button type="button" aria-label="Scroll down" onClick={() => window.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' })}><ChevronDown size={22} /></button>
      </div>

      {offlineModal}
    </div>
  );
};

export default FindNearbyPage;
