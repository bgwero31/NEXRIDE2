// File: src/components/maps/LiveGoogleMap.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildGoogleDirectionsPoint,
  cityLabel,
  fallbackRouteEstimate,
  getCityCenter,
  hasGoogleMapsApiKey,
  loadGoogleMapsApi,
  toLatLng,
} from "../../lib/googleMaps";

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#02040a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b9c9dc" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#02040a" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#0b1b32" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#030712" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0c182b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#112b52" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#123d78" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#00d4ff" }, { weight: 0.35 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000814" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function markerIcon(google, type = "default") {
  const color =
    type === "pickup" ? "#00d4ff" :
    type === "destination" ? "#20e28a" :
    type === "driver" ? "#0066ff" :
    type === "request" ? "#ffb020" : "#ffffff";

  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: type === "driver" ? 10 : 8,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
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

export default function LiveGoogleMap({
  city = "harare",
  role = "rider",
  origin = null,
  destination = null,
  driverLocation = null,
  markers = [],
  showRoute = true,
  cameraFollow = true,
  onRouteInfo,
  onMapStatus,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const routeArrowRef = useRef(null);
  const routeMarkerRefs = useRef([]);
  const markerRefs = useRef([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const center = useMemo(() => getCityCenter(city), [city]);
  const originPoint = useMemo(() => resolvePoint(origin), [origin]);
  const destinationPoint = useMemo(() => resolvePoint(destination), [destination]);
  const driverPoint = useMemo(() => toLatLng(driverLocation), [driverLocation]);

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
            zoom: 14,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: "greedy",
            styles: mapStyles,
            backgroundColor: "#02040a",
          });

          directionsRendererRef.current = new google.maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: true,
            preserveViewport: false,
            polylineOptions: {
              strokeColor: "#00d4ff",
              strokeOpacity: 0.95,
              strokeWeight: 6,
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
    const google = window.google;
    mapRef.current.setCenter(center);
  }, [ready, center]);

  useEffect(() => {
    if (!ready || !mapRef.current || typeof window === "undefined" || !window.google?.maps) return;
    const google = window.google;
    const map = mapRef.current;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];

    const addMarker = ({ position, type, title, label }) => {
      const point = toLatLng(position);
      if (!point) return null;
      const marker = new google.maps.Marker({
        position: point,
        map,
        title: title || label || type,
        label: label ? { text: String(label), color: "#ffffff", fontWeight: "900", fontSize: "11px" } : undefined,
        icon: markerIcon(google, type),
      });
      markerRefs.current.push(marker);
      return marker;
    };

    addMarker({ position: originPoint, type: "pickup", title: "Pickup" });
    addMarker({ position: destinationPoint, type: "destination", title: "Destination" });
    addMarker({ position: driverPoint, type: "driver", title: "Driver", label: role === "driver" ? "ME" : "" });

    markers.forEach((marker) => {
      addMarker({
        position: marker,
        type: marker.type || "default",
        title: marker.title || marker.label,
        label: marker.price ? `$${Number(marker.price || 0).toFixed(0)}` : marker.label,
      });
    });

    const bounds = new google.maps.LatLngBounds();
    markerRefs.current.forEach((marker) => bounds.extend(marker.getPosition()));
    if (markerRefs.current.length > 1) map.fitBounds(bounds, 60);
  }, [ready, originPoint, destinationPoint, driverPoint, markers, role]);

  useEffect(() => {
    if (!ready || !cameraFollow || !driverPoint || !mapRef.current || typeof window === "undefined" || !window.google?.maps) return;
    if (!showRoute) return;

    mapRef.current.panTo(driverPoint);
    const currentZoom = mapRef.current.getZoom?.() || 14;
    if (currentZoom < 15) mapRef.current.setZoom(15);
  }, [cameraFollow, driverPoint, ready, showRoute]);

  useEffect(() => {
    if (!ready || !showRoute || !originPoint || !destinationPoint || typeof window === "undefined" || !window.google?.maps) {
      return;
    }

    let cancelled = false;
    const google = window.google;
    const service = new google.maps.DirectionsService();

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

        if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
          directionsRendererRef.current?.setDirections(result);

          routeArrowRef.current?.setMap(null);
          routeMarkerRefs.current.forEach((marker) => marker.setMap(null));
          routeMarkerRefs.current = [];
          routeArrowRef.current = new google.maps.Polyline({
            path: result.routes[0].overview_path || [],
            map: mapRef.current,
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 4.2,
                  fillColor: "#00d4ff",
                  fillOpacity: 1,
                  strokeColor: "#eaffff",
                  strokeWeight: 1.4,
                },
                offset: "10%",
                repeat: "72px",
              },
            ],
          });

          const leg = result.routes[0].legs[0];
          if (leg.start_location && leg.end_location && mapRef.current) {
            routeMarkerRefs.current = [
              new google.maps.Marker({
                position: leg.start_location,
                map: mapRef.current,
                title: "Pickup",
                icon: markerIcon(google, "pickup"),
              }),
              new google.maps.Marker({
                position: leg.end_location,
                map: mapRef.current,
                title: "Destination",
                icon: markerIcon(google, "destination"),
              }),
            ];
          }
          onRouteInfo?.({
            distanceText: leg.distance?.text || "",
            durationText: leg.duration_in_traffic?.text || leg.duration?.text || "",
            distanceMeters: leg.distance?.value || null,
            durationSeconds: leg.duration_in_traffic?.value || leg.duration?.value || null,
            startAddress: leg.start_address || "",
            endAddress: leg.end_address || "",
            pickupCoords: leg.start_location ? { lat: leg.start_location.lat(), lng: leg.start_location.lng() } : null,
            dropoffCoords: leg.end_location ? { lat: leg.end_location.lat(), lng: leg.end_location.lng() } : null,
            source: "google",
          });
          return;
        }

        directionsRendererRef.current?.set("directions", null);
        routeArrowRef.current?.setMap(null);
        routeArrowRef.current = null;
        routeMarkerRefs.current.forEach((marker) => marker.setMap(null));
        routeMarkerRefs.current = [];
        const estimate = fallbackRouteEstimate(originPoint, destinationPoint);
        if (estimate) onRouteInfo?.(estimate);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [ready, showRoute, originPoint, destinationPoint, city, onRouteInfo]);

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
}
