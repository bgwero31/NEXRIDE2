// File: src/components/maps/LiveGoogleMap.jsx

"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildGoogleDirectionsPoint, fallbackRouteEstimate, getCityCenter, hasGoogleMapsApiKey, loadGoogleMapsApi, toLatLng } from "../../lib/googleMaps";

const CAMERA_THROTTLE_MS = 400;
const BOUNDS_THROTTLE_MS = 700;
const USER_INTERACTION_PAUSE_MS = 4000;
const ROUTE_REFRESH_MIN_METERS = 120;

function distanceMeters(a, b) {
  const p1 = toLatLng(a); const p2 = toLatLng(b);
  if (!p1 || !p2) return Infinity;
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(p2.lat - p1.lat); const dLng = rad(p2.lng - p1.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p1.lat)) * Math.cos(rad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#14251f" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "on" }, { saturation: -45 }, { lightness: 18 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b8c9be" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#263c32" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#496354" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1b3027" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#20382d" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#294236" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#b2c4b8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#263c32" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#526b5d" }, { weight: 1.1 }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#41624e" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#6f9a78" }, { weight: 1.6 }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#344e40" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#263c32" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#244d58" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#b0c8c7" }] },
];

const lightMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#edf0e9" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#46554e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f7f9f5" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dbe9dd" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d3dcd4" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f3e6c8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c8dedd" }] },
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
  arrow.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true" class="nx-gmap-arrow-svg"><ellipse cx="32" cy="58" rx="10" ry="3" fill="#06152b" opacity="0.22"/><circle cx="32" cy="32" r="22" fill="#ffffff"/><path d="M32 12 L48 48 L32 40 L16 48 Z" fill="#1ca962" stroke="#1ca962" stroke-width="1" stroke-linejoin="round" /><path d="M32 12 L46 44" stroke="#6dea99" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.75" /></svg>`;
  div.appendChild(arrow);
  if (photoUrl) { const badge = document.createElement("img"); badge.className = "nx-gmap-car-photo"; badge.src = photoUrl; badge.alt = ""; div.appendChild(badge); }
  if (label) { const chip = document.createElement("span"); chip.className = "nx-gmap-marker-label"; chip.textContent = label; div.appendChild(chip); }
}

function renderRiderDot(div) {
  const dot = document.createElement("div"); dot.className = "nx-gmap-rider-dot";
  dot.innerHTML = `<div class="nx-rider-pulse"></div><div class="nx-rider-core"></div>`;
  div.appendChild(dot);
}

// Show an independent pickup and destination pin even when GPS is unavailable.
// An actual rider GPS marker is distinct from the booked pickup location.
function renderPlacePin(div, label, variant = "pickup") {
  const pin = document.createElement("div");
  pin.className = `nx-gmap-place-pin nx-gmap-place-${variant}`;
  const glyph = document.createElement("span");
  glyph.className = "nx-gmap-place-glyph";
  glyph.textContent = "";
  pin.appendChild(glyph);
  const caption = document.createElement("span");
  caption.className = "nx-gmap-place-label";
  caption.textContent = label;
  pin.appendChild(caption);
  div.appendChild(pin);
}

