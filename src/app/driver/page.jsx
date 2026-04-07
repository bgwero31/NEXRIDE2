// File: src/app/driver/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { auth, db } from "../../lib/firebase";

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
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
          setLoadingProfile(false);
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

    const markOffline = async () => {
      try {
        await update(driverNode, {
          online: false,
          lastSeen: Date.now(),
        });
      } catch {}
    };

    const handleUnload = () => {
      markOffline();
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
      <main className="nx-shell">
        <div
          className="nx-container"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="nx-card"
            style={{
              width: "100%",
              padding: 24,
              borderRadius: 28,
              textAlign: "center",
            }}
          >
            <div className="nx-title" style={{ fontSize: 24 }}>
              Loading driver app...
            </div>
            <div className="nx-subtitle" style={{ marginTop: 8 }}>
              Preparing your dashboard.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="nx-shell">
      <div className="nx-container" style={{ paddingTop: 18, paddingBottom: 28 }}>
        {/* top bar */}
        <div
          className="nx-glass"
          style={{
            borderRadius: 22,
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          <div className="nx-between" style={{ gap: 12 }}>
            <div className="nx-logo">
              <div className="nx-logo-mark" />
              <div>
                <div style={{ fontWeight: 1000, fontSize: 18 }}>NEXRIDE</div>
                <div className="nx-soft-text">Driver dashboard</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="nx-btn nx-btn-secondary"
              style={{
                width: "auto",
                padding: "10px 14px",
                borderRadius: 14,
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* hero */}
        <section
          className="nx-card"
          style={{
            padding: 18,
            borderRadius: 28,
            marginBottom: 16,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -70,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(0, 198, 255, 0.12)",
              filter: "blur(18px)",
            }}
          />

          <div style={{ position: "relative", zIndex: 2 }}>
            <div className="nx-between" style={{ marginBottom: 14, alignItems: "flex-start" }}>
              <div>
                <div className="nx-title" style={{ fontSize: 28, marginBottom: 8 }}>
                  Welcome{profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
                </div>
                <div className="nx-subtitle">
                  Go online and respond to nearby rider requests in {cityLabel(city)}.
                </div>
              </div>

              <div className="nx-pill">
                <span
                  className="nx-badge-online"
                  style={{
                    background: online ? "var(--green)" : "#777",
                    boxShadow: online ? "0 0 12px rgba(31, 214, 122, 0.8)" : "none",
                  }}
                />
                {online ? "Online" : "Offline"}
              </div>
            </div>

            <div className="nx-grid" style={{ gap: 10 }}>
              <div className="nx-glass" style={{ borderRadius: 18, padding: 14 }}>
                <div className="nx-between">
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {profile?.carName || "Driver vehicle"}
                    </div>
                    <div className="nx-soft-text" style={{ marginTop: 4 }}>
                      {profile?.plateNumber || "No plate"} • {cityLabel(city)}
                    </div>
                  </div>

                  <button
                    onClick={toggleOnline}
                    disabled={savingOnline}
                    className={`nx-btn ${online ? "nx-btn-secondary" : "nx-btn-primary"}`}
                    style={{
                      width: "auto",
                      padding: "10px 14px",
                      borderRadius: 14,
                    }}
                  >
                    {savingOnline ? "Saving..." : online ? "Go offline" : "Go online"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* alerts */}
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
              marginBottom: 14,
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
              marginBottom: 14,
            }}
          >
            {success}
          </div>
        ) : null}

        {/* active trip */}
        <section
          className="nx-card"
          style={{
            padding: 18,
            borderRadius: 28,
            marginBottom: 16,
          }}
        >
          <div className="nx-between" style={{ marginBottom: 10 }}>
            <div>
              <div className="nx-section-title">Active trip</div>
              <div className="nx-soft-text" style={{ marginTop: 4 }}>
                Current accepted ride will show here.
              </div>
            </div>
            <div className="nx-pill">{activeTrip ? "Live" : "None"}</div>
          </div>

          <div className="nx-glass" style={{ borderRadius: 18, padding: 14 }}>
            {activeTrip ? (
              <div className="nx-grid" style={{ gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {activeTrip.pickupName} → {activeTrip.dropoffName}
                </div>
                <div className="nx-soft-text">
                  Rider: {activeTrip.riderName} • Price: ${Number(activeTrip.agreedPrice || 0).toFixed(2)}
                </div>
                <div className="nx-soft-text">
                  OTP: {activeTrip.otp}
                </div>
                <div className="nx-pill">{activeTrip.status}</div>
              </div>
            ) : (
              <div className="nx-soft-text">
                No active trip yet.
              </div>
            )}
          </div>
        </section>

        {/* request list */}
        <section
          className="nx-card"
          style={{
            padding: 18,
            borderRadius: 28,
            marginBottom: 16,
          }}
        >
          <div className="nx-between" style={{ marginBottom: 12 }}>
            <div>
              <div className="nx-section-title">Nearby requests</div>
              <div className="nx-soft-text" style={{ marginTop: 4 }}>
                Open ride requests in {cityLabel(city)}.
              </div>
            </div>
            <div className="nx-pill">{visibleRequests.length} open</div>
          </div>

          {!online ? (
            <div className="nx-glass" style={{ borderRadius: 18, padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>You are offline</div>
              <div className="nx-soft-text">
                Go online first to start accepting rider requests.
              </div>
            </div>
          ) : visibleRequests.length === 0 ? (
            <div className="nx-glass" style={{ borderRadius: 18, padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>No open requests</div>
              <div className="nx-soft-text">
                Waiting for riders to request trips in your city.
              </div>
            </div>
          ) : (
            <div className="nx-grid">
              {visibleRequests.map((item) => (
                <div
                  key={item.id}
                  className="nx-glass"
                  style={{
                    borderRadius: 20,
                    padding: 14,
                  }}
                >
                  <div className="nx-between" style={{ alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
                        {item.pickupName} → {item.dropoffName}
                      </div>
                      <div className="nx-soft-text" style={{ marginBottom: 8 }}>
                        Rider: {item.riderName || "Rider"}
                      </div>
                      <div className="nx-soft-text" style={{ marginBottom: 6 }}>
                        Offer: ${Number(item.offerPrice || 0).toFixed(2)} • People: {item.people || 1}
                      </div>
                      {item.notes ? (
                        <div className="nx-soft-text">
                          Note: {item.notes}
                        </div>
                      ) : null}
                    </div>

                    <div className="nx-pill">{item.status}</div>
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
                      className="nx-btn nx-btn-primary"
                      onClick={() => acceptRequest(item)}
                      disabled={!!workingRequestId || !!activeTrip}
                      style={{ padding: "12px 14px", borderRadius: 14 }}
                    >
                      {workingRequestId === item.id ? "Accepting..." : "Accept"}
                    </button>

                    <button
                      className="nx-btn nx-btn-secondary"
                      onClick={() => openNegotiate(item)}
                      disabled={!!activeTrip}
                      style={{ padding: "12px 14px", borderRadius: 14 }}
                    >
                      Negotiate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* next steps */}
        <section
          className="nx-glass"
          style={{
            borderRadius: 22,
            padding: 16,
          }}
        >
          <div className="nx-between" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 900 }}>Next upgrade</div>
            <div className="nx-pill">Coming next</div>
          </div>

          <div className="nx-soft-text" style={{ marginBottom: 14 }}>
            Next we connect live trip tracking, OTP verification, driver location updates, and completed ride flow.
          </div>

             <div className="nx-grid">
            <Link href="/rider">
              <button className="nx-btn nx-btn-secondary" type="button">
                Open rider app
              </button>
            </Link>
          </div>
        </section>
      </div>

      {/* negotiate modal */}
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
            className="nx-card"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: 18,
              borderRadius: 24,
            }}
          >
            <div style={{ fontWeight: 1000, fontSize: 20, marginBottom: 8 }}>
              Negotiate offer
            </div>
            <div className="nx-subtitle" style={{ marginBottom: 14 }}>
              Send a custom price to {negotiatingFor.riderName || "this rider"}.
            </div>

            <div className="nx-grid">
              <div className="nx-grid" style={{ gap: 8 }}>
                <label className="nx-soft-text">Proposed price ($)</label>
                <input
                  className="nx-input"
                  type="number"
                  min="1"
                  step="0.01"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  placeholder="Enter your price"
                />
              </div>

              <div className="nx-grid" style={{ gap: 8 }}>
                <label className="nx-soft-text">Message (optional)</label>
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
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <button
                  className="nx-btn nx-btn-secondary"
                  type="button"
                  onClick={() => {
                    setNegotiatingFor(null);
                    setProposedPrice("");
                    setProposedMessage("");
                  }}
                >
                  Cancel
                </button>

                <button
                  className="nx-btn nx-btn-primary"
                  type="button"
                  onClick={sendNegotiation}
                >
                  Send offer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
          }
