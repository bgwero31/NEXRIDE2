// File: src/app/rider/page.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, ref, remove } from "firebase/database";
import { auth, db } from "../../lib/firebase";

import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import BottomSheet from "../../components/ui/BottomSheet";
import RiderMap from "../../components/rider/RiderMap";
import ActionCard from "../../components/ui/ActionCard";

import RequestSheet from "../../components/rider/RequestSheet";
import WaitingSheet from "../../components/rider/WaitingSheet";
import OffersSheet from "../../components/rider/OffersSheet";
import TripSheet from "../../components/rider/TripSheet";
import CompletedSheet from "../../components/rider/CompletedSheet";

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function getMode({ requestData, offers, tripData, completedTrip }) {
  if (completedTrip) return "completed";
  if (tripData) return "trip";
  if (requestData && offers.length > 0) return "offers";
  if (requestData) return "waiting";
  return "request";
}

export default function RiderPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState("harare");

  const [requestId, setRequestId] = useState("");
  const [requestData, setRequestData] = useState(null);

  const [offers, setOffers] = useState([]);

  const [tripId, setTripId] = useState("");
  const [tripData, setTripData] = useState(null);
  const [completedTrip, setCompletedTrip] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestUnsubRef = useRef(null);
  const offersUnsubRef = useRef(null);
  const tripUnsubRef = useRef(null);
  const completedTripUnsubRef = useRef(null);

  const mode = useMemo(
    () => getMode({ requestData, offers, tripData, completedTrip }),
    [requestData, offers, tripData, completedTrip]
  );

  const driversNearby = useMemo(() => {
    return offers.length || 0;
  }, [offers]);

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
          setError("Profile not found.");
          return;
        }

        if (profileData.role && profileData.role !== "rider") {
          router.push("/driver");
          return;
        }

        setProfile(profileData);

        const savedCity =
          profileData.city ||
          (typeof window !== "undefined"
            ? localStorage.getItem("nexride-last-place")
            : null) ||
          "harare";

        setCity(savedCity);

        try {
          localStorage.setItem("nexride-last-place", savedCity);
        } catch {}

        const savedRequestId =
          typeof window !== "undefined"
            ? localStorage.getItem("nexride-last-request-id") || ""
            : "";

        const savedTripId =
          typeof window !== "undefined"
            ? localStorage.getItem("nexride-active-trip-id") || ""
            : "";

        if (savedRequestId) setRequestId(savedRequestId);
        if (savedTripId) setTripId(savedTripId);
      } catch (err) {
        console.error(err);
        setError("Failed to load your profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!city || !requestId) return;

    try {
      requestUnsubRef.current?.();
      offersUnsubRef.current?.();
    } catch {}

    const reqRef = ref(db, `rideRequests/${city}/${requestId}`);
    requestUnsubRef.current = onValue(reqRef, (snap) => {
      const data = snap.val();
      setRequestData(data || null);
    });

    const offersRef = ref(db, `rideOffers/${requestId}`);
    offersUnsubRef.current = onValue(offersRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setOffers(arr);
    });

    return () => {
      try {
        requestUnsubRef.current?.();
        offersUnsubRef.current?.();
      } catch {}
    };
  }, [city, requestId]);

  useEffect(() => {
    if (!requestData?.matchedTripId) return;

    setTripId(requestData.matchedTripId);

    try {
      localStorage.setItem("nexride-active-trip-id", requestData.matchedTripId);
    } catch {}
  }, [requestData?.matchedTripId]);

  useEffect(() => {
    if (!tripId) return;

    try {
      tripUnsubRef.current?.();
      completedTripUnsubRef.current?.();
    } catch {}

    const activeRef = ref(db, `activeTrips/${tripId}`);
    tripUnsubRef.current = onValue(activeRef, (snap) => {
      const data = snap.val();

      if (data) {
        setTripData(data);
        setCompletedTrip(null);
        return;
      }

      setTripData(null);

      const doneRef = ref(db, `completedTrips/${tripId}`);
      completedTripUnsubRef.current = onValue(doneRef, (doneSnap) => {
        const doneData = doneSnap.val();
        setCompletedTrip(doneData || null);
      });
    });

    return () => {
      try {
        tripUnsubRef.current?.();
        completedTripUnsubRef.current?.();
      } catch {}
    };
  }, [tripId]);

  const handleRequestCreated = (request) => {
    setError("");
    setSuccess("");
    setCompletedTrip(null);
    setTripData(null);
    setTripId("");
    setOffers([]);
    setRequestId(request.id);
    setRequestData(request);
    setCity(request.city || city);

    try {
      localStorage.setItem("nexride-last-request-id", request.id);
      if (request.city) localStorage.setItem("nexride-last-place", request.city);
      localStorage.removeItem("nexride-active-trip-id");
    } catch {}
  };

  const handleAcceptOffer = async (offer) => {
    // Accept logic already handled inside OffersSheet parent previously,
    // but now we keep it centralized here by routing to same state changes
    // through the listener after Firebase updates.
    // OffersSheet will call this with the offer; we do the write here.
    if (!user || !profile || !requestId || !requestData || !offer?.id) return;

    setError("");
    setSuccess("");

    try {
      const { push, set, update } = await import("firebase/database");
      const tripRef = push(ref(db, "activeTrips"));
      const newTripId = tripRef.key;
      const now = Date.now();
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      const payload = {
        tripId: newTripId,
        requestId,
        offerId: offer.id,
        city,
        riderId: user.uid,
        riderName: profile.fullName || "Rider",
        riderPhone: profile.phone || "",
        driverId: offer.driverId,
        driverName: offer.driverName || "Driver",
        driverPhone: offer.driverPhone || "",
        pickupName: requestData.pickupName || "",
        pickupLat: requestData.pickupLat ?? null,
        pickupLng: requestData.pickupLng ?? null,
        dropoffName: requestData.dropoffName || "",
        dropoffLat: requestData.dropoffLat ?? null,
        dropoffLng: requestData.dropoffLng ?? null,
        agreedPrice: Number(offer.proposedPrice || requestData.offerPrice || 0),
        people: Number(requestData.people || 1),
        notes: requestData.notes || "",
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

      await update(ref(db, `rideOffers/${requestId}/${offer.id}`), {
        status: "accepted",
        acceptedAt: now,
        acceptedTripId: newTripId,
      });

      const otherOffers = offers.filter((item) => item.id !== offer.id);
      await Promise.all(
        otherOffers.map((item) =>
          update(ref(db, `rideOffers/${requestId}/${item.id}`), {
            status: "closed",
            closedAt: now,
          })
        )
      );

      await update(ref(db, `rideRequests/${city}/${requestId}`), {
        status: "matched",
        matchedDriverId: offer.driverId,
        matchedTripId: newTripId,
        matchedAt: now,
      });

      setTripId(newTripId);
      setTripData(payload);
      setSuccess("Driver accepted successfully.");

      try {
        localStorage.setItem("nexride-active-trip-id", newTripId);
      } catch {}
    } catch (err) {
      console.error(err);
      setError("Failed to accept this offer.");
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId || !city) return;

    setError("");
    setSuccess("");

    try {
      await remove(ref(db, `rideRequests/${city}/${requestId}`));

      setRequestData(null);
      setOffers([]);
      setRequestId("");
      setSuccess("Ride request cancelled.");

      try {
        localStorage.removeItem("nexride-last-request-id");
      } catch {}
    } catch (err) {
      console.error(err);
      setError("Failed to cancel request.");
    }
  };

  const handleCancelTrip = () => {
    setError("Trip cancellation flow not added yet.");
  };

  const handleContactDriver = () => {
    if (!tripData?.driverPhone) {
      setError("Driver phone is not available.");
      return;
    }

    if (typeof window !== "undefined") {
      window.location.href = `tel:${tripData.driverPhone}`;
    }
  };

  const handleRequestAgain = () => {
    setCompletedTrip(null);
    setTripData(null);
    setTripId("");
    setRequestId("");
    setRequestData(null);
    setOffers([]);
    setError("");
    setSuccess("");

    try {
      localStorage.removeItem("nexride-active-trip-id");
      localStorage.removeItem("nexride-last-request-id");
    } catch {}
  };

  const handleLogout = async () => {
    try {
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
          <ActionCard style={{ width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>
              Loading rider app...
            </div>
            <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 8 }}>
              Preparing your dashboard
            </div>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
<RiderMap
  mode={mode}
  city={city}
  requestData={requestData}
  tripData={tripData}
/>

      <FloatingTopBar
        title="NEXRIDE"
        subtitle={`${profile?.fullName || "Rider"} • ${cityLabel(city)}`}
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

      <BottomSheet height="18vh">
        {mode === "request" && (
          <RequestSheet
            user={user}
            profile={profile}
            initialCity={city}
            onRequestCreated={handleRequestCreated}
          />
        )}

        {mode === "waiting" && (
          <WaitingSheet
            requestData={requestData}
            driversNearby={driversNearby}
            onCancel={handleCancelRequest}
            onOpenOffers={() => {
              if (offers.length > 0) setSuccess("Offers refreshed.");
              else setError("No driver offers yet.");
            }}
          />
        )}

        {mode === "offers" && (
          <OffersSheet
            requestData={requestData}
            offers={offers}
            onAcceptOffer={handleAcceptOffer}
            onCancelRequest={handleCancelRequest}
          />
        )}

        {mode === "trip" && (
          <TripSheet
            tripData={tripData}
            onCancelTrip={handleCancelTrip}
            onContactDriver={handleContactDriver}
          />
        )}

        {mode === "completed" && (
          <CompletedSheet
            completedTrip={completedTrip}
            onRequestAgain={handleRequestAgain}
          />
        )}
      </BottomSheet>
    </MobileShell>
  );
}
