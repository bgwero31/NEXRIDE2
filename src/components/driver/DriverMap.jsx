// File: src/components/driver/DriverMap.jsx

"use client";

import { useEffect, useRef, useState } from "react";

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

function makeRequestMarkerHtml(price = "") {
  return `
    <div style="
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg,#a855f7,#7c3aed);
      box-shadow: 0 0 18px rgba(124,58,237,0.45);
      border: 2px solid #fff;
    "></div>
    ${
      price
        ? `<div style="
            position:absolute;
            top:-28px;
            left:50%;
            transform:translateX(-50%);
            background:rgba(255,255,255,0.96);
            color:#4c1d95;
            border:1px solid rgba(124,58,237,0.12);
            font-size:11px;
            font-weight:900;
            border-radius:999px;
            padding:4px 8px;
            white-space:nowrap;
            box-shadow:0 8px 16px rgba(0,0,0,0.10);
          ">${price}</div>`
        : ""
    }
  `;
}

function makePickupMarkerHtml() {
  return `
    <div style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg,#c4b5fd,#8b5cf6);
      border: 2px solid #fff;
      box-shadow: 0 0 18px rgba(139,92,246,0.45);
    "></div>
  `;
}

function makeDropoffMarkerHtml() {
  return `
    <div style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg,#ec4899,#8b5cf6);
      border: 2px solid #fff;
      box-shadow: 0 0 18px rgba(236,72,153,0.32);
    "></div>
  `;
}

function makeDriverMarkerHtml(heading = 0) {
  return `
    <div style="
      position: relative;
      width: 54px;
      height: 54px;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="
        position:absolute;
        inset:0;
        border-radius:50%;
        background: radial-gradient(circle, rgba(168,85,247,0.22), rgba(124,58,237,0.04) 70%, rgba(124,58,237,0) 75%);
        animation: nxDriverPulse 1.8s ease-in-out infinite;
      "></div>

      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg,#c084fc,#7c3aed);
        border: 2px solid #fff;
        box-shadow: 0 0 20px rgba(124,58,237,0.45);
        display:flex;
        align-items:center;
        justify-content:center;
        transform: rotate(${Number(heading || 0)}deg);
      ">
        <div style="
          width:0;
          height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-bottom:10px solid #fff;
          transform: translateY(-1px);
        "></div>
      </div>
    </div>
  `;
}

function speakText(text) {
  try {
    if (!window?.speechSynthesis || !text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    window.speechSynthesis.cancel();
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
  const lastSpokenRef = useRef("");
  const followDriverRef = useRef(true);

  const [mapsApi, setMapsApi] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [navStats, setNavStats] = useState({
    distanceText: "",
    durationText: "",
    nextInstruction: "",
  });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes nxDriverPulse {
        0%,100% { transform: scale(0.92); opacity: 0.75; }
        50% { transform: scale(1.08); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      try {
        document.head.removeChild(style);
      } catch {}
    };
  }, []);

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
      followDriverRef.current = false;
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

  // watch live driver position
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;
    if (!navigator.geolocation) return;

    const map = mapRef.current;

    const onSuccess = (pos) => {
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
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54"><foreignObject width="54" height="54">${makeDriverMarkerHtml(
                heading
              )}</foreignObject></svg>`
            )}`,
            scaledSize: new mapsApi.Size(54, 54),
            anchor: new mapsApi.Point(27, 27),
          },
          zIndex: 999,
        });
      } else {
        driverMarkerRef.current.setPosition(driverPos);
        driverMarkerRef.current.setIcon({
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54"><foreignObject width="54" height="54">${makeDriverMarkerHtml(
              heading
            )}</foreignObject></svg>`
          )}`,
          scaledSize: new mapsApi.Size(54, 54),
          anchor: new mapsApi.Point(27, 27),
        });
      }

      if (!activeTrip && followDriverRef.current) {
        map.panTo(driverPos);
      }
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
  }, [mapReady, mapsApi, activeTrip]);

  // draw open requests on queue mode
  useEffect(() => {
    if (!mapReady || !mapsApi || !mapRef.current) return;
    const map = mapRef.current;
    const currentMarkers = requestMarkersRef.current;
    const queueMode = mode === "queue";

    Object.keys(currentMarkers).forEach((id) => {
      const stillExists = queueMode && requests.some((r) => r.id === id);
      if (!stillExists) {
        currentMarkers[id].setMap(null);
        delete currentMarkers[id];
      }
    });

    if (!queueMode) return;

    requests.forEach((item) => {
      const lat = Number(item?.pickupLat);
      const lng = Number(item?.pickupLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos = { lat, lng };
      const price = `$${Number(item?.offerPrice || 0).toFixed(0)}`;

      if (!currentMarkers[item.id]) {
        currentMarkers[item.id] = new mapsApi.Marker({
          position: pos,
          map,
          title: item?.pickupName || "Ride request",
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="56"><foreignObject width="70" height="56">${makeRequestMarkerHtml(
                price
              )}</foreignObject></svg>`
            )}`,
            scaledSize: new mapsApi.Size(70, 56),
            anchor: new mapsApi.Point(35, 28),
          },
          zIndex: 50,
        });
      } else {
        currentMarkers[item.id].setPosition(pos);
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
      setNavStats({
        distanceText: "",
        durationText: "",
        nextInstruction: "",
      });
      return;
    }

    const pickupLat = Number(activeTrip?.pickupLat);
    const pickupLng = Number(activeTrip?.pickupLng);
    const dropoffLat = Number(activeTrip?.dropoffLat);
    const dropoffLng = Number(activeTrip?.dropoffLng);

    if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
      const pos = { lat: pickupLat, lng: pickupLng };
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new mapsApi.Marker({
          position: pos,
          map,
          title: "Pickup",
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><foreignObject width="24" height="24">${makePickupMarkerHtml()}</foreignObject></svg>`
            )}`,
            scaledSize: new mapsApi.Size(24, 24),
            anchor: new mapsApi.Point(12, 12),
          },
          zIndex: 300,
        });
      } else {
        pickupMarkerRef.current.setPosition(pos);
      }
    }

    if (Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)) {
      const pos = { lat: dropoffLat, lng: dropoffLng };
      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = new mapsApi.Marker({
          position: pos,
          map,
          title: "Destination",
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><foreignObject width="24" height="24">${makeDropoffMarkerHtml()}</foreignObject></svg>`
            )}`,
            scaledSize: new mapsApi.Size(24, 24),
            anchor: new mapsApi.Point(12, 12),
          },
          zIndex: 300,
        });
      } else {
        dropoffMarkerRef.current.setPosition(pos);
      }
    }

    const driverPos = lastDriverPosRef.current;
    if (!driverPos) return;

    const toPickup =
      activeTrip.status === "accepted" || activeTrip.status === "arrived";

    const routeRequest = toPickup
      ? {
          origin: driverPos,
          destination: { lat: pickupLat, lng: pickupLng },
          travelMode: mapsApi.TravelMode.DRIVING,
        }
      : {
          origin: driverPos,
          destination: { lat: dropoffLat, lng: dropoffLng },
          travelMode: mapsApi.TravelMode.DRIVING,
        };

    if (
      !Number.isFinite(routeRequest.destination?.lat) ||
      !Number.isFinite(routeRequest.destination?.lng)
    ) {
      return;
    }

    directionsService.route(routeRequest, (result, status) => {
      if (status !== "OK" || !result?.routes?.length) return;

      if (directionsRendererRef.current) {
        directionsRendererRef.current.setDirections(result);
      }

      const leg = result.routes[0]?.legs?.[0];
      const firstStep = leg?.steps?.[0];

      const nextInstruction = firstStep?.instructions
        ? String(firstStep.instructions).replace(/<[^>]+>/g, "")
        : toPickup
        ? "Proceed to pickup"
        : "Proceed to destination";

      setNavStats({
        distanceText: leg?.distance?.text || "",
        durationText: leg?.duration?.text || "",
        nextInstruction,
      });

      const speakKey = `${activeTrip.status}-${nextInstruction}`;
      if (lastSpokenRef.current !== speakKey) {
        lastSpokenRef.current = speakKey;
        speakText(nextInstruction);
      }

      if (followDriverRef.current) {
        try {
          const bounds = new mapsApi.LatLngBounds();
          bounds.extend(driverPos);
          bounds.extend(routeRequest.destination);
          map.fitBounds(bounds, 80);
        } catch {}
      }
    });
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

      {(navStats.distanceText || navStats.durationText || navStats.nextInstruction) && (
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
            {navStats.nextInstruction || "Navigation active"}
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {navStats.distanceText || "--"} • {navStats.durationText || "--"}
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
