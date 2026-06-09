// File: src/app/trip/[tripId]/navigate/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, update } from "firebase/database";
import { auth, db } from "../../../../lib/firebase";
import { googleMapsDirectionsUrl, pointFromRecord, toLatLng } from "../../../../lib/googleMaps";
import { speakNexrideStage } from "../../../../lib/nexrideVoice";
import LiveGoogleMap from "../../../../components/maps/LiveGoogleMap";

function titleFor(status, role) {
  if (status === "accepted") return role === "driver" ? "Head to pickup" : "Driver is coming";
  if (status === "arrived") return role === "driver" ? "At pickup" : "Driver arrived";
  if (status === "picked") return "Trip started";
  if (status === "enroute") return "Following destination";
  if (status === "completed") return "Trip completed";
  return "NEXRIDE navigation";
}

function phaseFor(status) {
  if (status === "accepted" || status === "arrived") return "pickup";
  if (status === "completed") return "completed";
  return "destination";
}

function recordPoint(record, prefix, label) {
  const coords = pointFromRecord(record, prefix);
  if (coords) return { ...coords, label };
  return label ? { label } : null;
}

function safeLocation(pos) {
  const accuracy = Number(pos?.coords?.accuracy || 9999);
  if (accuracy > 250) return null;
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
    accuracy,
    updatedAt: Date.now(),
  };
}

export default function TripNavigatePage() {
  const { tripId } = useParams();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [trip, setTrip] = useState(null);
  const [completedTrip, setCompletedTrip] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [selfLocation, setSelfLocation] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      try {
        const snap = await get(ref(db, `profiles/${currentUser.uid}`));
        setProfile(snap.val() || {});
      } catch {
        setProfile({});
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!tripId) return;
    const tripNode = ref(db, `activeTrips/${tripId}`);
    const unsub = onValue(tripNode, (snap) => {
      const data = snap.val();
      setTrip(data || null);
      if (data) {
        setCompletedTrip(null);
        return;
      }
      get(ref(db, `completedTrips/${tripId}`)).then((done) => setCompletedTrip(done.val() || null)).catch(() => {});
    });
    return () => unsub();
  }, [tripId]);

  const role = profile?.role || (trip?.driverId === user?.uid ? "driver" : "rider");
  const liveTrip = trip || completedTrip;
  const phase = phaseFor(liveTrip?.status || "accepted");
  const city = liveTrip?.city || profile?.city || "harare";

  useEffect(() => {
    if (!user || !trip || typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const point = safeLocation(pos);
        if (!point) return;
        setSelfLocation(point);
        try {
          if (role === "driver") await update(ref(db, `activeTrips/${trip.tripId}/driverLive`), point);
          if (role === "rider" && ["accepted", "arrived"].includes(trip.status)) await update(ref(db, `activeTrips/${trip.tripId}/riderLive`), point);
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [role, trip, user]);

  useEffect(() => {
    if (!liveTrip?.status) return;
    speakNexrideStage(liveTrip.status, role, liveTrip, { force: false });
  }, [liveTrip?.status, role]);

  const driverLive = toLatLng(trip?.driverLive) || (role === "driver" ? selfLocation : null);
  const riderLive = toLatLng(trip?.riderLive) || (role === "rider" ? selfLocation : null);

  const origin = useMemo(() => {
    if (!liveTrip) return null;
    if (completedTrip) return recordPoint(completedTrip, "pickup", completedTrip.pickupName || "Pickup");
    if (phase === "pickup") return driverLive || recordPoint(liveTrip, "pickup", liveTrip.pickupName || "Pickup");
    return driverLive || riderLive || recordPoint(liveTrip, "pickup", liveTrip.pickupName || "Pickup");
  }, [completedTrip, driverLive, liveTrip, phase, riderLive]);

  const destination = useMemo(() => {
    if (!liveTrip) return null;
    if (completedTrip) return recordPoint(completedTrip, "dropoff", completedTrip.dropoffName || "Destination");
    if (phase === "pickup") return riderLive || recordPoint(liveTrip, "pickup", liveTrip.pickupName || "Pickup");
    return recordPoint(liveTrip, "dropoff", liveTrip.dropoffName || "Destination");
  }, [completedTrip, liveTrip, phase, riderLive]);

  const mapsUrl = useMemo(() => {
    if (!origin || !destination) return "";
    return googleMapsDirectionsUrl({ origin, destination, city });
  }, [city, destination, origin]);

  if (!authReady || !liveTrip) {
    return (
      <main className="nx-nav-page">
        <div className="nx-nav-loading">Loading NEXRIDE navigation...</div>
      </main>
    );
  }

  return (
    <main className="nx-nav-page">
      <LiveGoogleMap
        city={city}
        role={role}
        origin={origin}
        destination={destination}
        driverLocation={driverLive}
        riderLocation={riderLive}
        driverPhotoUrl={liveTrip.driverPhotoUrl || ""}
        riderPhotoUrl={liveTrip.riderPhotoUrl || ""}
        markers={[]}
        showRoute={Boolean(origin && destination)}
        cameraFollow
        followTarget={phase === "pickup" || role === "driver" ? "driver" : "route"}
        routePhase={phase}
        onRouteInfo={setRouteInfo}
      />

      <section className="nx-nav-top-card">
        <div className="nx-nav-arrow">↑</div>
        <div>
          <strong>{titleFor(liveTrip.status, role)}</strong>
          <span>{phase === "pickup" ? "Pickup route" : phase === "completed" ? "Final summary" : "Destination route"}</span>
        </div>
      </section>

      <button type="button" className="nx-nav-back" onClick={() => router.back()}>×</button>

      <section className="nx-nav-bottom-card">
        <div>
          <strong>{routeInfo?.durationText || liveTrip.durationText || "ETA loading"}</strong>
          <span>{routeInfo?.distanceText || liveTrip.distanceText || "Distance loading"} • {liveTrip.dropoffName || "Destination"}</span>
        </div>
        <div className="nx-nav-actions">
          <a href={mapsUrl} target="_blank" rel="noreferrer">Open Google</a>
          <button type="button" onClick={() => router.back()}>Details</button>
        </div>
      </section>
    </main>
  );
}
