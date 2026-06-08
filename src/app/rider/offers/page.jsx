// File: src/app/rider/offers/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, push, ref, remove, set, update } from "firebase/database";
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

function statusPill(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    border: "1px solid transparent",
    textTransform: "uppercase",
  };

  if (status === "pending") {
    return {
      ...base,
      color: "#d9f6ff",
      background: "rgba(0,198,255,0.12)",
      border: "1px solid rgba(0,198,255,0.25)",
    };
  }

  if (status === "accepted") {
    return {
      ...base,
      color: "#eaffdc",
      background: "rgba(45,200,95,0.12)",
      border: "1px solid rgba(45,200,95,0.22)",
    };
  }

  return {
    ...base,
    color: "#fff0d2",
    background: "rgba(255,170,30,0.12)",
    border: "1px solid rgba(255,170,30,0.22)",
  };
}

export default function RiderOffersPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [city, setCity] = useState("");
  const [latestRequestId, setLatestRequestId] = useState("");
  const [latestRequest, setLatestRequest] = useState(null);
  const [offers, setOffers] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [acceptingOfferId, setAcceptingOfferId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedOffers = useMemo(() => {
    return [...offers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
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
      } catch (err) {
        console.error(err);
        setError("Failed to load rider profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user || !city) return;

    let storedRequestId = "";
    try {
      storedRequestId = localStorage.getItem("nexride-last-request-id") || "";
    } catch {}

    if (!storedRequestId) {
      setLoadingRequest(false);
      return;
    }

    setLatestRequestId(storedRequestId);

    const requestRef = ref(db, `rideRequests/${city}/${storedRequestId}`);
    const unsubRequest = onValue(requestRef, (snap) => {
      const data = snap.val();
      setLatestRequest(data || null);
      setLoadingRequest(false);
    });

    const offersRef = ref(db, `rideOffers/${storedRequestId}`);
    const unsubOffers = onValue(offersRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setOffers(arr);
    });

    return () => {
      unsubRequest();
      unsubOffers();
    };
  }, [user, city]);

  const acceptOffer = async (offer) => {
    if (!user || !profile || !latestRequestId || !latestRequest || !offer?.id) return;

    setError("");
    setSuccess("");
    setAcceptingOfferId(offer.id);

    try {
      const tripRef = push(ref(db, "activeTrips"));
      const tripId = tripRef.key;
      const now = Date.now();
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      const payload = {
        tripId,
        requestId: latestRequestId,
        offerId: offer.id,
        city,
        riderId: user.uid,
        riderName: profile.fullName || "Rider",
        riderPhone: profile.phone || "",
        driverId: offer.driverId,
        driverName: offer.driverName || "Driver",
        driverPhone: offer.driverPhone || "",
        pickupName: latestRequest.pickupName || "",
        pickupLat: latestRequest.pickupLat ?? null,
        pickupLng: latestRequest.pickupLng ?? null,
        dropoffName: latestRequest.dropoffName || "",
        dropoffLat: latestRequest.dropoffLat ?? null,
        dropoffLng: latestRequest.dropoffLng ?? null,
        agreedPrice: Number(offer.proposedPrice || latestRequest.offerPrice || 0),
        people: Number(latestRequest.people || 1),
        notes: latestRequest.notes || "",
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

      await update(ref(db, `rideOffers/${latestRequestId}/${offer.id}`), {
        status: "accepted",
        acceptedAt: now,
        acceptedTripId: tripId,
      });

      const otherOffers = offers.filter((item) => item.id !== offer.id);
      await Promise.all(
        otherOffers.map((item) =>
          update(ref(db, `rideOffers/${latestRequestId}/${item.id}`), {
            status: "closed",
            closedAt: now,
          })
        )
      );

      await update(ref(db, `rideRequests/${city}/${latestRequestId}`), {
        status: "matched",
        matchedDriverId: offer.driverId,
        matchedTripId: tripId,
        matchedAt: now,
      });

      setActiveTrip(payload);
      setSuccess("Driver accepted successfully.");

      try {
        localStorage.setItem("nexride-active-trip-id", tripId);
      } catch {}

      router.push(`/trip/${tripId}`);
    } catch (err) {
      console.error(err);
      setError("Failed to accept this offer.");
    } finally {
      setAcceptingOfferId("");
    }
  };

  const cancelRequest = async () => {
    if (!latestRequestId || !city) return;

    setError("");
    setSuccess("");

    try {
      await remove(ref(db, `rideRequests/${city}/${latestRequestId}`));

      try {
        localStorage.removeItem("nexride-last-request-id");
      } catch {}

      setLatestRequest(null);
      setOffers([]);
      setLatestRequestId("");
      setSuccess("Ride request cancelled.");
    } catch (err) {
      console.error(err);
      setError("Failed to cancel request.");
    }
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
              Loading offers...
            </div>
            <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 8 }}>
              Preparing your offers page
            </div>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <MapPlaceholder
        label="Driver offers"
        sublabel="Nearby drivers and accepted trip updates will appear here"
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

      <BottomSheet height="58vh">
        <div style={{ display: "grid", gap: 12 }}>
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
                <div style={{ fontSize: 22, fontWeight: 1000 }}>Driver offers</div>
                <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                  Review driver prices and choose the best one.
                </div>
              </div>

              <div style={statusPill(latestRequest ? latestRequest.status || "open" : "none")}>
                {latestRequest ? latestRequest.status || "open" : "none"}
              </div>
            </div>

            {latestRequest ? (
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>
                  {latestRequest.pickupName} → {latestRequest.dropoffName}
                </div>
                <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                  Your offer: ${Number(latestRequest.offerPrice || 0).toFixed(2)}
                </div>
                {latestRequest.notes ? (
                  <div style={{ fontSize: 13, color: "#b7c9d9" }}>
                    {latestRequest.notes}
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ marginTop: 14, fontSize: 13, color: "#9fb3c8" }}>
                No active request found for this session.
              </div>
            )}
          </ActionCard>

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

          {!latestRequestId && !loadingRequest ? (
            <ActionCard>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>No request found</div>
              <div style={{ fontSize: 13, color: "#9fb3c8", marginBottom: 12 }}>
                Create a ride request first, then drivers can start sending offers.
              </div>
              <button
                onClick={() => router.push("/rider")}
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
          ) : sortedOffers.length === 0 ? (
            <ActionCard>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Waiting for offers</div>
              <div style={{ fontSize: 13, color: "#9fb3c8", marginBottom: 12 }}>
                Nearby drivers have not responded yet.
              </div>

              {latestRequest ? (
                <button
                  onClick={cancelRequest}
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
                  Cancel request
                </button>
              ) : null}
            </ActionCard>
          ) : (
            sortedOffers.map((offer) => (
              <ActionCard key={offer.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>
                      {offer.driverName || "Driver"}
                    </div>

                    <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 6 }}>
                      Proposed fare: ${Number(offer.proposedPrice || 0).toFixed(2)}
                    </div>

                    {offer.message ? (
                      <div style={{ fontSize: 13, color: "#b7c9d9", marginTop: 6 }}>
                        {offer.message}
                      </div>
                    ) : null}

                    <div style={{ fontSize: 12, color: "#8396aa", marginTop: 8 }}>
                      Offer received
                    </div>
                  </div>

                  <div style={statusPill(offer.status || "pending")}>
                    {offer.status || "pending"}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={() => acceptOffer(offer)}
                    disabled={!!acceptingOfferId || offer.status === "closed"}
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
                    {acceptingOfferId === offer.id ? "Accepting..." : "Accept this driver"}
                  </button>
                </div>
              </ActionCard>
            ))
          )}

          {activeTrip ? (
            <ActionCard>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Trip created</div>
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                Trip ID: {activeTrip.tripId}
              </div>
            </ActionCard>
          ) : null}
        </div>
      </BottomSheet>
    </MobileShell>
  );
}
