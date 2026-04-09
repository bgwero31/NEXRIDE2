// File: src/components/rider/RiderMap.jsx

"use client";

import { useEffect, useRef, useState } from "react";
import { onValue, ref as dbRef } from "firebase/database";
import { db } from "../../lib/firebase";

const CITY_CENTERS = {
  harare: { lat: -17.8252, lng: 31.0335 },
  bulawayo: { lat: -20.1325, lng: 28.6265 },
  gweru: { lat: -19.4553, lng: 29.8174 },
  zvishavane: { lat: -20.3403, lng: 30.0428 },
  masvingo: { lat: -20.0744, lng: 30.8327 },
  mutare: { lat: -18.9707, lng: 32.6709 },
  kwekwe: { lat: -18.9281, lng: 29.8149 },
  chinhoyi: { lat: -17.3667, lng: 30.2 },
  kadoma: { lat: -18.3333, lng: 29.9167 },
};

function getDefaultCenter(city) {
  if (!city) return CITY_CENTERS.harare;
  const key = String(city).trim().toLowerCase();
  return CITY_CENTERS[key] || CITY_CENTERS.harare;
}

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

function makeDotMarker(mapsApi, color = "#8b5cf6", scale = 7) {
  return {
    path: mapsApi.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function makeDriverArrow(mapsApi, heading = 0, color = "#8b5cf6") {
  return {
    path: mapsApi.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 6,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    rotation: Number(heading || 0),
  };
}

export default function RiderMap({
  mode = "request",
  city = "",
  requestData = null,
  tripData = null,
  onPickupResolved,
  onDriversCountChange,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);

  const riderMarkerRef = useRef(null);
  const acceptedDriverMarkerRef = useRef(null);
  const onlineDriverMarkersRef = useRef({});

  const directionsRendererRef = useRef(null);
  const geocoderRef = useRef(null);
  const watchIdRef = useRef(null);

  const lastResolvedRef = useRef({ lat: null, lng: null, at: 0 });
  const lastKnownRiderPosRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapsApi, setMapsApi] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [onlineDrivers, setOnlineDrivers] = useState({});

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const cityKey = String(city || "").trim().toLowerCase();

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

  useEffect(() => {
    if (!mapsApi || mapRef.current || !mapNodeRef.current) return;

    const map = new mapsApi.Map(mapNodeRef.current, {
      center: getDefaultCenter(cityKey),
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#f4efe7" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#5b5670" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d7d5dd" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#ece7f3" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#d9efff" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });

    mapRef.current = map;
    geocoderRef.current = new mapsApi.Geocoder();

    directionsRendererRef.current = new mapsApi.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: false,
      polylineOptions: {
        strokeColor: "#8b5cf6",
        strokeOpacity: 0.95,
        strokeWeight: 5,
      },
    });
    directionsRendererRef.current.setMap(map);

    setMapReady(true);
  }, [mapsApi, cityKey]);

  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;
    if (!navigator.geolocation) return;

    const map = mapRef.current;

    const updatePickupAddress = (lat, lng) => {
      if (!geocoderRef.current) return;

      const last = lastResolvedRef.current;
      const now = Date.now();
      const movedEnough =
        last.lat == null ||
        Math.abs(last.lat - lat) > 0.0008 ||
        Math.abs(last.lng - lng) > 0.0008;
      const enoughTimePassed = now - (last.at || 0) > 15000;

      if (!movedEnough && !enoughTimePassed) return;

      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== "OK" || !results?.length) return;

        lastResolvedRef.current = { lat, lng, at: Date.now() };

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
      });
    };

    const onSuccess = (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const me = { lat, lng };

      lastKnownRiderPosRef.current = me;

      if (!riderMarkerRef.current) {
        riderMarkerRef.current = new mapsApi.Marker({
          position: me,
          map,
          title: "Your location",
          icon: makeDotMarker(mapsApi, "#06b6d4", 8),
          zIndex: 999,
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

  // listen to online drivers
  useEffect(() => {
    if (!cityKey) return;

    const onlineRef = dbRef(db, `driversOnline/${cityKey}`);

    const unsub = onValue(onlineRef, (snap) => {
      const data = snap.val() || {};
      const filtered = {};

      Object.entries(data).forEach(([id, value]) => {
        if (value?.online === true) {
          filtered[id] = value;
        }
      });

      setOnlineDrivers(filtered);
      onDriversCountChange?.(Object.keys(filtered).length);
    });

    return () => unsub();
  }, [cityKey, onDriversCountChange]);

  // draw all online drivers
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;

    const map = mapRef.current;
    const drivers = onlineDrivers || {};
    const currentMarkers = onlineDriverMarkersRef.current;
    const acceptedDriverId = tripData?.driverId || "";

    Object.keys(currentMarkers).forEach((driverId) => {
      if (!drivers[driverId] || driverId === acceptedDriverId) {
        currentMarkers[driverId].setMap(null);
        delete currentMarkers[driverId];
      }
    });

    Object.entries(drivers).forEach(([driverId, driver]) => {
      if (driverId === acceptedDriverId) return;

      const lat = Number(driver?.lat);
      const lng = Number(driver?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos = { lat, lng };

      if (!currentMarkers[driverId]) {
        currentMarkers[driverId] = new mapsApi.Marker({
          position: pos,
          map,
          title: driver?.name || "Online driver",
          icon: makeDotMarker(mapsApi, "#8b5cf6", 5),
          zIndex: 20,
        });
      } else {
        currentMarkers[driverId].setPosition(pos);
      }
    });
  }, [mapReady, mapsApi, tripData, cityKey, mode, onlineDrivers]);

  // request route preview
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current || !requestData) return;
    if (!requestData.pickupLat || !requestData.pickupLng) return;
    if (!requestData.dropoffLat || !requestData.dropoffLng) return;
    if (mode === "trip") return;

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
  }, [mapReady, mapsApi, requestData, mode]);

  // live trip route
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;

    const map = mapRef.current;
    const directionsService = new mapsApi.DirectionsService();

    if (!tripData) {
      if (acceptedDriverMarkerRef.current) {
        acceptedDriverMarkerRef.current.setMap(null);
        acceptedDriverMarkerRef.current = null;
      }
      return;
    }

    const driverLat = tripData?.driverLive?.lat;
    const driverLng = tripData?.driverLive?.lng;
    const riderPos = lastKnownRiderPosRef.current;

    if (driverLat != null && driverLng != null) {
      const driverPos = {
        lat: Number(driverLat),
        lng: Number(driverLng),
      };

      if (!acceptedDriverMarkerRef.current) {
        acceptedDriverMarkerRef.current = new mapsApi.Marker({
          position: driverPos,
          map,
          title: tripData?.driverName || "Driver",
          icon: makeDriverArrow(
            mapsApi,
            Number(tripData?.driverLive?.heading || 0),
            "#8b5cf6"
          ),
          zIndex: 200,
        });
      } else {
        acceptedDriverMarkerRef.current.setPosition(driverPos);
        acceptedDriverMarkerRef.current.setIcon(
          makeDriverArrow(
            mapsApi,
            Number(tripData?.driverLive?.heading || 0),
            "#8b5cf6"
          )
        );
      }

      if (riderPos) {
        const bounds = new mapsApi.LatLngBounds();
        bounds.extend(riderPos);
        bounds.extend(driverPos);
        map.fitBounds(bounds, 80);
      } else {
        map.panTo(driverPos);
      }
    } else if (acceptedDriverMarkerRef.current) {
      acceptedDriverMarkerRef.current.setMap(null);
      acceptedDriverMarkerRef.current = null;
    }

    if (
      (tripData.status === "accepted" || tripData.status === "arrived") &&
      driverLat != null &&
      driverLng != null &&
      riderPos
    ) {
      directionsService.route(
        {
          origin: { lat: Number(driverLat), lng: Number(driverLng) },
          destination: riderPos,
          travelMode: mapsApi.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(result);
          }
        }
      );
      return;
    }

    if (
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
        background: "#f4efe7",
      }}
    >
      <div
        ref={mapNodeRef}
        style={{
          width: "100%",
          height: "100%",
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
            color: "#a61b3c",
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
