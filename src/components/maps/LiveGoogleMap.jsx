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

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolvePoint(value) {
  if (!value) return null;
  const coords = toLatLng(value);
  if (coords) return coords;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value.label) return value.label;
  return null;
}

function pointKey(point) {
  const coords = toLatLng(point);
  if (!coords) return typeof point === "string" ? point : point?.label || "";
  return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
}

const LiveGoogleMap = forwardRef(function LiveGoogleMap(
  {
    city = "harare",
    origin = null,
    destination = null,
    showRoute = true,
    cameraFollow = true,
    routePhase = "route",
    boundsBottomPadding = 220,
    onRouteInfo,
    onMapStatus,
    onDirectionStep, // Sends the "Head south" text to the parent
  },
  ref
) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const lastBoundsAtRef = useRef(0);
  const lastRouteFitKeyRef = useRef("");
  const lastCameraAtRef = useRef(0);
  const lastCameraKeyRef = useRef("");
  const userInteractionUntilRef = useRef(0);

  const onRouteInfoRef = useRef(onRouteInfo);
  const onMapStatusRef = useRef(onMapStatus);
  const onDirectionStepRef = useRef(onDirectionStep);

  useEffect(() => { onRouteInfoRef.current = onRouteInfo; }, [onRouteInfo]);
  useEffect(() => { onMapStatusRef.current = onMapStatus; }, [onMapStatus]);
  useEffect(() => { onDirectionStepRef.current = onDirectionStep; }, [onDirectionStep]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const center = useMemo(() => getCityCenter(city), [city]);
  const originPoint = useMemo(() => resolvePoint(origin), [origin]);
  const destinationPoint = useMemo(() => resolvePoint(destination), [destination]);

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
        const target = toLatLng(originPoint) || center;
        if (target) map.panTo(target);
      },
      getMap: () => mapRef.current,
    }),
    [center, originPoint]
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
            zoom: 15,
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

          // GOOGLE DRAWS THE POLYLINE AND PINS NATIVELY
          directionsRendererRef.current = new google.maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: false, // SHOWS THE NATIVE A/B PINS
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#6100FF", // PURPLE ROUTE
              strokeOpacity: 1,
              strokeWeight: 8,
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

  /* --------------------- Camera follow --------------------- */
  useEffect(() => {
    if (!ready || !cameraFollow || !mapRef.current || !window.google?.maps) return;
    if (Date.now() < userInteractionUntilRef.current) return;

    const target = toLatLng(originPoint) || toLatLng(destinationPoint);
    if (!target) return;

    const now = Date.now();
    const key = pointKey(target);
    if (now - lastCameraAtRef.current < CAMERA_THROTTLE_MS && key === lastCameraKeyRef.current) {
      return;
    }
    lastCameraAtRef.current = now;
    lastCameraKeyRef.current = key;

    const currentZoom = mapRef.current.getZoom?.() || 14;
    const desiredZoom = routePhase === "pickup" || routePhase === "destination" ? 16 : 15;

    mapRef.current.panTo(target);
    if (currentZoom < desiredZoom) mapRef.current.setZoom(desiredZoom);
    
    if (typeof mapRef.current.setTilt === "function") {
      mapRef.current.setTilt(routePhase === "pickup" || routePhase === "destination" ? 45 : 0);
    }
  }, [cameraFollow, destinationPoint, originPoint, ready, routePhase]);

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
      listeners.forEach((l) => { try { l?.remove?.(); } catch {} });
    };
  }, [ready]);

  /* --------------------- Route drawing + directions --------------------- */
  useEffect(() => {
    if (!ready || !showRoute || !originPoint || !destinationPoint || !window.google?.maps) {
      directionsRendererRef.current?.set("directions", null);
      onDirectionStepRef.current?.(null);
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

    service.route(request, (result, status) => {
      if (cancelled) return;

      if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
        directionsRendererRef.current?.setDirections(result);

        const leg = result.routes[0].legs[0];
        
        // Grab the first step instruction (e.g., "Head south")
        const firstStep = leg.steps?.[0];
        if (firstStep && firstStep.instructions) {
          const cleanInstruction = firstStep.instructions.replace(/<[^>]+>/g, '');
          onDirectionStepRef.current?.({
            text: cleanInstruction,
            distance: firstStep.distance?.text || "",
            maneuver: firstStep.maneuver || "straight"
          });
        }

        const now = Date.now();
        const shouldFitRoute = routeFitKey !== lastRouteFitKeyRef.current;

        if (shouldFitRoute && now - lastBoundsAtRef.current > BOUNDS_THROTTLE_MS) {
          if (Date.now() >= userInteractionUntilRef.current) {
            mapRef.current?.fitBounds(leg.bounds, {
              top: 130,
              left: 50,
              right: 50,
              bottom: Math.max(160, Number(boundsBottomPadding) || 260),
            });
          }
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
          phase: routePhase,
        });
        return;
      }

      directionsRendererRef.current?.set("directions", null);
      onDirectionStepRef.current?.(null);
      const estimate = fallbackRouteEstimate(originPoint, destinationPoint);
      if (estimate) onRouteInfoRef.current?.({ ...estimate, phase: routePhase });
    });

    return () => {
      cancelled = true;
    };
  }, [ready, showRoute, originPoint, destinationPoint, city, routePhase, boundsBottomPadding]);

  if (!hasGoogleMapsApiKey()) return null;

  return (
    <div className="nx-google-map-layer">
      <div ref={mapNodeRef} className="nx-google-map-canvas" />
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
