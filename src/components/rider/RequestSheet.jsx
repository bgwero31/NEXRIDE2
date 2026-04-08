// File: src/components/rider/RequestSheet.jsx

"use client";

import { useMemo, useState } from "react";
import { push, ref, set } from "firebase/database";
import { db } from "../../lib/firebase";

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

export default function RequestSheet({
  user,
  profile,
  initialCity = "harare",
  onRequestCreated,
}) {
  const [city, setCity] = useState(initialCity || "harare");
  const [pickupName, setPickupName] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [people, setPeople] = useState(1);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canSubmit = useMemo(() => {
    return (
      pickupName.trim() &&
      dropoffName.trim() &&
      Number(offerPrice) > 0 &&
      Number(people) > 0 &&
      city.trim()
    );
  }, [pickupName, dropoffName, offerPrice, people, city]);

  const useMyCurrentLocation = () => {
    setError("");
    setSuccess("");
    setLocating(true);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      setLocating(false);
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
          localStorage.setItem("nexride-last-place", city);
        } catch {}

        setSuccess("Pickup location detected.");
        setLocating(false);
      },
      (err) => {
        console.error(err);
        if (err.code === 1) {
          setError("Location permission denied.");
        } else if (err.code === 2) {
          setError("Location unavailable.");
        } else if (err.code === 3) {
          setError("Location request timed out.");
        } else {
          setError("Failed to get your location.");
        }
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
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
      setError("Enter pickup and dropoff.");
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

      try {
        localStorage.setItem("nexride-last-place", cleanCity);
        localStorage.setItem("nexride-last-request-id", requestId);
      } catch {}

      setSuccess("Ride request created successfully.");

      if (onRequestCreated) {
        onRequestCreated({
          id: requestId,
          ...payload,
        });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create ride request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ padding: "0 2px" }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 1000,
            letterSpacing: "-0.04em",
            color: "#fff",
            lineHeight: 1,
          }}
        >
          Where to?
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#96a3b8",
            marginTop: 6,
            lineHeight: 1.45,
          }}
        >
          Book your next ride with a cleaner NEXRIDE flow.
        </div>
      </div>

      <form onSubmit={handleRequestRide} style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            borderRadius: 24,
            padding: 12,
            background:
              "linear-gradient(180deg, rgba(10,12,20,0.82), rgba(8,10,18,0.92))",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
          }}
        >
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
              }}
            >
              <input
                className="nx-input"
                placeholder="Pickup location"
                value={pickupName}
                onChange={(e) => setPickupName(e.target.value)}
              />

              <button
                type="button"
                onClick={useMyCurrentLocation}
                disabled={locating}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#fff",
                  borderRadius: 18,
                  padding: "0 16px",
                  fontWeight: 1000,
                  minWidth: 78,
                }}
              >
                {locating ? "..." : "GPS"}
              </button>
            </div>

            <input
              className="nx-input"
              placeholder="Dropoff location"
              value={dropoffName}
              onChange={(e) => setDropoffName(e.target.value)}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px",
                gap: 10,
              }}
            >
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
              placeholder="Extra trip details (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                minHeight: 74,
                resize: "none",
              }}
            />
          </div>
        </div>

        {error ? (
          <div
            style={{
              padding: 12,
              borderRadius: 16,
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
              borderRadius: 16,
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
            borderRadius: 22,
            padding: "16px",
            fontSize: 16,
            fontWeight: 1000,
            color: "#fff",
            background: "linear-gradient(90deg,#8b5cf6,#6d28d9,#4f46e5)",
            boxShadow: "0 16px 32px rgba(109,40,217,0.24)",
          }}
        >
          {submitting ? "Requesting..." : "Request ride"}
        </button>
      </form>
    </div>
  );
}
