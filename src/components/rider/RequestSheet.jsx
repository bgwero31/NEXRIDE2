// File: src/components/rider/RequestSheet.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const fieldWrap = {
  borderRadius: 16,
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(124,58,237,0.10)",
  padding: "12px 13px",
};

const inputStyle = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#1f1635",
  fontSize: 14,
  fontWeight: 600,
};

const labelStyle = {
  fontSize: 11,
  color: "#7c3aed",
  fontWeight: 800,
  marginBottom: 4,
};

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

  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const autoServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const canSubmit = useMemo(() => {
    return pickupName.trim() && dropoffName.trim() && Number(offerPrice) > 0;
  }, [pickupName, dropoffName, offerPrice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.google?.maps?.places) return;

    autoServiceRef.current =
      autoServiceRef.current ||
      new window.google.maps.places.AutocompleteService();

    placesServiceRef.current =
      placesServiceRef.current ||
      new window.google.maps.places.PlacesService(document.createElement("div"));

    geocoderRef.current =
      geocoderRef.current || new window.google.maps.Geocoder();

    sessionTokenRef.current =
      sessionTokenRef.current ||
      new window.google.maps.places.AutocompleteSessionToken();
  }, []);

  const resetSessionToken = () => {
    if (typeof window === "undefined") return;
    if (!window.google?.maps?.places) return;
    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
  };

  const fetchSuggestions = (text, type) => {
    if (!text?.trim()) {
      if (type === "pickup") setPickupSuggestions([]);
      else setDropoffSuggestions([]);
      return;
    }

    if (!window.google?.maps?.places || !autoServiceRef.current) return;

    autoServiceRef.current.getPlacePredictions(
      {
        input: text,
        sessionToken: sessionTokenRef.current || undefined,
        componentRestrictions: { country: "zw" },
      },
      (predictions) => {
        const next = predictions || [];
        if (type === "pickup") setPickupSuggestions(next.slice(0, 5));
        else setDropoffSuggestions(next.slice(0, 5));
      }
    );
  };

  const applyPlace = (prediction, type) => {
    if (!prediction?.place_id || !placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["name", "formatted_address", "geometry"],
        sessionToken: sessionTokenRef.current || undefined,
      },
      (place, status) => {
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !place
        ) {
          return;
        }

        const name =
          place.formatted_address ||
          place.name ||
          prediction.description ||
          "";

        const lat = place.geometry?.location?.lat?.();
        const lng = place.geometry?.location?.lng?.();

        if (type === "pickup") {
          setPickupName(name);
          setPickupLat(lat != null ? String(lat) : "");
          setPickupLng(lng != null ? String(lng) : "");
          setPickupSuggestions([]);
        } else {
          setDropoffName(name);
          setDropoffLat(lat != null ? String(lat) : "");
          setDropoffLng(lng != null ? String(lng) : "");
          setDropoffSuggestions([]);
        }

        resetSessionToken();
      }
    );
  };

  const geocodeTypedPlace = async (text) => {
    if (!text?.trim()) return null;
    if (!geocoderRef.current) return null;

    return new Promise((resolve) => {
      geocoderRef.current.geocode(
        {
          address: text,
          componentRestrictions: { country: "ZW" },
        },
        (results, status) => {
          if (status !== "OK" || !results?.length) {
            resolve(null);
            return;
          }

          const best = results[0];
          const lat = best.geometry?.location?.lat?.();
          const lng = best.geometry?.location?.lng?.();

          resolve({
            name: best.formatted_address || text,
            lat: lat != null ? lat : null,
            lng: lng != null ? lng : null,
          });
        }
      );
    });
  };

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
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setPickupLat(String(lat));
        setPickupLng(String(lng));
        setPickupName("Current location");

        if (geocoderRef.current) {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results?.length) {
              const best = results[0];
              const name = best.formatted_address || "Current location";
              setPickupName(name);
            }
          });
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
    let finalPickupName = pickupName.trim();
    let finalDropoffName = dropoffName.trim();
    let finalPickupLat = pickupLat !== "" ? Number(pickupLat) : null;
    let finalPickupLng = pickupLng !== "" ? Number(pickupLng) : null;
    let finalDropoffLat = dropoffLat !== "" ? Number(dropoffLat) : null;
    let finalDropoffLng = dropoffLng !== "" ? Number(dropoffLng) : null;
    const cleanOffer = Number(offerPrice);
    const cleanPeople = Number(people) || 1;
    const cleanNotes = notes.trim();

    if (!finalPickupName || !finalDropoffName || !cleanCity) {
      setError("Enter pickup and destination.");
      return;
    }

    if (!cleanOffer || cleanOffer <= 0) {
      setError("Enter a valid offer price.");
      return;
    }

    try {
      setSubmitting(true);

      if (
        finalPickupName &&
        (!Number.isFinite(finalPickupLat) || !Number.isFinite(finalPickupLng))
      ) {
        const foundPickup = await geocodeTypedPlace(finalPickupName);

        if (foundPickup) {
          finalPickupName = foundPickup.name;
          finalPickupLat = foundPickup.lat;
          finalPickupLng = foundPickup.lng;

          setPickupName(foundPickup.name);
          setPickupLat(foundPickup.lat != null ? String(foundPickup.lat) : "");
          setPickupLng(foundPickup.lng != null ? String(foundPickup.lng) : "");
        }
      }

      if (
        finalDropoffName &&
        (!Number.isFinite(finalDropoffLat) || !Number.isFinite(finalDropoffLng))
      ) {
        const foundDropoff = await geocodeTypedPlace(finalDropoffName);

        if (foundDropoff) {
          finalDropoffName = foundDropoff.name;
          finalDropoffLat = foundDropoff.lat;
          finalDropoffLng = foundDropoff.lng;

          setDropoffName(foundDropoff.name);
          setDropoffLat(foundDropoff.lat != null ? String(foundDropoff.lat) : "");
          setDropoffLng(foundDropoff.lng != null ? String(foundDropoff.lng) : "");
        } else {
          finalDropoffLat = null;
          finalDropoffLng = null;
        }
      }

      const requestRef = push(ref(db, `rideRequests/${cleanCity}`));
      const requestId = requestRef.key;
      const now = Date.now();

      const payload = {
        riderId: user.uid,
        riderName: profile.fullName || "Rider",
        riderPhone: profile.phone || "",
        pickupName: finalPickupName,
        pickupLat: Number.isFinite(finalPickupLat) ? finalPickupLat : null,
        pickupLng: Number.isFinite(finalPickupLng) ? finalPickupLng : null,
        dropoffName: finalDropoffName,
        dropoffLat: Number.isFinite(finalDropoffLat) ? finalDropoffLat : null,
        dropoffLng: Number.isFinite(finalDropoffLng) ? finalDropoffLng : null,
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

  const suggestionBox = (items, type) =>
    items.length ? (
      <div
        style={{
          marginTop: 6,
          borderRadius: 14,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(124,58,237,0.10)",
          overflow: "hidden",
        }}
      >
        {items.map((item) => (
          <button
            key={item.place_id}
            type="button"
            onClick={() => applyPlace(item, type)}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              textAlign: "left",
              padding: "11px 12px",
              color: "#24153d",
              fontSize: 13,
              borderBottom: "1px solid rgba(124,58,237,0.06)",
            }}
          >
            {item.description}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <form onSubmit={handleRequestRide} style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            borderRadius: 24,
            padding: 12,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(246,240,255,0.82))",
            border: "1px solid rgba(124,58,237,0.10)",
            boxShadow: "0 10px 30px rgba(41, 19, 78, 0.12)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 1000,
              color: "#2b1650",
              marginBottom: 8,
            }}
          >
            Where to & for how much?
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={fieldWrap}>
              <div style={labelStyle}>City</div>
              <select
                value={city}
                onChange={(e) => {
                  const nextCity = e.target.value;
                  setCity(nextCity);
                  try {
                    localStorage.setItem("nexride-last-place", nextCity);
                  } catch {}
                }}
                style={inputStyle}
              >
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {cityLabel(item)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={fieldWrap}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#8b5cf6",
                      boxShadow: "0 0 10px rgba(139,92,246,0.5)",
                    }}
                  />
                  <div>
                    <div style={labelStyle}>Pickup</div>
                    <input
                      style={inputStyle}
                      value={pickupName}
                      onChange={(e) => {
                        setPickupName(e.target.value);
                        fetchSuggestions(e.target.value, "pickup");
                      }}
                      placeholder="Your current location"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={useMyCurrentLocation}
                    disabled={locating}
                    style={{
                      border: "none",
                      background: "rgba(124,58,237,0.10)",
                      color: "#5b21b6",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {locating ? "..." : "GPS"}
                  </button>
                </div>
              </div>
              {suggestionBox(pickupSuggestions, "pickup")}
            </div>

            <div>
              <div style={fieldWrap}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#c084fc",
                      boxShadow: "0 0 10px rgba(192,132,252,0.5)",
                    }}
                  />
                  <div>
                    <div style={labelStyle}>Destination</div>
                    <input
                      style={inputStyle}
                      value={dropoffName}
                      onChange={(e) => {
                        setDropoffName(e.target.value);
                        setDropoffLat("");
                        setDropoffLng("");
                        fetchSuggestions(e.target.value, "dropoff");
                      }}
                      placeholder="Type destination"
                    />
                  </div>
                </div>
              </div>
              {suggestionBox(dropoffSuggestions, "dropoff")}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 10,
                alignItems: "center",
                borderRadius: 18,
                padding: 10,
                background: "rgba(255,255,255,0.64)",
                border: "1px solid rgba(124,58,237,0.08)",
              }}
            >
              <button
                type="button"
                onClick={() => changeFare(-1)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(124,58,237,0.10)",
                  color: "#5b21b6",
                  fontSize: 24,
                }}
              >
                −
              </button>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 800 }}>
                  Your fare
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 1000,
                    color: "#1f1635",
                    lineHeight: 1.1,
                  }}
                >
                  ${Number(offerPrice || 0).toFixed(0)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => changeFare(1)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(124,58,237,0.10)",
                  color: "#5b21b6",
                  fontSize: 24,
                }}
              >
                +
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "82px 1fr",
                gap: 8,
              }}
            >
              <div style={fieldWrap}>
                <div style={labelStyle}>Pax</div>
                <input
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  type="number"
                  min="1"
                  style={inputStyle}
                />
              </div>

              <div style={fieldWrap}>
                <div style={labelStyle}>Notes</div>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div
            style={{
              padding: 9,
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
              padding: 9,
              borderRadius: 12,
              background: "rgba(31, 214, 122, 0.10)",
              border: "1px solid rgba(31, 214, 122, 0.18)",
              color: "#0f7a4e",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {success}
          </div>
        ) : 

                <button
          type="submit"
          disabled={!canSubmit || submitting}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 18,
            padding: "14px",
            fontSize: 15,
            fontWeight: 1000,
            color: "#fff",
            background: "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
            boxShadow: "0 12px 28px rgba(124,58,237,0.20)",
          }}
        >
          {submitting ? "Finding..." : "Find offers"}
        </button>
      </form>
    </div>
  );
        }
