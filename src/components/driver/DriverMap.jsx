// File: src/components/driver/DriverMap.jsx

"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import LiveGoogleMap from "../maps/LiveGoogleMap";
import {
  pointFromRecord,
  toLatLng,
} from "../../lib/googleMaps";
import { normalizeCity } from "../../lib/nexrideCity";

/* ------------------------------ Constants ----------------------------- */

const GPS_ACCURACY_LIMIT_M = 1200;
const MAX_REQUEST_PINS = 30;

/* ------------------------------ Helpers ------------------------------- */

function recordPoint(record, prefix, fallbackLabel) {
  const coords = pointFromRecord(record, prefix);
  if (coords) return { ...coords, label: fallbackLabel };
  return fallbackLabel ? { label: fallbackLabel } : null;
}

/* ---------------------------- Component ------------------------------- */

const DriverMap = forwardRef(function DriverMap(
  {
    mode,
    city,
    activeTrip,
    completedTrip,
    requests = [],
    driverPhotoUrl = "",
    selfLocation: selfLocationProp = null, // optional — pass from parent to skip internal GPS
    boundsBottomPadding = 180,
    onRouteInfoChange,
  },
  ref
) {
  const cityKey = useMemo(
    () => normalizeCity(city || "zvishavane"),
    [city]
  );

  const [internalSelfLocation, setInternalSelfLocation] = useState(null);
  const [gpsNotice, setGpsNotice] = useState("");
  const [routeInfo, setRouteInfo] = useState(null);
  const [mapStatus, setMapStatus] = useState("loading");
  
  // NEW STATE: For the "Head South" banner
  const [directionStep, setDirectionStep] = useState(null);

  const mapApiRef = useRef(null);

  // Use parent-provided location if given (avoids double GPS watch).
  const selfLocation = selfLocationProp || internalSelfLocation;

  // Stable callback ref — parent re-renders won't trigger effect loops.
  const onRouteInfoChangeRef = useRef(onRouteInfoChange);
  useEffect(() => {
    onRouteInfoChangeRef.current = onRouteInfoChange;
  }, [onRouteInfoChange]);

  /* ------------- Internal GPS watch (skipped if prop given) ---------- */
  useEffect(() => {
    if (selfLocationProp) return; // parent is already watching
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = Number(pos.coords.accuracy || 9999);
        if (accuracy > GPS_ACCURACY_LIMIT_M) {
          setGpsNotice("Waiting for accurate driver GPS.");
          return;
        }
        setGpsNotice(accuracy > 250 ? "Approximate driver location" : "");
        setInternalSelfLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
          accuracy,
        });
      },
      (error) => setGpsNotice(error?.code === 1 ? "Enable location permission to share your driver position." : "Driver GPS unavailable. Check your location services."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [selfLocationProp]);

  /* -------------------- Forward route info to parent ----------------- */
  useEffect(() => {
    if (routeInfo) onRouteInfoChangeRef.current?.(routeInfo);
  }, [routeInfo]);

  /* ----------------------- Derived values ---------------------------- */
  const routeRecord = activeTrip || completedTrip || null;

  const pickup = routeRecord?.pickupName || (
    mode === "queue" ? "Requests nearby" : "Waiting for rider requests"
  );
  const dropoff = routeRecord?.dropoffName || (
    mode === "queue" ? "Tap a request to view route" : "Open request marketplace"
  );

  const driverLive = useMemo(
    () => selfLocation || toLatLng(activeTrip?.driverLive),
    [activeTrip?.driverLive?.lat, activeTrip?.driverLive?.lng, selfLocation]
  );

  const riderLive = useMemo(
    () => toLatLng(activeTrip?.riderLive),
    [activeTrip?.riderLive?.lat, activeTrip?.riderLive?.lng]
  );
  // -------------------------------

  const routeTargetMode =
    activeTrip?.status === "accepted" || activeTrip?.status === "arrived"
      ? "pickup"
      : "destination";

  const routeOrigin = useMemo(() => {
    if (driverLive && activeTrip) return { ...driverLive, label: "My live location" };
    if (activeTrip && routeTargetMode === "destination") return riderLive || recordPoint(activeTrip, "pickup", activeTrip.pickupName || pickup);
    if (completedTrip) return recordPoint(completedTrip, "pickup", completedTrip.pickupName || pickup);
    return null;
  }, [activeTrip, completedTrip, driverLive, pickup, riderLive, routeTargetMode]);

  const routeDestination = useMemo(() => {
    if (activeTrip && routeTargetMode === "pickup" && riderLive) {
      return { ...riderLive, label: "Rider live location" };
    }
    if (activeTrip && routeTargetMode === "pickup") {
      return recordPoint(activeTrip, "pickup", activeTrip.pickupName || pickup);
    }
    if (activeTrip) {
      return recordPoint(activeTrip, "dropoff", activeTrip.dropoffName || dropoff);
    }
    if (completedTrip) {
      return recordPoint(completedTrip, "dropoff", completedTrip.dropoffName || dropoff);
    }
    return null;
  }, [activeTrip, completedTrip, dropoff, pickup, riderLive, routeTargetMode]);

  /* ------------------------ Request pins ---------------------------- */
  // Only show request pins when we're actually free (queue / offline).
  const requestMarkers = useMemo(() => {
    if (activeTrip || completedTrip) return [];
    return requests
      .slice(0, MAX_REQUEST_PINS)
      .map((request) => ({
        ...request,
        lat: request.pickupLat,
        lng: request.pickupLng,
        type: "request",
        price: request.offerPrice,
        title: request.pickupName || "Rider request",
      }))
      .filter(
        (r) =>
          Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))
      );
  }, [requests, activeTrip, completedTrip]);

  /* ------------------ Imperative API for parent ---------------------- */
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapApiRef.current?.zoomIn?.(),
      zoomOut: () => mapApiRef.current?.zoomOut?.(),
      recenter: () => mapApiRef.current?.recenter?.(),
      getMap: () => mapApiRef.current?.getMap?.(),
    }),
    []
  );

  /* ---------------------------- Derived ------------------------------ */
  const showFallbackSkeleton = mapStatus !== "google";
  
  // Helper to check if route is active
  const showRoute = Boolean(
    (activeTrip || completedTrip) && routeOrigin && routeDestination
  );

  /* ---------------------------- Render ---------------------------- */
  return (
    <section className="nx-live-map driver-map">

      {/* THE HEAD SOUTH NAVIGATION BANNER */}
      {directionStep && showRoute && (
        <div className="nx-map-nav-banner">
          <div className="nx-map-nav-icon">
            {directionStep.maneuver === "turn-right" ? "➡️" : 
             directionStep.maneuver === "turn-left" ? "⬅️" : "⬆️"}
          </div>
          <div className="nx-map-nav-text">
            <strong>{directionStep.text}</strong>
            {directionStep.distance && <span>In {directionStep.distance}</span>}
          </div>
        </div>
      )}

      <div className="nx-map-grid" />
      <div className="nx-map-glow one" />
      <div className="nx-map-glow two" />

      {/* Fallback skeleton while Google loads — only when idle */}
      {showFallbackSkeleton ? (
        <>
          <svg
            className="nx-route-svg"
            viewBox="0 0 400 760"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="routeGradientDriver" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#06152b" />
                <stop offset="48%" stopColor="#0066ff" />
                <stop offset="100%" stopColor="#00d4ff" />
              </linearGradient>
            </defs>
            <path
              className="nx-route-shadow"
              d="M330 585 C230 520 300 430 187 355 C90 291 164 210 72 126"
            />
            <path
              className="nx-route-path"
              d="M330 585 C230 520 300 430 187 355 C90 291 164 210 72 126"
              stroke="url(#routeGradientDriver)"
            />
          </svg>
          <div className="nx-map-offline-hint" role="status">Map loading · Check your connection and Google Maps setup if the map does not appear.</div>
        </>
      ) : null}

      {gpsNotice ? <div className="nx-gps-hint" role="status">{gpsNotice}</div> : null}
      <LiveGoogleMap
        lightMap
        ref={mapApiRef}
        city={cityKey}
        role="driver"
        origin={routeOrigin}
        destination={routeDestination}
        driverLocation={driverLive}
        riderLocation={activeTrip ? riderLive : null}
        pickupLocation={recordPoint(routeRecord, "pickup", "Pickup")}
        dropoffLocation={recordPoint(routeRecord, "dropoff", "Drop-off")}
        markers={requestMarkers}
        driverPhotoUrl={
          driverPhotoUrl ||
          activeTrip?.driverPhotoUrl ||
          completedTrip?.driverPhotoUrl ||
          ""
        }
        riderPhotoUrl={activeTrip?.riderPhotoUrl || completedTrip?.riderPhotoUrl || ""}
        showRoute={showRoute}
        followTarget={showRoute ? "route" : "driver"}
        routePhase={
          completedTrip
            ? "completed"
            : activeTrip
            ? routeTargetMode === "pickup"
              ? "pickup"
              : "destination"
            : "request"
        }
        boundsBottomPadding={boundsBottomPadding}
        onRouteInfo={setRouteInfo}
        onMapStatus={setMapStatus}
        onDirectionStep={setDirectionStep}
      />

      {/* Map controls */}
      <div className="nx-map-control-stack">
        <button
          type="button"
          className="nx-map-control"
          onClick={() => mapApiRef.current?.zoomIn?.()}
          aria-label="Zoom in"
        >
          ＋
        </button>
        <button
          type="button"
          className="nx-map-control"
          onClick={() => mapApiRef.current?.recenter?.()}
          aria-label="Recenter"
        >
          ⌖
        </button>
        <button
          type="button"
          className="nx-map-control"
          onClick={() => mapApiRef.current?.zoomOut?.()}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </section>
  );
});

DriverMap.displayName = "DriverMap";

export default DriverMap;
