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

/**
 * InDrive-style suggested fare band derived from route distance.
 * Base + per-km estimate. Returns suggested/min/max in USD.
 */
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

  // Keep appSettings in a ref so the init effect never depends on it directly.
  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  /* --------------- Initial form hydration (once at mount) ------------ */
  // Runs ONCE. Prevents "form resets every render" bug from appSettings churn.
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
  // Attached once. City bias updates separately via setBounds.
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

  /* ------------- Re-bias autocomplete when the city changes ----------- */
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
      setError(
        "GPS is not available on this device. Type your pickup manually."
      );
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const gpsPoint = buildGpsPointFromPosition(pos);
        const accuracy = Number(gpsPoint?.accuracy || 9999);

        if (!gpsPoint || accuracy > 250) {
          setError(
            "GPS is too weak right now. Move outside or type pickup manually."
          );
          setLocating(false);
          return;
        }

        const detected = getNearestCityFromPoint(gpsPoint);
        const detectedCity = detected?.cityKey || city;

        setCity(detectedCity);
        saveDetectedCityLocal(detectedCity);
        // Fire-and-forget: city save must NEVER block the ride flow.
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
        setError(
          "Could not read GPS. Type pickup manually or allow location access."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [city, user?.uid]);

  /* --------------- Auto-GPS on mount (smart + non-clobbering) -------- */
  // Only auto-locates if there is NO saved custom pickup.
  useEffect(() => {
    if (hasAutoLocatedRef.current) return;
    if (pickupCoords) return;

    const savedPickup = readStored("nexride-default-pickup");
    if (
      savedPickup &&
      savedPickup.trim() &&
      savedPickup !== "Current GPS pickup"
    ) {
      // Respect the saved address — don't wipe it with GPS.
      hasAutoLocatedRef.current = true;
      return;
    }

    hasAutoLocatedRef.current = true;
    const timer = setTimeout(() => useCurrentLocation(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------- Live route preview (debounced) ------------- */
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
          // withTraffic defaults to false — cheaper + faster in ZW.
        });
        if (!cancelled && route) setRoutePreview(route);
      } catch {
        // Route preview is optional — silent fail is correct here.
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

      // Non-blocking city persistence
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

      // Non-blocking notification — must never block the ride flow.
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

      // Persist session preferences
      writeStored("nexride-last-request-id", requestRef.key);
      writeStored("nexride-last-place", requestCity);
      writeStored("nexride-default-pickup", cleanPickup);
      writeStored("nexride-default-dropoff", cleanDropoff);

      onRequestCreated?.({ ...payload, id: requestRef.key });
    } catch (err) {
      console.error("[RequestSheet] submit failed:", err);
      setError(
        "Failed to post ride request. Check your internet and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ Render ------------------------------ */
  return (
    <form onSubmit={submitRequest} className="nx-request-sheet">
      <div className="nx-sheet-head">
        <div>
          <div className="nx-eyebrow">Live ride request</div>
          <h2 className="nx-sheet-title">Where to & how much?</h2>
          <p className="nx-sheet-copy">
            Your pickup uses phone GPS automatically. Add your destination and
            fare.
          </p>
        </div>
        <div className="nx-price-badge">${price(offerPrice)}</div>
      </div>

      {error ? <div className="nx-alert-error">{error}</div> : null}

      <ActionCard className="nx-route-card">
        <div className="nx-route-row">
          <span className="nx-dot nx-dot-pickup" />
          <input
            ref={pickupInputRef}
            className="nx-route-input"
            type="text"
            placeholder="Current GPS pickup"
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

      <div className="nx-field-grid two">
        <label className="nx-field">
          <span>City</span>
          <select
            className="nx-input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {cityOptions.map((item) => (
              <option key={item} value={item}>
                {cityLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="nx-field">
          <span>Passengers</span>
          <input
            className="nx-input"
            type="number"
            min="1"
            max="8"
            value={people}
            onChange={(e) => setPeople(e.target.value)}
          />
        </label>
      </div>

      <div className="nx-field-grid three">
        <label className="nx-field">
          <span>Your fare</span>
          <input
            className="nx-input"
            type="number"
            min="1"
            step="0.50"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
          />
        </label>
        <label className="nx-field">
          <span>Payment</span>
          <select
            className="nx-input"
            value={preferredPayment}
            onChange={(e) => setPreferredPayment(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="ecocash">EcoCash</option>
            <option value="onemoney">OneMoney</option>
            <option value="card">Card</option>
          </select>
        </label>
        <label className="nx-field">
          <span>Ride</span>
          <select
            className="nx-input"
            value={rideMode}
            onChange={(e) => setRideMode(e.target.value)}
          >
            <option value="standard">Standard</option>
            <option value="comfort">Comfort</option>
            <option value="quick">Quick</option>
            <option value="family">Family</option>
          </select>
        </label>
      </div>

      {routePreview ? (
        <ActionCard className="nx-route-preview-card">
          <div className="nx-offer-top">
            <div>
              <div className="nx-eyebrow">Route preview</div>
              <h3 className="nx-card-title">
                {routePreview.distanceText} • {routePreview.durationText}
              </h3>
              <p className="nx-sheet-copy">
                Real distance and ETA will be saved with this request.
              </p>
            </div>
            <a
              className="nx-status-pill"
              href={googleMapsDirectionsUrl({
                origin: pickupCoords || pickupName,
                destination: dropoffName,
                city,
              })}
              target="_blank"
              rel="noreferrer"
            >
              OPEN
            </a>
          </div>

          {suggested ? (
            <div className="nx-fare-suggest">
              <div className="nx-fare-suggest-text">
                <span className="nx-fare-suggest-label">
                  Suggested ${suggested.suggested.toFixed(2)}
                </span>
                <span className="nx-fare-suggest-range">
                  Range ${suggested.min.toFixed(2)} – $
                  {suggested.max.toFixed(2)}
                </span>
              </div>
              {Number(offerPrice) !== suggested.suggested ? (
                <button
                  type="button"
                  className="nx-fare-suggest-apply"
                  onClick={() =>
                    setOfferPrice(suggested.suggested.toFixed(2))
                  }
                >
                  Use
                </button>
              ) : (
                <span className="nx-fare-suggest-ok">✓ Applied</span>
              )}
            </div>
          ) : null}
        </ActionCard>
      ) : routeLoading ? (
        <ActionCard className="nx-route-preview-card">
          <div className="nx-eyebrow">Calculating route…</div>
          <p className="nx-sheet-copy">
            Fetching distance and ETA from Google.
          </p>
        </ActionCard>
      ) : null}

      <textarea
        className="nx-input"
        rows={2}
        placeholder="Optional note for drivers, e.g. luggage, gate number"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <PremiumButton type="submit" disabled={!canSubmit} loading={saving}>
        {saving ? "Posting request..." : "Find drivers now"}
      </PremiumButton>
    </form>
  );
}
