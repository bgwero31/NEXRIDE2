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
  SERVICE_CITY_KEYS,
} from "../../lib/nexrideCity";
import {
  nexrideNotificationTypes,
  queueNexrideEvent,
} from "../../lib/nexrideNotifications";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

const cityOptions = SERVICE_CITY_KEYS;

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "ecocash", label: "EcoCash" },
  { value: "onemoney", label: "OneMoney" },
  { value: "card", label: "Card" },
];

const RIDE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "comfort", label: "Comfort" },
  { value: "quick", label: "Quick" },
  { value: "family", label: "Family" },
];

function cityLabel(city) {
  if (!city) return "City";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

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

export default function RequestSheet({
  user,
  profile,
  appSettings = {},
  initialCity = "zvishavane",
  onRequestCreated,
  onDraftRouteChange,
}) {
  const [city, setCity] = useState(normalizeCity(initialCity || profile?.city || "zvishavane"));
  const [pickupName, setPickupName] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [offerPrice, setOfferPrice] = useState("3");
  const [preferredPayment, setPreferredPayment] = useState("cash");
  const [rideMode, setRideMode] = useState("standard");
  const [people, setPeople] = useState("1");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);
  const pickupAutocompleteRef = useRef(null);
  const dropoffAutocompleteRef = useRef(null);
  const hasAutoLocatedRef = useRef(false);
  const appSettingsRef = useRef(appSettings);

  useEffect(() => { appSettingsRef.current = appSettings; }, [appSettings]);

  /* Hydrate once */
  useEffect(() => {
    const settings = appSettingsRef.current || {};
    const savedPickup = readStored("nexride-default-pickup") || settings.defaultPickup || "";
    const savedDropoff = readStored("nexride-default-dropoff") || settings.defaultDropoff || "";
    const savedPayment = readStored("nexride-preferred-payment") || settings.preferredPayment || "cash";
    const savedRideMode = readStored("nexride-ride-mode") || settings.rideMode || "standard";
    const savedCity = readStored("nexride-gps-detected-city") || readStored("nexride-last-place") || initialCity || profile?.city || "zvishavane";

    setCity(normalizeCity(savedCity));
    if (savedPickup) setPickupName(savedPickup);
    setDropoffName(savedDropoff);
    setPreferredPayment(savedPayment);
    setRideMode(savedRideMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Autocomplete */
  useEffect(() => {
    if (!hasGoogleMapsApiKey()) return;
    if (!pickupInputRef.current || !dropoffInputRef.current) return;
    let cancelled = false;
    let pL = null, dL = null;

    loadGoogleMapsApi().then((google) => {
      if (cancelled || !google?.maps?.places) return;
      const center = getCityCenter(city);
      const bounds = new google.maps.LatLngBounds(
        { lat: center.lat - 0.5, lng: center.lng - 0.5 },
        { lat: center.lat + 0.5, lng: center.lng + 0.5 }
      );
      const opts = {
        componentRestrictions: { country: "zw" },
        fields: ["formatted_address", "geometry", "name"],
        bounds, strictBounds: false,
      };
      const pAC = new google.maps.places.Autocomplete(pickupInputRef.current, opts);
      const dAC = new google.maps.places.Autocomplete(dropoffInputRef.current, opts);
      pickupAutocompleteRef.current = pAC;
      dropoffAutocompleteRef.current = dAC;

      pL = pAC.addListener("place_changed", () => {
        const pl = pAC.getPlace();
        const f = pl.formatted_address || pl.name || pickupInputRef.current?.value || "";
        const loc = pl.geometry?.location;
        if (f) setPickupName(f);
        if (loc) setPickupCoords({ lat: loc.lat(), lng: loc.lng() });
      });
      dL = dAC.addListener("place_changed", () => {
        const pl = dAC.getPlace();
        const f = pl.formatted_address || pl.name || dropoffInputRef.current?.value || "";
        const loc = pl.geometry?.location;
        if (f) setDropoffName(f);
        if (loc) setDropoffCoords({ lat: loc.lat(), lng: loc.lng() });
      });
    }).catch(() => {});

    return () => {
      cancelled = true;
      try { pL?.remove?.(); dL?.remove?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasGoogleMapsApiKey()) return;
    const center = getCityCenter(city);
    if (!center) return;
    (async () => {
      try {
        const google = await loadGoogleMapsApi();
        const bounds = new google.maps.LatLngBounds(
          { lat: center.lat - 0.5, lng: center.lng - 0.5 },
          { lat: center.lat + 0.5, lng: center.lng + 0.5 }
        );
        pickupAutocompleteRef.current?.setBounds?.(bounds);
        dropoffAutocompleteRef.current?.setBounds?.(bounds);
      } catch {}
    })();
  }, [city]);

  /* GPS */
  const useCurrentLocation = useCallback(() => {
    setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("GPS not available. Type pickup manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const gpsPoint = buildGpsPointFromPosition(pos);
        const accuracy = Number(gpsPoint?.accuracy || 9999);
        if (!gpsPoint || accuracy > 250) {
          setError("GPS too weak. Type pickup manually.");
          setLocating(false);
          return;
        }
        const detected = getNearestCityFromPoint(gpsPoint);
        const detectedCity = detected?.cityKey || city;
        setCity(detectedCity);
        saveDetectedCityLocal(detectedCity);
        saveDetectedCity({ db, ref, update, uid: user?.uid, cityKey: detectedCity }).catch(() => {});
        setPickupCoords({ lat: gpsPoint.lat, lng: gpsPoint.lng, accuracy, source: "phone-gps" });
        setPickupName((c) => (c?.trim() && c !== "Current GPS pickup" ? c : "Current GPS pickup"));
        setLocating(false);
      },
      () => { setError("Could not read GPS."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [city, user?.uid]);

  useEffect(() => {
    if (hasAutoLocatedRef.current || pickupCoords) return;
    const saved = readStored("nexride-default-pickup");
    if (saved && saved.trim() && saved !== "Current GPS pickup") {
      hasAutoLocatedRef.current = true;
      return;
    }
    hasAutoLocatedRef.current = true;
    const t = setTimeout(() => useCurrentLocation(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Route preview */
  useEffect(() => {
    const cp = pickupName.trim();
    const cd = dropoffName.trim();
    if (!cp || !cd) { setRoutePreview(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const route = await getGoogleRouteDetails({
          origin: pickupCoords || cp, destination: dropoffCoords || cd, city,
        });
        if (!cancelled && route) setRoutePreview(route);
      } catch {}
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [city, dropoffCoords, dropoffName, pickupCoords, pickupName]);

  const cleanCity = useMemo(() => normalizeCity(city || "zvishavane"), [city]);
  const canSubmit = Boolean(
    user?.uid && cleanCity && pickupName.trim() &&
    (pickupCoords || pickupName.trim() !== "Current GPS pickup") &&
    dropoffName.trim() && Number(offerPrice) > 0 && Number(people) > 0
  );
  const suggested = routePreview ? suggestFare(routePreview.distanceMeters) : null;

  useEffect(() => {
    onDraftRouteChange?.({
      city: cleanCity,
      pickupName: pickupName.trim() || "Current GPS pickup",
      pickupCoords,
      dropoffName: dropoffName.trim(),
      dropoffCoords,
      routePreview,
      offerPrice: Number(offerPrice || 0),
    });
  }, [cleanCity, dropoffCoords, dropoffName, offerPrice, onDraftRouteChange, pickupCoords, pickupName, routePreview]);

  const bumpFare = (delta) => {
    setOfferPrice((prev) => {
      const n = Number(prev || 0) + delta;
      return String(Math.max(1, Math.round(n * 100) / 100));
    });
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setError("");
    const cp = pickupName.trim();
    const cd = dropoffName.trim();
    const priceNumber = Number(offerPrice);
    const peopleNumber = Number(people || 1);

    if (!user?.uid) return setError("Login again before requesting.");
    if (!cp || !cd) return setError("Add pickup and destination.");
    if (cp === "Current GPS pickup" && !pickupCoords) {
      setError("Allow GPS or type pickup.");
      return useCurrentLocation();
    }
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) return setError("Add a valid fare.");

    try {
      setSaving(true);
      let googleRoute = routePreview;
      if (!googleRoute) {
        try {
          googleRoute = await getGoogleRouteDetails({
            origin: pickupCoords || cp, destination: dropoffCoords || cd, city: cleanCity,
          });
        } catch { googleRoute = null; }
      }
      const rp = googleRoute?.pickupCoords || pickupCoords || null;
      const rd = googleRoute?.dropoffCoords || dropoffCoords || null;
      const detected = getNearestCityFromPoint(rp || pickupCoords);
      const requestCity = detected?.cityKey || cleanCity;

      setCity(requestCity);
      saveDetectedCityLocal(requestCity);
      saveDetectedCity({ db, ref, update, uid: user.uid, cityKey: requestCity }).catch(() => {});

      const requestRef = push(ref(db, `rideRequests/${requestCity}`));
      const now = Date.now();
      const payload = {
        id: requestRef.key, city: requestCity,
        riderId: user.uid,
        riderName: profile?.fullName || user.email || "Rider",
        riderPhone: profile?.phone || "",
        riderPhotoUrl: profile?.photoUrl || profile?.profilePhotoUrl || "",
        pickupName: googleRoute?.startAddress || cp,
        pickupLat: rp?.lat ?? null, pickupLng: rp?.lng ?? null,
        dropoffName: googleRoute?.endAddress || cd,
        dropoffLat: rd?.lat ?? null, dropoffLng: rd?.lng ?? null,
        distanceText: googleRoute?.distanceText || "",
        distanceMeters: googleRoute?.distanceMeters || null,
        durationText: googleRoute?.durationText || "",
        durationSeconds: googleRoute?.durationSeconds || null,
        routeSource: googleRoute?.source || "manual",
        mapsUrl: googleMapsDirectionsUrl({ origin: rp || cp, destination: rd || cd, city: requestCity }),
        offerPrice: priceNumber, people: peopleNumber,
        notes: notes.trim(), preferredPayment, rideMode,
        status: "open", viewCount: 0, offersCount: 0,
        createdAt: now, updatedAt: now,
      };

      await set(requestRef, payload);

      queueNexrideEvent({
        type: nexrideNotificationTypes.REQUEST_CREATED,
        city: requestCity, targetRole: "driver",
        title: "New NEXRIDE request",
        message: `${profile?.fullName || "A rider"} is offering $${price(priceNumber)} from ${payload.pickupName || "pickup"}.`,
        url: "/driver",
        data: { requestId: requestRef.key, city: requestCity, offerPrice: priceNumber },
      }).catch(() => {});

      writeStored("nexride-last-request-id", requestRef.key);
      writeStored("nexride-last-place", requestCity);
      writeStored("nexride-default-pickup", cp);
      writeStored("nexride-default-dropoff", cd);

      onRequestCreated?.({ ...payload, id: requestRef.key });
    } catch (err) {
      console.error("[RequestSheet] submit failed:", err);
      setError("Failed to post. Check internet.");
    } finally { setSaving(false); }
  };

  /* ---------------------------------- RENDER ---------------------------------- */
  return (
    <form onSubmit={submitRequest} className="nx-rs">
      {/* Header — single line */}
      <div className="nx-rs-head">
        <h2 className="nx-rs-title">Where to?</h2>
        <span className="nx-rs-badge">${price(offerPrice)}</span>
      </div>

      {error ? <div className="nx-alert-error nx-rs-alert">{error}</div> : null}

      {/* Route — compact */}
      <div className="nx-rs-route">
        <div className="nx-rs-route-row">
          <span className="nx-dot nx-dot-pickup" />
          <input
            ref={pickupInputRef}
            className="nx-rs-input"
            type="text"
            placeholder="Pickup"
            value={pickupName}
            onChange={(e) => { setPickupName(e.target.value); if (!e.target.value.trim()) setPickupCoords(null); }}
            autoComplete="off"
          />
          <button type="button" className="nx-rs-gps" onClick={useCurrentLocation} disabled={locating} aria-label="Use GPS">
            {locating ? "…" : "📍"}
          </button>
        </div>
        <div className="nx-rs-route-line" />
        <div className="nx-rs-route-row">
          <span className="nx-dot nx-dot-destination" />
          <input
            ref={dropoffInputRef}
            className="nx-rs-input"
            type="text"
            placeholder="Where to?"
            value={dropoffName}
            onChange={(e) => { setDropoffName(e.target.value); setDropoffCoords(null); }}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Route info + city — one compact row */}
      <div className="nx-rs-info">
        <select className="nx-rs-city" value={city} onChange={(e) => setCity(e.target.value)}>
          {cityOptions.map((c) => <option key={c} value={c}>{cityLabel(c)}</option>)}
        </select>
        <span className="nx-rs-sep">•</span>
        <span className="nx-rs-pax">
          <button type="button" onClick={() => setPeople((p) => String(Math.max(1, Number(p) - 1)))} aria-label="Fewer">−</button>
          <span>{people} pax</span>
          <button type="button" onClick={() => setPeople((p) => String(Math.min(8, Number(p) + 1)))} aria-label="More">+</button>
        </span>
        {routePreview ? (
          <>
            <span className="nx-rs-sep">•</span>
            <span className="nx-rs-meta">{routePreview.distanceText} · {routePreview.durationText}</span>
          </>
        ) : null}
      </div>

      {/* Fare — compact stepper row */}
      <div className="nx-rs-fare">
        <span className="nx-rs-fare-label">Fare</span>
        <button type="button" className="nx-rs-step" onClick={() => bumpFare(-0.5)} aria-label="Lower">−</button>
        <div className="nx-rs-fare-display">${price(offerPrice)}</div>
        <button type="button" className="nx-rs-step" onClick={() => bumpFare(0.5)} aria-label="Raise">+</button>
        {suggested && Number(offerPrice) !== suggested ? (
          <button type="button" className="nx-rs-suggest" onClick={() => setOfferPrice(suggested.toFixed(2))}>
            ${suggested.toFixed(2)}
          </button>
        ) : null}
      </div>

      {/* Payment pills */}
      <div className="nx-rs-pills">
        {PAYMENT_OPTIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`nx-rs-chip ${preferredPayment === p.value ? "is-active" : ""}`}
            onClick={() => setPreferredPayment(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Ride mode pills */}
      <div className="nx-rs-pills">
        {RIDE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`nx-rs-chip ${rideMode === r.value ? "is-active" : ""}`}
            onClick={() => setRideMode(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Notes — collapsed by default */}
      {notesOpen ? (
        <input
          className="nx-rs-input nx-rs-notes"
          placeholder="Note for driver (luggage, gate…)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      ) : (
        <button type="button" className="nx-rs-notes-toggle" onClick={() => setNotesOpen(true)}>
          + Add note for driver
        </button>
      )}

      {/* CTA */}
      <PremiumButton type="submit" disabled={!canSubmit} loading={saving}>
        {saving ? "Posting…" : "Find drivers"}
      </PremiumButton>
    </form>
  );
}
