// File: src/components/maps/LiveGoogleMap.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildGoogleDirectionsPoint,
  fallbackRouteEstimate,
  getCityCenter,
  hasGoogleMapsApiKey,
  loadGoogleMapsApi,
  toLatLng,
} from "../../lib/googleMaps";

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#01050d" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#c5d7ea" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#01050d" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#0c213e" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#020916" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0b172a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#163158" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#123d78" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#00d4ff" }, { weight: 0.45 }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#10213a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000814" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function markerIcon(google, type = "default", heading = null) {
  const color =
    type === "pickup" ? "#00d4ff" :
    type === "destination" ? "#20e28a" :
    type === "driver" ? "#0066ff" :
    type === "rider" ? "#ffb020" :
    type === "request" ? "#ffb020" : "#ffffff";

  if (type === "driver") {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 6.2,
      rotation: cleanNumber(heading, 0),
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#eaffff",
      strokeWeight: 2.2,
    };
  }

  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: type === "request" ? 9 : 8,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2.5,
  };
}

function resolvePoint(value) {
  if (!value) return null;
  const coords = toLatLng(value);
  if (coords) return coords;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value.label) return value.label;
  return null;
}

function positionFromRouteLocation(location) {
  if (!location) return null;
  if (typeof location.lat === "function" && typeof location.lng === "function") {
    return { lat: location.lat(), lng: location.lng() };
  }
  return toLatLng(location);
}

function pointKey(point) {
  const coords = toLatLng(point);
  if (!coords) return typeof point === "string" ? point : point?.label || "";
  return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
}

function createHtmlOverlay(google, map, position, className, render, title = "", zIndex = 1000) {
  const point = toLatLng(position);
  if (!point) return null;

  const overlay = new google.maps.OverlayView();
  overlay.onAdd = function onAdd() {
    const div = document.createElement("div");
    div.className = className;
    div.style.position = "absolute";
    div.style.zIndex = String(zIndex);
    div.style.transform = "translate(-50%, -50%)";
    div.style.pointerEvents = "auto";
    if (title) div.title = title;
    render(div);
    this.div = div;
    this.getPanes().overlayMouseTarget.appendChild(div);
  };
  overlay.draw = function draw() {
    const projection = this.getProjection();
    if (!projection || !this.div) return;
    const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(point.lat, point.lng));
    if (!pixel) return;
    this.div.style.left = `${pixel.x}px`;
    this.div.style.top = `${pixel.y}px`;
  };
  overlay.onRemove = function onRemove() {
    if (this.div?.parentNode) this.div.parentNode.removeChild(this.div);
    this.div = null;
  };
  overlay.setMap(map);
  return overlay;
}

function renderCar(div, { heading = 0, photoUrl = "", label = "" } = {}) {
  const car = document.createElement("div");
  car.className = "nx-gmap-car-marker-inner";
  car.style.transform = `rotate(${cleanNumber(heading, 0)}deg)`;
  car.innerHTML = `
    <svg viewBox="0 0 64 64" aria-hidden="true" class="nx-gmap-car-svg">
      <path d="M18 39h28c3.8 0 7-3.1 7-7v-6.2c0-2.4-1.5-4.6-3.8-5.5l-7.7-3.2A17.5 17.5 0 0 0 34.8 16h-5.6c-2.3 0-4.6.5-6.7 1.4l-7.7 3.2a5.9 5.9 0 0 0-3.8 5.5V32c0 3.9 3.1 7 7 7Z" />
      <path d="M22 22h20l5.5 4H16.5L22 22Z" class="nx-gmap-car-window" />
      <circle cx="20" cy="40" r="4" />
      <circle cx="44" cy="40" r="4" />
      <path d="M32 5l6 9H26l6-9Z" class="nx-gmap-car-nose" />
    </svg>`;
  div.appendChild(car);

  if (photoUrl) {
    const badge = document.createElement("img");
    badge.className = "nx-gmap-car-photo";
    badge.src = photoUrl;
    badge.alt = "";
    div.appendChild(badge);
  }

  if (label) {
    const chip = document.createElement("span");
    chip.className = "nx-gmap-marker-label";
    chip.textContent = label;
    div.appendChild(chip);
  }
}

