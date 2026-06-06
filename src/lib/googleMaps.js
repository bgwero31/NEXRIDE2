// File: src/lib/googleMaps.js

const GOOGLE_MAPS_SCRIPT_ID = "nexride-google-maps-js";

export const ZIMBABWE_CITY_CENTERS = {
  harare: { lat: -17.8292, lng: 31.0522, label: "Harare" },
  bulawayo: { lat: -20.1325, lng: 28.6265, label: "Bulawayo" },
  gweru: { lat: -19.45, lng: 29.8167, label: "Gweru" },
  mutare: { lat: -18.9707, lng: 32.6709, label: "Mutare" },
  masvingo: { lat: -20.0744, lng: 30.8328, label: "Masvingo" },
  zvishavane: { lat: -20.3267, lng: 30.0665, label: "Zvishavane" },
  kwekwe: { lat: -18.9281, lng: 29.8149, label: "Kwekwe" },
  kadoma: { lat: -18.3333, lng: 29.9167, label: "Kadoma" },
};

export function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

export function hasGoogleMapsApiKey() {
  return Boolean(getGoogleMapsApiKey().trim());
}

export function cityLabel(city) {
  const clean = String(city || "harare").toLowerCase();
  return ZIMBABWE_CITY_CENTERS[clean]?.label || clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function getCityCenter(city) {
  const clean = String(city || "harare").toLowerCase();
  return ZIMBABWE_CITY_CENTERS[clean] || ZIMBABWE_CITY_CENTERS.harare;
}

export function toLatLng(value) {
  if (!value) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function pointFromRecord(record, prefix = "") {
  if (!record) return null;
  const latKey = prefix ? `${prefix}Lat` : "lat";
  const lngKey = prefix ? `${prefix}Lng` : "lng";
  return toLatLng({ lat: record[latKey], lng: record[lngKey] });
}

export function formatPointForGoogleMaps(pointOrText, city = "harare") {
  const point = toLatLng(pointOrText);
  if (point) return `${point.lat},${point.lng}`;
  const text = typeof pointOrText === "string" ? pointOrText.trim() : pointOrText?.label?.trim();
  if (!text) return cityLabel(city) + ", Zimbabwe";
  const lower = text.toLowerCase();
  if (lower.includes("zimbabwe") || lower.includes(cityLabel(city).toLowerCase())) return text;
  return `${text}, ${cityLabel(city)}, Zimbabwe`;
}

export function googleMapsDirectionsUrl({ origin, destination, city = "harare", travelMode = "driving" }) {
  const base = "https://www.google.com/maps/dir/?api=1";
  const cleanOrigin = encodeURIComponent(formatPointForGoogleMaps(origin, city));
  const cleanDestination = encodeURIComponent(formatPointForGoogleMaps(destination, city));
  return `${base}&origin=${cleanOrigin}&destination=${cleanDestination}&travelmode=${encodeURIComponent(travelMode)}`;
}

export function googleMapsSearchUrl({ query, city = "harare" }) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatPointForGoogleMaps(query, city))}`;
}

export function loadGoogleMapsApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (window.google?.maps) return Promise.resolve(window.google);

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY."));

  const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
  if (existing?.dataset.loaded === "true" && window.google?.maps) return Promise.resolve(window.google);

  if (window.__nexrideGoogleMapsPromise) return window.__nexrideGoogleMapsPromise;

  window.__nexrideGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve(window.google);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    if (!existing) document.head.appendChild(script);
  });

  return window.__nexrideGoogleMapsPromise;
}

export function buildGoogleDirectionsPoint(google, value, city = "harare") {
  const point = toLatLng(value);
  if (point) return point;
  const label = typeof value === "string" ? value : value?.label;
  return formatPointForGoogleMaps(label, city);
}

export async function geocodeAddress(address, city = "harare") {
  if (!address || !hasGoogleMapsApiKey()) return null;
  const google = await loadGoogleMapsApi();
  const geocoder = new google.maps.Geocoder();
  const fullAddress = formatPointForGoogleMaps(address, city);

  return new Promise((resolve) => {
    geocoder.geocode({ address: fullAddress, region: "ZW" }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null);
        return;
      }

      const loc = results[0].geometry.location;
      resolve({
        lat: loc.lat(),
        lng: loc.lng(),
        formattedAddress: results[0].formatted_address,
        placeId: results[0].place_id || "",
      });
    });
  });
}

export async function getGoogleRouteDetails({ origin, destination, city = "harare" }) {
  if (!origin || !destination || !hasGoogleMapsApiKey()) return null;
  const google = await loadGoogleMapsApi();
  const service = new google.maps.DirectionsService();

  return new Promise((resolve) => {
    service.route(
      {
        origin: buildGoogleDirectionsPoint(google, origin, city),
        destination: buildGoogleDirectionsPoint(google, destination, city),
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
        provideRouteAlternatives: false,
        region: "ZW",
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes?.[0]?.legs?.[0]) {
          resolve(null);
          return;
        }

        const leg = result.routes[0].legs[0];
        resolve({
          distanceText: leg.distance?.text || "",
          durationText: leg.duration_in_traffic?.text || leg.duration?.text || "",
          distanceMeters: leg.distance?.value || null,
          durationSeconds: leg.duration_in_traffic?.value || leg.duration?.value || null,
          startAddress: leg.start_address || "",
          endAddress: leg.end_address || "",
          pickupCoords: leg.start_location ? { lat: leg.start_location.lat(), lng: leg.start_location.lng() } : null,
          dropoffCoords: leg.end_location ? { lat: leg.end_location.lat(), lng: leg.end_location.lng() } : null,
          source: "google",
        });
      }
    );
  });
}

export function haversineDistanceMeters(a, b) {
  const p1 = toLatLng(a);
  const p2 = toLatLng(b);
  if (!p1 || !p2) return null;
  const earthRadius = 6371000;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function fallbackRouteEstimate(origin, destination) {
  const meters = haversineDistanceMeters(origin, destination);
  if (!meters) return null;
  const roadAdjustedMeters = meters * 1.28;
  const km = roadAdjustedMeters / 1000;
  const minutes = Math.max(3, Math.round((km / 32) * 60));
  return {
    distanceText: `${km.toFixed(km < 10 ? 1 : 0)} km`,
    durationText: `${minutes} min`,
    distanceMeters: Math.round(roadAdjustedMeters),
    durationSeconds: minutes * 60,
    source: "estimate",
  };
}
