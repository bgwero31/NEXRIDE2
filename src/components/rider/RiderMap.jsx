// File: src/components/rider/RiderMap.jsx

"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: -20.3403, lng: 30.0428 }; // Zvishavane fallback

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if (window.google?.maps) return resolve(window.google.maps);

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.body.appendChild(script);
  });
}

export default function RiderMap({
  mode = "request",
  requestData = null,
  tripData = null,
  onPickupResolved,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const geocoderRef = useRef(null);
  const watchIdRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapsApi, setMapsApi] = useState(null);
  const [loadError, setLoadError] = useState("");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // load Google Maps
  useEffect(() => {
    let cancelled = false;

    if (!apiKey) {
      setLoadError("Google Maps API key missing.");
      return;
    }

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled) return;
        setMapsApi(maps);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoadError("Failed to load Google Maps.");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // init map
  useEffect(() => {
    if (!mapsApi || mapRef.current || !mapNodeRef.current) return;

    const map = new mapsApi.Map(mapNodeRef.current, {
      center: DEFAULT_CENTER,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0b1020" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0b1020" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });

    mapRef.current = map;
    geocoderRef.current = new mapsApi.Geocoder();
    directionsRendererRef.current = new mapsApi.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#8b5cf6",
        strokeOpacity: 0.95,
        strokeWeight: 5,
      },
    });
    directionsRendererRef.current.setMap(map);

    setMapReady(true);
  }, [mapsApi]);

  // watch rider location
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;
    if (!navigator.geolocation) return;

    const map = mapRef.current;

    const updatePickupAddress = (lat, lng) => {
      if (!geocoderRef.current) return;

      geocoderRef.current.geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status !== "OK" || !results?.length) return;

          const best = results[0];
          const text = best.formatted_address || "Current location";

          let detectedCity = "";
          const parts = best.address_components || [];
          for (const part of parts) {
            const types = part.types || [];
            if (
              types.includes("locality") ||
              types.includes("administrative_area_level_2") ||
              types.includes("administrative_area_level_1")
            ) {
              detectedCity = part.long_name;
              break;
            }
          }

          onPickupResolved?.({
            pickupName: text,
            pickupLat: lat,
            pickupLng: lng,
            city: detectedCity || "",
          });
        }
      );
    };

    const onSuccess = (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const me = { lat, lng };

      if (!riderMarkerRef.current) {
        riderMarkerRef.current = new mapsApi.Marker({
          position: me,
          map,
          title: "Your location",
          icon: {
            path: mapsApi.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#06b6d4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      } else {
        riderMarkerRef.current.setPosition(me);
      }

      if (mode === "request" || mode === "waiting" || mode === "offers") {
        map.panTo(me);
      }

      try {
        localStorage.setItem("nexride-last-lat", String(lat));
        localStorage.setItem("nexride-last-lng", String(lng));
      } catch {}

      updatePickupAddress(lat, lng);
    };

    const onError = (err) => {
      console.error("geolocation error", err);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000,
    });

    return () => {
      try {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
    };
  }, [mapReady, mapsApi, mode, onPickupResolved]);

  // show request route preview in request/waiting/offers mode
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current || !requestData) return;
    if (!requestData.pickupLat || !requestData.pickupLng) return;
    if (!requestData.dropoffLat || !requestData.dropoffLng) return;

    const directionsService = new mapsApi.DirectionsService();

    directionsService.route(
      {
        origin: {
          lat: Number(requestData.pickupLat),
          lng: Number(requestData.pickupLng),
        },
        destination: {
          lat: Number(requestData.dropoffLat),
          lng: Number(requestData.dropoffLng),
        },
        travelMode: mapsApi.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
        }
      }
    );
  }, [mapReady, mapsApi, requestData]);

  // live trip mode: show driver marker + route from driver to pickup/dropoff
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current || !tripData) return;

    const map = mapRef.current;
    const driverLat = tripData?.driverLive?.lat;
    const driverLng = tripData?.driverLive?.lng;

    if (driverLat != null && driverLng != null) {
      const driverPos = {
        lat: Number(driverLat),
        lng: Number(driverLng),
      };

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new mapsApi.Marker({
          position: driverPos,
          map,
          title: "Driver",
          icon: {
            path: mapsApi.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#8b5cf6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
            rotation: Number(tripData?.driverLive?.heading || 0),
          },
        });
      } else {
        driverMarkerRef.current.setPosition(driverPos);
        driverMarkerRef.current.setIcon({
          path: mapsApi.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#8b5cf6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          rotation: Number(tripData?.driverLive?.heading || 0),
        });
      }

      map.panTo(driverPos);
    }

    const directionsService = new mapsApi.DirectionsService();

    if (
      tripData.status === "accepted" ||
      tripData.status === "arrived"
    ) {
      if (
        driverLat != null &&
        driverLng != null &&
        tripData.pickupLat != null &&
        tripData.pickupLng != null
      ) {
        directionsService.route(
          {
            origin: { lat: Number(driverLat), lng: Number(driverLng) },
            destination: {
              lat: Number(tripData.pickupLat),
              lng: Number(tripData.pickupLng),
            },
            travelMode: mapsApi.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK" && directionsRendererRef.current) {
              directionsRendererRef.current.setDirections(result);
            }
          }
        );
      }
    } else if (
      (tripData.status === "picked" || tripData.status === "enroute") &&
      tripData.pickupLat != null &&
      tripData.pickupLng != null &&
      tripData.dropoffLat != null &&
      tripData.dropoffLng != null
    ) {
      directionsService.route(
        {
          origin: {
            lat: Number(tripData.pickupLat),
            lng: Number(tripData.pickupLng),
          },
          destination: {
            lat: Number(tripData.dropoffLat),
            lng: Number(tripData.dropoffLng),
          },
          travelMode: mapsApi.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(result);
          }
        }
      );
    }
  }, [mapReady, mapsApi, tripData]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#050816",
      }}
    >
      <div
        ref={mapNodeRef}
        style={{
          width: "100%",
          height: "100%",
          filter: "saturate(1.05) contrast(1.02)",
        }}
      />

      {loadError ? (
        <div
          style={{
            position: "absolute",
            top: 90,
            left: 16,
            right: 16,
            zIndex: 5,
            padding: 12,
            borderRadius: 14,
            background: "rgba(255, 91, 91, 0.08)",
            border: "1px solid rgba(255, 91, 91, 0.18)",
            color: "#ffd5d5",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {loadError}
        </div>
      ) : null}
    </div>
  );
}