function renderPhoto(div, { photoUrl = "", fallback = "R", label = "" } = {}) {
  const frame = document.createElement("div");
  frame.className = "nx-gmap-photo-frame";
  if (photoUrl) {
    const img = document.createElement("img");
    img.src = photoUrl;
    img.alt = "";
    frame.appendChild(img);
  } else {
    frame.textContent = fallback;
  }
  div.appendChild(frame);
  if (label) {
    const chip = document.createElement("span");
    chip.className = "nx-gmap-marker-label";
    chip.textContent = label;
    div.appendChild(chip);
  }
}

function renderDestination(div) {
  const glow = document.createElement("div");
  glow.className = "nx-gmap-destination-glow";
  glow.innerHTML = `<span></span>`;
  div.appendChild(glow);
}

function routeCopy(phase) {
  if (phase === "pickup") return "Following pickup route";
  if (phase === "destination") return "Following destination route";
  if (phase === "completed") return "Final route summary";
  if (phase === "request") return "Preview route";
  return "Live follow";
}

export default function LiveGoogleMap({
  city = "harare",
  role = "rider",
  origin = null,
  destination = null,
  driverLocation = null,
  riderLocation = null,
  driverPhotoUrl = "",
  riderPhotoUrl = "",
  markers = [],
  showRoute = true,
  cameraFollow = true,
  followTarget = "driver",
  routePhase = "route",
  onRouteInfo,
  onMapStatus,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const routeArrowRef = useRef(null);
  const routeMarkerRefs = useRef([]);
  const markerRefs = useRef([]);
  const overlayRefs = useRef([]);
  const lastBoundsAtRef = useRef(0);
  const lastRouteFitKeyRef = useRef("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const center = useMemo(() => getCityCenter(city), [city]);
  const originPoint = useMemo(() => resolvePoint(origin), [origin]);
  const destinationPoint = useMemo(() => resolvePoint(destination), [destination]);
  const driverPoint = useMemo(() => toLatLng(driverLocation), [driverLocation]);
  const riderPoint = useMemo(() => toLatLng(riderLocation), [riderLocation]);

  useEffect(() => {
    let cancelled = false;

    if (!hasGoogleMapsApiKey()) {
      setError("Missing Google Maps key");
      onMapStatus?.("fallback");
      return;
    }

    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !mapNodeRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapNodeRef.current, {
            center,
            zoom: 16,
            minZoom: 4,
            maxZoom: 21,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: "greedy",
            styles: mapStyles,
            backgroundColor: "#01050d",
            heading: 0,
            tilt: 0,
          });

          directionsRendererRef.current = new google.maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#12cfff",
              strokeOpacity: 0.98,
              strokeWeight: 8,
              zIndex: 50,
            },
          });
        }

        setReady(true);
        setError("");
        onMapStatus?.("google");
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setError("Google Maps failed to load");
          onMapStatus?.("fallback");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [center, onMapStatus]);

  useEffect(() => {
    if (!ready || !mapRef.current || typeof window === "undefined" || !window.google?.maps) return;
    if (originPoint || destinationPoint || driverPoint || riderPoint || markers.length) return;
    mapRef.current.setCenter(center);
  }, [ready, center, originPoint, destinationPoint, driverPoint, riderPoint, markers.length]);

  useEffect(() => {
    if (!ready || !mapRef.current || typeof window === "undefined" || !window.google?.maps) return;
    const google = window.google;
    const map = mapRef.current;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];

    const addMarker = ({ position, type, title, label, heading }) => {
      const point = toLatLng(position);
      if (!point) return null;
      const marker = new google.maps.Marker({
        position: point,
        map,
        title: title || label || type,
        optimized: false,
        zIndex: type === "pickup" || type === "destination" ? 800 : 700,
        label: label ? { text: String(label), color: "#ffffff", fontWeight: "900", fontSize: "11px" } : undefined,
        icon: markerIcon(google, type, heading),
      });
      markerRefs.current.push(marker);
      return marker;
    };

    addMarker({ position: originPoint, type: "pickup", title: routePhase === "pickup" ? "Pickup" : "Route start" });

    if (destinationPoint) {
      const destinationOverlay = createHtmlOverlay(
        google,
        map,
        destinationPoint,
        "nx-gmap-destination-marker",
        renderDestination,
        routePhase === "pickup" ? "Pickup" : "Destination",
        970
      );
      if (destinationOverlay) overlayRefs.current.push(destinationOverlay);
    }

    if (driverPoint) {
      const driverOverlay = createHtmlOverlay(
        google,
        map,
        driverPoint,
        "nx-gmap-car-marker",
        (div) => renderCar(div, {
          heading: driverLocation?.heading,
          photoUrl: driverPhotoUrl,
          label: role === "driver" ? "You" : "Driver",
        }),
        role === "driver" ? "Your live car" : "Driver live car",
        1005
      );
      if (driverOverlay) overlayRefs.current.push(driverOverlay);
    }

    if (riderPoint) {
      const riderOverlay = createHtmlOverlay(
        google,
        map,
        riderPoint,
        "nx-gmap-rider-marker",
        (div) => renderPhoto(div, {
          photoUrl: riderPhotoUrl,
          fallback: role === "rider" ? "You" : "R",
          label: role === "rider" ? "You" : "Rider",
        }),
        role === "rider" ? "Your live pickup" : "Rider live pickup",
        1000
      );
      if (riderOverlay) overlayRefs.current.push(riderOverlay);
    }

    markers.forEach((marker) => {
      const point = toLatLng(marker);
      if (!point) return;

      if (marker.type === "driver") {
        const driverOverlay = createHtmlOverlay(
          google,
          map,
          point,
          "nx-gmap-car-marker is-nearby",
          (div) => renderCar(div, {
            heading: marker.heading,
            photoUrl: marker.driverPhotoUrl || marker.photoUrl || "",
            label: "",
          }),
          marker.title || marker.name || "Nearby driver",
          880
        );
        if (driverOverlay) overlayRefs.current.push(driverOverlay);
        return;
      }

      addMarker({
        position: marker,
        type: marker.type || "default",
        title: marker.title || marker.label,
        label: marker.price ? `$${Number(marker.price || 0).toFixed(0)}` : marker.label,
        heading: marker.heading,
      });
    });

    const bounds = new google.maps.LatLngBounds();
    const allPoints = [originPoint, destinationPoint, driverPoint, riderPoint, ...markers].map(toLatLng).filter(Boolean);
    allPoints.forEach((point) => bounds.extend(point));
    if (!showRoute && allPoints.length > 1 && !bounds.isEmpty()) map.fitBounds(bounds, 76);
  }, [ready, originPoint, destinationPoint, driverPoint, riderPoint, markers, role, showRoute, driverLocation?.heading, driverPhotoUrl, riderPhotoUrl, routePhase]);

  useEffect(() => {
    if (!ready || !cameraFollow || !mapRef.current || typeof window === "undefined" || !window.google?.maps) return;

    const target =
      followTarget === "rider" ? riderPoint :
      followTarget === "origin" ? toLatLng(originPoint) :
      followTarget === "destination" ? toLatLng(destinationPoint) :
      followTarget === "route" ? null :
      driverPoint || riderPoint || toLatLng(originPoint) || toLatLng(destinationPoint);

    if (!target) return;

    const currentZoom = mapRef.current.getZoom?.() || 14;
    const desiredZoom = routePhase === "pickup" || routePhase === "destination" ? 18 : 16;
    const heading = cleanNumber(driverLocation?.heading, 0);

    if (typeof mapRef.current.moveCamera === "function") {
      mapRef.current.moveCamera({
        center: target,
        zoom: Math.max(currentZoom, desiredZoom),
        heading: Number.isFinite(heading) ? heading : 0,
        tilt: routePhase === "pickup" || routePhase === "destination" ? 45 : 0,
      });
    } else {
      mapRef.current.panTo(target);
      if (currentZoom < desiredZoom) mapRef.current.setZoom(desiredZoom);
      if (Number.isFinite(heading) && typeof mapRef.current.setHeading === "function") mapRef.current.setHeading(heading);
      if (typeof mapRef.current.setTilt === "function") mapRef.current.setTilt(routePhase === "pickup" || routePhase === "destination" ? 45 : 0);
    }
  }, [cameraFollow, destinationPoint, driverPoint, followTarget, originPoint, ready, riderPoint, routePhase]);

  useEffect(() => {
    if (!ready || !showRoute || !originPoint || !destinationPoint || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    let cancelled = false;
    const google = window.google;
    const service = new google.maps.DirectionsService();
    const routeFitKey = `${routePhase}:${pointKey(destinationPoint)}`;

    service.route(
      {
        origin: buildGoogleDirectionsPoint(google, originPoint, city),
        destination: buildGoogleDirectionsPoint(google, destinationPoint, city),
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
        provideRouteAlternatives: false,
        region: "ZW",
      },
      (result, status) => {
        if (cancelled) return;

        routeArrowRef.current?.setMap(null);
        routeArrowRef.current = null;
        routeMarkerRefs.current.forEach((marker) => marker.setMap(null));
        routeMarkerRefs.current = [];

        if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
          directionsRendererRef.current?.setDirections(result);

          const overviewPath = result.routes[0].overview_path || [];
          routeArrowRef.current = new google.maps.Polyline({
            path: overviewPath,
            map: mapRef.current,
            strokeOpacity: 0,
            zIndex: 90,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 5,
                  fillColor: "#13d9ff",
                  fillOpacity: 1,
                  strokeColor: "#eaffff",
                  strokeWeight: 1.6,
                },
                offset: "10%",
                repeat: "58px",
              },
            ],
          });

          const leg = result.routes[0].legs[0];
          const startCoords = positionFromRouteLocation(leg.start_location);
          const endCoords = positionFromRouteLocation(leg.end_location);

          if (mapRef.current) {
            if (startCoords) {
              routeMarkerRefs.current.push(new google.maps.Marker({
                position: startCoords,
                map: mapRef.current,
                title: routePhase === "pickup" ? "Driver live location" : "Route start",
                optimized: false,
                zIndex: 930,
                icon: markerIcon(google, routePhase === "pickup" || role === "driver" ? "driver" : "pickup", driverLocation?.heading),
                label: routePhase === "pickup" && role === "driver" ? { text: "ME", color: "#ffffff", fontWeight: "900", fontSize: "11px" } : undefined,
              }));
            }

            const now = Date.now();
            const shouldFitRoute = routeFitKey !== lastRouteFitKeyRef.current || routePhase === "completed";
            if (shouldFitRoute && now - lastBoundsAtRef.current > 700) {
              const bounds = new google.maps.LatLngBounds();
              overviewPath.forEach((point) => bounds.extend(point));
              if (!bounds.isEmpty()) {
                mapRef.current.fitBounds(bounds, {
                  top: 112,
                  left: 48,
                  right: 48,
                  bottom: routePhase === "completed" ? 190 : 232,
                });
              }
              lastBoundsAtRef.current = now;
              lastRouteFitKeyRef.current = routeFitKey;
            }
          }

          onRouteInfo?.({
            distanceText: leg.distance?.text || "",
            durationText: leg.duration_in_traffic?.text || leg.duration?.text || "",
            distanceMeters: leg.distance?.value || null,
            durationSeconds: leg.duration_in_traffic?.value || leg.duration?.value || null,
            startAddress: leg.start_address || "",
            endAddress: leg.end_address || "",
            pickupCoords: startCoords,
            dropoffCoords: endCoords,
            source: "google",
            phase: routePhase,
          });
          return;
        }

        directionsRendererRef.current?.set("directions", null);
        const estimate = fallbackRouteEstimate(originPoint, destinationPoint);
        if (estimate) onRouteInfo?.({ ...estimate, phase: routePhase });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [ready, showRoute, originPoint, destinationPoint, city, onRouteInfo, routePhase, role, driverLocation?.heading]);

  if (!hasGoogleMapsApiKey()) return null;

  return (
    <div className="nx-google-map-layer">
      <div ref={mapNodeRef} className="nx-google-map-canvas" />
      <div className="nx-live-follow-badge">⌖ {routeCopy(routePhase)}</div>
      {!ready ? (
        <div className="nx-google-map-loading">
          <strong>Loading Google Maps...</strong>
          <span>Preparing live route, distance and ETA.</span>
        </div>
      ) : null}
      {error ? (
        <div className="nx-google-map-warning">
          <strong>{error}</strong>
          <span>Fallback map remains active.</span>
        </div>
      ) : null}
    </div>
  );
}