const LiveGoogleMap = forwardRef(function LiveGoogleMap(
  { city = "harare", role = "rider", origin = null, destination = null, driverLocation = null, riderLocation = null, pickupLocation = null, dropoffLocation = null, markers = [], followTarget = "auto", driverPhotoUrl = "", showRoute = true, cameraFollow = true, routePhase = "route", boundsBottomPadding = 220, lightMap = false, nearbyDrivers = [], onRouteInfo, onMapStatus, onDirectionStep },
  ref
) {
  const mapNodeRef = useRef(null); const mapRef = useRef(null); const directionsRendererRef = useRef(null); const fallbackPolylineRef = useRef(null); const overlayRefs = useRef([]);
  const lastBoundsAtRef = useRef(0); const lastRouteFitKeyRef = useRef(""); const lastRouteRequestRef = useRef(null); const routeRequestIdRef = useRef(0); const lastCameraAtRef = useRef(0); const lastCameraKeyRef = useRef(""); const userInteractionUntilRef = useRef(0);

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
  const pickupPoint = useMemo(() => toLatLng(pickupLocation), [pickupLocation]);
  const dropoffPoint = useMemo(() => toLatLng(dropoffLocation), [dropoffLocation]);

  useImperativeHandle(ref, () => ({
      zoomIn: () => { const map = mapRef.current; if (!map) return; userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS; map.setZoom(Math.min(21, (map.getZoom() || 14) + 1)); },
      zoomOut: () => { const map = mapRef.current; if (!map) return; userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS; map.setZoom(Math.max(4, (map.getZoom() || 14) - 1)); },
      recenter: () => { const map = mapRef.current; if (!map) return; userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS; const target = role === "rider" ? (riderPoint || pickupPoint || driverPoint || center) : (driverPoint || pickupPoint || riderPoint || center); if (target) map.panTo(target); },
      getMap: () => mapRef.current,
  }), [center, driverPoint, pickupPoint, riderPoint, role]);

  useEffect(() => {
    let cancelled = false;
    if (!hasGoogleMapsApiKey()) { setError("Missing Google Maps key"); onMapStatusRef.current?.("fallback"); return; }
    loadGoogleMapsApi().then((google) => {
        if (cancelled || !mapNodeRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapNodeRef.current, { center, zoom: 15, minZoom: 4, maxZoom: 21, disableDefaultUI: true, clickableIcons: false, gestureHandling: "greedy", styles: lightMap ? lightMapStyles : mapStyles, backgroundColor: lightMap ? "#edf0e9" : "#14251f", heading: 0, tilt: 0 });
          
          directionsRendererRef.current = new google.maps.DirectionsRenderer({ 
            map: mapRef.current, 
            suppressMarkers: true, 
            preserveViewport: true, 
            polylineOptions: { strokeColor: lightMap ? "#087965" : "#20e28a", strokeOpacity: 1, strokeWeight: 7, zIndex: 50 }
          });
        }
        setReady(true); setError(""); onMapStatusRef.current?.("google");
    }).catch((err) => { if (!cancelled) { setError("Google Maps failed to load"); onMapStatusRef.current?.("fallback"); } });
    return () => { cancelled = true; };
  }, [center, lightMap]);

  useEffect(() => { return () => { routeRequestIdRef.current += 1; try { overlayRefs.current.forEach((o) => o.setMap(null)); fallbackPolylineRef.current?.setMap(null); directionsRendererRef.current?.setMap(null); } catch {} overlayRefs.current = []; }; }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const google = window.google; const map = mapRef.current;
    overlayRefs.current.forEach((overlay) => overlay.setMap(null)); overlayRefs.current = [];

    // Static trip endpoints always remain visible, irrespective of GPS permission.
    // Hide a duplicate pickup pin if it is essentially on top of the rider GPS pin.
    if (pickupPoint && (!riderPoint || distanceMeters(pickupPoint, riderPoint) > 24)) {
      const pin = createHtmlOverlay(google, map, pickupPoint, "nx-gmap-place-marker", (div) => renderPlacePin(div, "Pickup", "pickup"), "Pickup point", 1001);
      if (pin) overlayRefs.current.push(pin);
    }
    if (dropoffPoint) {
      const pin = createHtmlOverlay(google, map, dropoffPoint, "nx-gmap-place-marker", (div) => renderPlacePin(div, "Drop-off", "destination"), "Destination", 1001);
      if (pin) overlayRefs.current.push(pin);
    }
    if (driverPoint) {
      const overlay = createHtmlOverlay(google, map, driverPoint, "nx-gmap-car-marker", (div) => renderCar(div, { heading: driverLocation?.heading, photoUrl: driverPhotoUrl, label: role === "driver" ? "You · Driver" : "Driver" }), "Driver", 1005);
      if (overlay) overlayRefs.current.push(overlay);
    }
    (Array.isArray(nearbyDrivers) ? nearbyDrivers : []).forEach((nearby) => {
      const point = toLatLng(nearby);
      if (!point) return;
      const overlay = createHtmlOverlay(google, map, point, "nx-gmap-car-marker is-nearby", (div) => renderCar(div, { heading: nearby.heading, photoUrl: nearby.photoUrl || nearby.driverPhotoUrl || "", label: "" }), nearby.name || "Nearby driver", 990);
      if (overlay) overlayRefs.current.push(overlay);
    });
    // Open rider requests are separate from a trip's rider marker.
    if (role === "driver" && !pickupPoint) {
      (Array.isArray(markers) ? markers : []).forEach((request) => {
        const point = toLatLng(request);
        if (!point) return;
        const label = request.price ? `Request · $${Number(request.price).toFixed(2)}` : "Ride request";
        const pin = createHtmlOverlay(google, map, point, "nx-gmap-place-marker", (div) => renderPlacePin(div, label, "request"), "Ride request", 995);
        if (pin) overlayRefs.current.push(pin);
      });
    }
    if (riderPoint) {
      const overlay = createHtmlOverlay(google, map, riderPoint, "nx-gmap-rider-marker", (div) => {
        renderRiderDot(div);
        const chip = document.createElement("span");
        chip.className = "nx-gmap-marker-label";
        chip.textContent = role === "rider" ? "You · Rider" : "Rider";
        div.appendChild(chip);
      }, "Rider GPS position", 1010);
      if (overlay) overlayRefs.current.push(overlay);
    }
  }, [ready, driverPoint, riderPoint, pickupPoint, dropoffPoint, nearbyDrivers, markers, driverLocation?.heading, driverPhotoUrl, role]);

  useEffect(() => {
    if (!ready || !cameraFollow || !mapRef.current || !window.google?.maps) return;
    
    // FIX: If we just drew a route, do NOT snap back to the driver immediately!
    // Let the user see the route for 5 seconds.
    if (Date.now() < userInteractionUntilRef.current) return;
    
    // Follow your own role, not the other participant's marker.
    const target = followTarget === "route" ? null : followTarget === "driver" ? (driverPoint || riderPoint) : followTarget === "rider" ? (riderPoint || driverPoint) : role === "driver" ? (driverPoint || riderPoint) : (riderPoint || driverPoint);
    const finalTarget = target || (followTarget === "route" ? null : toLatLng(originPoint) || toLatLng(destinationPoint));
    if (!finalTarget) return;
    const now = Date.now(); const key = pointKey(finalTarget);
    if (now - lastCameraAtRef.current < CAMERA_THROTTLE_MS && key === lastCameraKeyRef.current) return;
    lastCameraAtRef.current = now; lastCameraKeyRef.current = key;
    const currentZoom = mapRef.current.getZoom?.() || 14; const desiredZoom = routePhase === "pickup" || routePhase === "destination" ? 16 : 15;
    mapRef.current.panTo(finalTarget); if (currentZoom < desiredZoom) mapRef.current.setZoom(desiredZoom);
    if (typeof mapRef.current.setTilt === "function") mapRef.current.setTilt(routePhase === "pickup" || routePhase === "destination" ? 45 : 0);
  }, [cameraFollow, destinationPoint, driverPoint, originPoint, ready, riderPoint, role, followTarget, routePhase]);

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
      routeRequestIdRef.current += 1;
      lastRouteRequestRef.current = null;
      lastRouteFitKeyRef.current = "";
      onDirectionStepRef.current?.(null);
      return;
    }

    const google = window.google;
    const routeFitKey = `${routePhase}:${pointKey(destinationPoint)}`;
    const previous = lastRouteRequestRef.current;
    const sameTarget = previous?.targetKey === routeFitKey;
    const movedMeters = previous ? distanceMeters(previous.origin, originPoint) : Infinity;

    // Driver GPS can update every few seconds. Keep the live vehicle marker moving,
    // but do not spend a Directions request for every tiny GPS change.
    if (sameTarget && movedMeters < ROUTE_REFRESH_MIN_METERS) return;

    const service = new google.maps.DirectionsService();
    const requestId = ++routeRequestIdRef.current;
    lastRouteRequestRef.current = { targetKey: routeFitKey, origin: toLatLng(originPoint) };

    if (!sameTarget) onDirectionStepRef.current?.(null);

    // Show the provisional connection while Directions calculates the road route.
    const p1 = toLatLng(originPoint); const p2 = toLatLng(destinationPoint);
    fallbackPolylineRef.current?.setMap(null);
    if (p1 && p2) {
      fallbackPolylineRef.current = new google.maps.Polyline({ 
        path: [p1, p2], 
        strokeColor: lightMap ? "#087965" : "#20e28a",
        strokeOpacity: 0.5, 
        strokeWeight: 6, 
        map: mapRef.current 
      });
    }

    // 2. ASK GOOGLE FOR THE SNAPPED ROUTE
    service.route({ 
      origin: buildGoogleDirectionsPoint(google, originPoint, city), 
      destination: buildGoogleDirectionsPoint(google, destinationPoint, city), 
      travelMode: google.maps.TravelMode.DRIVING, 
      provideRouteAlternatives: false, 
      region: "ZW" 
    }, (result, status) => {
      if (requestId !== routeRequestIdRef.current) return;

      // Remove the fallback line no matter what happens
      fallbackPolylineRef.current?.setMap(null);
      directionsRendererRef.current?.set("directions", null);

      if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
        directionsRendererRef.current?.setDirections(result);
        const leg = result.routes[0].legs[0];
        const firstStep = leg.steps?.[0];
        
        if (firstStep && firstStep.instructions) {
          onDirectionStepRef.current?.({
            text: firstStep.instructions.replace(/<[^>]+>/g, ''), 
            distance: firstStep.distance?.text || "", 
            maneuver: firstStep.maneuver || "straight" 
          });
        }

        const now = Date.now();
        if ((routeFitKey !== lastRouteFitKeyRef.current) && (now - lastBoundsAtRef.current > BOUNDS_THROTTLE_MS)) {
            userInteractionUntilRef.current = Date.now() + 5000;
            // DirectionsLeg does not expose `bounds`; use DirectionsRoute.bounds.
            const fittedBounds = result.routes[0].bounds || new google.maps.LatLngBounds(leg.start_location, leg.end_location);
            const mapHeight = mapNodeRef.current?.clientHeight || 400;
            const top = lightMap ? Math.min(96, Math.round(mapHeight * 0.25)) : 130;
            const bottom = Math.min(boundsBottomPadding, Math.round(mapHeight * 0.34));
            mapRef.current?.fitBounds(fittedBounds, { top, left: 38, right: 58, bottom });
            lastBoundsAtRef.current = now; 
            lastRouteFitKeyRef.current = routeFitKey;
        }
        
        onRouteInfoRef.current?.({
          distanceText: leg.distance?.text || "", 
          durationText: leg.duration?.text || "", 
          distanceMeters: leg.distance?.value || null, 
          durationSeconds: leg.duration?.value || null, 
          startAddress: leg.start_address || "", 
          endAddress: leg.end_address || "", 
          source: "google", 
          phase: routePhase 
        });
        return;
      } else {
        console.error("[NEXRIDE] Google Directions request failed:", status);
        // A Directions failure does not mean the Google map itself failed.
        onMapStatusRef.current?.("google");
        onDirectionStepRef.current?.(null);
        onRouteInfoRef.current?.({ source: "unavailable", phase: routePhase, distanceText: "", durationText: "" });
      }
    });

    // The request ID invalidates stale responses only when a materially new route is requested.
    // Small GPS updates therefore cannot cancel an in-flight Directions response.
  }, [ready, showRoute, originPoint, destinationPoint, city, routePhase, boundsBottomPadding, lightMap]);

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
