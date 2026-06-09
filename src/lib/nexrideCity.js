import { haversineDistanceMeters, toLatLng } from "./googleMaps";

export const DEFAULT_CITY_KEY = "zvishavane";

export const NEXRIDE_SERVICE_CITIES = {
  harare: { lat: -17.8292, lng: 31.0522, label: "Harare", radiusMeters: 85000 },
  bulawayo: { lat: -20.1325, lng: 28.6265, label: "Bulawayo", radiusMeters: 85000 },
  chitungwiza: { lat: -18.0127, lng: 31.0756, label: "Chitungwiza", radiusMeters: 45000 },
  mutare: { lat: -18.9707, lng: 32.6709, label: "Mutare", radiusMeters: 70000 },
  gweru: { lat: -19.45, lng: 29.8167, label: "Gweru", radiusMeters: 70000 },
  kwekwe: { lat: -18.9281, lng: 29.8149, label: "Kwekwe", radiusMeters: 60000 },
  kadoma: { lat: -18.3333, lng: 29.9167, label: "Kadoma", radiusMeters: 60000 },
  masvingo: { lat: -20.0744, lng: 30.8328, label: "Masvingo", radiusMeters: 70000 },
  zvishavane: { lat: -20.3267, lng: 30.0665, label: "Zvishavane", radiusMeters: 65000 },
  chinhoyi: { lat: -17.3667, lng: 30.2, label: "Chinhoyi", radiusMeters: 60000 },
  marondera: { lat: -18.1853, lng: 31.5519, label: "Marondera", radiusMeters: 60000 },
};

export const SERVICE_CITY_KEYS = Object.keys(NEXRIDE_SERVICE_CITIES);

export function normalizeCity(city, fallback = DEFAULT_CITY_KEY) {
  const clean = String(city || "").trim().toLowerCase();
  if (NEXRIDE_SERVICE_CITIES[clean]) return clean;
  return NEXRIDE_SERVICE_CITIES[fallback] ? fallback : DEFAULT_CITY_KEY;
}

export function cityLabelSmart(city) {
  const key = normalizeCity(city);
  return NEXRIDE_SERVICE_CITIES[key]?.label || key;
}

export function buildGpsPointFromPosition(pos) {
  if (!pos?.coords) return null;
  const point = {
    lat: Number(pos.coords.latitude),
    lng: Number(pos.coords.longitude),
    accuracy: Number(pos.coords.accuracy || 9999),
    heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
    speed: typeof pos.coords.speed === "number" ? pos.coords.speed : null,
    source: "phone-gps",
  };
  return toLatLng(point) ? point : null;
}

export function getNearestCityFromPoint(point) {
  const p = toLatLng(point);
  if (!p) return null;

  const ranked = SERVICE_CITY_KEYS
    .map((cityKey) => {
      const city = NEXRIDE_SERVICE_CITIES[cityKey];
      const distanceMeters = haversineDistanceMeters(p, city);
      return {
        cityKey,
        label: city.label,
        distanceMeters,
        radiusMeters: city.radiusMeters,
        insideServiceArea: Number(distanceMeters) <= Number(city.radiusMeters || 70000),
      };
    })
    .filter((item) => Number.isFinite(Number(item.distanceMeters)))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return ranked[0] || null;
}

export async function saveDetectedCity({ db, ref, update, uid, cityKey }) {
  if (!db || !ref || !update || !uid || !cityKey) return;
  try {
    await Promise.all([
      update(ref(db, `profiles/${uid}`), { city: cityKey, gpsDetectedCity: cityKey, cityUpdatedAt: Date.now() }),
      update(ref(db, `appSettings/${uid}`), { city: cityKey, gpsDetectedCity: cityKey, cityUpdatedAt: Date.now() }),
    ]);
  } catch {}
}

export function saveDetectedCityLocal(cityKey) {
  try {
    localStorage.setItem("nexride-last-place", cityKey);
    localStorage.setItem("nexride-gps-detected-city", cityKey);
  } catch {}
}
