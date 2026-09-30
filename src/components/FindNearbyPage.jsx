import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Loader2, MapPin, Star, X, ShieldCheck, Search, AlertCircle, Signal, LocateFixed, Radar, BadgeCheck, House, TreePalm, Route as RouteIcon, Car, Bus, Bike, ChevronDown, CalendarCheck, Send } from 'lucide-react';
import { TILE_URL, TILE_OPTIONS, MAP_OPTIONS, toCoords, distanceKm, formatDistance, geocodeAddress, inArea, getCurrentPosition } from '../lib/geo';
import { useApproxCoords } from '../lib/useApproxCoords';
import ListingActionSheet from './ListingActionSheet';
import { fetchRoute, getEstimates, formatDuration, formatStepDistance, stepText } from '../lib/routing';
import './FindNearbyPage.css';

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
  rent: { Icon: House, label: 'Find Rent', title: 'Rentals', tag: 'paupahan' },
  staycation: { Icon: TreePalm, label: 'Staycation', title: 'Staycations', tag: 'staycation' }
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
  return { isDesktop: !isMobile, os, browser };
};

const DesktopLocationSteps = ({ os, browser }) => (
  <ol className="desktop-steps">
    <li>
      I-click ang <b>🔒 lock / site settings icon</b> sa kaliwa ng address bar ng {browser}, tapos gawing <b>Allow</b> ang <b>Location</b>.
    </li>
    {os === 'windows' && (
      <li>
        Sa Windows: <b>Settings</b> &gt; <b>Privacy &amp; security</b> &gt; <b>Location</b> — i-ON ang <b>Location services</b> at <b>Let desktop apps access your location</b>.
      </li>
    )}
    {os === 'mac' && (
      <li>
        Sa Mac: <b>System Settings</b> &gt; <b>Privacy &amp; Security</b> &gt; <b>Location Services</b> — i-ON ito at i-check ang <b>{browser}</b>.
      </li>
    )}
    <li>I-reload ang page at pindutin ulit ang <b>Activate Location</b>.</li>
  </ol>
);
const SCAN_MS = 2400;
const MIN_MOVE_KM = 0.02; // huwag i-update ang radar sa GPS jitter na < 20m

const isOccupied = (item) => {
  const value = String(item?.availability || '').toLowerCase().trim();
  return value === 'occupied' || value === 'accommodated' || value === 'rented' || value === 'unavailable';
};

// Registered landlord = may account (user_id) sa app. Available lang at may pin sa mapa.
const isRadarEligible = (item) => Boolean(item?.user_id) && !isOccupied(item) && Boolean(toCoords(item));

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

