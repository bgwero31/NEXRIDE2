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
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const requestMarkersRef = useRef({});
  const directionsRendererRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastDriverPosRef = useRef(null);
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

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
      center: getDefaultCenter(city),
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
      polylineOptions: {
        strokeColor: "#8b5cf6",
        strokeOpacity: 0.95,
        strokeWeight: 6,
      },
    });

    directionsRendererRef.current.setMap(map);

    setMapReady(true);
  }, [mapsApi, city]);

  // watch driver gps + push to firebase
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;
    if (!navigator.geolocation) return;

    const map = mapRef.current;

    const pushDriverPosition = async (lat, lng, heading = 0) => {
      const uid = auth.currentUser?.uid;
      if (!uid || !city) return;

      try {
        await update(dbRef(db, `driversOnline/${city}/${uid}`), {
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
      const heading =
        typeof pos.coords.heading === "number" ? pos.coords.heading : 0;

      const driverPos = { lat, lng };
      lastDriverPosRef.current = driverPos;

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new mapsApi.Marker({
          position: driverPos,
          map,
          title: "You",
          icon: makeDriverArrow(mapsApi, heading),
          zIndex: 999,
        });
      } else {
        driverMarkerRef.current.setPosition(driverPos);
        driverMarkerRef.current.setIcon(makeDriverArrow(mapsApi, heading));
      }

      if (!activeTrip && followRef.current) {
        map.panTo(driverPos);
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
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
    };
  }, [mapReady, mapsApi, city, activeTrip]);

  // nearby request markers
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

  // active trip markers + route
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;

    const map = mapRef.current;
    const directionsService = new mapsApi.DirectionsService();

    if (!activeTrip) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setMap(null);
        pickupMarkerRef.current = null;
      }
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setMap(null);
        dropoffMarkerRef.current = null;
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setDirections({ routes: [] });
      }
      setNavInfo({
        distance: "",
        duration: "",
        instruction: "",
      });
      return;
    }

    const pickupLat = Number(activeTrip?.pickupLat);
    const pickupLng = Number(activeTrip?.pickupLng);
    const dropoffLat = Number(activeTrip?.dropoffLat);
    const dropoffLng = Number(activeTrip?.dropoffLng);

    if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
      const pickupPos = { lat: pickupLat, lng: pickupLng };

      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new mapsApi.Marker({
          position: pickupPos,
          map,
          title: "Pickup",
          icon: makeDot(mapsApi, "#06b6d4", 7),
          zIndex: 200,
        });
      } else {
        pickupMarkerRef.current.setPosition(pickupPos);
      }
    }

    if (Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)) {
      const dropoffPos = { lat: dropoffLat, lng: dropoffLng };

      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = new mapsApi.Marker({
          position: dropoffPos,
          map,
          title: "Destination",
          icon: makeDot(mapsApi, "#ec4899", 7),
          zIndex: 200,
        });
      } else {
        dropoffMarkerRef.current.setPosition(dropoffPos);
      }
    }

    const driverPos = lastDriverPosRef.current;
    if (!driverPos) return;

    const goingToPickup =
      activeTrip.status === "accepted" || activeTrip.status === "arrived";

    const destination = goingToPickup
      ? { lat: pickupLat, lng: pickupLng }
      : { lat: dropoffLat, lng: dropoffLng };

    if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) {
      return;
    }

    directionsService.route(
      {
        origin: driverPos,
        destination,
        travelMode: mapsApi.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes?.length) return;

        directionsRendererRef.current?.setDirections(result);

        const leg = result.routes[0]?.legs?.[0];
        const firstStep = leg?.steps?.[0];
        const instruction = firstStep?.instructions
          ? stripHtml(firstStep.instructions)
          : goingToPickup
          ? "Proceed to pickup"
          : "Proceed to destination";

        setNavInfo({
          distance: leg?.distance?.text || "",
          duration: leg?.duration?.text || "",
          instruction,
        });

        const speakKey = `${activeTrip.status}-${instruction}`;
        if (lastSpeakKeyRef.current !== speakKey) {
          lastSpeakKeyRef.current = speakKey;
          speak(instruction);
        }

        if (followRef.current) {
          const bounds = new mapsApi.LatLngBounds();
          bounds.extend(driverPos);
          bounds.extend(destination);
          map.fitBounds(bounds, 80);
        }
      }
    );
  }, [mapReady, mapsApi, activeTrip]);

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
