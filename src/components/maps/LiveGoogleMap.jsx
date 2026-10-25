// File: src/components/maps/LiveGoogleMap.jsx

"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildGoogleDirectionsPoint, fallbackRouteEstimate, getCityCenter, hasGoogleMapsApiKey, loadGoogleMapsApi, toLatLng } from "../../lib/googleMaps";

const CAMERA_THROTTLE_MS = 400;
const BOUNDS_THROTTLE_MS = 700;
const USER_INTERACTION_PAUSE_MS = 4000;

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#edf2f7" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "on" }, { saturation: -45 }, { lightness: 18 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#667085" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d7dee8" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef3f8" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#e6edf5" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e8edf3" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7b8794" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dbe5f0" }, { weight: 1.1 }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#bcd3ff" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#7da7ff" }, { weight: 1.6 }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f8fbff" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d9e9ff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7a93ad" }] },
];

function cleanNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function resolvePoint(value) { if (!value) return null; const coords = toLatLng(value); if (coords) return coords; if (typeof value === "string" && value.trim()) return value.trim(); if (value.label) return value.label; return null; }
function pointKey(point) { const coords = toLatLng(point); if (!coords) return typeof point === "string" ? point : point?.label || ""; return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`; }

function createHtmlOverlay(google, map, position, className, render, title = "", zIndex = 1000) {
  const point = toLatLng(position); if (!point) return null;
  const overlay = new google.maps.OverlayView();
  overlay.onAdd = function onAdd() {
    const div = document.createElement("div"); div.className = className; div.style.position = "absolute"; div.style.zIndex = String(zIndex); div.style.transform = "translate(-50%, -50%)"; div.style.pointerEvents = "none"; if (title) div.title = title; render(div); this.div = div; this.getPanes().overlayMouseTarget.appendChild(div);
  };
  overlay.draw = function draw() { const projection = this.getProjection(); if (!projection || !this.div) return; const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(point.lat, point.lng)); if (!pixel) return; this.div.style.left = `${pixel.x}px`; this.div.style.top = `${pixel.y}px`; };
  overlay.onRemove = function onRemove() { if (this.div?.parentNode) this.div.parentNode.removeChild(this.div); this.div = null; };
  overlay.setMap(map); return overlay;
}

function renderCar(div, { heading = 0, photoUrl = "", label = "" } = {}) {
  const arrow = document.createElement("div"); arrow.className = "nx-gmap-arrow-marker"; arrow.style.transform = `rotate(${cleanNumber(heading, 0)}deg)`;
  arrow.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true" class="nx-gmap-arrow-svg"><ellipse cx="32" cy="58" rx="10" ry="3" fill="#06152b" opacity="0.22"/><circle cx="32" cy="32" r="22" fill="#ffffff"/><path d="M32 12 L48 48 L32 40 L16 48 Z" fill="#0b6dff" stroke="#0b6dff" stroke-width="1" stroke-linejoin="round" /><path d="M32 12 L46 44" stroke="#00d4ff" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.75" /></svg>`;
  div.appendChild(arrow);
  if (photoUrl) { const badge = document.createElement("img"); badge.className = "nx-gmap-car-photo"; badge.src = photoUrl; badge.alt = ""; div.appendChild(badge); }
  if (label) { const chip = document.createElement("span"); chip.className = "nx-gmap-marker-label"; chip.textContent = label; div.appendChild(chip); }
}

function renderRiderDot(div) {
  const dot = document.createElement("div"); dot.className = "nx-gmap-rider-dot";
  dot.innerHTML = `<div class="nx-rider-pulse"></div><div class="nx-rider-core"></div>`;
  div.appendChild(dot);
}

