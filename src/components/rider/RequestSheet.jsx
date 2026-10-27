// File: src/components/rider/RequestSheet.jsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { push, ref, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import {
  getGoogleRouteDetails,
  googleMapsDirectionsUrl,
  hasGoogleMapsApiKey,
  loadGoogleMapsApi,
  getCityCenter,
} from "../../lib/googleMaps";
import {
  buildGpsPointFromPosition,
  getNearestCityFromPoint,
  normalizeCity,
  saveDetectedCity,
  saveDetectedCityLocal,
} from "../../lib/nexrideCity";
import {
  nexrideNotificationTypes,
  queueNexrideEvent,
} from "../../lib/nexrideNotifications";
import PremiumButton from "../ui/PremiumButton";

/* ------------------------------ Helpers ------------------------------- */

function price(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function suggestFare(distanceMeters) {
  const km = Number(distanceMeters || 0) / 1000;
  const suggested = Math.max(2, Math.round((2 + km * 0.6) * 2) / 2);
  return suggested;
}

function readStored(key) {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStored(key, value) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, value); } catch {}
}

const PAYMENT_OPTIONS = [
  { value: "cash", label: "💵 Cash" },
  { value: "ecocash", label: "📱 EcoCash" },
  { value: "onemoney", label: "📲 OneMoney" },
  { value: "card", label: "💳 Card" },
];

const RIDE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "comfort", label: "Comfort" },
  { value: "quick", label: "Quick" },
  { value: "family", label: "Family" },
];

/* ---------------------------- Component ------------------------------- */

