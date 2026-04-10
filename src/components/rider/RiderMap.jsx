// File: src/components/driver/DriverMap.jsx

"use client";

import { useEffect, useRef, useState } from "react";
import { ref as dbRef, update } from "firebase/database";
import { db, auth } from "../../lib/firebase";

const CITY_CENTERS = {
  harare: { lat: -17.8252, lng: 31.0335 },
  bulawayo: { lat: -20.1325, lng: 28.6265 },
  gweru: { lat: -19.4553, lng: 29.8174 },
  zvishavane: { lat: -20.3403, lng: 30.0428 },
  masvingo: { lat: -20.0744, lng: 30.8327 },
  mutare: { lat: -18.9707, lng: 32.6709 },
  kwekwe: { lat: -18.9281, lng: 29.8149 },
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

function makeDriverArrow(mapsApi, heading = 0) {
  return {
    path: mapsApi.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 7,
    fillColor: "#8b5cf6",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    rotation: Number(heading || 0),
  };
}

function makeDot(mapsApi, color = "#8b5cf6", scale = 7) {
  return {
    path: mapsApi.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function stripHtml(text = "") {
  return String(text).replace(/<[^>]+>/g, "");
}

function speak(text) {
  try {
    if (!window?.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    window.speechSynthesis.speak(utter);
  } catch {}
}

export default function DriverMap({
  mode = "offline",
  city = "",
  activeTrip = null,
  requests = [],
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);

  const driverMarkerRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const requestMarkersRef = useRef({});
  const directionsRendererRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastSpeakKeyRef = useRef("");
  const followRef = useRef(true);

  const [mapsApi, setMapsApi] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [navInfo, setNavInfo] = useState({
    distance: "",
    duration: "",
    instruction: "",
  });
  const [driverPos, setDriverPos] = useState(null);
  const [riderPos, setRiderPos] = useState(null);
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
        if (!cancelled) setMapsApi(maps);
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
    if (!mapsApi || !mapNodeRef.current || mapRef.current) return;

    const map = new mapsApi.Map(mapNodeRef.current, {
      center: getDefaultCenter(cityKey),
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#f5f0ff" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#5b5670" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#ddd6fe" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#e0e7ff" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#efe9ff" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });

    map.addListener("dragstart", () => {
      followRef.current = false;
    });

    mapRef.current = map;

    directionsRendererRef.current = new mapsApi.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: false,
      polylineOptions: {
        strokeColor: "#8b5cf6",
        strokeOpacity: 0.95,
        strokeWeight: 6,
      },
    });

    directionsRendererRef.current.setMap(map);
    setMapReady(true);
  }, [mapsApi, cityKey]);

  // driver gps + push to firebase
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;
    if (!navigator.geolocation) return;
    if (!cityKey) return;

    const map = mapRef.current;

    const pushDriverPosition = async (lat, lng, heading = 0) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      try {
        await update(dbRef(db, `driversOnline/${cityKey}/${uid}`), {
          lat,
          lng,
          heading: heading ?? 0,
          online: true,
          lastSeen: Date.now(),
        });

        if (activeTrip?.tripId) {
          await update(dbRef(db, `activeTrips/${activeTrip.tripId}/driverLive`), {
            lat,
            lng,
            heading: heading ?? 0,
            updatedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error("pushDriverPosition failed", err);
      }
    };

    const onSuccess = async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const me = { lat, lng };
setRiderPos(me);
      const heading =
        typeof pos.coords.heading === "number" ? pos.coords.heading : 0;

      const nextDriverPos = { lat, lng };
      setDriverPos(nextDriverPos);

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new mapsApi.Marker({
          position: nextDriverPos,
          map,
          title: "You",
          icon: makeDriverArrow(mapsApi, heading),
          zIndex: 999,
        });
      } else {
        driverMarkerRef.current.setPosition(nextDriverPos);
        driverMarkerRef.current.setIcon(makeDriverArrow(mapsApi, heading));
      }

      if (!activeTrip && followRef.current) {
        map.panTo(nextDriverPos);
      }

      await pushDriverPosition(lat, lng, heading);
    };

    const onError = (err) => {
      console.error("driver geolocation error", err);
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
        if (watchIdRef.current) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      } catch {}
    };
  }, [mapReady, mapsApi, cityKey, activeTrip]);

  // queue request markers
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;

    const map = mapRef.current;
    const current = requestMarkersRef.current;
    const queueMode = mode === "queue";

    Object.keys(current).forEach((id) => {
      const keep = queueMode && requests.some((r) => r.id === id);
      if (!keep) {
        current[id].setMap(null);
        delete current[id];
      }
    });

    if (!queueMode) return;

    requests.forEach((item) => {
      const lat = Number(item?.pickupLat);
      const lng = Number(item?.pickupLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos = { lat, lng };

      if (!current[item.id]) {
        current[item.id] = new mapsApi.Marker({
          position: pos,
          map,
          title: item?.pickupName || "Ride request",
          icon: makeDot(mapsApi, "#8b5cf6", 6),
          zIndex: 40,
        });
      } else {
        current[item.id].setPosition(pos);
      }
    });
  }, [mapReady, mapsApi, requests, mode]);

