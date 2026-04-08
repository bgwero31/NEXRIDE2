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

const quickPlacesByCity = {
  zvishavane: ["Mandava Stadium", "Zvishavane Police Station", "Makwasha bus stop", "A9"],
  harare: ["Robert Gabriel Mugabe International Airport", "Warren Park", "CBD", "Borrowdale"],
  bulawayo: ["Nkulumane", "City Centre", "Bradfield", "Airport"],
};

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

const shellCard = {
  borderRadius: 30,
  padding: 14,
  background:
    "linear-gradient(180deg, rgba(12,15,26,0.82) 0%, rgba(10,12,22,0.92) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
  backdropFilter: "blur(18px)",
};

const chipBtn = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  borderRadius: 18,
  padding: "12px 14px",
  fontWeight: 800,
  fontSize: 14,
};

const routeBox = {
  borderRadius: 22,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const inputStyle = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#fff",
  fontSize: 16,
  padding: "0",
};

const iconDot = (bg) => ({
  width: 12,
  height: 12,
  borderRadius: 999,
  background: bg,
  boxShadow: `0 0 12px ${bg}`,
  flexShrink: 0,
});

export default function RequestSheet({
  user,
  profile,
  initialCity = "harare",
  onRequestCreated,
}) {
  const [city, setCity] = useState(initialCity || "harare");
  const [pickupName, setPickupName] = useState(cityLabel(initialCity || "harare"));
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffName, setDropoffName] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [offerPrice, setOfferPrice] = useState(3);
  const [people, setPeople] = useState(1);
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const quickPlaces = useMemo(() => {
    return quickPlacesByCity[city] || ["Town", "Bus rank", "Hospital", "CBD"];
  }, [city]);

  const canSubmit = useMemo(() => {
    return pickupName.trim() && dropoffName.trim() && Number(offerPrice) > 0;
  }, [pickupName, dropoffName, offerPrice]);

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

        if (!pickupName.trim() || pickupName === cityLabel(city)) {
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
      () => {
        setError("Failed to get your location.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const changeFare = (delta) => {
    setOfferPrice((prev) => {
      const next = Number(prev || 0) + delta;
      return next < 1 ? 1 : next;
    });
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

      onRequestCreated?.({
        id: requestId,
        ...payload,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to create ride request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <form onSubmit={handleRequestRide} style={{ display: "grid", gap: 10 }}>
        <div style={shellCard}>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              style={{
                ...chipBtn,
                background: "rgba(25,181,255,0.18)",
                border: "1px solid rgba(25,181,255,0.20)",
                minWidth: 86,
              }}
            >
              Ride
            </button>

            <button
              type="button"
              style={{
                ...chipBtn,
                opacity: 0.85,
                minWidth: 110,
              }}
            >
              City to city
            </button>
          </div>

          <div style={routeBox}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 14px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={iconDot("#b6ff15")} />
              <div>
                <div style={{ fontSize: 12, color: "#9fb3c8", marginBottom: 4 }}>
                  Pickup point
                </div>
                <input
                  style={inputStyle}
                  value={pickupName}
                  onChange={(e) => setPickupName(e.target.value)}
                  placeholder="Your current location"
                />
              </div>

              <button
                type="button"
                onClick={useMyCurrentLocation}
                disabled={locating}
                style={{
                  border: "none",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  borderRadius: 14,
                  padding: "10px 14px",
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                {locating ? "..." : "GPS"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 14px 14px",
              }}
            >
              <div style={iconDot("#ff8080")} />
              <div>
                <div style={{ fontSize: 12, color: "#9fb3c8", marginBottom: 4 }}>
                  Destination
                </div>
                <input
                  style={inputStyle}
                  value={dropoffName}
                  onChange={(e) => setDropoffName(e.target.value)}
                  placeholder="Where to?"
                />
              </div>

              <div
                style={{
                  fontSize: 28,
                  lineHeight: 1,
                  color: "#fff",
                  opacity: 0.92,
                }}
              >
                +
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 12,
              alignItems: "center",
              marginTop: 14,
              padding: 12,
              borderRadius: 22,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <button
              type="button"
              onClick={() => changeFare(-1)}
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                border: "none",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                fontSize: 32,
                lineHeight: 1,
                justifySelf: "start",
              }}
            >
              −
            </button>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 14,
                  color: "#aebfd3",
                  marginBottom: 4,
                }}
              >
                Tap to offer your fare
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 1000,
                  color: "#fff",
                  letterSpacing: "-0.04em",
                }}
              >
                ${Number(offerPrice || 0).toFixed(0)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => changeFare(1)}
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                border: "none",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                fontSize: 32,
                lineHeight: 1,
                justifySelf: "end",
              }}
            >
              +
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              marginTop: 12,
            }}
          >
            <select
              value={city}
              onChange={(e) => {
                const nextCity = e.target.value;
                setCity(nextCity);
                if (!pickupName || pickupName === cityLabel(city)) {
                  setPickupName(cityLabel(nextCity));
                }
                try {
                  localStorage.setItem("nexride-last-place", nextCity);
                } catch {}
              }}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                padding: "13px 14px",
                fontSize: 15,
                outline: "none",
              }}
            >
              {cityOptions.map((item) => (
                <option key={item} value={item}>
                  {cityLabel(item)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                padding: "0 16px",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {showMore ? "Less" : "More"}
            </button>
          </div>

          {showMore ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "92px 1fr",
                gap: 10,
                marginTop: 12,
              }}
            >
              <input
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                type="number"
                min="1"
                placeholder="Pax"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  color: "#fff",
                  padding: "13px 14px",
                  fontSize: 15,
                  outline: "none",
                }}
              />

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  color: "#fff",
                  padding: "13px 14px",
                  fontSize: 15,
                  outline: "none",
                  minHeight: 68,
                  resize: "none",
                }}
              />
            </div>
          ) : null}

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 8,
            }}
          >
            {quickPlaces.map((place) => (
              <button
                key={place}
                type="button"
                onClick={() => setDropoffName(place)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "10px 2px",
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: "2px solid rgba(255,255,255,0.7)",
                    opacity: 0.85,
                  }}
                />
                <div style={{ fontSize: 15, color: "#eaf2fb" }}>{place}</div>
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div
            style={{
              padding: 10,
              borderRadius: 14,
              background: "rgba(255, 91, 91, 0.08)",
              border: "1px solid rgba(255, 91, 91, 0.18)",
              color: "#ffd5d5",
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
              borderRadius: 14,
              background: "rgba(31, 214, 122, 0.08)",
              border: "1px solid rgba(31, 214, 122, 0.18)",
              color: "#d5ffe7",
              fontSize: 12,
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
            padding: "17px",
            fontSize: 16,
            fontWeight: 1000,
            color: "#0a111b",
            background: "linear-gradient(90deg,#c7ff15,#a8f400)",
            boxShadow: "0 16px 30px rgba(168,244,0,0.22)",
          }}
        >
          {submitting ? "Finding..." : "Find offers"}
        </button>
      </form>
    </div>
  );
      }
