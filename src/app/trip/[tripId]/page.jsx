// File: src/app/trip/[tripId]/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { auth, db } from "../../../lib/firebase";

import MobileShell from "../../../components/ui/MobileShell";
import FloatingTopBar from "../../../components/ui/FloatingTopBar";
import BottomSheet from "../../../components/ui/BottomSheet";
import MapPlaceholder from "../../../components/ui/MapPlaceholder";
import ActionCard from "../../../components/ui/ActionCard";

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function tripStatusStyle(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    border: "1px solid transparent",
  };

  if (status === "accepted") {
    return {
      ...base,
      color: "#d9f6ff",
      background: "rgba(0,198,255,0.12)",
      border: "1px solid rgba(0,198,255,0.22)",
    };
  }

  if (status === "arrived") {
    return {
      ...base,
      color: "#fff7d6",
      background: "rgba(255,176,32,0.12)",
      border: "1px solid rgba(255,176,32,0.22)",
    };
  }

  if (status === "picked" || status === "enroute") {
    return {
      ...base,
      color: "#e7ffe9",
      background: "rgba(31,214,122,0.12)",
      border: "1px solid rgba(31,214,122,0.22)",
    };
  }

  if (status === "completed") {
    return {
      ...base,
      color: "#e8f0ff",
      background: "rgba(110,140,255,0.12)",
      border: "1px solid rgba(110,140,255,0.22)",
    };
  }

  return {
    ...base,
    color: "#f5f7fa",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

function statusMessage(status) {
  if (status === "accepted") return "Driver accepted your ride request.";
  if (status === "arrived") return "Your driver has arrived at the pickup point.";
  if (status === "picked") return "Trip started successfully.";
  if (status === "enroute") return "You are on the way to your destination.";
  if (status === "completed") return "Trip completed.";
  return "Waiting for trip updates.";
}

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params?.tripId;

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [trip, setTrip] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const driverLive = useMemo(() => {
    return trip?.driverLive || {};
  }, [trip]);

  useEffect(() => {
    if (!tripId) return;

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);

      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);

      try {
        setLoadingProfile(true);

        const snap = await get(ref(db, `profiles/${currentUser.uid}`));
        const profileData = snap.val();

        if (!profileData) {
          setError("Profile not found.");
          return;
        }

        setProfile(profileData);
      } catch (err) {
        console.error(err);
        setError("Failed to load your profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router, tripId]);

  useEffect(() => {
    if (!tripId) return;

    const tripRef = ref(db, `activeTrips/${tripId}`);

    const unsub = onValue(
      tripRef,
      (snap) => {
        const data = snap.val();

        if (!data) {
          setTrip(null);
          setLoadingTrip(false);
          setError("Trip not found or no longer active.");
          return;
        }

        setTrip(data);
        setLoadingTrip(false);

        try {
          localStorage.setItem("nexride-active-trip-id", tripId);
        } catch {}
      },
      (err) => {
        console.error(err);
        setLoadingTrip(false);
        setError("Failed to load trip.");
      }
    );

    return () => unsub();
  }, [tripId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error(err);
      setError("Failed to logout.");
    }
  };

  const goBackToRider = () => {
    router.push("/rider");
  };

  if (!authReady || loadingProfile || loadingTrip) {
    return (
      <MobileShell>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <ActionCard style={{ width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>
              Loading trip...
            </div>
            <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 8 }}>
              Preparing your live ride screen
            </div>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <MapPlaceholder
        label="Live trip"
        sublabel="Driver route, ETA, and live movement will appear here"
      />

      <FloatingTopBar
        title="NEXRIDE"
        subtitle={
          trip
            ? `${trip.driverName || "Driver"} • ${cityLabel(trip.city)}`
            : profile?.fullName || "Trip"
        }
        right={
          <button
            onClick={handleLogout}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 800,
            }}
          >
            Logout
          </button>
        }
      />

      <BottomSheet height="60vh">
        <div style={{ display: "grid", gap: 12 }}>
          {error ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255, 91, 91, 0.08)",
                border: "1px solid rgba(255, 91, 91, 0.18)",
                color: "#ffd5d5",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(31, 214, 122, 0.08)",
                border: "1px solid rgba(31, 214, 122, 0.18)",
                color: "#d5ffe7",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {success}
            </div>
          ) : null}

          {trip ? (
            <>
              <ActionCard>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 1000 }}>
                      Active trip
                    </div>
                    <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                      {statusMessage(trip.status)}
                    </div>
                  </div>

                  <div style={tripStatusStyle(trip.status || "accepted")}>
                    {trip.status || "accepted"}
                  </div>
                </div>

                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>
                    {trip.pickupName} → {trip.dropoffName}
                  </div>

                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Agreed fare: ${Number(trip.agreedPrice || 0).toFixed(2)}
                  </div>

                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Trip ID: {trip.tripId}
                  </div>
                </div>
              </ActionCard>

              <ActionCard>
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
                  Driver details
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {trip.driverName || "Driver"}
                  </div>

                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Phone: {trip.driverPhone || "Not available"}
                  </div>

                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Rider: {trip.riderName || "Rider"}
                  </div>
                </div>
              </ActionCard>

              <ActionCard>
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
                  OTP
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 140,
                    padding: "14px 18px",
                    borderRadius: 18,
                    background: "rgba(0,198,255,0.10)",
                    border: "1px solid rgba(0,198,255,0.18)",
                    fontSize: 28,
                    fontWeight: 1000,
                    letterSpacing: 4,
                    color: "#dff8ff",
                  }}
                >
                  {trip.otp || "------"}
                </div>

                <div style={{ fontSize: 12, color: "#9fb3c8", marginTop: 10 }}>
                  Show this code to the driver when pickup starts.
                </div>
              </ActionCard>

              <ActionCard>
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
                  Live driver data
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Latitude:{" "}
                    {driverLive?.lat !== undefined && driverLive?.lat !== null
                      ? driverLive.lat
                      : "Waiting..."}
                  </div>

                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Longitude:{" "}
                    {driverLive?.lng !== undefined && driverLive?.lng !== null
                      ? driverLive.lng
                      : "Waiting..."}
                  </div>

                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Heading:{" "}
                    {driverLive?.heading !== undefined && driverLive?.heading !== null
                      ? driverLive.heading
                      : "Waiting..."}
                  </div>

                  <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                    Updated:{" "}
                    {driverLive?.updatedAt
                      ? new Date(driverLive.updatedAt).toLocaleTimeString()
                      : "Waiting..."}
                  </div>
                </div>
              </ActionCard>

              {trip.notes ? (
                <ActionCard>
                  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
                    Trip notes
                  </div>

                  <div style={{ fontSize: 13, color: "#b7c9d9", lineHeight: 1.6 }}>
                    {trip.notes}
                  </div>
                </ActionCard>
              ) : null}

              <ActionCard>
                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    onClick={goBackToRider}
                    style={{
                      width: "100%",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      padding: "14px",
                      fontSize: 14,
                      fontWeight: 900,
                      color: "#fff",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    Back to rider page
                  </button>
                </div>
              </ActionCard>
            </>
          ) : (
            <ActionCard>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Trip unavailable</div>
              <div style={{ fontSize: 13, color: "#9fb3c8", marginBottom: 12 }}>
                This trip could not be found.
              </div>

              <button
                onClick={goBackToRider}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 16,
                  padding: "14px",
                  fontSize: 14,
                  fontWeight: 1000,
                  color: "#001018",
                  background: "linear-gradient(90deg,#00c6ff,#0066ff)",
                  boxShadow: "0 10px 24px rgba(0,102,255,0.22)",
                }}
              >
                Back to rider page
              </button>
            </ActionCard>
          )}
        </div>
      </BottomSheet>
    </MobileShell>
  );
}
