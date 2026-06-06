// File: src/components/rider/RiderMap.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../../lib/firebase";
import LiveGoogleMap from "../maps/LiveGoogleMap";
import { cityLabel, googleMapsDirectionsUrl, pointFromRecord, toLatLng } from "../../lib/googleMaps";

function modeCopy(mode) {
  if (mode === "request") return "Choose pickup";
  if (mode === "waiting") return "Searching";
  if (mode === "offers") return "Offers ready";
  if (mode === "trip") return "Trip live";
  if (mode === "completed") return "Completed";
  return "Live";
}

function recordPoint(record, prefix, fallbackLabel) {
  const coords = pointFromRecord(record, prefix);
  if (coords) return { ...coords, label: fallbackLabel };
  return fallbackLabel ? { label: fallbackLabel } : null;
}

export default function RiderMap({ mode, city, requestData, tripData, viewCount = 0, offersCount = 0, onDriversCountChange, onRouteInfoChange }) {
  const cityKey = String(city || "harare").toLowerCase();
  const [drivers, setDrivers] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [mapStatus, setMapStatus] = useState("fallback");

  useEffect(() => {
    if (!cityKey) return;
    const node = ref(db, `driversOnline/${cityKey}`);
    const unsub = onValue(node, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .filter((item) => item.online);
      setDrivers(list);
      onDriversCountChange?.(list.length);
    });
    return () => unsub();
  }, [cityKey, onDriversCountChange]);

  useEffect(() => {
    if (routeInfo) onRouteInfoChange?.(routeInfo);
  }, [onRouteInfoChange, routeInfo]);

  const pickup = requestData?.pickupName || tripData?.pickupName || "Pickup location";
  const dropoff = requestData?.dropoffName || tripData?.dropoffName || "Destination";
  const activeDriver = tripData?.driverName || "Nearby drivers";
  const driverLive = toLatLng(tripData?.driverLive);

  const routeTargetMode = tripData?.status === "accepted" || tripData?.status === "arrived" ? "pickup" : "destination";

  const mapOrigin = useMemo(() => {
    if (tripData && driverLive) return { ...driverLive, label: "Driver live location" };
    if (tripData) return recordPoint(tripData, "pickup", tripData.pickupName || pickup);
    return recordPoint(requestData, "pickup", requestData?.pickupName || pickup);
  }, [driverLive, pickup, requestData, tripData]);

  const mapDestination = useMemo(() => {
    if (tripData && routeTargetMode === "pickup") return recordPoint(tripData, "pickup", tripData.pickupName || pickup);
    if (tripData) return recordPoint(tripData, "dropoff", tripData.dropoffName || dropoff);
    return recordPoint(requestData, "dropoff", requestData?.dropoffName || dropoff);
  }, [dropoff, pickup, requestData, routeTargetMode, tripData]);

  const driverMarkers = useMemo(
    () => drivers
      .map((driver) => ({ ...driver, type: "driver", title: driver.name || "Driver", label: "" }))
      .filter((driver) => Number.isFinite(Number(driver.lat)) && Number.isFinite(Number(driver.lng))),
    [drivers]
  );

  const openMapsUrl = useMemo(() => {
    if (!mapOrigin || !mapDestination) return "";
    return googleMapsDirectionsUrl({ origin: mapOrigin, destination: mapDestination, city: cityKey });
  }, [cityKey, mapDestination, mapOrigin]);

  const carPins = useMemo(
    () => [
      { left: "18%", top: "30%" },
      { left: "72%", top: "34%" },
      { left: "54%", top: "48%" },
      { left: "28%", top: "64%" },
      { left: "78%", top: "61%" },
      { left: "44%", top: "23%" },
    ],
    []
  );

  return (
    <section className="nx-live-map rider-map">
      <div className="nx-map-grid" />
      <div className="nx-map-glow one" />
      <div className="nx-map-glow two" />

      {mapStatus !== "google" ? (
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

      <div className="nx-map-pin pickup" style={{ left: "18%", top: "76%" }}>●</div>
      <div className="nx-map-pin destination" style={{ left: "80%", top: "16%" }}>●</div>

      {carPins.map((pin, index) => (
        <div key={index} className="nx-car-pin" style={{ ...pin, animationDelay: `${index * 220}ms` }}>🚘</div>
      ))}
        </>
      ) : null}

      <LiveGoogleMap
        city={cityKey}
        role="rider"
        origin={mapOrigin}
        destination={mapDestination}
        driverLocation={driverLive}
        markers={driverMarkers}
        showRoute={Boolean(mapOrigin && mapDestination && (requestData || tripData))}
        onRouteInfo={setRouteInfo}
        onMapStatus={setMapStatus}
      />

      <div className="nx-map-card nx-map-status-card">
        <div>
          <span className="nx-eyebrow">{cityLabel(cityKey)} live map</span>
          <h3>{modeCopy(mode)}</h3>
          <p>{activeDriver}</p>
        </div>
        <div className="nx-map-chip">{mapStatus === "google" ? "Google live" : `${drivers.length} online`}</div>
      </div>

      {(requestData || tripData) ? (
        <div className="nx-map-card nx-map-route-card">
          <div className="nx-route-mini-row"><span className="nx-dot nx-dot-pickup" />{pickup}</div>
          <div className="nx-route-mini-row"><span className="nx-dot nx-dot-destination" />{dropoff}</div>
          <div className="nx-map-metrics">
            <span>{routeInfo?.distanceText || requestData?.distanceText || tripData?.distanceText || "Distance loading"}</span>
            <span>{routeInfo?.durationText || requestData?.durationText || tripData?.durationText || "ETA loading"}</span>
            <span>{tripData ? (routeTargetMode === "pickup" ? "Driver to pickup" : "To destination") : `${viewCount} viewed`}</span>
            {!tripData ? <span>{offersCount} offers</span> : null}
          </div>
          {openMapsUrl ? (
            <a className="nx-map-open-link" href={openMapsUrl} target="_blank" rel="noreferrer">
              Open in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="nx-map-control-stack">
        <button className="nx-map-control">＋</button>
        <button className="nx-map-control">⌖</button>
        <button className="nx-map-control">−</button>
      </div>
    </section>
  );
}
