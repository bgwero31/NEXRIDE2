// File: src/app/rider/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import { auth, db } from "../../lib/firebase";

import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import BottomSheet from "../../components/ui/BottomSheet";
import MapPlaceholder from "../../components/ui/MapPlaceholder";
import ActionCard from "../../components/ui/ActionCard";

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
      () => setError("Failed to get your location."),
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

    try {
      setSubmitting(true);

      const requestRef = push(ref(db, `rideRequests/${cleanCity}`));
      const requestId = requestRef.key;
      const now = Date.now();

      await set(requestRef, {
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
      });

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
      <MapPlaceholder
        label="Rider map"
        sublabel="Pickup, driver offers, and live trips will appear here"
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

      <BottomSheet height="56vh">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 1000 }}>Request a ride</div>
            <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
              Set your route, offer your price, and wait for drivers to respond.
            </div>
          </div>

          <form onSubmit={handleRequestRide} style={{ display: "grid", gap: 12 }}>
            <ActionCard>
              <div style={{ display: "grid", gap: 10 }}>
                <select
                  value={city}
                  onChange={(e) => {
                    const nextCity = e.target.value;
                    setCity(nextCity);
                    try {
                      localStorage.setItem("nexride-last-place", nextCity);
                    } catch {}
                  }}
                  className="nx-input"
                >
                  {cityOptions.map((item) => (
                    <option key={item} value={item}>
                      {cityLabel(item)}
                    </option>
                  ))}
                </select>

                <input
                  className="nx-input"
                  placeholder="Pickup location"
                  value={pickupName}
                  onChange={(e) => setPickupName(e.target.value)}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                  <input
                    className="nx-input"
                    placeholder="Pickup latitude"
                    value={pickupLat}
                    onChange={(e) => setPickupLat(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={useMyCurrentLocation}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#fff",
                      borderRadius: 16,
                      padding: "0 16px",
                      fontWeight: 900,
                    }}
                  >
                    GPS
                  </button>
                </div>

                <input
                  className="nx-input"
                  placeholder="Pickup longitude"
                  value={pickupLng}
                  onChange={(e) => setPickupLng(e.target.value)}
                />

                <input
                  className="nx-input"
                  placeholder="Dropoff location"
                  value={dropoffName}
                  onChange={(e) => setDropoffName(e.target.value)}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input
                    className="nx-input"
                    placeholder="Dropoff latitude"
                    value={dropoffLat}
                    onChange={(e) => setDropoffLat(e.target.value)}
                  />
                  <input
                    className="nx-input"
                    placeholder="Dropoff longitude"
                    value={dropoffLng}
                    onChange={(e) => setDropoffLng(e.target.value)}
                  />
                </div>
              </div>
            </ActionCard>

            <ActionCard>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  className="nx-input"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Your offer ($)"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                />
                <input
                  className="nx-input"
                  type="number"
                  min="1"
                  placeholder="People"
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                />
              </div>

              <textarea
                className="nx-input"
                placeholder="Extra trip details"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ minHeight: 90, resize: "none", marginTop: 10 }}
              />
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

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 18,
                padding: "16px",
                fontSize: 15,
                fontWeight: 1000,
                color: "#001018",
                background: "linear-gradient(90deg,#00c6ff,#0066ff)",
                boxShadow: "0 14px 30px rgba(0,102,255,0.24)",
              }}
            >
              {submitting ? "Requesting ride..." : "Request ride"}
            </button>
          </form>

          <ActionCard>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Latest request</div>
            <div style={{ fontSize: 13, color: "#9fb3c8" }}>
              {activeRequestId
                ? `Created successfully — ID: ${activeRequestId}`
                : "No new request in this session yet."}
            </div>
          </ActionCard>
        </div>
      </BottomSheet>
    </MobileShell>
  );
      }
