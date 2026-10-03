// File: src/components/rider/RiderMap.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../../lib/firebase";
import LiveGoogleMap from "../maps/LiveGoogleMap";
import {
  googleMapsDirectionsUrl,
  pointFromRecord,
  toLatLng,
} from "../../lib/googleMaps";
import {
  buildGpsPointFromPosition,
  getNearestCityFromPoint,
  normalizeCity,
} from "../../lib/nexrideCity";

/* ------------------------------ Constants ----------------------------- */

/** Drivers are considered stale if no heartbeat within this window. */
const DRIVER_STALE_MS = 90_000;

/** Minimum GPS accuracy (meters) to trust for city detection. */
const GPS_ACCURACY_LIMIT_M = 250;

function modeCopy(mode) {
  switch (mode) {
    case "request": return "Where to?";
    case "waiting": return "Searching";
    case "offers": return "Offers ready";
    case "trip": return "Trip live";
    case "completed": return "Completed";
    default: return "Live";
  }
}

function recordPoint(record, prefix, fallbackLabel) {
  const coords = pointFromRecord(record, prefix);
  if (coords) return { ...coords, label: fallbackLabel };
  return fallbackLabel ? { label: fallbackLabel } : null;
}

/* ---------------------------- Component ------------------------------- */

export default function RiderMap({
  mode,
  city,
  requestData,
  tripData,
  completedTrip,
  draftRoute = null,
  viewCount = 0,
  offersCount = 0,
  boundsBottomPadding = 180,
  onDriversCountChange,
  onRouteInfoChange,
  onCityDetected,
}) {
  const cityKey = normalizeCity(city || "zvishavane");

  const [drivers, setDrivers] = useState([]);
  const [riderCurrentLocation, setRiderCurrentLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [mapStatus, setMapStatus] = useState("loading");

  /* -------- Stable callback refs (no re-subscribes on parent rerender) --- */
  const onDriversCountChangeRef = useRef(onDriversCountChange);
  const onRouteInfoChangeRef = useRef(onRouteInfoChange);
  const onCityDetectedRef = useRef(onCityDetected);

  useEffect(() => { onDriversCountChangeRef.current = onDriversCountChange; }, [onDriversCountChange]);
  useEffect(() => { onRouteInfoChangeRef.current = onRouteInfoChange; }, [onRouteInfoChange]);
  useEffect(() => { onCityDetectedRef.current = onCityDetected; }, [onCityDetected]);

  /** Remember the last city we told the parent about — avoids spamming writes. */
  const lastAnnouncedCityRef = useRef("");

  /** Optional ref for map control commands (zoom/recenter). */
  const mapApiRef = useRef(null);

  /* -------------------- Online drivers subscription ------------------- */
  useEffect(() => {
    if (!cityKey) return;
    const node = ref(db, `driversOnline/${cityKey}`);

    const unsub = onValue(node, (snap) => {
      const now = Date.now();
      const data = snap.val() || {};

      const fresh = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .filter((item) => {
          if (!item.online) return false;
          if (!Number.isFinite(Number(item.lat))) return false;
          if (!Number.isFinite(Number(item.lng))) return false;
          const seen = Number(item.lastSeen || item.updatedAt || 0);
          if (!seen) return true;
          return now - seen <= DRIVER_STALE_MS;
        });

      setDrivers(fresh);
      onDriversCountChangeRef.current?.(fresh.length);
    });

    return () => unsub();
  }, [cityKey]);

  /* ------------- Rider GPS watch (with city-change guard) ------------- */
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = Number(pos.coords.accuracy || 9999);
        if (accuracy > GPS_ACCURACY_LIMIT_M) return;

        const gpsPoint = buildGpsPointFromPosition(pos);
        if (!gpsPoint) return;

        const detected = getNearestCityFromPoint(gpsPoint);
        const detectedKey = detected?.cityKey || "";

        if (detectedKey && detectedKey !== lastAnnouncedCityRef.current) {
          lastAnnouncedCityRef.current = detectedKey;
          onCityDetectedRef.current?.(detectedKey, detected);
        }

        setRiderCurrentLocation({
          lat: gpsPoint.lat,
          lng: gpsPoint.lng,
          heading: gpsPoint.heading,
          accuracy,
          city: detectedKey || cityKey,
          label: "My live location",
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [cityKey]);

  /* ------------------- Report route info to parent -------------------- */
  useEffect(() => {
    if (routeInfo) onRouteInfoChangeRef.current?.(routeInfo);
  }, [routeInfo]);

  /* -------------------------- Derived data ---------------------------- */
  const routeRecord =
    tripData || requestData || completedTrip || draftRoute || null;

  const pickup = routeRecord?.pickupName || "My live location";
  const dropoff = routeRecord?.dropoffName || "Choose destination";
  const activeDriver =
    tripData?.driverName || completedTrip?.driverName || "Nearby drivers";

  /* ----- Memoized by lat/lng VALUES, not object identity ----- */
  const tripDriverLive = useMemo(
    () => toLatLng(tripData?.driverLive),
    [tripData?.driverLive?.lat, tripData?.driverLive?.lng]
  );

  const matchedOnlineDriver = useMemo(
    () =>
      tripData?.driverId
        ? drivers.find(
            (driver) =>
              driver.id === tripData.driverId ||
              driver.driverId === tripData.driverId
          ) || null
        : null,
    [drivers, tripData?.driverId]
  );

  const matchedDriverLatLng = useMemo(
    () => toLatLng(matchedOnlineDriver),
    [matchedOnlineDriver?.lat, matchedOnlineDriver?.lng]
  );

  const driverLive = tripDriverLive || matchedDriverLatLng;

  const riderLive = useMemo(
    () => toLatLng(tripData?.riderLive) || riderCurrentLocation,
    [tripData?.riderLive?.lat, tripData?.riderLive?.lng, riderCurrentLocation]
  );

  const routeTargetMode =
    tripData?.status === "accepted" || tripData?.status === "arrived"
      ? "pickup"
      : "destination";
  const isCompletedMap = !tripData && completedTrip;

  const mapOrigin = useMemo(() => {
    if (tripData && driverLive)
      return { ...driverLive, label: "Driver live location" };
    if (tripData)
      return (
        riderLive ||
        recordPoint(tripData, "pickup", tripData.pickupName || pickup)
      );
    if (completedTrip)
      return recordPoint(completedTrip, "pickup", completedTrip.pickupName || pickup);
    if (requestData)
      return (
        recordPoint(requestData, "pickup", requestData?.pickupName || pickup) ||
        riderLive
      );
    if (draftRoute?.pickupCoords)
      return {
        ...draftRoute.pickupCoords,
        label: draftRoute.pickupName || "My live location",
      };
    return (
      riderLive ||
      recordPoint(draftRoute, "pickup", draftRoute?.pickupName || pickup)
    );
  }, [completedTrip, draftRoute, driverLive, pickup, requestData, riderLive, tripData]);

  const mapDestination = useMemo(() => {
    if (tripData && routeTargetMode === "pickup")
      return recordPoint(tripData, "pickup", tripData.pickupName || pickup);
    if (tripData)
      return recordPoint(tripData, "dropoff", tripData.dropoffName || dropoff);
    if (completedTrip)
      return recordPoint(completedTrip, "dropoff", completedTrip.dropoffName || dropoff);
    if (requestData)
      return recordPoint(requestData, "dropoff", requestData?.dropoffName || dropoff);
    if (draftRoute?.dropoffCoords)
      return {
        ...draftRoute.dropoffCoords,
        label: draftRoute.dropoffName || dropoff,
      };
    if (draftRoute?.dropoffName) return { label: draftRoute.dropoffName };
    return null;
  }, [completedTrip, draftRoute, dropoff, pickup, requestData, routeTargetMode, tripData]);

  const driverMarkers = useMemo(
    () =>
      drivers
        .map((driver) => ({
          ...driver,
          type: "driver",
          title: driver.name || "Driver",
          label: "",
        }))
        .filter(
          (driver) =>
            Number.isFinite(Number(driver.lat)) &&
            Number.isFinite(Number(driver.lng))
        ),
    [drivers]
  );

  const openMapsUrl = useMemo(() => {
    if (!mapOrigin || !mapDestination) return "";
    return googleMapsDirectionsUrl({
      origin: mapOrigin,
      destination: mapDestination,
      city: cityKey,
    });
  }, [cityKey, mapDestination, mapOrigin]);

  const isSearching = mode === "waiting";
  const isRequestMode = mode === "request";
  const showRouteCard = Boolean(
    requestData || tripData || completedTrip || draftRoute?.dropoffName
  );
  const showFallbackSkeleton = mapStatus !== "google" && !tripData;

  /* ------------------------- Map control wiring ----------------------- */
  const zoomIn = () => mapApiRef.current?.zoomIn?.();
  const zoomOut = () => mapApiRef.current?.zoomOut?.();
  const recenter = () => mapApiRef.current?.recenter?.();

  /* ---------------------------- Render ---------------------------- */
  return (
    <section className="nx-live-map rider-map">
      <div className="nx-map-grid" />
      <div className="nx-map-glow one" />
      <div className="nx-map-glow two" />

      {/* Fallback skeleton ONLY while Google loads and no trip is active */}
      {showFallbackSkeleton ? (
        <>
          <svg
            className="nx-route-svg"
            viewBox="0 0 400 760"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="routeGradientRider" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="45%" stopColor="#0066ff" />
                <stop offset="100%" stopColor="#06152b" />
              </linearGradient>
            </defs>
            <path
              className="nx-route-shadow"
              d="M76 590 C176 520 94 430 207 355 C316 283 236 205 328 128"
            />
            <path
              className="nx-route-path"
              d="M76 590 C176 520 94 430 207 355 C316 283 236 205 328 128"
              stroke="url(#routeGradientRider)"
            />
          </svg>

          <div
            className="nx-map-pin pickup"
            style={{ left: "18%", top: "76%" }}
          >
            ●
          </div>
          <div
            className="nx-map-pin destination"
            style={{ left: "80%", top: "16%" }}
          >
            ●
          </div>
        </>
      ) : null}

      <LiveGoogleMap
        ref={mapApiRef}
        city={cityKey}
        role="rider"
        origin={mapOrigin}
        destination={mapDestination}
        driverLocation={driverLive}
        riderLocation={riderLive}
        driverPhotoUrl={
          tripData?.driverPhotoUrl ||
          completedTrip?.driverPhotoUrl ||
          matchedOnlineDriver?.driverPhotoUrl ||
          ""
        }
        riderPhotoUrl={
          tripData?.riderPhotoUrl ||
          completedTrip?.riderPhotoUrl ||
          requestData?.riderPhotoUrl ||
          ""
        }
        markers={tripData || completedTrip ? [] : driverMarkers}
        showRoute={Boolean(
          mapOrigin &&
            mapDestination &&
            (requestData || tripData || completedTrip || draftRoute?.dropoffName)
        )}
        followTarget={
          tripData ? "driver" : mapDestination ? "route" : "rider"
        }
        routePhase={
          isCompletedMap
            ? "completed"
            : tripData
            ? routeTargetMode === "pickup"
              ? "pickup"
              : "destination"
            : "request"
        }
        boundsBottomPadding={boundsBottomPadding}
        onRouteInfo={setRouteInfo}
        onMapStatus={setMapStatus}
      />

      {/* Status card — hidden in request mode */}
      {!isRequestMode ? (
        <div
          className={`nx-map-card nx-map-status-card ${
            isSearching ? "is-searching" : ""
          }`}
        >
          <div>
            <h3>{modeCopy(mode)}</h3>
            <p>{activeDriver}</p>
          </div>
          {drivers.length > 0 ? (
            <div className="nx-map-chip">
              {drivers.length} nearby
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Route card */}
      {showRouteCard ? (
        <div className="nx-map-card nx-map-route-card">
          <div className="nx-route-mini-row">
            <span className="nx-dot nx-dot-pickup" />
            {pickup}
          </div>
          <div className="nx-route-mini-row">
            <span className="nx-dot nx-dot-destination" />
            {dropoff}
          </div>
          <div className="nx-map-metrics">
            <span>
              {routeInfo?.distanceText ||
                routeRecord?.distanceText ||
                "—"}
            </span>
            <span>
              {routeInfo?.durationText || routeRecord?.durationText || "—"}
            </span>
            <span>
              {completedTrip
                ? "Final route"
                : tripData
                ? routeTargetMode === "pickup"
                  ? "Driver to pickup"
                  : "To destination"
                : requestData
                ? `${viewCount} viewed`
                : "Preview"}
            </span>
            {requestData && !tripData ? (
              <span>
                {offersCount} offer{offersCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {openMapsUrl ? (
            <a
              className="nx-map-open-link"
              href={openMapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Map controls */}
      <div className="nx-map-control-stack">
        <button
          type="button"
          className="nx-map-control"
          onClick={zoomIn}
          aria-label="Zoom in"
        >
          ＋
        </button>
        <button
          type="button"
          className="nx-map-control"
          onClick={recenter}
          aria-label="Recenter map"
        >
          ⌖
        </button>
        <button
          type="button"
          className="nx-map-control"
          onClick={zoomOut}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </section>
  );
}
