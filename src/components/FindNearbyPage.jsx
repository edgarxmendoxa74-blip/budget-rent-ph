import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Loader2, MapPin, Star, X, ShieldCheck, Search, AlertCircle, Signal, LocateFixed, Radar, BadgeCheck } from 'lucide-react';
import { TILE_URL, TILE_OPTIONS, MAP_OPTIONS, toCoords, distanceKm, formatDistance, geocodeAddress, inBounds } from '../lib/geo';
import './FindNearbyPage.css';

const RADIUS_OPTIONS = [1, 3, 5, 10];

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

const RadarMap = ({ center, radiusKm, results, scanning, selectedId, onSelect, isLive, recenterKey, areaBounds }) => {
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
    results.filter((item) => item.coords).forEach((item, i) => {
      const icon = L.divIcon({
        className: 'house-marker-wrap',
        html: `<div class="house-marker ${item.id === selectedId ? 'selected' : ''} ${item.is_verified ? 'verified' : ''}" style="animation-delay:${Math.min(i * 90, 1200)}ms"><span class="hm-emoji">🏠</span><span class="hm-price">${escapeHtml(shortPrice(item.price))}</span></div>`,
        iconSize: [78, 32],
        iconAnchor: [39, 32]
      });
      L.marker([item.coords.lat, item.coords.lng], { icon, zIndexOffset: item.id === selectedId ? 900 : 0, title: item.name || item.location || 'Listing' })
        .on('click', () => onSelectRef.current(item.id))
        .addTo(group);
    });
  }, [results, scanning, selectedId]);

  // Pan sa napiling listing
  useEffect(() => {
    const map = mapRef.current;
    const item = results.find((r) => r.id === selectedId);
    if (map && item?.coords) map.panTo([item.coords.lat, item.coords.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={mapEl} className="radar-map" />;
};

const FindNearbyPage = ({ listings, reviewStats, onSelectProperty, isLandlord }) => {
  const [locating, setLocating] = useState(false);
  const [center, setCenter] = useState(null); // { lat, lng }
  const [mode, setMode] = useState(null); // 'live' (GPS radar, malapit lang) | 'search' (buong lugar na hinanap)
  const [placeLabel, setPlaceLabel] = useState('');
  const [area, setArea] = useState(null); // { bounds, query } ng hinanap na lugar
  const [radiusKm, setRadiusKm] = useState(3);
  const [scanning, setScanning] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorType, setErrorType] = useState(null);
  const [manualQuery, setManualQuery] = useState('');
  const watchId = useRef(null);
  const scanTimer = useRef(null);
  const device = useMemo(getDeviceInfo, []);

  const locationFound = Boolean(center);

  const runScan = () => {
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
      const result = await geocodeAddress(q);
      if (!result) {
        setErrorType('notfound');
        return;
      }
      stopWatch();
      setMode('search');
      setPlaceLabel(q);
      setArea({ bounds: result.bounds, query: q });
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

  const results = useMemo(() => {
    if (!center) return [];

    // Area search: lahat ng available sa buong lugar (nasa loob ng boundary, o tugma ang address text)
    if (mode === 'search' && area) {
      const place = area.query.split(',')[0].toLowerCase().replace(/\b(city|province|of)\b/g, '').trim();
      return listings
        .filter((item) => Boolean(item?.user_id) && !isOccupied(item))
        .map((item) => {
          const coords = toCoords(item);
          return { ...item, coords, distance: coords ? distanceKm(center, coords) : null };
        })
        .filter((item) => inBounds(item.coords, area.bounds) || (place && String(item.location || '').toLowerCase().includes(place)))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    // GPS radar: malapit lang sa kinaroroonan
    return listings
      .filter(isRadarEligible)
      .map((item) => {
        const coords = toCoords(item);
        return { ...item, coords, distance: distanceKm(center, coords) };
      })
      .filter((item) => item.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [listings, center, radiusKm, mode, area]);

  const isSearch = mode === 'search';

  const nextRadius = RADIUS_OPTIONS.find((r) => r > radiusKm);
  const selected = results.find((r) => r.id === selectedId);

  return (
    <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', backgroundColor: 'white' }}>
      <header className="hero nearby-hero">
        <div className="hero-content">
          {!isLandlord && (
            <>
              <div className="nearby-title-row">
                <span className="nearby-icon"><Navigation size={22} /></span>
                <h2>{isSearch ? `Rentals sa ${placeLabel}` : 'Rentals Near You'}</h2>
                {mode === 'live' && <span className="live-pill"><Signal size={12} className="pulse" /> LIVE</span>}
              </div>
              <p className="nearby-sub">
                {mode === 'live' ? 'Ini-scan ang paligid mo para sa available na bahay' : isSearch ? `Lahat ng available na paupahan sa buong ${placeLabel}` : 'Mag-search ng lugar na lilipatan, o i-scan ang malapit sa iyo'}
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

              {!scanning && selected && (
                <div className="map-peek animate-slide-up" onClick={() => onSelectProperty(selected)}>
                  <img src={selected.image || '/placeholder.png'} alt={selected.name || 'Listing'} />
                  <div className="map-peek-info">
                    <strong>
                      {selected.name || selected.location?.split(',')[0]}
                      {selected.is_verified && <BadgeCheck size={14} fill="#0066ff" color="white" />}
                    </strong>
                    <span>{selected.location}</span>
                    <span className="map-peek-meta">₱{Number(selected.price || 0).toLocaleString()}/mo{!isSearch && selected.distance != null && <> • {formatDistance(selected.distance)}</>}</span>
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
                      {!isSearch && (
                        <span className="near-distance">
                          <MapPin size={11} /> {formatDistance(item.distance)}
                        </span>
                      )}
                    </div>
                    <div className="card-info">
                      <h4 className="card-title">{item.location?.split(',')[0] || item.name}</h4>
                      <p className="card-subtitle">
                        {item.type || 'Rental'} • {isSearch ? (item.location || placeLabel) : `${formatDistance(item.distance)} away`}
                      </p>

                      <div className="card-price-row">
                        <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
                        <span className="price-period">/month</span>
                        {reviewStats?.get(item.id)?.count > 0 && (
                          <span className="card-rating" title={`${reviewStats.get(item.id).avg.toFixed(1)} out of 5`}>
                            <Star size={11} fill="currentColor" strokeWidth={0} />
                            {reviewStats.get(item.id).avg.toFixed(1)}
                            <em>({reviewStats.get(item.id).count})</em>
                          </span>
                        )}
                      </div>

                      {item.coords && (
                      <button
                        className="card-inquire-btn"
                        aria-label="Show on map"
                        title="Show on map"
                        onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        📍
                      </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

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
