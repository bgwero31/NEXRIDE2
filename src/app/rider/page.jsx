// File: src/app/rider/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import { auth, db } from "../../lib/firebase";

const cityOptions = [
  "harare",
  "bulawayo",
  "gweru",
  "mutare",
  "masvingo",
  "zvishavane",
  "kwekwe",
  "kadoma",
];

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

export default function RiderPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [city, setCity] = useState("harare");
  const [pickupName, setPickupName] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [people, setPeople] = useState(1);
  const [notes, setNotes] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeRequestId, setActiveRequestId] = useState("");

  const canSubmit = useMemo(() => {
    return (
      pickupName.trim() &&
      dropoffName.trim() &&
      Number(offerPrice) > 0 &&
      Number(people) > 0 &&
      city.trim()
    );
  }, [pickupName, dropoffName, offerPrice, people, city]);

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
          setLoadingProfile(false);
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
        setError("Failed to load your profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  const useMyCurrentLocation = () => {
    setError("");
    setSuccess("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this phone.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setPickupLat(String(lat));
        setPickupLng(String(lng));

        if (!pickupName.trim()) {
          setPickupName("Current location");
        }

        try {
          localStorage.setItem("nexride-last-lat", String(lat));
          localStorage.setItem("nexride-last-lng", String(lng));
        } catch {}

        setSuccess("Pickup GPS captured.");
      },
      () => {
        setError("Failed to get your location.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 1000 }
    );
  };

  const handleRequestRide = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!user || !profile) {
      setError("User not ready.");
      return;
    }

    const cleanCity = city.trim().toLowerCase();
    const cleanPickup = pickupName.trim();
    const cleanDropoff = dropoffName.trim();
    const cleanOffer = Number(offerPrice);
    const cleanPeople = Number(people) || 1;
    const cleanNotes = notes.trim();

    if (!cleanPickup || !cleanDropoff || !cleanCity) {
      setError("Enter city, pickup and dropoff.");
      return;
    }

    if (!cleanOffer || cleanOffer <= 0) {
      setError("Enter a valid offer price.");
      return;
    }

    if (cleanPeople <= 0) {
      setError("Enter valid number of people.");
      return;
    }

    try {
      setSubmitting(true);

      const requestRef = push(ref(db, `rideRequests/${cleanCity}`));
      const requestId = requestRef.key;
      const now = Date.now();

      const payload = {
        riderId: user.uid,
        riderName: profile.fullName || "Rider",
        riderPhone: profile.phone || "",
        pickupName: cleanPickup,
        pickupLat: pickupLat ? Number(pickupLat) : null,
        pickupLng: pickupLng ? Number(pickupLng) : null,
        dropoffName: cleanDropoff,
        dropoffLat: dropoffLat ? Number(dropoffLat) : null,
        dropoffLng: dropoffLng ? Number(dropoffLng) : null,
        offerPrice: cleanOffer,
        people: cleanPeople,
        notes: cleanNotes,
        city: cleanCity,
        status: "open",
        createdAt: now,
        expiresAt: now + 1000 * 60 * 10,
      };

      await set(requestRef, payload);

      setActiveRequestId(requestId);
      setSuccess("Ride request created successfully.");

      try {
        localStorage.setItem("nexride-last-place", cleanCity);
        localStorage.setItem("nexride-last-request-id", requestId);
      } catch {}

      setNotes("");
    } catch (err) {
      console.error(err);
      setError("Failed to create ride request.");
    } finally {
      setSubmitting(false);
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
              Loading rider app...
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
                <div className="nx-soft-text">Rider dashboard</div>
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
          <div
            style={{
              position: "relative",
              zIndex: 2,
            }}
          >
            <div className="nx-pill" style={{ marginBottom: 14 }}>
              <span className="nx-badge-online" />
              Ready to request
            </div>

            <div className="nx-title" style={{ fontSize: 28, marginBottom: 8 }}>
              Welcome{profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
            </div>

            <div className="nx-subtitle" style={{ marginBottom: 14 }}>
              Request your ride, set your price, and wait for nearby drivers to respond.
            </div>

            <div className="nx-grid" style={{ gap: 10 }}>
              <div className="nx-glass" style={{ borderRadius: 18, padding: 14 }}>
                <div className="nx-between">
                  <div>
                    <div style={{ fontWeight: 900 }}>Current city</div>
                    <div className="nx-soft-text" style={{ marginTop: 4 }}>
                      {cityLabel(city)}
                    </div>
                  </div>
                  <div className="nx-pill">Cash beta</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* request form */}
        <section
          className="nx-card"
          style={{
            padding: 18,
            borderRadius: 28,
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div className="nx-section-title">Request a ride</div>
            <div className="nx-soft-text" style={{ marginTop: 4 }}>
              Fill in the trip details below.
            </div>
          </div>

          <form onSubmit={handleRequestRide} className="nx-grid">
            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">City</label>
              <select
                className="nx-input"
                value={city}
                onChange={(e) => {
                  const nextCity = e.target.value;
                  setCity(nextCity);
                  try {
                    localStorage.setItem("nexride-last-place", nextCity);
                  } catch {}
                }}
              >
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {cityLabel(item)}
                  </option>
                ))}
              </select>
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Pickup location</label>
              <input
                className="nx-input"
                type="text"
                placeholder="Enter pickup point"
                value={pickupName}
                onChange={(e) => setPickupName(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gridTemplateColumns: "1fr auto", gap: 10 }}>
              <input
                className="nx-input"
                type="text"
                placeholder="Pickup latitude (optional)"
                value={pickupLat}
                onChange={(e) => setPickupLat(e.target.value)}
              />
              <button
                type="button"
                className="nx-btn nx-btn-secondary"
                style={{
                  width: "auto",
                  padding: "0 16px",
                  minHeight: 50,
                  borderRadius: 16,
                }}
                onClick={useMyCurrentLocation}
              >
                Use GPS
              </button>
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <input
                className="nx-input"
                type="text"
                placeholder="Pickup longitude (optional)"
                value={pickupLng}
                onChange={(e) => setPickupLng(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Dropoff location</label>
              <input
                className="nx-input"
                type="text"
                placeholder="Enter destination"
                value={dropoffName}
                onChange={(e) => setDropoffName(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                className="nx-input"
                type="text"
                placeholder="Dropoff latitude (optional)"
                value={dropoffLat}
                onChange={(e) => setDropoffLat(e.target.value)}
              />
              <input
                className="nx-input"
                type="text"
                placeholder="Dropoff longitude (optional)"
                value={dropoffLng}
                onChange={(e) => setDropoffLng(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="nx-grid" style={{ gap: 8 }}>
                <label className="nx-soft-text">Your offer ($)</label>
                <input
                  className="nx-input"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="4"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                />
              </div>

              <div className="nx-grid" style={{ gap: 8 }}>
                <label className="nx-soft-text">People</label>
                <input
                  className="nx-input"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                />
              </div>
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Notes (optional)</label>
              <textarea
                className="nx-input"
                placeholder="Add any extra trip details"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  minHeight: 96,
                  resize: "none",
                }}
              />
            </div>

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

            <button
              className="nx-btn nx-btn-primary"
              type="submit"
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Requesting ride..." : "Request ride"}
            </button>
          </form>
        </section>

        {/* active request preview */}
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
              <div className="nx-section-title">Latest request</div>
              <div className="nx-soft-text" style={{ marginTop: 4 }}>
                Your latest ride request ID will show here.
              </div>
            </div>
            <div className="nx-pill">MVP</div>
          </div>

          <div className="nx-glass" style={{ borderRadius: 18, padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Request status</div>
            <div className="nx-soft-text">
              {activeRequestId
                ? `Created successfully — ID: ${activeRequestId}`
                : "No new request in this session yet."}
            </div>
          </div>
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
            Next we connect this rider page to live driver offers, accepted trips, and tracking.
          </div>

          <div className="nx-grid">
            <Link href="/driver">
              <button className="nx-btn nx-btn-secondary" type="button">
                Open driver app
              </button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
