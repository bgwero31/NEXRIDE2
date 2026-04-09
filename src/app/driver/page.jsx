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
import DriverMap from "../../components/driver/DriverMap";
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
  const cityKey = useMemo(
    () => String(city || "").trim().toLowerCase(),
    [city]
  );

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
  const onlineStateUnsubRef = useRef(null);
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
    if (!user || !cityKey) return;

    try {
      requestsUnsubRef.current?.();
    } catch {}

    const requestsRef = ref(db, `rideRequests/${cityKey}`);
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
  }, [cityKey, user]);

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

  // keep online state synced from firebase
  useEffect(() => {
    if (!user || !cityKey) return;

    try {
      onlineStateUnsubRef.current?.();
    } catch {}

    const onlineRef = ref(db, `driversOnline/${cityKey}/${user.uid}`);
    onlineStateUnsubRef.current = onValue(onlineRef, (snap) => {
      const data = snap.val();
      setOnline(!!data?.online);
    });

    return () => {
      try {
        onlineStateUnsubRef.current?.();
      } catch {}
    };
  }, [user, cityKey]);

  useEffect(() => {
    if (!user || !cityKey) return;

    const driverNode = ref(db, `driversOnline/${cityKey}/${user.uid}`);

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
  }, [user, cityKey]);

  // backup live gps watcher
  useEffect(() => {
    if (!user || !cityKey || !online) return;
    if (!navigator.geolocation) return;

    const driverOnlineRef = ref(db, `driversOnline/${cityKey}/${user.uid}`);

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
  }, [user, cityKey, online, activeTrip?.tripId]);

  const toggleOnline = async () => {
    if (!user || !profile || !cityKey) return;

    setError("");
    setSuccess("");

    try {
      setSavingOnline(true);

      const node = ref(db, `driversOnline/${cityKey}/${user.uid}`);

      if (!online) {
        await set(node, {
          driverId: user.uid,
          name: profile.fullName || "Driver",
          phone: profile.phone || "",
          vehicleType: profile.vehicleType || "car",
          carName: profile.carName || "",
          plateNumber: profile.plateNumber || "",
          city: cityKey,
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
    if (!user || !profile || !cityKey || !requestItem?.id) return;

    setError("");
    setSuccess("");
    setWorkingRequestId(requestItem.id);

    try {
      const requestPath = ref(db, `rideRequests/${cityKey}/${requestItem.id}`);
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
        city: cityKey,
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
              await update(ref(db, `driversOnline/${cityKey}/${user.uid}`), {
                lat,
                lng,
                heading,
                online: true,
                lastSeen: Date.now(),
              });
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
      if (user && cityKey) {
        const node = ref(db, `driversOnline/${cityKey}/${user.uid}`);
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
      <DriverMap
        mode={mode}
        city={cityKey}
        activeTrip={activeTrip}
        requests={visibleRequests}
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

      <BottomSheet height="12vh" padding={10}>
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

                <d
