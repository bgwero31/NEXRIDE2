// File: src/lib/nexrideCity.js
/**
 * NEXRIDE city detection & service-area utilities.
 * Single source of truth for service cities, GPS-derived city, and persistence.
 */

import { haversineDistanceMeters, toLatLng } from "./googleMaps";

/* ----------------------------- Constants ----------------------------- */

/** Default city if nothing else is known. */
export const DEFAULT_CITY_KEY = "zvishavane";

/** Fallback radius (meters) if a city entry is missing its own radius. */
const DEFAULT_RADIUS_METERS = 70_000;

/** GPS accuracy threshold — anything worse than this is unreliable. */
export const MAX_ACCEPTABLE_GPS_ACCURACY = 250;

/** localStorage keys used across the app. Keep in one place. */
export const CITY_STORAGE_KEYS = Object.freeze({
  lastPlace: "nexride-last-place",
  gpsDetected: "nexride-gps-detected-city",
});

/**
 * Canonical service cities. Any change here propagates everywhere.
 * @typedef {{ lat:number, lng:number, label:string, radiusMeters:number }} ServiceCity
 * @type {Record<string, ServiceCity>}
 */
export const NEXRIDE_SERVICE_CITIES = Object.freeze({
  harare:      { lat: -17.8292, lng: 31.0522, label: "Harare",      radiusMeters: 85000 },
  bulawayo:    { lat: -20.1325, lng: 28.6265, label: "Bulawayo",    radiusMeters: 85000 },
  chitungwiza: { lat: -18.0127, lng: 31.0756, label: "Chitungwiza", radiusMeters: 45000 },
  mutare:      { lat: -18.9707, lng: 32.6709, label: "Mutare",      radiusMeters: 70000 },
  gweru:       { lat: -19.45,   lng: 29.8167, label: "Gweru",       radiusMeters: 70000 },
  kwekwe:      { lat: -18.9281, lng: 29.8149, label: "Kwekwe",      radiusMeters: 60000 },
  kadoma:      { lat: -18.3333, lng: 29.9167, label: "Kadoma",      radiusMeters: 60000 },
  masvingo:    { lat: -20.0744, lng: 30.8328, label: "Masvingo",    radiusMeters: 70000 },
  zvishavane:  { lat: -20.3267, lng: 30.0665, label: "Zvishavane",  radiusMeters: 65000 },
  chinhoyi:    { lat: -17.3667, lng: 30.2,    label: "Chinhoyi",    radiusMeters: 60000 },
  marondera:   { lat: -18.1853, lng: 31.5519, label: "Marondera",   radiusMeters: 60000 },
});

/** Stable array of city keys, in declaration order. */
export const SERVICE_CITY_KEYS = Object.freeze(Object.keys(NEXRIDE_SERVICE_CITIES));

/* ----------------------------- Normalizers ---------------------------- */

/**
 * Normalize any string into a known service-city key.
 * @param {string} [city]
 * @param {string} [fallback=DEFAULT_CITY_KEY]
 * @returns {string}
 */
export function normalizeCity(city, fallback = DEFAULT_CITY_KEY) {
  const clean = String(city ?? "").trim().toLowerCase();
  if (NEXRIDE_SERVICE_CITIES[clean]) return clean;
  return NEXRIDE_SERVICE_CITIES[fallback] ? fallback : DEFAULT_CITY_KEY;
}

/**
 * Human-readable label for a city key.
 * @param {string} city
 * @returns {string}
 */
export function cityLabelSmart(city) {
  const key = normalizeCity(city);
  return NEXRIDE_SERVICE_CITIES[key]?.label ?? key;
}

/* ------------------------- Geolocation helpers ------------------------ */

/**
 * Build a normalized GPS point from a browser Position object.
 * Returns null if coordinates are missing or invalid.
 * @param {GeolocationPosition | null | undefined} pos
 * @returns {null | { lat:number, lng:number, accuracy:number, heading:number|null, speed:number|null, source:"phone-gps" }}
 */
export function buildGpsPointFromPosition(pos) {
  if (!pos?.coords) return null;
  const point = {
    lat: Number(pos.coords.latitude),
    lng: Number(pos.coords.longitude),
    accuracy: Number(pos.coords.accuracy ?? 9999),
    heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
    speed: typeof pos.coords.speed === "number" ? pos.coords.speed : null,
    source: "phone-gps",
  };
  return toLatLng(point) ? point : null;
}

/**
 * Find the nearest service city to a point, plus whether it's inside service area.
 * @param {{lat:number,lng:number}|null} point
 * @returns {null | { cityKey:string, label:string, distanceMeters:number, radiusMeters:number, insideServiceArea:boolean }}
 */
export function getNearestCityFromPoint(point) {
  const p = toLatLng(point);
  if (!p) return null;

  let best = null;
  for (const cityKey of SERVICE_CITY_KEYS) {
    const city = NEXRIDE_SERVICE_CITIES[cityKey];
    const distanceMeters = haversineDistanceMeters(p, city);
    if (!Number.isFinite(distanceMeters)) continue;

    const radiusMeters = Number(city.radiusMeters) || DEFAULT_RADIUS_METERS;
    const candidate = {
      cityKey,
      label: city.label,
      distanceMeters,
      radiusMeters,
      insideServiceArea: distanceMeters <= radiusMeters,
    };

    if (!best || candidate.distanceMeters < best.distanceMeters) best = candidate;
  }
  return best;
}

/* ---------------------------- Persistence ----------------------------- */

/**
 * Persist the detected city to Firebase (profile + settings).
 * Never throws — safe to call in UI paths.
 * @param {{
 *   db: any, ref: Function, update: Function,
 *   uid?: string|null, cityKey?: string|null
 * }} params
 * @returns {Promise<boolean>} true if written, false otherwise.
 */
export async function saveDetectedCity({ db, ref, update, uid, cityKey }) {
  if (!db || !ref || !update || !uid || !cityKey) return false;
  const now = Date.now();
  const patch = { city: cityKey, gpsDetectedCity: cityKey, cityUpdatedAt: now };

  try {
    await Promise.all([
      update(ref(db, `profiles/${uid}`), patch),
      update(ref(db, `appSettings/${uid}`), patch),
    ]);
    return true;
  } catch (err) {
    // Non-fatal: city preference is nice-to-have. We log in dev only.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[nexrideCity] saveDetectedCity failed:", err?.message || err);
    }
    return false;
  }
}

/**
 * Persist the detected city to localStorage.
 * Never throws.
 * @param {string} cityKey
 * @returns {boolean}
 */
export function saveDetectedCityLocal(cityKey) {
  if (!cityKey || typeof window === "undefined") return false;
  try {
    localStorage.setItem(CITY_STORAGE_KEYS.lastPlace, cityKey);
    localStorage.setItem(CITY_STORAGE_KEYS.gpsDetected, cityKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the last known city from localStorage (if any).
 * @returns {string|null}
 */
export function readDetectedCityLocal() {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem(CITY_STORAGE_KEYS.gpsDetected) ||
      localStorage.getItem(CITY_STORAGE_KEYS.lastPlace) ||
      null
    );
  } catch {
    return null;
  }
}