export default function RequestSheet({
  user,
  profile,
  appSettings = {},
  initialCity = "zvishavane",
  onRequestCreated,
  onDraftRouteChange,
}) {
  const [city, setCity] = useState(normalizeCity(initialCity || profile?.city || "zvishavane"));
  const [pickupName, setPickupName] = useState("Current GPS location");
  const [dropoffName, setDropoffName] = useState("");
  const [offerPrice, setOfferPrice] = useState("3");
  const [preferredPayment, setPreferredPayment] = useState("cash");
  const [rideMode, setRideMode] = useState("standard");
  const [people, setPeople] = useState("1");
  
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);
  
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const dropoffInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const hasAutoLocatedRef = useRef(false);

  // Hydrate preferences
  useEffect(() => {
    const settings = appSettings || {};
    const savedPayment = readStored("nexride-preferred-payment") || settings.preferredPayment || "cash";
    const savedRideMode = readStored("nexride-ride-mode") || settings.rideMode || "standard";
    setPreferredPayment(savedPayment);
    setRideMode(savedRideMode);
  }, [appSettings]);

  // Attach Google Places Autocomplete to "Where to?"
  useEffect(() => {
    if (!hasGoogleMapsApiKey() || !dropoffInputRef.current) return;
    let cancelled = false;

    loadGoogleMapsApi().then((google) => {
      if (cancelled || !google?.maps?.places) return;
      
      const center = getCityCenter(city);
      const bounds = new google.maps.LatLngBounds(
        { lat: center.lat - 0.5, lng: center.lng - 0.5 },
        { lat: center.lat + 0.5, lng: center.lng + 0.5 }
      );

      const ac = new google.maps.places.Autocomplete(dropoffInputRef.current, {
        componentRestrictions: { country: "zw" },
        fields: ["formatted_address", "geometry", "name"],
        bounds: bounds,
      });

      autocompleteRef.current = ac;

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const formatted = place.formatted_address || place.name || "";
        const location = place.geometry?.location;
        if (formatted) setDropoffName(formatted);
        if (location) setDropoffCoords({ lat: location.lat(), lng: location.lng() });
      });
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [city]);

  // Auto-detect GPS on mount
  const useCurrentLocation = useCallback(() => {
    setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("GPS is not available. Type pickup manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const gpsPoint = buildGpsPointFromPosition(pos);
        const accuracy = Number(gpsPoint?.accuracy || 9999);
        if (!gpsPoint || accuracy > 250) {
          setError("GPS is too weak. Type pickup manually.");
          setLocating(false);
          return;
        }
        const detected = getNearestCityFromPoint(gpsPoint);
        const detectedCity = detected?.cityKey || city;
        setCity(detectedCity);
        saveDetectedCityLocal(detectedCity);
        saveDetectedCity({ db, ref, update, uid: user?.uid, cityKey: detectedCity }).catch(() => {});
        setPickupCoords({ lat: gpsPoint.lat, lng: gpsPoint.lng, accuracy });
        setPickupName("Current GPS location");
        setLocating(false);
      },
      () => { setError("Could not read GPS."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [city, user?.uid]);

  useEffect(() => {
    if (hasAutoLocatedRef.current || pickupCoords) return;
    hasAutoLocatedRef.current = true;
    useCurrentLocation();
  }, [pickupCoords, useCurrentLocation]);

  // Route preview
  useEffect(() => {
    if (!dropoffName.trim()) { setRoutePreview(null); return; }
    const timer = setTimeout(async () => {
      try {
        const route = await getGoogleRouteDetails({
          origin: pickupCoords || pickupName,
          destination: dropoffCoords || dropoffName,
          city,
        });
        if (route) setRoutePreview(route);
      } catch {}
    }, 700);
    return () => clearTimeout(timer);
  }, [city, dropoffCoords, dropoffName, pickupCoords, pickupName]);

  const suggested = routePreview ? suggestFare(routePreview.distanceMeters) : null;
  const canSubmit = Boolean(user?.uid && dropoffName.trim() && Number(offerPrice) > 0);

  // Sync draft route to map
  useEffect(() => {
    onDraftRouteChange?.({
      city, pickupName, pickupCoords, dropoffName,
      dropoffCoords, routePreview, offerPrice: Number(offerPrice || 0),
    });
  }, [city, dropoffCoords, dropoffName, offerPrice, onDraftRouteChange, pickupCoords, pickupName, routePreview]);

  const bumpFare = (delta) => {
    setOfferPrice((prev) => {
      const n = Number(prev || 0) + delta;
      return String(Math.max(1, Math.round(n * 100) / 100));
    });
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setError("");
    if (!user?.uid) return setError("Login again before requesting.");
    if (!dropoffName.trim()) return setError("Add a destination first.");
    if (!pickupCoords) return setError("Allow GPS or type pickup manually.");

    try {
      setSaving(true);
      let googleRoute = routePreview;
      if (!googleRoute) {
        try {
          googleRoute = await getGoogleRouteDetails({
            origin: pickupCoords, destination: dropoffCoords || dropoffName, city,
          });
        } catch {}
      }

      const resolvedDropoff = googleRoute?.dropoffCoords || dropoffCoords || null;
      const requestCity = city;
      const requestRef = push(ref(db, `rideRequests/${requestCity}`));
      const now = Date.now();

      const payload = {
        id: requestRef.key, city: requestCity,
        riderId: user.uid,
        riderName: profile?.fullName || user.email || "Rider",
        riderPhone: profile?.phone || "",
        riderPhotoUrl: profile?.photoUrl || profile?.profilePhotoUrl || "",
        pickupName: googleRoute?.startAddress || pickupName,
        pickupLat: pickupCoords.lat ?? null,
        pickupLng: pickupCoords.lng ?? null,
        dropoffName: googleRoute?.endAddress || dropoffName,
        dropoffLat: resolvedDropoff?.lat ?? null,
        dropoffLng: resolvedDropoff?.lng ?? null,
        distanceText: googleRoute?.distanceText || "",
        distanceMeters: googleRoute?.distanceMeters || null,
        durationText: googleRoute?.durationText || "",
        durationSeconds: googleRoute?.durationSeconds || null,
        mapsUrl: googleMapsDirectionsUrl({ origin: pickupCoords, destination: dropoffName, city: requestCity }),
        offerPrice: Number(offerPrice), people: Number(people),
        notes: "", preferredPayment, rideMode,
        status: "open", viewCount: 0, offersCount: 0,
        createdAt: now, updatedAt: now,
      };

      await set(requestRef, payload);
      queueNexrideEvent({
        type: nexrideNotificationTypes.REQUEST_CREATED,
        city: requestCity, targetRole: "driver",
        title: "New NEXRIDE request",
        message: `${profile?.fullName || "A rider"} is offering $${price(offerPrice)} from ${payload.pickupName}.`,
        url: "/driver",
        data: { requestId: requestRef.key, city: requestCity, offerPrice: Number(offerPrice) },
      }).catch(() => {});

      onRequestCreated?.({ ...payload, id: requestRef.key });
    } catch (err) {
      console.error(err);
      setError("Failed to post ride request.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------- RENDER ---------------------------------- */
  return (
    <form onSubmit={submitRequest} className="nx-rs-v3">
      
      {/* 1. PICKUP & DESTINATION (Uber Style) */}
      <div className="nx-rs-v3-route-box">
        <div className="nx-rs-v3-route-line" />
        
        {/* Pickup Row */}
        <div className="nx-rs-v3-row">
          <span className="nx-dot nx-dot-pickup" />
          <input
            className="nx-rs-v3-input pickup"
            type="text"
            value={pickupName}
            onChange={(e) => { setPickupName(e.target.value); if (!e.target.value.trim()) setPickupCoords(null); }}
            placeholder="Pickup location"
          />
          <button type="button" className="nx-rs-v3-gps" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "…" : "📍"}
          </button>
        </div>

        {/* Dropoff Row */}
        <div className="nx-rs-v3-row">
          <span className="nx-dot nx-dot-destination" />
          <input
            ref={dropoffInputRef}
            className="nx-rs-v3-input dropoff"
            type="text"
            value={dropoffName}
            onChange={(e) => { setDropoffName(e.target.value); setDropoffCoords(null); }}
            placeholder="Where to?"
            autoComplete="off"
          />
        </div>
      </div>

      {error ? <div className="nx-alert-error nx-rs-v3-alert">{error}</div> : null}

      {/* 2. THE FARE (inDrive Style) */}
      <div className="nx-rs-v3-fare-box">
        <div className="nx-rs-v3-fare-label">Offer your fare</div>
        
        <div className="nx-rs-v3-fare-controls">
          <button type="button" className="nx-rs-v3-step" onClick={() => bumpFare(-0.5)}>−</button>
          <div className="nx-rs-v3-fare-display">${price(offerPrice)}</div>
          <button type="button" className="nx-rs-v3-step" onClick={() => bumpFare(0.5)}>+</button>
        </div>

        {suggested && Number(offerPrice) !== suggested && (
          <button 
            type="button" 
            className="nx-rs-v3-suggest"
            onClick={() => setOfferPrice(suggested.toFixed(2))}
          >
            Suggested: ${suggested.toFixed(2)}
          </button>
        )}
      </div>

      {/* 3. PAYMENT & RIDE CHIPS (Horizontal Scroll) */}
      <div className="nx-rs-v3-chips-wrap">
        <div className="nx-rs-v3-chips-scroll">
          {PAYMENT_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`nx-rs-v3-chip ${preferredPayment === p.value ? "is-active" : ""}`}
              onClick={() => setPreferredPayment(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="nx-rs-v3-chips-scroll">
          {RIDE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`nx-rs-v3-chip ${rideMode === r.value ? "is-active" : ""}`}
              onClick={() => setRideMode(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. SUBMIT BUTTON */}
      <div style={{ marginTop: 12 }}>
        <PremiumButton type="submit" disabled={!canSubmit} loading={saving}>
          {saving ? "Finding driver..." : `Request NEXRIDE • $${price(offerPrice)}`}
        </PremiumButton>
      </div>
    </form>
  );
}