const LiveGoogleMap = forwardRef(function LiveGoogleMap(
  { city = "harare", role = "rider", origin = null, destination = null, driverLocation = null, riderLocation = null, driverPhotoUrl = "", showRoute = true, cameraFollow = true, routePhase = "route", boundsBottomPadding = 220, onRouteInfo, onMapStatus, onDirectionStep },
  ref
) {
  const mapNodeRef = useRef(null); const mapRef = useRef(null); const directionsRendererRef = useRef(null); const fallbackPolylineRef = useRef(null); const overlayRefs = useRef([]);
  const lastBoundsAtRef = useRef(0); const lastRouteFitKeyRef = useRef(""); const lastCameraAtRef = useRef(0); const lastCameraKeyRef = useRef(""); const userInteractionUntilRef = useRef(0);

  const onRouteInfoRef = useRef(onRouteInfo); const onMapStatusRef = useRef(onMapStatus); const onDirectionStepRef = useRef(onDirectionStep);
  useEffect(() => { onRouteInfoRef.current = onRouteInfo; }, [onRouteInfo]);
  useEffect(() => { onMapStatusRef.current = onMapStatus; }, [onMapStatus]);
  useEffect(() => { onDirectionStepRef.current = onDirectionStep; }, [onDirectionStep]);

  const [ready, setReady] = useState(false); const [error, setError] = useState("");
  const center = useMemo(() => getCityCenter(city), [city]);
  const originPoint = useMemo(() => resolvePoint(origin), [origin]);
  const destinationPoint = useMemo(() => resolvePoint(destination), [destination]);
  const driverPoint = useMemo(() => toLatLng(driverLocation), [driverLocation]);
  const riderPoint = useMemo(() => toLatLng(riderLocation), [riderLocation]);

  useImperativeHandle(ref, () => ({
      zoomIn: () => { const map = mapRef.current; if (!map) return; userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS; map.setZoom(Math.min(21, (map.getZoom() || 14) + 1)); },
      zoomOut: () => { const map = mapRef.current; if (!map) return; userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS; map.setZoom(Math.max(4, (map.getZoom() || 14) - 1)); },
      recenter: () => { const map = mapRef.current; if (!map) return; userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS; const target = driverPoint || riderPoint || toLatLng(originPoint) || center; if (target) map.panTo(target); },
      getMap: () => mapRef.current,
  }), [center, driverPoint, originPoint, riderPoint]);

  useEffect(() => {
    let cancelled = false;
    if (!hasGoogleMapsApiKey()) { setError("Missing Google Maps key"); onMapStatusRef.current?.("fallback"); return; }
    loadGoogleMapsApi().then((google) => {
        if (cancelled || !mapNodeRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapNodeRef.current, { center, zoom: 15, minZoom: 4, maxZoom: 21, disableDefaultUI: true, clickableIcons: false, gestureHandling: "greedy", styles: mapStyles, backgroundColor: "#f5f7fb", heading: 0, tilt: 0 });
          directionsRendererRef.current = new google.maps.DirectionsRenderer({ map: mapRef.current, suppressMarkers: true, preserveViewport: true, polylineOptions: { strokeColor: "#6100FF", strokeOpacity: 1, strokeWeight: 8, zIndex: 50 } });
        }
        setReady(true); setError(""); onMapStatusRef.current?.("google");
    }).catch((err) => { if (!cancelled) { setError("Google Maps failed to load"); onMapStatusRef.current?.("fallback"); } });
    return () => { cancelled = true; };
  }, [center]);

  useEffect(() => { return () => { try { overlayRefs.current.forEach((o) => o.setMap(null)); fallbackPolylineRef.current?.setMap(null); } catch {} overlayRefs.current = []; }; }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const google = window.google; const map = mapRef.current;
    overlayRefs.current.forEach((overlay) => overlay.setMap(null)); overlayRefs.current = [];

    if (driverPoint) {
      const overlay = createHtmlOverlay(google, map, driverPoint, "nx-gmap-car-marker", (div) => renderCar(div, { heading: driverLocation?.heading, photoUrl: driverPhotoUrl, label: role === "driver" ? "You" : "Driver" }), "Driver", 1005);
      if (overlay) overlayRefs.current.push(overlay);
    }
    if (riderPoint) {
      const overlay = createHtmlOverlay(google, map, riderPoint, "nx-gmap-rider-marker", renderRiderDot, "Rider", 1000);
      if (overlay) overlayRefs.current.push(overlay);
    }
  }, [ready, driverPoint, riderPoint, driverLocation?.heading, driverPhotoUrl, role]);

  useEffect(() => {
    if (!ready || !cameraFollow || !mapRef.current || !window.google?.maps) return;
    
    // FIX: If we just drew a route, do NOT snap back to the driver immediately!
    // Let the user see the route for 5 seconds.
    if (Date.now() < userInteractionUntilRef.current) return;
    
    const target = driverPoint || riderPoint || toLatLng(originPoint) || toLatLng(destinationPoint);
    if (!target) return;
    const now = Date.now(); const key = pointKey(target);
    if (now - lastCameraAtRef.current < CAMERA_THROTTLE_MS && key === lastCameraKeyRef.current) return;
    lastCameraAtRef.current = now; lastCameraKeyRef.current = key;
    const currentZoom = mapRef.current.getZoom?.() || 14; const desiredZoom = routePhase === "pickup" || routePhase === "destination" ? 16 : 15;
    mapRef.current.panTo(target); if (currentZoom < desiredZoom) mapRef.current.setZoom(desiredZoom);
    if (typeof mapRef.current.setTilt === "function") mapRef.current.setTilt(routePhase === "pickup" || routePhase === "destination" ? 45 : 0);
  }, [cameraFollow, destinationPoint, driverPoint, originPoint, ready, riderPoint, routePhase]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;
    const markInteraction = () => { userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS; };
    const listeners = [map.addListener("dragstart", markInteraction), map.addListener("zoom_changed", () => { if (Date.now() < userInteractionUntilRef.current) return; markInteraction(); })];
    return () => { listeners.forEach((l) => { try { l?.remove?.(); } catch {} }); };
  }, [ready]);

  useEffect(() => {
    if (!ready || !showRoute || !originPoint || !destinationPoint || !window.google?.maps) {
      directionsRendererRef.current?.set("directions", null);
      fallbackPolylineRef.current?.setMap(null);
      return;
    }

    let cancelled = false; const google = window.google; const service = new google.maps.DirectionsService(); const routeFitKey = `${routePhase}:${pointKey(originPoint)}:${pointKey(destinationPoint)}`;

    // 1. DRAW AN INSTANT STRAIGHT LINE (FALLBACK)
    const p1 = toLatLng(originPoint); const p2 = toLatLng(destinationPoint);
    if (p1 && p2) {
      fallbackPolylineRef.current = new google.maps.Polyline({ path: [p1, p2], strokeColor: "#6100FF", strokeOpacity: 0.5, strokeWeight: 6, map: mapRef.current });
    }

    // 2. ASK GOOGLE FOR THE SNAPPED ROUTE
    service.route({ origin: buildGoogleDirectionsPoint(google, originPoint, city), destination: buildGoogleDirectionsPoint(google, destinationPoint, city), travelMode: google.maps.TravelMode.DRIVING, provideRouteAlternatives: false, region: "ZW" }, (result, status) => {
      if (cancelled) return;
      
      // Remove the fallback line if Google responds
      fallbackPolylineRef.current?.setMap(null);
      directionsRendererRef.current?.set("directions", null);

      if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
        directionsRendererRef.current?.setDirections(result);
        const leg = result.routes[0].legs[0];
        const firstStep = leg.steps?.[0];
        if (firstStep && firstStep.instructions) onDirectionStepRef.current?.({ text: firstStep.instructions.replace(/<[^>]+>/g, ''), distance: firstStep.distance?.text || "", maneuver: firstStep.maneuver || "straight" });

        const now = Date.now();
        if ((routeFitKey !== lastRouteFitKeyRef.current) && (now - lastBoundsAtRef.current > BOUNDS_THROTTLE_MS)) {
            // FIX: Pause the camera follow for 5 seconds so it doesn't zoom back in on the driver and hide the line!
            userInteractionUntilRef.current = Date.now() + 5000;
            
            mapRef.current?.fitBounds(leg.bounds, { top: 130, left: 50, right: 50, bottom: Math.max(160, Number(boundsBottomPadding) || 260) });
            lastBoundsAtRef.current = now; lastRouteFitKeyRef.current = routeFitKey;
        }
        onRouteInfoRef.current?.({ distanceText: leg.distance?.text || "", durationText: leg.duration?.text || "", distanceMeters: leg.distance?.value || null, durationSeconds: leg.duration?.value || null, startAddress: leg.start_address || "", endAddress: leg.end_address || "", source: "google", phase: routePhase });
        return;
      }
    });

    return () => { cancelled = true; };
  }, [ready, showRoute, originPoint, destinationPoint, city, routePhase, boundsBottomPadding]);

  if (!hasGoogleMapsApiKey()) return null;
  return (
    <div className="nx-google-map-layer">
      <div ref={mapNodeRef} className="nx-google-map-canvas" />
      {!ready ? (<div className="nx-google-map-loading"><strong>Loading Google Maps...</strong><span>Preparing live route...</span></div>) : null}
      {error ? (<div className="nx-google-map-warning"><strong>{error}</strong><span>Fallback map remains active.</span></div>) : null}
    </div>
  );
});

LiveGoogleMap.displayName = "LiveGoogleMap";
export default LiveGoogleMap;
