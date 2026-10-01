// Ruta papunta sa bahay: libreng OSRM (OpenStreetMap data). Pang-simula lang ang public demo server nila;
// lumipat sa sariling OSRM/Valhalla o bayad na provider kapag lumaki ang traffic.
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

export const fetchRoute = async (from, to) => {
  const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('RouteServiceError');
  const data = await res.json();
  if (data.code === 'NoRoute') throw new Error('NoRoute');
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) throw new Error('RouteServiceError');
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: route.distance / 1000,
    carMin: route.duration / 60,
    steps: (route.legs?.[0]?.steps || []).filter((s) => s.maneuver)
  };
};

// Tantiyang oras ayon sa sasakyan. Hindi ito eksakto: nag-iiba ang trapiko, pila, at hintuan.
export const TRANSPORT_MODES = [
  { key: 'walk', label: 'Lakad', maxKm: 2, minutes: (km) => (km / 4.8) * 60 },
  { key: 'tricycle', label: 'Tricycle', maxKm: 15, minutes: (km) => (km / 22) * 60 },
  { key: 'jeep', label: 'Jeep', maxKm: 60, minutes: (km) => (km / 18) * 60 },
  { key: 'car', label: 'Kotse', maxKm: Infinity, minutes: (km, route) => route.carMin * 1.25 }
];

export const getEstimates = (route) =>
  TRANSPORT_MODES.map((mode) => ({
    key: mode.key,
    label: mode.label,
    available: route.distanceKm <= mode.maxKm,
    minutes: mode.minutes(route.distanceKm, route)
  }));

export const formatDuration = (minutes) => {
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} araw ${hours % 24} oras`;
  }
  return mins ? `${hours} oras ${mins} min` : `${hours} oras`;
};

export const formatStepDistance = (meters) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(meters / 10) * 10)} m`;

// Hakbang-hakbang na direksyon sa Tagalog, galing sa maneuver ng OSRM
export const stepText = (step) => {
  const { type, modifier } = step.maneuver;
  const road = step.name ? ` sa ${step.name}` : '';
  if (type === 'depart') return `Simulan${road || ' sa kalsada'}`;
  if (type === 'arrive') return 'Nakarating ka na sa destinasyon';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return `Pumasok sa rotonda${road}`;
  if (modifier === 'uturn') return 'Mag-U-turn';
  if (modifier && /left|right/.test(modifier)) {
    const dir = modifier.includes('left') ? 'Kumaliwa' : 'Kumanan';
    const how = modifier.startsWith('slight') ? ' nang bahagya' : modifier.startsWith('sharp') ? ' nang matalim' : '';
    return `${dir}${how}${road}`;
  }
  if (type === 'merge') return `Sumanib${road}`;
  if (type === 'fork') return `Sa hati ng daan, ${modifier === 'left' ? 'kumaliwa' : 'kumanan'}${road}`;
  return `Diretso${road}`;
};
