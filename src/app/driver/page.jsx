// File: src/app/driver/page.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  get,
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";
import { auth, db } from "../../lib/firebase";

import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import BottomSheet from "../../components/ui/BottomSheet";
import MapPlaceholder from "../../components/ui/MapPlaceholder";
import ActionCard from "../../components/ui/ActionCard";
import DriverTripControls, {
  pushDriverLivePosition,
} from "../../components/driver/DriverTripControls";

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function requestStatusStyle(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };

  if (status === "open") {
    return {
      ...base,
      color: "#6d28d9",
      background: "rgba(124,58,237,0.10)",
      border: "1px solid rgba(124,58,237,0.12)",
    };
  }

  if (status === "matched" || status === "accepted") {
    return {
      ...base,
      color: "#0f7a4e",
      background: "rgba(31,214,122,0.10)",
      border: "1px solid rgba(31,214,122,0.16)",
    };
  }

  return {
    ...base,
    color: "#5f557c",
    background: "rgba(255,255,255,0.58)",
    border: "1px solid rgba(124,58,237,0.08)",
  };
}

function getMode({ online, activeTrip, completedTrip }) {
  if (completedTrip) return "completed";
  if (activeTrip) return "trip";
  if (!online) return "offline";
  return "queue";
}

export default function DriverPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [city, setCity] = useState("");
  const [online, setOnline] = useState(false);

  const [requests, setRequests] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [completedTrip, setCompletedTrip] = useState(null);

  const [negotiatingFor, setNegotiatingFor] = useState(null);
  const [proposedPrice, setProposedPrice] = useState("");
  const [proposedMessage, setProposedMessage] = useState("");

  const [statusText, setStatusText] = useState("Loading driver app...");
  const [savingOnline, setSavingOnline] = useState(false);
  const [workingRequestId, setWorkingRequestId] = useState("");
  const [sendingNegotiation, setSendingNegotiation] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestsUnsubRef = useRef(null);
  const activeTripUnsubRef = useRef(null);
  const locationWatchRef = useRef(null);

  const visibleRequests = useMemo(() => {
    return requests
      .filter((r) => r.status === "open")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [requests]);

  const mode = useMemo(
    () => getMode({ online, activeTrip, completedTrip }),
    [online, activeTrip, completedTrip]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);

      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);

      try {
        setLoadingProfile(true);
        setError("");

        const snap = await get(ref(db, `profiles/${currentUser.uid}`));
        const profileData = snap.val();

        if (!profileData) {
          setError("Driver profile not found.");
          return;
        }

        const userSnap = await get(ref(db, `users/${currentUser.uid}`));
        const userData = userSnap.val();
        const actualRole = profileData.role || userData?.role || "rider";

        if (actualRole !== "driver") {
          router.push("/rider");
          return;
        }

        setProfile({
          ...profileData,
          role: actualRole,
        });

        const savedCity =
          profileData.city ||
          (typeof window !== "undefined"
            ? localStorage.getItem("nexride-last-place")
            : null) ||
          "harare";

        setCity(savedCity);
        setStatusText("Driver dashboard ready");

        try {
          localStorage.setItem("nexride-last-place", savedCity);
        } catch {}
      } catch (err) {
        console.error(err);
        setError("Failed to load driver profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user || !city) return;

    try {
      requestsUnsubRef.current?.();
    } catch {}

    const requestsRef = ref(db, `rideRequests/${city}`);
    requestsUnsubRef.current = onValue(requestsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setRequests(arr);
    });

    return () => {
      try {
        requestsUnsubRef.current?.();
      } catch {}
    };
  }, [city, user]);

  useEffect(() => {
    if (!user) return;

    try {
      activeTripUnsubRef.current?.();
    } catch {}

    const activeTripsRef = ref(db, "activeTrips");
    activeTripUnsubRef.current = onValue(activeTripsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));

      const mine = arr.find((trip) => trip.driverId === user.uid) || null;

      setActiveTrip(mine);
      if (mine) {
        setCompletedTrip(null);
        try {
          localStorage.setItem("nexride-driver-active-trip-id", mine.tripId);
        } catch {}
      }
    });

    return () => {
      try {
        activeTripUnsubRef.current?.();
      } catch {}
    };
  }, [user]);

  useEffect(() => {
    if (!user || !city) return;

    const driverNode = ref(db, `driversOnline/${city}/${user.uid}`);

    const handleUnload = () => {
      try {
        update(driverNode, {
          online: false,
          lastSeen: Date.now(),
        });
      } catch {}
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user, city]);

  useEffect(() => {
    if (!user || !city || !online) return;
    if (!navigator.geolocation) return;

    const driverOnlineRef = ref(db, `driversOnline/${city}/${user.uid}`);

    const handlePosition = async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const heading =
        typeof pos.coords.heading === "number" ? pos.coords.heading : null;

      try {
        await update(driverOnlineRef, {
          lat,
          lng,
          heading,
          online: true,
          lastSeen: Date.now(),
        });

        if (activeTrip?.tripId) {
          await pushDriverLivePosition(activeTrip.tripId, lat, lng, heading);
        }
      } catch (err) {
        console.error("driver live location update failed", err);
      }
    };

    const handleError = (err) => {
      console.error("driver geolocation error", err);
    };

    navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    locationWatchRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      }
    );

    return () => {
      try {
        if (locationWatchRef.current) {
          navigator.geolocation.clearWatch(locationWatchRef.current);
        }
      } catch {}
    };
  }, [user, city, online, activeTrip?.tripId]);

  const toggleOnline = async () => {
    if (!user || !profile || !city) return;

    setError("");
    setSuccess("");

    try {
      setSavingOnline(true);

      const node = ref(db, `driversOnline/${city}/${user.uid}`);

      if (!online) {
        await set(node, {
          driverId: user.uid,
          name: profile.fullName || "Driver",
          phone: profile.phone || "",
          vehicleType: profile.vehicleType || "car",
          carName: profile.carName || "",
          plateNumber: profile.plateNumber || "",
          city,
          lat: null,
          lng: null,
          heading: null,
          online: true,
          lastSeen: Date.now(),
        });

        setOnline(true);
        setStatusText("You are now online");
        setSuccess("Driver is online.");
      } else {
        await update(node, {
          online: false,
          lastSeen: Date.now(),
        });

        setOnline(false);
        setStatusText("You are offline");
        setSuccess("Driver is offline.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to update online status.");
    } finally {
      setSavingOnline(false);
    }
  };

  const acceptRequest = async (requestItem) => {
    if (!user || !profile || !city || !requestItem?.id) return;

    setError("");
    setSuccess("");
    setWorkingRequestId(requestItem.id);

    try {
      const requestPath = ref(db, `rideRequests/${city}/${requestItem.id}`);
      const snap = await get(requestPath);
      const freshRequest = snap.val();

      if (!freshRequest || freshRequest.status !== "open") {
        setError("This request is no longer available.");
        setWorkingRequestId("");
        return;
      }

      const tripRef = push(ref(db, "activeTrips"));
      const tripId = tripRef.key;
      const now = Date.now();
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      const payload = {
        tripId,
        requestId: requestItem.id,
        city,
        riderId: freshRequest.riderId,
        riderName: freshRequest.riderName || "Rider",
        riderPhone: freshRequest.riderPhone || "",
        driverId: user.uid,
        driverName: profile.fullName || "Driver",
        driverPhone: profile.phone || "",
        pickupName: freshRequest.pickupName || "",
        pickupLat: freshRequest.pickupLat ?? null,
        pickupLng: freshRequest.pickupLng ?? null,
        dropoffName: freshRequest.dropoffName || "",
        dropoffLat: freshRequest.dropoffLat ?? null,
        dropoffLng: freshRequest.dropoffLng ?? null,
        agreedPrice: Number(freshRequest.offerPrice || 0),
        people: Number(freshRequest.people || 1),
        notes: freshRequest.notes || "",
        otp,
        status: "accepted",
        createdAt: now,
        driverLive: {
          lat: null,
          lng: null,
          heading: null,
          updatedAt: now,
        },
      };

      await set(tripRef, payload);

      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const heading =
                typeof pos.coords.heading === "number"
                  ? pos.coords.heading
                  : null;

              await pushDriverLivePosition(tripId, lat, lng, heading);
            },
            (err) => console.error("initial trip location push failed", err),
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
        }
      } catch (err) {
        console.error("initial driver location set failed", err);
      }

      await update(requestPath, {
        status: "matched",
        matchedDriverId: user.uid,
        matchedTripId: tripId,
        matchedAt: now,
      });

      setActiveTrip(payload);
      setCompletedTrip(null);
      setSuccess("Ride accepted successfully.");
      setStatusText("Trip accepted");

      try {
        localStorage.setItem("nexride-driver-active-trip-id", tripId);
      } catch {}
    } catch (err) {
      console.error(err);
      setError("Failed to accept request.");
    } finally {
      setWorkingRequestId("");
    }
  };

  const openNegotiate = (requestItem) => {
    setNegotiatingFor(requestItem);
    setProposedPrice(String(requestItem.offerPrice || ""));
    setProposedMessage("");
    setError("");
    setSuccess("");
  };

  const sendNegotiation = async () => {
    if (!user || !profile || !negotiatingFor?.id) return;

    setError("");
    setSuccess("");

    const price = Number(proposedPrice);

    if (!price || price <= 0) {
      setError("Enter a valid price.");
      return;
    }

    try {
      setSendingNegotiation(true);

      const offerRef = push(ref(db, `rideOffers/${negotiatingFor.id}`));

      await set(offerRef, {
        driverId: user.uid,
        driverName: profile.fullName || "Driver",
        driverPhone: profile.phone || "",
        proposedPrice: price,
        message: proposedMessage.trim(),
        status: "pending",
        createdAt: Date.now(),
      });

      setSuccess("Negotiation sent.");
      setNegotiatingFor(null);
      setProposedPrice("");
      setProposedMessage("");
    } catch (err) {
      console.error(err);
      setError("Failed to send negotiation.");
    } finally {
      setSendingNegotiation(false);
    }
  };

  const handleTripUpdated = (updatedTrip) => {
    setActiveTrip(updatedTrip);
    setStatusText(`Trip ${updatedTrip.status}`);
  };

  const handleTripCompleted = (doneTrip) => {
    setCompletedTrip(doneTrip);
    setActiveTrip(null);
    setStatusText("Trip completed");

    try {
      localStorage.removeItem("nexride-driver-active-trip-id");
    } catch {}
  };

  const resetCompletedState = () => {
    setCompletedTrip(null);
    setSuccess("");
    setError("");
  };

  const handleLogout = async () => {
    try {
      if (user && city) {
        const node = ref(db, `driversOnline/${city}/${user.uid}`);
        await update(node, {
          online: false,
          lastSeen: Date.now(),
        });
      }

      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error(err);
      setError("Failed to logout.");
    }
  };

  if (!authReady || loadingProfile) {
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
          <ActionCard
            style={{
              width: "100%",
              textAlign: "center",
              padding: 16,
              borderRadius: 22,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.60), rgba(247,241,255,0.88))",
              border: "1px solid rgba(124,58,237,0.10)",
              boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 1000, color: "#23153d" }}>
              Loading driver app...
            </div>
            <div style={{ fontSize: 12, color: "#615682", marginTop: 6 }}>
              Preparing your dashboard
            </div>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <MapPlaceholder
        label={
          mode === "trip"
            ? "Live driver trip"
            : mode === "completed"
            ? "Trip completed"
            : online
            ? "Nearby requests"
            : "Driver map"
        }
        sublabel={
          mode === "trip"
            ? "Pickup route, trip status, and live movement will appear here"
            : mode === "completed"
            ? "Your last completed trip summary"
            : online
            ? "Open ride requests in your city"
            : "Go online to start receiving requests"
        }
      />

      <FloatingTopBar
        title="NEXRIDE DRIVER"
        subtitle={`${profile?.fullName || "Driver"} • ${cityLabel(city)}`}
        right={
          <button
            onClick={handleLogout}
            style={{
              border: "1px solid rgba(124,58,237,0.10)",
              background: "rgba(255,255,255,0.58)",
              color: "#5b21b6",
              borderRadius: 14,
              padding: "10px 12px",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            Logout
          </button>
        }
      />

      <BottomSheet height="16vh">
        <div style={{ display: "grid", gap: 8 }}>
          {error ? (
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                background: "rgba(255, 91, 91, 0.08)",
                border: "1px solid rgba(255, 91, 91, 0.18)",
                color: "#a61b3c",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                background: "rgba(31,214,122,0.10)",
                border: "1px solid rgba(31,214,122,0.18)",
                color: "#0f7a4e",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {success}
            </div>
          ) : null}

          {(mode === "offline" || mode === "queue") && (
            <ActionCard
              style={{
                padding: 12,
                borderRadius: 22,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.60), rgba(247,241,255,0.88))",
                border: "1px solid rgba(124,58,237,0.10)",
                boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 1000,
                      color: "#23153d",
                      lineHeight: 1.1,
                    }}
                  >
                    {profile?.carName || "Your car"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#74698f",
                      marginTop: 3,
                    }}
                  >
                    {profile?.plateNumber || "No plate"} • {cityLabel(city)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#615682",
                      marginTop: 6,
                    }}
                  >
                    {statusText}
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    color: online ? "#0f7a4e" : "#5f557c",
                    background: online
                      ? "rgba(31,214,122,0.10)"
                      : "rgba(255,255,255,0.58)",
                    border: online
                      ? "1px solid rgba(31,214,122,0.16)"
                      : "1px solid rgba(124,58,237,0.08)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {online ? "ONLINE" : "OFFLINE"}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={toggleOnline}
                  disabled={savingOnline}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 18,
                    padding: "14px",
                    fontSize: 14,
                    fontWeight: 1000,
                    color: "#fff",
                    background: "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
                    boxShadow: "0 12px 28px rgba(124,58,237,0.18)",
                  }}
                >
                  {savingOnline
                    ? "Saving..."
                    : online
                    ? "Go offline"
                    : "Go online"}
                </button>
              </div>
            </ActionCard>
          )}

          {mode === "offline" && (
            <ActionCard
              style={{
                padding: 12,
                borderRadius: 20,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.86))",
                border: "1px solid rgba(124,58,237,0.10)",
                boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 1000,
                  color: "#23153d",
                  marginBottom: 5,
                }}
              >
                You are offline
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#615682",
                  lineHeight: 1.45,
                }}
              >
                Go online first to start receiving rider requests in your city.
              </div>
            </ActionCard>
          )}

          {mode === "queue" && (
            <>
              <div style={{ padding: "0 2px" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 1000,
                    color: "#23153d",
                  }}
                >
                  Nearby requests
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#615682",
                    marginTop: 3,
                  }}
                >
                  Open ride requests in {cityLabel(city)}
                </div>
              </div>

              {visibleRequests.length === 0 ? (
                <ActionCard
                  style={{
                    padding: 12,
                    borderRadius: 20,
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.86))",
                    border: "1px solid rgba(124,58,237,0.10)",
                    boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 1000,
                      color: "#23153d",
                      marginBottom: 5,
                    }}
                  >
                    No open requests
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#615682",
                      lineHeight: 1.45,
                    }}
                  >
                    Waiting for riders to request trips in your city.
                  </div>
                </ActionCard>
              ) : (
                visibleRequests.map((item) => (
                  <ActionCard
                    key={item.id}
                    style={{
                      padding: 12,
                      borderRadius: 20,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.86))",
                      border: "1px solid rgba(124,58,237,0.10)",
                      boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
                      backdropFilter: "blur(16px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 1000,
                            color: "#23153d",
                            lineHeight: 1.3,
                          }}
                        >
                          {item.pickupName} → {item.dropoffName}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "#74698f",
                            marginTop: 5,
                          }}
                        >
                          Rider: {item.riderName || "Rider"}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "#615682",
                            marginTop: 4,
                            lineHeight: 1.4,
                          }}
                        >
                          Offer: ${Number(item.offerPrice || 0).toFixed(2)} • People:{" "}
                          {item.people || 1}
                        </div>

                        {item.notes ? (
                          <div
                            style={{
                              marginTop: 8,
                              padding: 10,
                              borderRadius: 14,
                              background: "rgba(255,255,255,0.58)",
                              border: "1px solid rgba(124,58,237,0.08)",
                              color: "#51466f",
                              fontSize: 12,
                              lineHeight: 1.45,
                            }}
                          >
                            {item.notes}
                          </div>
                        ) : null}
                      </div>

                      <div style={requestStatusStyle(item.status || "open")}>
                        {item.status || "open"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      <button
                        onClick={() => acceptRequest(item)}
                        disabled={!!workingRequestId || !!activeTrip}
                        style={{
                          width: "100%",
                          border: "none",
                          borderRadius: 16,
                          padding: "12px 14px",
                          fontSize: 13,
                          fontWeight: 1000,
                          color: "#fff",
                          background:
                            "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
                          boxShadow: "0 10px 22px rgba(124,58,237,0.18)",
                        }}
                      >
                        {workingRequestId === item.id ? "Accepting..." : "Accept"}
                      </button>

                      <button
                        onClick={() => openNegotiate(item)}
                        disabled={!!activeTrip}
                        style={{
                          width: "100%",
                          border: "1px solid rgba(124,58,237,0.10)",
                          borderRadius: 16,
                          padding: "12px 14px",
                          fontSize: 13,
                          fontWeight: 1000,
                          color: "#5b21b6",
                          background: "rgba(255,255,255,0.58)",
                        }}
                      >
                        Negotiate
                      </button>
                    </div>
                  </ActionCard>
                ))
              )}
            </>
          )}

          {mode === "trip" && (
            <DriverTripControls
              trip={activeTrip}
              onTripUpdated={handleTripUpdated}
              onTripCompleted={handleTripCompleted}
            />
          )}

          {mode === "completed" && completedTrip && (
            <ActionCard
              style={{
                padding: 12,
                borderRadius: 22,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.60), rgba(247,241,255,0.88))",
                border: "1px solid rgba(124,58,237,0.10)",
                boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 1000,
                      color: "#23153d",
                      lineHeight: 1.1,
                    }}
                  >
                    Trip completed
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#615682",
                      marginTop: 4,
                    }}
                  >
                    Your last trip has been completed successfully.
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#0f7a4e",
                    background: "rgba(31,214,122,0.10)",
                    border: "1px solid rgba(31,214,122,0.16)",
                  }}
                >
                  COMPLETED
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 1000,
                    color: "#23153d",
                  }}
                >
                  {completedTrip.pickupName} → {completedTrip.dropoffName}
                </div>
                <div style={{ fontSize: 11, color: "#74698f" }}>
                  Rider: {completedTrip.riderName || "Rider"}
                </div>
                <div style={{ fontSize: 11, color: "#615682" }}>
                  Fare: ${Number(completedTrip.agreedPrice || 0).toFixed(2)}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={resetCompletedState}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 18,
                    padding: "14px",
                    fontSize: 13,
                    fontWeight: 1000,
                    color: "#fff",
                    background:
                      "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
                    boxShadow: "0 12px 28px rgba(124,58,237,0.18)",
                  }}
                >
                  Back to queue
                </button>
              </div>
            </ActionCard>
          )}
        </div>
      </BottomSheet>

      {negotiatingFor ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(44, 20, 88, 0.18)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 24,
              padding: 16,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(247,241,255,0.92))",
              border: "1px solid rgba(124,58,237,0.10)",
              boxShadow: "0 20px 60px rgba(41,19,78,0.16)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div
              style={{
                fontWeight: 1000,
                fontSize: 16,
                color: "#23153d",
                marginBottom: 6,
              }}
            >
              Negotiate offer
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#615682",
                marginBottom: 12,
                lineHeight: 1.45,
              }}
            >
              Send a custom price to {negotiatingFor.riderName || "this rider"}.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                className="nx-input"
                type="number"
                min="1"
                step="0.01"
                value={proposedPrice}
                onChange={(e) => setProposedPrice(e.target.value)}
                placeholder="Proposed price ($)"
              />

              <textarea
                className="nx-input"
                value={proposedMessage}
                onChange={(e) => setProposedMessage(e.target.value)}
                placeholder="I can be there in 4 minutes"
                style={{
                  minHeight: 84,
                  resize: "none",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setNegotiatingFor(null);
                    setProposedPrice("");
                    setProposedMessage("");
                  }}
                  style={{
                    width: "100%",
                    border: "1px solid rgba(124,58,237,0.10)",
                    borderRadius: 16,
                    padding: "12px 14px",
                    fontSize: 13,
                    fontWeight: 1000,
                    color: "#5b21b6",
                    background: "rgba(255,255,255,0.58)",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={sendNegotiation}
                  disabled={sendingNegotiation}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 16,
                    padding: "12px 14px",
                    fontSize: 13,
                    fontWeight: 1000,
                    color: "#fff",
                    background:
                      "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
                    boxShadow: "0 10px 22px rgba(124,58,237,0.18)",
                  }}
                >
                  {sendingNegotiation ? "Sending..." : "Send offer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  );
}
