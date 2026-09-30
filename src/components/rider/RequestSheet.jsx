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

/* ------------------------------ Helpers ------------------------------- */

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
  const base = 2;
  const perKm = 0.6;
  const suggested = Math.max(base, Math.round((base + km * perKm) * 2) / 2);
  const min = Math.max(1, Math.round(suggested * 0.75 * 2) / 2);
  const max = Math.round(suggested * 1.35 * 2) / 2;
  return { min, max, suggested };
}

function readStored(key) {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/* ----------------------------- Constants ------------------------------ */

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "ecocash", label: "EcoCash", icon: "📱" },
  { value: "onemoney", label: "OneMoney", icon: "📲" },
  { value: "card", label: "Card", icon: "💳" },
];

const RIDE_MODES = [
  { value: "standard", label: "Standard", icon: "🚗" },
  { value: "comfort", label: "Comfort", icon: "✨" },
  { value: "quick", label: "Quick", icon: "⚡" },
  { value: "family", label: "Family", icon: "👨‍👩‍👧" },
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
  /* ---------- Form state ---------- */
  const [city, setCity] = useState(
    normalizeCity(initialCity || profile?.city || "zvishavane")
  );
  const [pickupName, setPickupName] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [offerPrice, setOfferPrice] = useState("3");
  const [preferredPayment, setPreferredPayment] = useState("cash");
  const [rideMode, setRideMode] = useState("standard");
  const [people, setPeople] = useState("1");
  const [notes, setNotes] = useState("");

  /* ---------- Coordinates + route ---------- */
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  /* ---------- UI status ---------- */
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  /* ---------- Refs ---------- */
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);
  const pickupAutocompleteRef = useRef(null);
  const dropoffAutocompleteRef = useRef(null);
  const hasAutoLocatedRef = useRef(false);
  const appSettingsRef = useRef(appSettings);

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  /* --------------- Initial form hydration (once) ------------ */
  useEffect(() => {
    const settings = appSettingsRef.current || {};
    const savedPickup =
      readStored("nexride-default-pickup") || settings.defaultPickup || "";
    const savedDropoff =
      readStored("nexride-default-dropoff") || settings.defaultDropoff || "";
    const savedPayment =
      readStored("nexride-preferred-payment") ||
      settings.preferredPayment ||
      "cash";
    const savedRideMode =
      readStored("nexride-ride-mode") || settings.rideMode || "standard";
    const savedCity =
      readStored("nexride-gps-detected-city") ||
      readStored("nexride-last-place") ||
      initialCity ||
      profile?.city ||
      "zvishavane";

    setCity(normalizeCity(savedCity));
    if (savedPickup) setPickupName(savedPickup);
    setDropoffName(savedDropoff);
    setPreferredPayment(savedPayment);
    setRideMode(savedRideMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------- Google Places Autocomplete -------------------- */
  useEffect(() => {
    if (!hasGoogleMapsApiKey()) return;
    if (!pickupInputRef.current || !dropoffInputRef.current) return;

    let cancelled = false;
    let pickupListener = null;
    let dropoffListener = null;

    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !google?.maps?.places) return;

        const center = getCityCenter(city);
        const bounds = new google.maps.LatLngBounds(
          { lat: center.lat - 0.5, lng: center.lng - 0.5 },
          { lat: center.lat + 0.5, lng: center.lng + 0.5 }
        );

        const options = {
          componentRestrictions: { country: "zw" },
          fields: ["formatted_address", "geometry", "name"],
          bounds,
          strictBounds: false,
        };

        const pickupAutocomplete = new google.maps.places.Autocomplete(
          pickupInputRef.current,
          options
        );
        const dropoffAutocomplete = new google.maps.places.Autocomplete(
          dropoffInputRef.current,
          options
        );

        pickupAutocompleteRef.current = pickupAutocomplete;
        dropoffAutocompleteRef.current = dropoffAutocomplete;

        pickupListener = pickupAutocomplete.addListener(
          "place_changed",
          () => {
            const place = pickupAutocomplete.getPlace();
            const formatted =
              place.formatted_address ||
              place.name ||
              pickupInputRef.current?.value ||
              "";
            const location = place.geometry?.location;
            if (formatted) setPickupName(formatted);
            if (location)
              setPickupCoords({ lat: location.lat(), lng: location.lng() });
          }
        );

        dropoffListener = dropoffAutocomplete.addListener(
          "place_changed",
          () => {
            const place = dropoffAutocomplete.getPlace();
            const formatted =
              place.formatted_address ||
              place.name ||
              dropoffInputRef.current?.value ||
              "";
            const location = place.geometry?.location;
            if (formatted) setDropoffName(formatted);
            if (location)
              setDropoffCoords({ lat: location.lat(), lng: location.lng() });
          }
        );
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[RequestSheet] places init failed:",
            err?.message || err
          );
        }
      });

    return () => {
      cancelled = true;
      try {
        pickupListener?.remove?.();
        dropoffListener?.remove?.();
      } catch {}
      pickupAutocompleteRef.current = null;
      dropoffAutocompleteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------- Re-bias autocomplete when city changes ----------- */
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

  /* ----------------------- GPS location helper ------------------------ */
  const useCurrentLocation = useCallback(() => {
    setError("");

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("GPS unavailable. Type pickup manually.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const gpsPoint = buildGpsPointFromPosition(pos);
        const accuracy = Number(gpsPoint?.accuracy || 9999);

        if (!gpsPoint || accuracy > 250) {
          setError("GPS weak. Move outside or type pickup.");
          setLocating(false);
          return;
        }

        const detected = getNearestCityFromPoint(gpsPoint);
        const detectedCity = detected?.cityKey || city;

        setCity(detectedCity);
        saveDetectedCityLocal(detectedCity);
        saveDetectedCity({
          db,
          ref,
          update,
          uid: user?.uid,
          cityKey: detectedCity,
        }).catch(() => {});

        setPickupCoords({
          lat: gpsPoint.lat,
          lng: gpsPoint.lng,
          accuracy,
          source: "phone-gps",
        });
        setPickupName((current) =>
          current?.trim() && current !== "Current GPS pickup"
            ? current
            : "Current GPS pickup"
        );
        setLocating(false);
      },
      () => {
        setError("Could not read GPS. Type pickup manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [city, user?.uid]);

  /* --------------- Auto-GPS on mount ------------ */
  useEffect(() => {
    if (hasAutoLocatedRef.current) return;
    if (pickupCoords) return;

    const savedPickup = readStored("nexride-default-pickup");
    if (
      savedPickup &&
      savedPickup.trim() &&
      savedPickup !== "Current GPS pickup"
    ) {
      hasAutoLocatedRef.current = true;
      return;
    }

    hasAutoLocatedRef.current = true;
    const timer = setTimeout(() => useCurrentLocation(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------- Live route preview ------------- */
  useEffect(() => {
    const cleanPickup = pickupName.trim();
    const cleanDropoff = dropoffName.trim();

    if (!cleanPickup || !cleanDropoff) {
      setRoutePreview(null);
      setRouteLoading(false);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);

    const timer = setTimeout(async () => {
      try {
        const route = await getGoogleRouteDetails({
          origin: pickupCoords || cleanPickup,
          destination: dropoffCoords || cleanDropoff,
          city,
        });
        if (!cancelled && route) setRoutePreview(route);
      } catch {
        // optional
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [city, dropoffCoords, dropoffName, pickupCoords, pickupName]);

  /* ------------------------ Derived values ---------------------------- */
  const cleanCity = useMemo(
    () => normalizeCity(city || "zvishavane"),
    [city]
  );

  const canSubmit = Boolean(
    user?.uid &&
      cleanCity &&
      pickupName.trim() &&
      (pickupCoords || pickupName.trim() !== "Current GPS pickup") &&
      dropoffName.trim() &&
      Number(offerPrice) > 0 &&
      Number(people) > 0
  );

  const suggested = useMemo(
    () => (routePreview ? suggestFare(routePreview.distanceMeters) : null),
    [routePreview]
  );

  /* ------------------- Draft route notifications to map -------------- */
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
  }, [
    cleanCity,
    dropoffCoords,
    dropoffName,
    offerPrice,
    onDraftRouteChange,
    pickupCoords,
    pickupName,
    routePreview,
  ]);

  /* --------------------------- Submit handler ------------------------ */
  const submitRequest = async (e) => {
    e.preventDefault();
    setError("");

    const cleanPickup = pickupName.trim();
    const cleanDropoff = dropoffName.trim();
    const priceNumber = Number(offerPrice);
    const peopleNumber = Number(people || 1);

    if (!user?.uid) {
      setError("Login again before requesting a ride.");
      return;
    }

    if (!cleanPickup || !cleanDropoff) {
      setError("Add pickup and destination first.");
      return;
    }

    if (cleanPickup === "Current GPS pickup" && !pickupCoords) {
      setError("Allow GPS first, or type your pickup manually.");
      useCurrentLocation();
      return;
    }

    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      setError("Add a valid offer price.");
      return;
    }

    try {
      setSaving(true);

      let googleRoute = routePreview;
      if (!googleRoute) {
        try {
          googleRoute = await getGoogleRouteDetails({
            origin: pickupCoords || cleanPickup,
            destination: dropoffCoords || cleanDropoff,
            city: cleanCity,
          });
        } catch {
          googleRoute = null;
        }
      }

      const resolvedPickup = googleRoute?.pickupCoords || pickupCoords || null;
      const resolvedDropoff =
        googleRoute?.dropoffCoords || dropoffCoords || null;
      const detectedFromPickup = getNearestCityFromPoint(
        resolvedPickup || pickupCoords
      );
      const requestCity = detectedFromPickup?.cityKey || cleanCity;

      setCity(requestCity);
      saveDetectedCityLocal(requestCity);

      saveDetectedCity({
        db,
        ref,
        update,
        uid: user.uid,
        cityKey: requestCity,
      }).catch(() => {});

      const requestRef = push(ref(db, `rideRequests/${requestCity}`));
      const now = Date.now();

      const payload = {
        id: requestRef.key,
        city: requestCity,
        riderId: user.uid,
        riderName: profile?.fullName || user.email || "Rider",
        riderPhone: profile?.phone || "",
        riderPhotoUrl: profile?.photoUrl || profile?.profilePhotoUrl || "",
        pickupName: googleRoute?.startAddress || cleanPickup,
        pickupLat: resolvedPickup?.lat ?? null,
        pickupLng: resolvedPickup?.lng ?? null,
        dropoffName: googleRoute?.endAddress || cleanDropoff,
        dropoffLat: resolvedDropoff?.lat ?? null,
        dropoffLng: resolvedDropoff?.lng ?? null,
        distanceText: googleRoute?.distanceText || "",
        distanceMeters: googleRoute?.distanceMeters || null,
        durationText: googleRoute?.durationText || "",
        durationSeconds: googleRoute?.durationSeconds || null,
        routeSource: googleRoute?.source || "manual",
        mapsUrl: googleMapsDirectionsUrl({
          origin: resolvedPickup || cleanPickup,
          destination: resolvedDropoff || cleanDropoff,
          city: requestCity,
        }),
        offerPrice: priceNumber,
        people: peopleNumber,
        notes: notes.trim(),
        preferredPayment,
        rideMode,
        status: "open",
        viewCount: 0,
        offersCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await set(requestRef, payload);

      queueNexrideEvent({
        type: nexrideNotificationTypes.REQUEST_CREATED,
        city: requestCity,
        targetRole: "driver",
        title: "New NEXRIDE request",
        message: `${
          profile?.fullName || "A rider"
        } is offering $${price(priceNumber)} from ${
          payload.pickupName || "pickup"
        }.`,
        url: "/driver",
        data: {
          requestId: requestRef.key,
          city: requestCity,
          offerPrice: priceNumber,
        },
      }).catch(() => {});

      writeStored("nexride-last-request-id", requestRef.key);
      writeStored("nexride-last-place", requestCity);
      writeStored("nexride-default-pickup", cleanPickup);
      writeStored("nexride-default-dropoff", cleanDropoff);

      onRequestCreated?.({ ...payload, id: requestRef.key });
    } catch (err) {
      console.error("[RequestSheet] submit failed:", err);
      setError("Failed to post request. Check your internet and try again.");
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ Render ------------------------------ */
  return (
    <form onSubmit={submitRequest} className="nx-request-sheet nx-request-v2">
      {/* Header — clean, no fluff */}
      <div className="nx-request-v2-head">
        <h2 className="nx-request-v2-title">Where to?</h2>
        <div className="nx-request-v2-price-badge">
          <span className="nx-request-v2-price-label">Your offer</span>
          <strong>${price(offerPrice)}</strong>
        </div>
      </div>

      {error ? <div className="nx-alert-error">{error}</div> : null}

      {/* Route card — the hero */}
      <ActionCard className="nx-route-card nx-route-card-v2">
        <div className="nx-route-row">
          <span className="nx-dot nx-dot-pickup" />
          <input
            ref={pickupInputRef}
            className="nx-route-input"
            type="text"
            placeholder="Pickup location"
            value={pickupName}
            onChange={(e) => {
              setPickupName(e.target.value);
              if (!e.target.value.trim()) setPickupCoords(null);
            }}
            autoComplete="off"
          />
          <button
            type="button"
            className="nx-mini-btn"
            onClick={useCurrentLocation}
            disabled={locating}
            aria-label="Use current location"
          >
            {locating ? "…" : "📍"}
          </button>
        </div>
        <div className="nx-route-line" />
        <div className="nx-route-row">
          <span className="nx-dot nx-dot-destination" />
          <input
            ref={dropoffInputRef}
            className="nx-route-input"
            type="text"
            placeholder="Where to?"
            value={dropoffName}
            onChange={(e) => {
              setDropoffName(e.target.value);
              setDropoffCoords(null);
            }}
            autoComplete="off"
          />
        </div>
      </ActionCard>

      {/* Route preview — compact, no fluff */}
      {routePreview ? (
        <div className="nx-route-preview-v2">
          <div className="nx-route-preview-v2-left">
            <div className="nx-route-preview-v2-metric">
              <strong>{routePreview.distanceText || "—"}</strong>
              <span>Distance</span>
            </div>
            <div className="nx-route-preview-v2-divider" />
            <div className="nx-route-preview-v2-metric">
              <strong>{routePreview.durationText || "—"}</strong>
              <span>ETA</span>
            </div>
          </div>
          {suggested ? (
            <button
              type="button"
              className="nx-route-preview-v2-suggest"
              onClick={() =>
                setOfferPrice(suggested.suggested.toFixed(2))
              }
            >
              <span>Suggested</span>
              <strong>${suggested.suggested.toFixed(2)}</strong>
            </button>
          ) : null}
        </div>
      ) : routeLoading ? (
        <div className="nx-route-preview-v2 is-loading">
          <div className="nx-route-preview-v2-skeleton" />
        </div>
      ) : null}

      {/* Fare — the inDrive hero input */}
      <div className="nx-fare-block-v2">
        <label className="nx-fare-block-v2-label">Your fare</label>
        <div className="nx-fare-block-v2-input-wrap">
          <span className="nx-fare-block-v2-prefix">$</span>
          <input
            className="nx-fare-block-v2-input"
            type="number"
            min="1"
            step="0.50"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            inputMode="decimal"
          />
        </div>
        {suggested ? (
          <div className="nx-fare-block-v2-hint">
            Suggested range ${suggested.min.toFixed(2)} – $
            {suggested.max.toFixed(2)}
          </div>
        ) : null}
      </div>

      {/* Payment chips */}
      <div className="nx-chips-block">
        <span className="nx-chips-label">Payment</span>
        <div className="nx-chips-row">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`nx-chip ${
                preferredPayment === opt.value ? "is-active" : ""
              }`}
              onClick={() => setPreferredPayment(opt.value)}
            >
              <span className="nx-chip-icon">{opt.icon}</span>
              <span className="nx-chip-text">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ride mode chips */}
      <div className="nx-chips-block">
        <span className="nx-chips-label">Ride</span>
        <div className="nx-chips-row">
          {RIDE_MODES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`nx-chip ${
                rideMode === opt.value ? "is-active" : ""
              }`}
              onClick={() => setRideMode(opt.value)}
            >
              <span className="nx-chip-icon">{opt.icon}</span>
              <span className="nx-chip-text">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Passengers + city — subtle row */}
      <div className="nx-subtle-row">
        <div className="nx-subtle-field">
          <span className="nx-chips-label">Passengers</span>
          <div className="nx-stepper">
            <button
              type="button"
              onClick={() =>
                setPeople((p) => String(Math.max(1, Number(p || 1) - 1)))
              }
              aria-label="Fewer passengers"
            >
              −
            </button>
            <span>{people}</span>
            <button
              type="button"
              onClick={() =>
                setPeople((p) => String(Math.min(8, Number(p || 1) + 1)))
              }
              aria-label="More passengers"
            >
              +
            </button>
          </div>
        </div>

        <div className="nx-subtle-field">
          <span className="nx-chips-label">City</span>
          <select
            className="nx-subtle-select"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {cityOptions.map((item) => (
              <option key={item} value={item}>
                {cityLabel(item)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Note for driver — collapsible-ish via small textarea */}
      <textarea
        className="nx-input nx-input-note"
        rows={2}
        placeholder="Note for driver (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {/* Submit */}
      <PremiumButton type="submit" disabled={!canSubmit} loading={saving}>
        {saving ? "Posting…" : "Find drivers"}
      </PremiumButton>
    </form>
  );
}