// live trip route + accepted driver marker
useEffect(() => {
  if (!mapReady || !mapsApi || !mapRef.current) return;

  const map = mapRef.current;
  const directionsService = new mapsApi.DirectionsService();

  if (!tripData) {
    if (acceptedDriverMarkerRef.current) {
      acceptedDriverMarkerRef.current.setMap(null);
      acceptedDriverMarkerRef.current = null;
    }

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }

    return;
  }

  const driverLat = Number(tripData?.driverLive?.lat);
  const driverLng = Number(tripData?.driverLive?.lng);

  const currentRiderPos =
    lastKnownRiderPosRef.current ||
    (
      tripData?.pickupLat != null &&
      tripData?.pickupLng != null
        ? {
            lat: Number(tripData.pickupLat),
            lng: Number(tripData.pickupLng),
          }
        : null
    );

  // accepted driver marker
  if (Number.isFinite(driverLat) && Number.isFinite(driverLng)) {
    const driverPos = { lat: driverLat, lng: driverLng };

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
        zIndex: 300,
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
      acceptedDriverMarkerRef.current.setMap(map);
    }
  } else if (acceptedDriverMarkerRef.current) {
    acceptedDriverMarkerRef.current.setMap(null);
    acceptedDriverMarkerRef.current = null;
  }

  // route: driver -> rider pickup
  if (
    (tripData.status === "accepted" || tripData.status === "arrived") &&
    Number.isFinite(driverLat) &&
    Number.isFinite(driverLng) &&
    currentRiderPos
  ) {
    directionsService.route(
      {
        origin: { lat: driverLat, lng: driverLng },
        destination: currentRiderPos,
        travelMode: mapsApi.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);

          const bounds = new mapsApi.LatLngBounds();
          bounds.extend({ lat: driverLat, lng: driverLng });
          bounds.extend(currentRiderPos);
          map.fitBounds(bounds, 90);
        }
      }
    );
    return;
  }

  // route: pickup -> dropoff after otp verified
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

          const bounds = new mapsApi.LatLngBounds();
          bounds.extend({
            lat: Number(tripData.pickupLat),
            lng: Number(tripData.pickupLng),
          });
          bounds.extend({
            lat: Number(tripData.dropoffLat),
            lng: Number(tripData.dropoffLng),
          });
          map.fitBounds(bounds, 90);
        }
      }
    );
    return;
  }

  if (directionsRendererRef.current) {
    directionsRendererRef.current.setDirections({ routes: [] });
  }
}, [mapReady, mapsApi, tripData]);
  
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#f5f0ff",
      }}
    >
      <div
        ref={mapNodeRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {(navInfo.distance || navInfo.duration || navInfo.instruction) && (
        <div
          style={{
            position: "absolute",
            top: 86,
            left: 12,
            right: 12,
            zIndex: 20,
            borderRadius: 20,
            padding: "12px 14px",
            background:
              "linear-gradient(180deg, rgba(31,20,53,0.82), rgba(45,27,72,0.78))",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.14)",
            color: "#fff",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 1000,
              lineHeight: 1.3,
            }}
          >
            {navInfo.instruction || "Navigation active"}
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {navInfo.distance || "--"} • {navInfo.duration || "--"}
          </div>
        </div>
      )}

      {loadError ? (
        <div
          style={{
            position: "absolute",
            top: 90,
            left: 16,
            right: 16,
            zIndex: 30,
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
