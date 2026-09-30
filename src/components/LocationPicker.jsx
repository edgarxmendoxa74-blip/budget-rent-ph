import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Search, Loader2, MapPin } from 'lucide-react';
import { DEFAULT_CENTER, TILE_URL, TILE_OPTIONS, MAP_OPTIONS, geocodeAddress, getCurrentPosition } from '../lib/geo';
import './LocationPicker.css';

const pinIcon = L.divIcon({
  className: 'lp-pin',
  html: '<div class="lp-pin-body"><span>🏠</span></div>',
  iconSize: [40, 48],
  iconAnchor: [20, 46]
});

// Map pin picker para sa landlord: i-tap ang mapa, i-drag ang pin, gamitin ang GPS, o hanapin ang address.
const LocationPicker = ({ value, onChange, addressHint }) => {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [busy, setBusy] = useState(null); // 'gps' | 'search' | null
  const [message, setMessage] = useState('');

  onChangeRef.current = onChange;

  const placeMarker = (lat, lng, { pan = true, emit = true } = {}) => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on('dragend', (e) => {
        const p = e.target.getLatLng();
        onChangeRef.current?.(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 16));
    if (emit) onChangeRef.current?.(lat, lng);
  };

  useEffect(() => {
    const start = value?.lat != null ? value : DEFAULT_CENTER;
    const map = L.map(mapEl.current, { ...MAP_OPTIONS, zoomControl: true, attributionControl: true })
      .setView([start.lat, start.lng], value?.lat != null ? 16 : 12);
    L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
    map.on('click', (e) => placeMarker(e.latlng.lat, e.latlng.lng, { pan: false }));
    mapRef.current = map;
    if (value?.lat != null) placeMarker(value.lat, value.lng, { pan: false, emit: false });
    // Leaflet needs a size recalculation kapag nasa loob ng animated modal
    const t = setTimeout(() => map.invalidateSize(), 350);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = async () => {
    setBusy('gps');
    setMessage('');
    try {
      const pos = await getCurrentPosition();
      placeMarker(pos.lat, pos.lng);
    } catch (err) {
      setMessage(err?.code === 1
        ? 'Naka-block ang location. Sa phone: i-ON ang Location sa settings. Sa desktop: i-click ang 🔒 icon sa address bar at i-Allow ang Location.'
        : 'Hindi makuha ang GPS location. Subukang i-search ang address.');
    } finally {
      setBusy(null);
    }
  };

  const findAddress = async () => {
    if (!addressHint?.trim()) {
      setMessage('Ilagay muna ang Location/address sa itaas.');
      return;
    }
    setBusy('search');
    setMessage('');
    try {
      const result = await geocodeAddress(addressHint);
      if (!result) {
        setMessage('Walang nahanap. I-tap na lang ang eksaktong lugar sa mapa.');
        return;
      }
      placeMarker(result.lat, result.lng);
      setMessage('I-drag ang pin para eksakto sa bahay.');
    } catch {
      setMessage('Hindi ma-search ang address ngayon. I-tap na lang ang mapa.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="location-picker">
      <div className="lp-actions">
        <button type="button" onClick={useMyLocation} disabled={!!busy}>
          {busy === 'gps' ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} />}
          Nandito ako ngayon
        </button>
        <button type="button" onClick={findAddress} disabled={!!busy}>
          {busy === 'search' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Hanapin ang address
        </button>
      </div>
      <div ref={mapEl} className="lp-map" />
      <p className={`lp-status ${value?.lat != null ? 'set' : ''}`}>
        <MapPin size={13} />
        {message || (value?.lat != null
          ? `Naka-pin: ${Number(value.lat).toFixed(5)}, ${Number(value.lng).toFixed(5)}`
          : 'I-tap ang mapa kung nasaan ang property para makita ito ng tenants sa radar.')}
      </p>
    </div>
  );
};

export default LocationPicker;