const RadarMap = ({ center, radiusKm, results, scanning, selectedId, onSelect, isLive, recenterKey, areaBounds, route }) => {
  const routeItemId = route?.status === 'ready' ? route.item.id : null;
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layers = useRef({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
    if (!layers.current.circle) return;
    map.fitBounds(layers.current.circle.getBounds(), { padding: [16, 16] });
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
        html: `<div class="house-marker ${item.id === selectedId ? 'selected' : ''} ${item.is_verified ? 'verified' : ''} ${item.approx ? 'approx' : ''} ${isStay(item) ? 'stay' : ''}" style="animation-delay:${Math.min(i * 90, 1200)}ms"><span class="hm-icon">${markerIcon(item)}</span><span class="hm-price">${escapeHtml(shortPrice(item.price))}</span></div>`,
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
    L.marker([route.from.lat, route.from.lng], {
      icon: L.divIcon({ className: 'route-marker-wrap', html: '<div class="route-start"><span class="rs-dot"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span class="rs-label">Ikaw</span></div>', iconSize: [96, 36], iconAnchor: [18, 18] }),
      zIndexOffset: 1200, interactive: false
    }).addTo(group);
    const endSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${isStay(route.item) ? MARKER_ICONS.stay : MARKER_ICONS.rent}</svg>`;
    L.marker([route.to.lat, route.to.lng], {
      icon: L.divIcon({ className: 'route-marker-wrap', html: `<div class="route-end ${isStay(route.item) ? 'stay' : ''}"><span>${endSvg}</span></div>`, iconSize: [38, 46], iconAnchor: [19, 46] }),
      zIndexOffset: 1100, interactive: false
    }).addTo(group);
    group.addTo(map);
    map.fitBounds(L.latLngBounds(route.data.coords), { padding: [44, 44] });
    return () => { group.remove(); };
  }, [route]);

  // Pan sa napiling listing
  useEffect(() => {
    const map = mapRef.current;
    const item = results.find((r) => r.id === selectedId);
    if (map && item?.coords) map.panTo([item.coords.lat, item.coords.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={mapEl} className="radar-map" />;
};

const MODE_ICONS = { tricycle: Bike, jeep: Bus, car: Car };

const RoutePanel = ({ route, activeMode, onMode, onClose, showSteps, onToggleSteps }) => {
  const name = route.item.name || route.item.location?.split(',')[0] || 'bahay';

  if (route.status === 'loading') {
    return (
      <div className="route-panel">
        <div className="route-loading"><Loader2 size={18} className="animate-spin" /> Hinahanap ang ruta papunta sa {name}...</div>
      </div>
    );
  }

  if (route.status === 'error') {
    return (
      <div className="route-panel error">
        <p><AlertCircle size={16} /> {route.message}</p>
        <button type="button" className="route-close-inline" onClick={onClose}>Isara</button>
      </div>
    );
  }

  const { data } = route;
  const estimates = getEstimates(data);
  const active = estimates.find((e) => e.key === activeMode) || estimates[estimates.length - 1];
  const note = data.distanceKm > 150
    ? 'Malayong biyahe ito — maaaring may sasakyang pandagat o eroplano. Tantiya lang ang oras.'
    : data.distanceKm > 60
      ? 'Malayo ito — karaniwang bus, van, o kotse ang gamit. Hindi na karaniwang biyahe ang tricycle at jeep.'
      : data.distanceKm > 15
        ? 'Malayo na para sa tricycle — jeep o kotse ang mas karaniwan.'
        : 'Tantiya lang ang oras; nag-iiba ayon sa trapiko at hintuan.';

  return (
    <div className="route-panel animate-slide-up">
      <div className="route-head">
        <div>
          <strong>Papunta sa {name}</strong>
          <span>{formatDistance(data.distanceKm)} • ≈ {formatDuration(active.minutes)} sa {active.label}</span>
        </div>
        <button type="button" className="route-close" aria-label="Isara ang ruta" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="route-modes" role="group" aria-label="Uri ng sasakyan">
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
              <span>{e.available ? `≈ ${formatDuration(e.minutes)}` : 'Malayo'}</span>
            </button>
          );
        })}
      </div>

      <p className="route-note">{note}{route.item.approx ? ' Tinatayang lokasyon din ng bahay ang destinasyon.' : ''}</p>

      <div className="route-actions">
        <button type="button" className="route-steps-toggle" onClick={onToggleSteps} aria-expanded={showSteps}>
          {showSteps ? 'Itago' : 'Ipakita'} ang mga hakbang <ChevronDown size={15} className={showSteps ? 'flip' : ''} />
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
  const [showConfirm, setShowConfirm] = useState(false);
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
      setRoute({ status: 'ready', item, from, to: item.coords, data });
    } catch (err) {
      if (seq !== routeSeq.current) return;
      const message = err?.code === 1
        ? 'Naka-block ang location. I-Allow ito sa browser/phone settings para malaman kung nasaan ka.'
        : err?.code === 2 || err?.code === 3
          ? 'Hindi makuha ang lokasyon mo. Siguraduhing naka-ON ang location, tapos subukan ulit.'
          : err?.message === 'NoRoute'
            ? 'Walang daan na maaabot ng sasakyan papunta rito.'
            : 'Hindi makuha ang ruta ngayon. Subukan ulit mamaya.';
      setRoute({ status: 'error', item, message });
    }
  };

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
    setShowConfirm(false);
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
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        permStatus = result;
        if (result.state === 'granted') startLiveTracking();
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
        .filter((item) => Boolean(item?.user_id) && !isOccupied(item))
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

  // Unang screen: pumili muna ang tenant kung Find Rent o Staycation bago gumana ang Nearby
  if (!isLandlord && !intent) {
    return (
      <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', backgroundColor: 'white' }}>
        <header className="hero nearby-hero">
          <div className="hero-content">
            <div className="nearby-title-row">
              <span className="nearby-icon"><Navigation size={22} /></span>
              <h2>Ano ang hinahanap mo?</h2>
            </div>
            <p className="nearby-sub">Piliin muna para ipakita sa mapa ang tamang listings</p>
          </div>
        </header>
        <main className="info-page-container" style={{ width: '100%', maxWidth: '800px', padding: '6px' }}>
          <div className="intent-choices">
            <button type="button" className="intent-card rent" onClick={() => chooseIntent('rent')} onPointerMove={tiltMove} onPointerLeave={tiltReset} onPointerUp={tiltReset}>
              <span className="intent-icon rent"><span className="intent-glyph"><House size={34} strokeWidth={2.2} /></span></span>
              <strong>Find Rent</strong>
              <span>Paupahan, boarding house, bed space — buwan-buwan na upa</span>
            </button>
            <button type="button" className="intent-card stay" onClick={() => chooseIntent('staycation')} onPointerMove={tiltMove} onPointerLeave={tiltReset} onPointerUp={tiltReset}>
              <span className="intent-icon stay"><span className="intent-glyph"><TreePalm size={34} strokeWidth={2.2} /></span></span>
              <strong>Staycation</strong>
              <span>Bakasyon o overnight stay — presyo kada gabi</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', backgroundColor: 'white' }}>
      <header className="hero nearby-hero">
        <div className="hero-content">
          {!isLandlord && (
            <>
              <div className="nearby-title-row">
                <span className="nearby-icon"><Navigation size={22} /></span>
                <h2>{isSearch ? `${cfg.title} sa ${placeLabel}` : `${cfg.title} Near You`}</h2>
                {mode === 'live' && <span className="live-pill"><Signal size={12} className="pulse" /> LIVE</span>}
              </div>
              <p className="nearby-sub">
                {mode === 'live' ? `Ini-scan ang paligid mo para sa available na ${cfg.tag}` : isSearch ? `Lahat ng available na ${cfg.tag} sa buong ${placeLabel}` : 'Mag-search ng lugar na lilipatan, o i-scan ang malapit sa iyo'}
              </p>

              <form onSubmit={handleManualSearch} className="search-bar nearby-search">
                <Search className="search-icon" size={20} />
                <input type="text" placeholder="Saan ka lilipat? (hal. Dagupan, Pangasinan)" value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} />
                <button type="submit" className="nearby-search-btn" disabled={locating}>Search</button>
              </form>
            </>
          )}
        </div>
      </header>

      <main className="info-page-container" style={{ width: '100%', maxWidth: '800px', padding: '6px' }}>
        {errorType === 'notfound' && (
          <p className="near-inline-error"><AlertCircle size={15} /> Hindi mahanap ang lugar na iyon. Subukan ang ibang city o barangay.</p>
        )}

        {!locationFound ? (
          <div className="near-empty">
            {errorType === 'denied' || errorType === 'insecure' || errorType === 'policy' ? (
              <div className="near-error-card animate-fade-in">
                <AlertCircle size={44} />
                <h3>Location Access Required</h3>
                {errorType === 'policy' ? (
                  <p>Hindi pa pinapayagan ng website ang location sa ngayon. Gamitin muna ang search sa itaas para hanapin ang city o barangay.</p>
                ) : errorType === 'insecure' ? (
                  <p>Gumagana lang ang location sa secure na link (<b>https://</b>). Buksan ang app gamit ang https link, o gamitin ang search sa itaas.</p>
                ) : device.isDesktop ? (
                  <>
                    <p>Naka-block ang location sa browser mo. Para makita ang mga bahay na malapit sa iyo:</p>
                    <DesktopLocationSteps os={device.os} browser={device.browser} />
                    <button type="button" className="near-cta" onClick={startLiveTracking}><MapPin size={20} /> Subukan ulit</button>
                  </>
                ) : (
                  <p>
                    Please enable "Location" in your <b>Phone Settings</b> for this app to see properties near you automatically. Or use the manual search above.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="near-pin"><Radar size={42} /></div>
                <h3>I-scan ang paligid mo</h3>

                <button onClick={() => setShowConfirm(true)} disabled={locating} className="near-cta">
                  {locating ? <><Loader2 size={22} className="animate-spin" /> Hinahanap ka...</> : <><MapPin size={20} /> {device.isDesktop ? 'Activate Location' : 'Activate Live GPS'}</>}
                </button>

                {errorType === 'unavailable' && (
                  <p className="near-inline-error"><AlertCircle size={15} /> {device.isDesktop ? 'Hindi makuha ang location. Siguraduhing naka-ON ang Wi-Fi at Location services, o gamitin ang search.' : 'Hindi makuha ang GPS signal. Subukan ulit o gamitin ang search.'}</p>
                )}

                {device.isDesktop ? (
                  <div className="near-reminder">
                    <strong>Reminder (Desktop / Laptop)</strong>
                    Pagpindot ng button, i-click ang <b>Allow</b> sa lalabas na popup ng {device.browser}. Kung walang lumabas o naka-block:
                    <DesktopLocationSteps os={device.os} browser={device.browser} />
                    <span className="near-reminder-note">Sa desktop, Wi-Fi ang ginagamit para hanapin ka kaya puwedeng ilang metro ang layo. Puwede ring i-type ang city o barangay sa search.</span>
                  </div>
                ) : (
                  <p className="near-reminder">
                    <strong>Reminder</strong>
                    Go to your <b>Phone Settings</b> &gt; <b>Location</b> then turn it <b>ON</b>. Makikita mo sa mapa ang mga available na bahay ng registered landlords malapit sa iyo.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="listings">
            <div className="nearby-head">
              <div>
                <h3>{scanning ? 'Scanning...' : isSearch ? `${results.length} available sa ${placeLabel}` : `${results.length} available sa loob ng ${radiusKm} km`}</h3>
                <p className="gps-status">
                  <span className={`gps-dot ${isSearch ? 'manual' : ''}`} />
                  {mode === 'live' ? (device.isDesktop ? 'Location Connected • Updating Live' : 'GPS Connected • Updating Live') : `Search area: ${placeLabel}`}
                </p>
              </div>
              <div className="nearby-head-actions">
                {isSearch && (
                  <button className="stop-gps-btn near-me-btn" onClick={() => setShowConfirm(true)} disabled={locating}>
                    {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />} Malapit sa akin
                  </button>
                )}
                <button className="stop-gps-btn" onClick={stopGps}>{mode === 'live' ? (device.isDesktop ? 'Stop Location' : 'Stop GPS') : 'Clear'}</button>
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
                <div className="scan-banner"><Radar size={15} className="spin-slow" /> {isSearch ? `Hinahanap ang available sa ${placeLabel}...` : 'Hinahanap ang mga available na bahay...'}</div>
              )}

              {!scanning && selected && !route && (
                <div className="map-peek animate-slide-up" onClick={() => onSelectProperty(selected)}>
                  <img src={selected.image || '/placeholder.png'} alt={selected.name || 'Listing'} />
                  <div className="map-peek-info">
                    <strong>
                      {selected.name || selected.location?.split(',')[0]}
                      {selected.is_verified && <BadgeCheck size={14} fill="#0066ff" color="white" />}
                    </strong>
                    <span>{selected.location}</span>
                    {selected.approx && <span className="map-peek-approx">≈ Tinatayang lokasyon (hindi pa naka-pin ng landlord)</span>}
                    <span className="map-peek-meta">₱{Number(selected.price || 0).toLocaleString()}{isStay(selected) ? '/gabi' : '/mo'}{selected.distance != null && <> • {selected.approx ? '≈ ' : ''}{formatDistance(selected.distance)}{isSearch ? ' mula sa iyo' : ''}</>}</span>
                    <div className="peek-actions">
                      <button type="button" className="peek-directions" onClick={(e) => { e.stopPropagation(); startDirections(selected); }}>
                        <RouteIcon size={14} /> Directions
                      </button>
                      <button
                        type="button"
                        className={`peek-action ${isStay(selected) ? 'stay' : 'rent'}`}
                        onClick={(e) => { e.stopPropagation(); setActionSheet({ item: selected, kind: isStay(selected) ? 'book' : 'inquire' }); }}
                      >
                        {isStay(selected) ? <><CalendarCheck size={14} /> Book</> : <><Send size={14} /> Inquire</>}
                      </button>
                    </div>
                  </div>
                  <button type="button" className="map-peek-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); setSelectedId(null); }}><X size={16} /></button>
                </div>
              )}

              {!scanning && results.length === 0 && (
                <div className="radar-empty">
                  <strong>{isSearch ? `Wala pang available sa ${placeLabel}` : 'Walang available na bahay dito'}</strong>
                  <span>{isSearch ? 'Wala pang registered landlord na may bakanteng listing sa lugar na ito. Subukan ang kalapit na bayan o city.' : `Wala pang registered landlord na may bakanteng listing sa loob ng ${radiusKm} km.`}</span>
                  {!isSearch && nextRadius && (
                    <button type="button" onClick={() => changeRadius(nextRadius)}>Palawakin sa {nextRadius} km</button>
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
                      <img src={item.image || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
                      {item.distance != null && (
                        <span className="near-distance">
                          <MapPin size={11} /> {item.approx ? '≈ ' : ''}{formatDistance(item.distance)}
                        </span>
                      )}
                    </div>
                    <div className="card-info">
                      <h4 className="card-title">{item.location?.split(',')[0] || item.name}</h4>
                      <p className="card-subtitle">
                        {item.type || 'Rental'} • {item.distance != null ? `${item.approx ? '≈ ' : ''}${formatDistance(item.distance)} ${isSearch ? 'mula sa iyo' : 'away'}` : (item.location || placeLabel)}
                      </p>

                      <div className="card-price-row">
                        <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
                        <span className="price-period">{isStay(item) ? '/gabi' : '/month'}</span>
                        {reviewStats?.get(item.id)?.count > 0 && (
                          <span className="card-rating" title={`${reviewStats.get(item.id).avg.toFixed(1)} out of 3`}>
                            <Star size={11} fill="currentColor" strokeWidth={0} />
                            {reviewStats.get(item.id).avg.toFixed(1)}
                            <em>({reviewStats.get(item.id).count})</em>
                          </span>
                        )}
                      </div>

                      <div className="card-action-row">
                        <button
                          type="button"
                          className={`card-action-btn ${isStay(item) ? 'stay' : 'rent'}`}
                          onClick={(e) => { e.stopPropagation(); setActionSheet({ item, kind: isStay(item) ? 'book' : 'inquire' }); }}
                        >
                          {isStay(item) ? <><CalendarCheck size={15} /> Book</> : <><Send size={15} /> Inquire</>}
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

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowConfirm(false)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', borderRadius: '24px', padding: '32px 24px', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowConfirm(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            <div className="near-confirm-icon"><Signal size={34} className="pulse" /></div>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '10px', fontWeight: 800 }}>{device.isDesktop ? 'Allow Location Access?' : 'Enable Real-time Tracking?'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '24px' }}>Gagamitin ng BudgetRentPH ang location mo para ipakita sa mapa ang pinakamalapit na available na bahay. Hindi ito sine-save o ibinabahagi.{device.isDesktop && <> Pagkatapos, i-click din ang <b>Allow</b> sa popup ng {device.browser}.</>}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={startLiveTracking} className="near-confirm-allow"><ShieldCheck size={20} /> {device.isDesktop ? 'Allow Location' : 'Allow Live GPS'}</button>
              <button onClick={() => setShowConfirm(false)} className="near-confirm-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindNearbyPage;
