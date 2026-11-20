// File: src/components/rider/RiderMap.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import LiveGoogleMap from "../maps/LiveGoogleMap";
import {
  pointFromRecord,
  toLatLng,
} from "../../lib/googleMaps";
import {
  buildGpsPointFromPosition,
  getNearestCityFromPoint,
  normalizeCity,
} from "../../lib/nexrideCity";

const DRIVER_STALE_MS = 90_000;
const GPS_ACCURACY_LIMIT_M = 1200;

function recordPoint(record, prefix, fallbackLabel) {
  const coords = pointFromRecord(record, prefix);
  if (coords) return { ...coords, label: fallbackLabel };
  return fallbackLabel ? { label: fallbackLabel } : null;
}

export default function RiderMap({
  city,
  requestData,
  tripData,
  tripId,
  completedTrip,
  draftRoute = null,
  boundsBottomPadding = 180,
  onDriversCountChange,
  onRouteInfoChange,
  onCityDetected,
}) {
  const cityKey = normalizeCity(city || "zvishavane");

  const [drivers, setDrivers] = useState([]);
  const [riderCurrentLocation, setRiderCurrentLocation] = useState(null);
  const [gpsNotice, setGpsNotice] = useState("");
  const [routeInfo, setRouteInfo] = useState(null);
  const [mapStatus, setMapStatus] = useState("loading");

  const onDriversCountChangeRef = useRef(onDriversCountChange);
  const onRouteInfoChangeRef = useRef(onRouteInfoChange);
  const onCityDetectedRef = useRef(onCityDetected);

  useEffect(() => { onDriversCountChangeRef.current = onDriversCountChange; }, [onDriversCountChange]);
  useEffect(() => { onRouteInfoChangeRef.current = onRouteInfoChange; }, [onRouteInfoChange]);
  useEffect(() => { onCityDetectedRef.current = onCityDetected; }, [onCityDetected]);

  const lastAnnouncedCityRef = useRef("");
  const mapApiRef = useRef(null);

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
          if (!seen) return false;
          return now - seen <= DRIVER_STALE_MS;
        });

      setDrivers(fresh);
      onDriversCountChangeRef.current?.(fresh.length);
    });

    return () => unsub();
  }, [cityKey]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let active = true;
    let latestTimestamp = 0;

    function receivePosition(position) {
      if (!active || position.timestamp < latestTimestamp) return;
      const point = buildGpsPointFromPosition(position);
      if (!point) return;

      latestTimestamp = position.timestamp;
      const detected = point.accuracy <= GPS_ACCURACY_LIMIT_M ? getNearestCityFromPoint(point) : null;
      const detectedKey = detected?.cityKey || "";
      if (detectedKey && detectedKey !== lastAnnouncedCityRef.current) {
        lastAnnouncedCityRef.current = detectedKey;
        onCityDetectedRef.current?.(detectedKey, detected);
      }
      setGpsNotice(point.accuracy > 250 ? "Showing approximate location while GPS improves." : "");
      setRiderCurrentLocation({ ...point, city: detectedKey || cityKey, updatedAt: position.timestamp });
    }

    const gps = navigator.geolocation;
    gps.getCurrentPosition(receivePosition, () => {}, { maximumAge: 15000, timeout: 5000 });
    const watchId = gps.watchPosition(
      receivePosition,
      (error) => {
        if (!active) return;
        setGpsNotice(error?.code === 1 ? "Enable location to show your rider marker." : "Waiting for an updated GPS fix.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      active = false;
      gps.clearWatch(watchId);
    };
  }, [cityKey]);

  useEffect(() => {
    if (routeInfo) onRouteInfoChangeRef.current?.(routeInfo);
  }, [routeInfo]);

  const routeRecord = tripData || requestData || completedTrip || draftRoute || null;
  const pickup = routeRecord?.pickupName || "My live location";
  const dropoff = routeRecord?.dropoffName || "Choose destination";


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
  const sharedRiderLocation = toLatLng(tripData?.riderLive);
  const riderLive = riderCurrentLocation || sharedRiderLocation;
  const riderId = tripData?.riderId;
  const sharingLocation = ["accepted", "arrived", "picked", "enroute"].includes(tripData?.status);
  const lastSharedFix = useRef("");

  useEffect(() => {
    if (!tripId || !sharingLocation || !riderCurrentLocation || !riderId || auth.currentUser?.uid !== riderId) return;
    const fix = `${tripId}:${riderCurrentLocation.updatedAt}`;
    if (lastSharedFix.current === fix) return;
    lastSharedFix.current = fix;
    const { lat, lng, heading, accuracy, city, updatedAt } = riderCurrentLocation;
    update(ref(db, `activeTrips/${tripId}/riderLive`), { lat, lng, heading, accuracy, city, updatedAt })
      .catch(() => {
        if (lastSharedFix.current === fix) lastSharedFix.current = "";
      });
  }, [riderCurrentLocation, riderId, sharingLocation, tripId]);

  const routeTargetMode =
    tripData?.status === "accepted" || tripData?.status === "arrived"
      ? "pickup"
      : "destination";
  const isCompletedMap = !tripData && completedTrip;

  const mapOrigin = useMemo(() => {
    if (tripData && driverLive) return { ...driverLive, label: "Driver live location" };
    if (tripData && routeTargetMode === "pickup") return null;
    if (tripData) return riderLive || recordPoint(tripData, "pickup", tripData.pickupName || pickup);
    if (completedTrip) return recordPoint(completedTrip, "pickup", completedTrip.pickupName || pickup);
    if (requestData) return recordPoint(requestData, "pickup", requestData?.pickupName || pickup) || riderLive;
    if (draftRoute?.pickupCoords) return { ...draftRoute.pickupCoords, label: draftRoute.pickupName || "My live location" };
    return riderLive || recordPoint(draftRoute, "pickup", draftRoute?.pickupName || pickup);
  }, [completedTrip, draftRoute, driverLive, pickup, requestData, riderLive, routeTargetMode, tripData]);

  const mapDestination = useMemo(() => {
    if (tripData && routeTargetMode === "pickup") return riderLive || recordPoint(tripData, "pickup", tripData.pickupName || pickup);
    if (tripData) return recordPoint(tripData, "dropoff", tripData.dropoffName || dropoff);
    if (completedTrip) return recordPoint(completedTrip, "dropoff", completedTrip.dropoffName || dropoff);
    if (requestData) return recordPoint(requestData, "dropoff", requestData?.dropoffName || dropoff);
    
    if (draftRoute?.dropoffCoords) return { ...draftRoute.dropoffCoords, label: draftRoute.dropoffName || dropoff };
    return null; 
  }, [completedTrip, draftRoute, dropoff, pickup, requestData, riderLive, routeTargetMode, tripData]);

  const showFallbackSkeleton = mapStatus !== "google";

  const zoomIn = () => mapApiRef.current?.zoomIn?.();
  const zoomOut = () => mapApiRef.current?.zoomOut?.();
  const recenter = () => mapApiRef.current?.recenter?.();

  const showRoute = Boolean(
    mapOrigin &&
    mapDestination &&
    (requestData || tripData || completedTrip || draftRoute?.dropoffCoords)
  );

  return (
    <section className="nx-live-map rider-map">
      
      {showFallbackSkeleton ? (
        <>
          <svg className="nx-route-svg" viewBox="0 0 400 760" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="routeGradientRider" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="45%" stopColor="#0066ff" />
                <stop offset="100%" stopColor="#06152b" />
              </linearGradient>
            </defs>
            <path className="nx-route-shadow" d="M76 590 C176 520 94 430 207 355 C316 283 236 205 328 128" />
            <path className="nx-route-path" d="M76 590 C176 520 94 430 207 355 C316 283 236 205 328 128" stroke="url(#routeGradientRider)" />
          </svg>
          <div className="nx-map-offline-hint">Map preview · Enable GPS and Google Maps to view your live position</div>
        </>
      ) : null}

      {gpsNotice ? <div className="nx-gps-hint" role="status">{gpsNotice}</div> : null}
      <LiveGoogleMap
        lightMap
        ref={mapApiRef}
        city={cityKey}
        role="rider"
        origin={mapOrigin}
        destination={mapDestination}
        riderLocation={riderLive}
        driverLocation={tripData ? driverLive : null}
        pickupLocation={recordPoint(routeRecord, "pickup", "Pickup")}
        dropoffLocation={recordPoint(routeRecord, "dropoff", "Drop-off")}
        nearbyDrivers={tripData ? drivers.filter(d => d.id !== tripData.driverId) : drivers}
        showRoute={showRoute}
        cameraFollow={true}
        followTarget={showRoute ? "route" : "rider"}
        routePhase={isCompletedMap ? "completed" : tripData ? routeTargetMode : "request"}
        boundsBottomPadding={boundsBottomPadding}
        onRouteInfo={setRouteInfo}
        onMapStatus={setMapStatus}
      />

      <div className="nx-map-control-stack">
        <button type="button" className="nx-map-control" onClick={zoomIn} aria-label="Zoom in">＋</button>
        <button type="button" className="nx-map-control" onClick={recenter} aria-label="Recenter map">⌖</button>
        <button type="button" className="nx-map-control" onClick={zoomOut} aria-label="Zoom out">−</button>
      </div>
    </section>
  );
}
