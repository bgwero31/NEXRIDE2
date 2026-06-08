// File: src/components/driver/DriverMap.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import LiveGoogleMap from "../maps/LiveGoogleMap";
import { cityLabel, googleMapsDirectionsUrl, pointFromRecord, toLatLng } from "../../lib/googleMaps";

function modeCopy(mode) {
  if (mode === "offline") return "Go online";
  if (mode === "queue") return "Requests near you";
  if (mode === "trip") return "Active trip";
  if (mode === "completed") return "Trip complete";
  return "Driver map";
}

function recordPoint(record, prefix, fallbackLabel) {
  const coords = pointFromRecord(record, prefix);
  if (coords) return { ...coords, label: fallbackLabel };
  return fallbackLabel ? { label: fallbackLabel } : null;
}

export default function DriverMap({ mode, city, activeTrip, requests = [] }) {
  const cityKey = String(city || "harare").toLowerCase();
  const [selfLocation, setSelfLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [mapStatus, setMapStatus] = useState("fallback");

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setSelfLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
      }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 20000, timeout: 12000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const pickup = activeTrip?.pickupName || requests[0]?.pickupName || "Waiting for rider requests";
  const dropoff = activeTrip?.dropoffName || requests[0]?.dropoffName || "Open request marketplace";
  const driverLive = toLatLng(activeTrip?.driverLive) || selfLocation;
  const riderLive = toLatLng(activeTrip?.riderLive);
  const routeTargetMode = activeTrip?.status === "accepted" || activeTrip?.status === "arrived" ? "pickup" : "destination";

  const routeOrigin = useMemo(() => {
    if (driverLive) return { ...driverLive, label: "My live location" };
    if (activeTrip) return recordPoint(activeTrip, "pickup", activeTrip.pickupName || pickup);
    return null;
  }, [activeTrip, driverLive, pickup]);

  const routeDestination = useMemo(() => {
    if (activeTrip && routeTargetMode === "pickup" && riderLive) return { ...riderLive, label: "Rider live location" };
    if (activeTrip && routeTargetMode === "pickup") return recordPoint(activeTrip, "pickup", activeTrip.pickupName || pickup);
    if (activeTrip) return recordPoint(activeTrip, "dropoff", activeTrip.dropoffName || dropoff);
    const first = requests[0];
    return first ? recordPoint(first, "pickup", first.pickupName || "Pickup") : null;
  }, [activeTrip, dropoff, pickup, requests, riderLive, routeTargetMode]);

  const requestMarkers = useMemo(
    () => requests
      .map((request) => ({
        ...request,
        lat: request.pickupLat,
        lng: request.pickupLng,
        type: "request",
        price: request.offerPrice,
        title: request.pickupName || "Rider request",
      }))
      .filter((request) => Number.isFinite(Number(request.lat)) && Number.isFinite(Number(request.lng))),
    [requests]
  );

  const openMapsUrl = useMemo(() => {
    if (!routeOrigin || !routeDestination) return "";
    return googleMapsDirectionsUrl({ origin: routeOrigin, destination: routeDestination, city: cityKey });
  }, [cityKey, routeDestination, routeOrigin]);

  return (
    <section className="nx-live-map driver-map">
      <div className="nx-map-grid" />
      <div className="nx-map-glow one" />
      <div className="nx-map-glow two" />

      <svg className="nx-route-svg" viewBox="0 0 400 760" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="routeGradientDriver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06152b" />
            <stop offset="48%" stopColor="#0066ff" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
        </defs>
        <path className="nx-route-shadow" d="M330 585 C230 520 300 430 187 355 C90 291 164 210 72 126" />
        <path className="nx-route-path" d="M330 585 C230 520 300 430 187 355 C90 291 164 210 72 126" stroke="url(#routeGradientDriver)" />
      </svg>

      {requests.slice(0, 5).map((request, index) => {
        const positions = [
          { left: "23%", top: "33%" },
          { left: "70%", top: "37%" },
          { left: "48%", top: "52%" },
          { left: "78%", top: "63%" },
          { left: "30%", top: "69%" },
        ];
        return (
          <div key={request.id || index} className="nx-rider-pin" style={positions[index]}>${Number(request.offerPrice || 0).toFixed(0)}</div>
        );
      })}

      <div className="nx-car-pin driver-self" style={{ left: "48%", top: "70%" }}>🚘</div>

      <LiveGoogleMap
        city={cityKey}
        role="driver"
        origin={routeOrigin}
        destination={routeDestination}
        driverLocation={driverLive}
        markers={requestMarkers}
        showRoute={Boolean(activeTrip && routeOrigin && routeDestination)}
        onRouteInfo={setRouteInfo}
        onMapStatus={setMapStatus}
      />

      <div className="nx-map-card nx-map-status-card">
        <div>
          <span className="nx-eyebrow">Driver command center</span>
          <h3>{modeCopy(mode)}</h3>
          <p>{cityLabel(cityKey)} • {requests.length} open request{requests.length === 1 ? "" : "s"}</p>
        </div>
        <div className="nx-map-chip">{mapStatus === "google" ? "Google live" : "NEXRIDE"}</div>
      </div>

      <div className="nx-map-card nx-map-route-card">
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-pickup" />{pickup}</div>
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-destination" />{dropoff}</div>
        <div className="nx-map-metrics">
          <span>{routeInfo?.distanceText || activeTrip?.distanceText || (mode === "trip" ? "Distance loading" : "Marketplace")}</span>
          <span>{routeInfo?.durationText || activeTrip?.durationText || `${requests.length} requests`}</span>
          <span>{mode === "trip" ? (routeTargetMode === "pickup" ? "Navigate to pickup" : "Navigate to destination") : "Live requests"}</span>
        </div>
        {openMapsUrl ? (
          <a className="nx-map-open-link" href={openMapsUrl} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        ) : null}
      </div>
    </section>
  );
}
