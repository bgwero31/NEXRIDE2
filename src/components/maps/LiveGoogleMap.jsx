// File: src/components/maps/LiveGoogleMap.jsx

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildGoogleDirectionsPoint,
  fallbackRouteEstimate,
  getCityCenter,
  hasGoogleMapsApiKey,
  loadGoogleMapsApi,
  toLatLng,
} from "../../lib/googleMaps";

/* ------------------------------ Constants ----------------------------- */

const CAMERA_THROTTLE_MS = 400;
const BOUNDS_THROTTLE_MS = 700;
/** How long to pause camera-follow after a user interaction (ms). */
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

/* ------------------------------ Helpers ------------------------------- */

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

/** Stable key for a markers array — used to avoid redraw when content is identical. */
function markersKey(markers) {
  if (!Array.isArray(markers) || !markers.length) return "0";
  return markers
    .map((m) => {
      const c = toLatLng(m);
      if (!c) return m?.id || "";
      return `${m?.id || "m"}:${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
    })
    .join("|");
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
    // Do NOT block map gestures under markers — only inner content gets events.
    div.style.pointerEvents = "none";
    if (title) div.title = title;
    render(div);
    this.div = div;
    this.getPanes().overlayMouseTarget.appendChild(div);
  };
  overlay.draw = function draw() {
    const projection = this.getProjection();
    if (!projection || !this.div) return;
    const pixel = projection.fromLatLngToDivPixel(
      new google.maps.LatLng(point.lat, point.lng)
    );
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

/* ------------------ Premium blue navigation arrow marker ------------------ */
function renderCar(div, { heading = 0, photoUrl = "", label = "" } = {}) {
  const arrow = document.createElement("div");
  arrow.className = "nx-gmap-arrow-marker";
  arrow.style.transform = `rotate(${cleanNumber(heading, 0)}deg)`;
  arrow.innerHTML = `
    <svg viewBox="0 0 64 64" aria-hidden="true" class="nx-gmap-arrow-svg">
      <ellipse cx="32" cy="58" rx="10" ry="3" fill="#06152b" opacity="0.22"/>
      <circle cx="32" cy="32" r="22" fill="#ffffff"/>
      <path
        d="M32 12
           L48 48
           L32 40
           L16 48
           Z"
        fill="#0b6dff"
        stroke="#0b6dff"
        stroke-width="1"
        stroke-linejoin="round"
      />
      <path
        d="M32 12 L46 44"
        stroke="#00d4ff"
        stroke-width="1.4"
        stroke-linecap="round"
        fill="none"
        opacity="0.75"
      />
    </svg>`;
  div.appendChild(arrow);

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
  glow.innerHTML = `
    <span class="nx-gmap-destination-pulse"></span>
    <svg viewBox="0 0 54 68" class="nx-gmap-destination-pin" aria-hidden="true">
      <path d="M27 65C27 65 7 42.4 7 25.9C7 14.9 15.9 6 27 6C38.1 6 47 14.9 47 25.9C47 42.4 27 65 27 65Z"/>
      <circle cx="27" cy="25" r="10"/>
    </svg>`;
  div.appendChild(glow);
}

function routeCopy(phase) {
  if (phase === "pickup") return "Following pickup route";
  if (phase === "destination") return "Following destination route";
  if (phase === "completed") return "Final route summary";
  if (phase === "request") return "Preview route";
  return "Live follow";
}

/* ---------------------------- Component ------------------------------- */

const LiveGoogleMap = forwardRef(function LiveGoogleMap(
  {
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
    withTraffic = false,
    boundsBottomPadding = 220,
    onRouteInfo,
    onMapStatus,
  },
  ref
) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const routeHaloRef = useRef(null);
  const routeLineRef = useRef(null);
  const routeShineRef = useRef(null);
  const routeArrowRef = useRef(null);
  const routeMarkerRefs = useRef([]);
  const markerRefs = useRef([]);
  const overlayRefs = useRef([]);
  const lastBoundsAtRef = useRef(0);
  const lastRouteFitKeyRef = useRef("");
  const lastCameraAtRef = useRef(0);
  const lastCameraKeyRef = useRef("");

  // Pause camera-follow for N ms after any user interaction.
  const userInteractionUntilRef = useRef(0);

  // Callback refs — prevents parent re-renders from triggering effects.
  const onRouteInfoRef = useRef(onRouteInfo);
  const onMapStatusRef = useRef(onMapStatus);
  useEffect(() => { onRouteInfoRef.current = onRouteInfo; }, [onRouteInfo]);
  useEffect(() => { onMapStatusRef.current = onMapStatus; }, [onMapStatus]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const center = useMemo(() => getCityCenter(city), [city]);
  const originPoint = useMemo(() => resolvePoint(origin), [origin]);
  const destinationPoint = useMemo(() => resolvePoint(destination), [destination]);
  const driverPoint = useMemo(() => toLatLng(driverLocation), [driverLocation]);
  const riderPoint = useMemo(() => toLatLng(riderLocation), [riderLocation]);

  const markersKeyStr = useMemo(() => markersKey(markers), [markers]);

  /* --------------- Expose imperative API to parent ----------------- */
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const map = mapRef.current;
        if (!map) return;
        userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS;
        map.setZoom(Math.min(21, (map.getZoom() || 14) + 1));
      },
      zoomOut: () => {
        const map = mapRef.current;
        if (!map) return;
        userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS;
        map.setZoom(Math.max(4, (map.getZoom() || 14) - 1));
      },
      recenter: () => {
        const map = mapRef.current;
        if (!map) return;
        userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS;
        const target =
          driverPoint || riderPoint || toLatLng(originPoint) || center;
        if (target) map.panTo(target);
      },
      getMap: () => mapRef.current,
    }),
    [center, driverPoint, originPoint, riderPoint]
  );

  /* --------------------- Init map --------------------- */
  useEffect(() => {
    let cancelled = false;

    if (!hasGoogleMapsApiKey()) {
      setError("Missing Google Maps key");
      onMapStatusRef.current?.("fallback");
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
            backgroundColor: "#f5f7fb",
            heading: 0,
            tilt: 0,
          });

          directionsRendererRef.current = new google.maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#006dff",
              strokeOpacity: 0,
              strokeWeight: 0,
              zIndex: 50,
            },
          });
        }

        setReady(true);
        setError("");
        onMapStatusRef.current?.("google");
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[LiveGoogleMap] load failed:", err);
        }
        if (!cancelled) {
          setError("Google Maps failed to load");
          onMapStatusRef.current?.("fallback");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [center]);

  /* --------------------- Cleanup on unmount --------------------- */
  useEffect(() => {
    return () => {
      try {
        markerRefs.current.forEach((m) => m.setMap(null));
        overlayRefs.current.forEach((o) => o.setMap(null));
        routeMarkerRefs.current.forEach((m) => m.setMap(null));
        routeHaloRef.current?.setMap(null);
        routeLineRef.current?.setMap(null);
        routeShineRef.current?.setMap(null);
        routeArrowRef.current?.setMap(null);
      } catch {}
      markerRefs.current = [];
      overlayRefs.current = [];
      routeMarkerRefs.current = [];
    };
  }, []);

  /* --------------------- Recenter when idle --------------------- */
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    if (originPoint || destinationPoint || driverPoint || riderPoint || markers.length) return;
    mapRef.current.setCenter(center);
  }, [ready, center, originPoint, destinationPoint, driverPoint, riderPoint, markers.length]);

  /* --------------------- Draw markers --------------------- */
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
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
        label: label
          ? { text: String(label), color: "#ffffff", fontWeight: "900", fontSize: "11px" }
          : undefined,
        icon: markerIcon(google, type, heading),
      });
      markerRefs.current.push(marker);
      return marker;
    };

    addMarker({
      position: originPoint,
      type: "pickup",
      title: routePhase === "pickup" ? "Pickup" : "Route start",
    });

    if (destinationPoint) {
      const overlay = createHtmlOverlay(
        google,
        map,
        destinationPoint,
        "nx-gmap-destination-marker",
        renderDestination,
        routePhase === "pickup" ? "Pickup" : "Destination",
        970
      );
      if (overlay) overlayRefs.current.push(overlay);
    }

    if (driverPoint) {
      const overlay = createHtmlOverlay(
        google,
        map,
        driverPoint,
        "nx-gmap-car-marker",
        (div) =>
          renderCar(div, {
            heading: driverLocation?.heading,
            photoUrl: driverPhotoUrl,
            label: role === "driver" ? "You" : "Driver",
          }),
        role === "driver" ? "Your live car" : "Driver live car",
        1005
      );
      if (overlay) overlayRefs.current.push(overlay);
    }

    if (riderPoint) {
      const overlay = createHtmlOverlay(
        google,
        map,
        riderPoint,
        "nx-gmap-rider-marker",
        (div) =>
          renderPhoto(div, {
            photoUrl: riderPhotoUrl,
            fallback: role === "rider" ? "You" : "R",
            label: role === "rider" ? "You" : "Rider",
          }),
        role === "rider" ? "Your live pickup" : "Rider live pickup",
        1000
      );
      if (overlay) overlayRefs.current.push(overlay);
    }

    markers.forEach((marker) => {
      const point = toLatLng(marker);
      if (!point) return;

      if (marker.type === "driver") {
        const overlay = createHtmlOverlay(
          google,
          map,
          point,
          "nx-gmap-car-marker is-nearby",
          (div) =>
            renderCar(div, {
              heading: marker.heading,
              photoUrl: marker.driverPhotoUrl || marker.photoUrl || "",
              label: "",
            }),
          marker.title || marker.name || "Nearby driver",
          880
        );
        if (overlay) overlayRefs.current.push(overlay);
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
    const allPoints = [originPoint, destinationPoint, driverPoint, riderPoint, ...markers]
      .map(toLatLng)
      .filter(Boolean);
    allPoints.forEach((point) => bounds.extend(point));
    if (!showRoute && allPoints.length > 1 && !bounds.isEmpty()) {
      map.fitBounds(bounds, 76);
    }
  }, [
    ready,
    originPoint,
    destinationPoint,
    driverPoint,
    riderPoint,
    markersKeyStr,
    role,
    showRoute,
    driverLocation?.heading,
    driverPhotoUrl,
    riderPhotoUrl,
    routePhase,
    markers,
  ]);

  /* --------------------- Camera follow (throttled) --------------------- */
  useEffect(() => {
    if (!ready || !cameraFollow || !mapRef.current || !window.google?.maps) return;

    // Skip camera follow if user recently interacted with the map.
    if (Date.now() < userInteractionUntilRef.current) return;

    const target =
      followTarget === "rider" ? riderPoint :
      followTarget === "origin" ? toLatLng(originPoint) :
      followTarget === "destination" ? toLatLng(destinationPoint) :
      followTarget === "route" ? null :
      driverPoint || riderPoint || toLatLng(originPoint) || toLatLng(destinationPoint);

    if (!target) return;

    // Throttle: don't pan more than once every CAMERA_THROTTLE_MS for the same target
    const now = Date.now();
    const key = pointKey(target);
    if (
      now - lastCameraAtRef.current < CAMERA_THROTTLE_MS &&
      key === lastCameraKeyRef.current
    ) {
      return;
    }
    lastCameraAtRef.current = now;
    lastCameraKeyRef.current = key;

    const currentZoom = mapRef.current.getZoom?.() || 14;
    const desiredZoom = routePhase === "pickup" || routePhase === "destination" ? 17 : 15;
    const heading = cleanNumber(driverLocation?.heading, 0);

    if (typeof mapRef.current.moveCamera === "function") {
      mapRef.current.moveCamera({
        center: target,
        zoom: Math.max(currentZoom, desiredZoom),
        heading: Number.isFinite(heading) ? heading : 0,
        tilt: routePhase === "pickup" || routePhase === "destination" ? 35 : 0,
      });
    } else {
      mapRef.current.panTo(target);
      if (currentZoom < desiredZoom) mapRef.current.setZoom(desiredZoom);
      if (Number.isFinite(heading) && typeof mapRef.current.setHeading === "function") {
        mapRef.current.setHeading(heading);
      }
      if (typeof mapRef.current.setTilt === "function") {
        mapRef.current.setTilt(
          routePhase === "pickup" || routePhase === "destination" ? 35 : 0
        );
      }
    }
  }, [cameraFollow, destinationPoint, driverPoint, followTarget, originPoint, ready, riderPoint, routePhase, driverLocation?.heading]);

  /* ------------- Pause camera follow on manual map interaction ------------- */
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;

    const markInteraction = () => {
      userInteractionUntilRef.current = Date.now() + USER_INTERACTION_PAUSE_MS;
    };

    const listeners = [
      map.addListener("dragstart", markInteraction),
      map.addListener("zoom_changed", () => {
        if (Date.now() < userInteractionUntilRef.current) return;
        markInteraction();
      }),
    ];

    return () => {
      listeners.forEach((l) => {
        try { l?.remove?.(); } catch {}
      });
    };
  }, [ready]);

  /* --------------------- Clear route when hidden --------------------- */
  useEffect(() => {
    if (!ready || showRoute) return;
    directionsRendererRef.current?.set("directions", null);
    routeHaloRef.current?.setMap(null);
    routeHaloRef.current = null;
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;
    routeShineRef.current?.setMap(null);
    routeShineRef.current = null;
    routeArrowRef.current?.setMap(null);
    routeArrowRef.current = null;
  }, [ready, showRoute]);

  /* --------------------- Route drawing + directions --------------------- */
  useEffect(() => {
    if (!ready || !showRoute || !originPoint || !destinationPoint || !window.google?.maps) {
      // DEBUG: why aren't we running?
      console.log("[NEXRIDE-ROUTE-SKIP]", {
        ready,
        showRoute,
        hasOrigin: Boolean(originPoint),
        hasDestination: Boolean(destinationPoint),
        hasGoogle: Boolean(window.google?.maps),
        originPoint,
        destinationPoint,
      });
      return;
    }

    let cancelled = false;
    const google = window.google;
    const service = new google.maps.DirectionsService();
    const routeFitKey = `${routePhase}:${pointKey(originPoint)}:${pointKey(destinationPoint)}`;

    const request = {
      origin: buildGoogleDirectionsPoint(google, originPoint, city),
      destination: buildGoogleDirectionsPoint(google, destinationPoint, city),
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
      region: "ZW",
    };

    // Only enable traffic tier when explicitly requested (costs more).
    if (withTraffic) {
      request.drivingOptions = {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      };
    }

    // DEBUG: log every request
    console.log("[NEXRIDE-ROUTE-REQUEST]", {
      origin: request.origin,
      destination: request.destination,
      routePhase,
      role,
    });

    service.route(request, (result, status) => {
      if (cancelled) return;

      // DEBUG: log Google's reply
      console.log("[NEXRIDE-ROUTE]", {
        status,
        hasRoute: Boolean(result?.routes?.[0]),
        pathLength: result?.routes?.[0]?.overview_path?.length,
        distance: result?.routes?.[0]?.legs?.[0]?.distance?.text,
        duration: result?.routes?.[0]?.legs?.[0]?.duration?.text,
        errorMessage: result?.error_message,
      });

      // Clean previous route
      routeHaloRef.current?.setMap(null);
      routeHaloRef.current = null;
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      routeShineRef.current?.setMap(null);
      routeShineRef.current = null;
      routeArrowRef.current?.setMap(null);
      routeArrowRef.current = null;
      routeMarkerRefs.current.forEach((marker) => marker.setMap(null));
      routeMarkerRefs.current = [];

      if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
        directionsRendererRef.current?.setDirections(result);

        const overviewPath = result.routes[0].overview_path || [];

        routeHaloRef.current = new google.maps.Polyline({
          path: overviewPath,
          map: mapRef.current,
          strokeColor: "#071225",
          strokeOpacity: 0.92,
          strokeWeight: 15,
          zIndex: 610,
        });
        routeLineRef.current = new google.maps.Polyline({
          path: overviewPath,
          map: mapRef.current,
          strokeColor: "#2d18ff",
          strokeOpacity: 1,
          strokeWeight: 9,
          zIndex: 630,
        });
        routeShineRef.current = new google.maps.Polyline({
          path: overviewPath,
          map: mapRef.current,
          strokeColor: "#14d8ff",
          strokeOpacity: 0.90,
          strokeWeight: 4,
          zIndex: 640,
        });
        routeArrowRef.current = new google.maps.Polyline({
          path: overviewPath,
          map: mapRef.current,
          strokeOpacity: 0,
          zIndex: 660,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4.7,
                fillColor: "#ffffff",
                fillOpacity: 1,
                strokeColor: "#06152b",
                strokeWeight: 2,
              },
              offset: "11%",
              repeat: "74px",
            },
          ],
        });

        const leg = result.routes[0].legs[0];
        const startCoords = positionFromRouteLocation(leg.start_location);
        const endCoords = positionFromRouteLocation(leg.end_location);

        if (mapRef.current) {
          if (startCoords) {
            routeMarkerRefs.current.push(
              new google.maps.Marker({
                position: startCoords,
                map: mapRef.current,
                title:
                  routePhase === "pickup" ? "Driver live location" : "Route start",
                optimized: false,
                zIndex: 930,
                icon: markerIcon(
                  google,
                  routePhase === "pickup" || role === "driver" ? "driver" : "pickup",
                  driverLocation?.heading
                ),
                label:
                  routePhase === "pickup" && role === "driver"
                    ? { text: "ME", color: "#ffffff", fontWeight: "900", fontSize: "11px" }
                    : undefined,
              })
            );
          }

          const now = Date.now();
          const shouldFitRoute =
            routeFitKey !== lastRouteFitKeyRef.current || routePhase === "completed";

          if (shouldFitRoute && now - lastBoundsAtRef.current > BOUNDS_THROTTLE_MS) {
            if (Date.now() >= userInteractionUntilRef.current) {
              const bounds = new google.maps.LatLngBounds();

              overviewPath.forEach((point) => bounds.extend(point));
              if (driverPoint) bounds.extend(driverPoint);
              if (riderPoint) bounds.extend(riderPoint);

              if (!bounds.isEmpty()) {
                mapRef.current.fitBounds(bounds, {
                  top: 130,
                  left: 50,
                  right: 50,
                  bottom:
                    routePhase === "completed"
                      ? 200
                      : Math.max(160, Number(boundsBottomPadding) || 260),
                });
              }
            }
            lastBoundsAtRef.current = now;
            lastRouteFitKeyRef.current = routeFitKey;
          }
        }

        onRouteInfoRef.current?.({
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
      if (estimate) onRouteInfoRef.current?.({ ...estimate, phase: routePhase });
    });

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    showRoute,
    originPoint,
    destinationPoint,
    city,
    routePhase,
    role,
    withTraffic,
    boundsBottomPadding,
    // driverLocation?.heading intentionally NOT here
  ]);

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
});

LiveGoogleMap.displayName = "LiveGoogleMap";

export default LiveGoogleMap;
