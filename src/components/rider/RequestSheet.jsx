// File: src/components/rider/RequestSheet.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { push, ref, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { getGoogleRouteDetails, googleMapsDirectionsUrl, hasGoogleMapsApiKey, loadGoogleMapsApi } from "../../lib/googleMaps";
import { buildGpsPointFromPosition, getNearestCityFromPoint, normalizeCity, saveDetectedCity, saveDetectedCityLocal, SERVICE_CITY_KEYS } from "../../lib/nexrideCity";
import { nexrideNotificationTypes, queueNexrideEvent } from "../../lib/nexrideNotifications";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

const cityOptions = SERVICE_CITY_KEYS;

function cityLabel(city) {
  if (!city) return "City";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function price(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function RequestSheet({ user, profile, appSettings = {}, initialCity = "zvishavane", onRequestCreated, onDraftRouteChange }) {
  const [city, setCity] = useState(normalizeCity(initialCity || profile?.city || "zvishavane"));
  const [pickupName, setPickupName] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [offerPrice, setOfferPrice] = useState("3");
  const [preferredPayment, setPreferredPayment] = useState("cash");
  const [rideMode, setRideMode] = useState("standard");
  const [people, setPeople] = useState("1");
  const [notes, setNotes] = useState("");
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  useEffect(() => {
    try {
      const savedPickup = localStorage.getItem("nexride-default-pickup") || appSettings.defaultPickup || "";
      const savedDropoff = localStorage.getItem("nexride-default-dropoff") || appSettings.defaultDropoff || "";
      const savedPayment = localStorage.getItem("nexride-preferred-payment") || appSettings.preferredPayment || "cash";
      const savedRideMode = localStorage.getItem("nexride-ride-mode") || appSettings.rideMode || "standard";
      const savedCity = localStorage.getItem("nexride-gps-detected-city") || localStorage.getItem("nexride-last-place") || initialCity || profile?.city || "zvishavane";

      setCity(normalizeCity(savedCity));
      setPickupName(savedPickup || "Current GPS pickup");
      setDropoffName(savedDropoff);
      setPreferredPayment(savedPayment);
      setRideMode(savedRideMode);
    } catch {
      setPickupName(appSettings.defaultPickup || "Current GPS pickup");
      setDropoffName(appSettings.defaultDropoff || "");
      setPreferredPayment(appSettings.preferredPayment || "cash");
      setRideMode(appSettings.rideMode || "standard");
    }
  }, [appSettings.defaultDropoff, appSettings.defaultPickup, appSettings.preferredPayment, appSettings.rideMode, initialCity, profile?.city]);

  useEffect(() => {
    if (!hasGoogleMapsApiKey()) return;
    if (!pickupInputRef.current || !dropoffInputRef.current) return;

    let pickupListener = null;
    let dropoffListener = null;
    let cancelled = false;

    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !google?.maps?.places) return;

        const options = {
          componentRestrictions: { country: "zw" },
          fields: ["formatted_address", "geometry", "name"],
        };

        const pickupAutocomplete = new google.maps.places.Autocomplete(pickupInputRef.current, options);
        const dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInputRef.current, options);

        pickupListener = pickupAutocomplete.addListener("place_changed", () => {
          const place = pickupAutocomplete.getPlace();
          const formatted = place.formatted_address || place.name || pickupInputRef.current?.value || "";
          const location = place.geometry?.location;
          if (formatted) setPickupName(formatted);
          if (location) setPickupCoords({ lat: location.lat(), lng: location.lng() });
        });

        dropoffListener = dropoffAutocomplete.addListener("place_changed", () => {
          const place = dropoffAutocomplete.getPlace();
          const formatted = place.formatted_address || place.name || dropoffInputRef.current?.value || "";
          const location = place.geometry?.location;
          if (formatted) setDropoffName(formatted);
          if (location) setDropoffCoords({ lat: location.lat(), lng: location.lng() });
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      pickupListener?.remove?.();
      dropoffListener?.remove?.();
    };
  }, []);

  useEffect(() => {
    setRoutePreview(null);
    const cleanPickup = pickupName.trim();
    const cleanDropoff = dropoffName.trim();
    if (!cleanPickup || !cleanDropoff) return;

    const timer = setTimeout(async () => {
      try {
        const route = await getGoogleRouteDetails({
          origin: pickupCoords || cleanPickup,
          destination: dropoffCoords || cleanDropoff,
          city,
        });
        if (route) setRoutePreview(route);
      } catch {
        // Google route preview is optional. The request still works without it.
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [city, dropoffCoords, dropoffName, pickupCoords, pickupName]);

  const cleanCity = useMemo(() => normalizeCity(city || "zvishavane"), [city]);
  const canSubmit = Boolean(
    user?.uid &&
      cleanCity &&
      pickupName.trim() &&
      (pickupCoords || pickupName.trim() !== "Current GPS pickup") &&
      dropoffName.trim() &&
      Number(offerPrice) > 0 &&
      Number(people) > 0
  );

  const useCurrentLocation = () => {
    setError("");

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("GPS is not available on this device. Type your pickup manually.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const gpsPoint = buildGpsPointFromPosition(pos);
        const accuracy = Number(gpsPoint?.accuracy || 9999);
        if (!gpsPoint || accuracy > 250) {
          setError("GPS is too weak right now. Move outside or type pickup manually.");
          setLocating(false);
          return;
        }

        const detected = getNearestCityFromPoint(gpsPoint);
        const detectedCity = detected?.cityKey || cleanCity;

        setCity(detectedCity);
        saveDetectedCityLocal(detectedCity);
        await saveDetectedCity({ db, ref, update, uid: user?.uid, cityKey: detectedCity });

        setPickupCoords({ lat: gpsPoint.lat, lng: gpsPoint.lng, accuracy, source: "phone-gps" });
        setPickupName((current) => current?.trim() && current !== "Current GPS pickup" ? current : "Current GPS pickup");
        setLocating(false);
      },
      () => {
        setError("Could not read GPS. Type pickup manually or allow location access.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  };


  useEffect(() => {
    if (pickupCoords) return;
    const timer = setTimeout(() => useCurrentLocation(), 350);
    return () => clearTimeout(timer);
    // Auto GPS is intentional: riders only need to choose where they are going.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const resolvedDropoff = googleRoute?.dropoffCoords || dropoffCoords || null;
      const detectedFromPickup = getNearestCityFromPoint(resolvedPickup || pickupCoords);
      const requestCity = detectedFromPickup?.cityKey || cleanCity;
      setCity(requestCity);
      saveDetectedCityLocal(requestCity);
      await saveDetectedCity({ db, ref, update, uid: user?.uid, cityKey: requestCity });
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
        mapsUrl: googleMapsDirectionsUrl({ origin: resolvedPickup || cleanPickup, destination: resolvedDropoff || cleanDropoff, city: requestCity }),
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

      await queueNexrideEvent({
        type: nexrideNotificationTypes.REQUEST_CREATED,
        city: requestCity,
        targetRole: "driver",
        title: "New NEXRIDE request",
        message: `${profile?.fullName || "A rider"} is offering $${price(priceNumber)} from ${payload.pickupName || "pickup"}.`,
        url: "/driver",
        data: { requestId: requestRef.key, city: requestCity, offerPrice: priceNumber },
      });

      try {
        localStorage.setItem("nexride-last-request-id", requestRef.key);
        localStorage.setItem("nexride-last-place", requestCity);
        localStorage.setItem("nexride-default-pickup", cleanPickup);
        localStorage.setItem("nexride-default-dropoff", cleanDropoff);
      } catch {}

      onRequestCreated?.({ ...payload, id: requestRef.key });
    } catch (err) {
      console.error(err);
      setError("Failed to post ride request. Check your internet and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submitRequest} className="nx-request-sheet">
      <div className="nx-sheet-head">
        <div>
          <div className="nx-eyebrow">Live ride request</div>
          <h2 className="nx-sheet-title">Where to & how much?</h2>
          <p className="nx-sheet-copy">Your pickup uses phone GPS automatically. Add your destination and fare.</p>
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
            onChange={(e) => { setPickupName(e.target.value); if (!e.target.value.trim()) setPickupCoords(null); }}
          />
          <button type="button" className="nx-mini-btn" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "GPS" : "📍"}
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
            onChange={(e) => { setDropoffName(e.target.value); setDropoffCoords(null); }}
          />
        </div>
      </ActionCard>

      <div className="nx-field-grid two">
        <label className="nx-field">
          <span>City</span>
          <select className="nx-input" value={city} onChange={(e) => setCity(e.target.value)}>
            {cityOptions.map((item) => (
              <option key={item} value={item}>{cityLabel(item)}</option>
            ))}
          </select>
        </label>
        <label className="nx-field">
          <span>Passengers</span>
          <input className="nx-input" type="number" min="1" max="8" value={people} onChange={(e) => setPeople(e.target.value)} />
        </label>
      </div>

      <div className="nx-field-grid three">
        <label className="nx-field">
          <span>Your fare</span>
          <input className="nx-input" type="number" min="1" step="0.50" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
        </label>
        <label className="nx-field">
          <span>Payment</span>
          <select className="nx-input" value={preferredPayment} onChange={(e) => setPreferredPayment(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="ecocash">EcoCash</option>
            <option value="onemoney">OneMoney</option>
            <option value="card">Card</option>
          </select>
        </label>
        <label className="nx-field">
          <span>Ride</span>
          <select className="nx-input" value={rideMode} onChange={(e) => setRideMode(e.target.value)}>
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
              <div className="nx-eyebrow">Google route preview</div>
              <h3 className="nx-card-title">{routePreview.distanceText} • {routePreview.durationText}</h3>
              <p className="nx-sheet-copy">Real distance and ETA will be saved with this request.</p>
            </div>
            <a
              className="nx-status-pill"
              href={googleMapsDirectionsUrl({ origin: pickupCoords || pickupName, destination: dropoffName, city })}
              target="_blank"
              rel="noreferrer"
            >
              OPEN
            </a>
          </div>
        </ActionCard>
      ) : null}

      <textarea
        className="nx-input"
        rows={2}
        placeholder="Optional note for drivers, e.g. luggage, gate number"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <PremiumButton type="submit" disabled={!canSubmit || saving}>
        {saving ? "Posting request..." : "Find drivers now"}
      </PremiumButton>
    </form>
  );
}
