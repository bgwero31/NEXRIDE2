// File: src/app/driver/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
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

  if (status === "accepted" || status === "matched") {
    return {
      ...base,
      color: "#d9f6ff",
      background: "rgba(0,198,255,0.12)",
      border: "1px solid rgba(0,198,255,0.25)",
    };
  }

  if (status === "open") {
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

export default function DriverPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [city, setCity] = useState("");
  const [online, setOnline] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);

  const [statusText, setStatusText] = useState("Loading driver app...");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [negotiatingFor, setNegotiatingFor] = useState(null);
  const [proposedPrice, setProposedPrice] = useState("");
  const [proposedMessage, setProposedMessage] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingOnline, setSavingOnline] = useState(false);
  const [workingRequestId, setWorkingRequestId] = useState("");

  const visibleRequests = useMemo(() => {
    return requests
      .filter((r) => r.status === "open")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [requests]);

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
          setError("Driver profile not found.");
          return;
        }

        if (profileData.role !== "driver") {
          router.push("/rider");
          return;
        }

        setProfile(profileData);
        setCity(profileData.city || "harare");
        setStatusText("Driver dashboard ready");

        try {
          localStorage.setItem("nexride-last-place", profileData.city || "harare");
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
    if (!city) return;

    const requestsRef = ref(db, `rideRequests/${city}`);

    const unsub = onValue(requestsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setRequests(arr);
    });

    return () => unsub();
  }, [city]);

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

      const tripRef = push(ref(db, `activeTrips`));
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

      await update(requestPath, {
        status: "matched",
        matchedDriverId: user.uid,
        matchedTripId: tripId,
        matchedAt: now,
      });

      setActiveTrip(payload);
      setSuccess("Ride accepted successfully.");
      setStatusText("Trip accepted");
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
    }
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
          <ActionCard style={{ width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>
              Loading driver app...
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
      <MapPlaceholder
        label="Driver map"
        sublabel="Nearby requests, pickup routes, and live trips will appear here"
      />

      <FloatingTopBar
        title="NEXRIDE DRIVER"
        subtitle={`${profile?.fullName || "Driver"} • ${cityLabel(city)}`}
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
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 1000 }}>
                  {profile?.carName || "Your car"}
                </div>
                <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                  {profile?.plateNumber || "No plate"} • {cityLabel(city)}
                </div>
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  color: online ? "#dfffe9" : "#f3f6fa",
                  background: online
                    ? "rgba(31,214,122,0.12)"
                    : "rgba(255,255,255,0.06)",
                  border: online
                    ? "1px solid rgba(31,214,122,0.25)"
                    : "1px solid rgba(255,255,255,0.08)",
                  whiteSpace: "nowrap",
                }}
              >
                {online ? "ONLINE" : "OFFLINE"}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                onClick={toggleOnline}
                disabled={savingOnline}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 18,
                  padding: "15px 16px",
                  fontSize: 15,
                  fontWeight: 1000,
                  color: online ? "#fff" : "#001018",
                  background: online
                    ? "rgba(255,255,255,0.06)"
                    : "linear-gradient(90deg,#00c6ff,#0066ff)",
                  borderColor: "rgba(255,255,255,0.1)",
                  boxShadow: online
                    ? "none"
                    : "0 14px 30px rgba(0,102,255,0.24)",
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

          <ActionCard>
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>Active trip</div>
                <div style={{ fontSize: 12, color: "#9fb3c8", marginTop: 4 }}>
                  Current accepted ride
                </div>
              </div>

              <div style={statusPill(activeTrip ? activeTrip.status : "idle")}>
                {activeTrip ? activeTrip.status : "none"}
              </div>
            </div>

            {activeTrip ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>
                  {activeTrip.pickupName} → {activeTrip.dropoffName}
                </div>
                <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                  Rider: {activeTrip.riderName} • Price: $
                  {Number(activeTrip.agreedPrice || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                  OTP: {activeTrip.otp}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                No active trip yet.
              </div>
            )}
          </ActionCard>

          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Nearby requests</div>
            <div style={{ fontSize: 12, color: "#9fb3c8", marginTop: 4 }}>
              Open ride requests in {cityLabel(city)}
            </div>
          </div>

          {!online ? (
            <ActionCard>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>You are offline</div>
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                Go online first to start receiving requests.
              </div>
            </ActionCard>
          ) : visibleRequests.length === 0 ? (
            <ActionCard>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>No open requests</div>
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                Waiting for riders to request trips in your city.
              </div>
            </ActionCard>
          ) : (
            visibleRequests.map((item) => (
              <ActionCard key={item.id}>
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
                      {item.pickupName} → {item.dropoffName}
                    </div>
                    <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 6 }}>
                      Rider: {item.riderName || "Rider"}
                    </div>
                    <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                      Offer: ${Number(item.offerPrice || 0).toFixed(2)} • People:{" "}
                      {item.people || 1}
                    </div>
                    {item.notes ? (
                      <div style={{ fontSize: 13, color: "#b7c9d9", marginTop: 6 }}>
                        {item.notes}
                      </div>
                    ) : null}
                  </div>

                  <div style={statusPill(item.status || "open")}>
                    {item.status || "open"}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <button
                    onClick={() => acceptRequest(item)}
                    disabled={!!workingRequestId || !!activeTrip}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 16,
                      padding: "13px 14px",
                      fontSize: 14,
                      fontWeight: 1000,
                      color: "#001018",
                      background: "linear-gradient(90deg,#00c6ff,#0066ff)",
                      boxShadow: "0 10px 24px rgba(0,102,255,0.22)",
                    }}
                  >
                    {workingRequestId === item.id ? "Accepting..." : "Accept"}
                  </button>

                  <button
                    onClick={() => openNegotiate(item)}
                    disabled={!!activeTrip}
                    style={{
                      width: "100%",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      padding: "13px 14px",
                      fontSize: 14,
                      fontWeight: 900,
                      color: "#fff",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    Negotiate
                  </button>
                </div>
              </ActionCard>
            ))
          )}
        </div>
      </BottomSheet>

{negotiatingFor ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
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
              background:
                "linear-gradient(180deg, rgba(13,17,23,0.98), rgba(7,10,15,0.99))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 24,
              padding: 18,
              boxShadow: "0 24px 60px rgba(0,0,0,0.52)",
            }}
          >
            <div style={{ fontWeight: 1000, fontSize: 20, marginBottom: 8 }}>
              Negotiate offer
            </div>
            <div style={{ fontSize: 13, color: "#9fb3c8", marginBottom: 14 }}>
              Send a custom price to {negotiatingFor.riderName || "this rider"}.
            </div>

            <div style={{ display: "grid", gap: 12 }}>
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
                  minHeight: 90,
                  resize: "none",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
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
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    padding: "13px 14px",
                    fontSize: 14,
                    fontWeight: 900,
                    color: "#fff",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={sendNegotiation}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 16,
                    padding: "13px 14px",
                    fontSize: 14,
                    fontWeight: 1000,
                    color: "#001018",
                    background: "linear-gradient(90deg,#00c6ff,#0066ff)",
                    boxShadow: "0 10px 24px rgba(0,102,255,0.22)",
                  }}
                >
                  Send offer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  );
          }
