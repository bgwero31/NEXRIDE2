// File: src/components/driver/DriverTripControls.jsx

"use client";

import { useMemo, useState } from "react";
import { ref, remove, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import ActionCard from "../ui/ActionCard";

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
    textTransform: "uppercase",
    border: "1px solid transparent",
  };

  if (status === "accepted") {
    return {
      ...base,
      color: "#d9f6ff",
      background: "rgba(0,198,255,0.12)",
      border: "1px solid rgba(0,198,255,0.25)",
    };
  }

  if (status === "arrived") {
    return {
      ...base,
      color: "#fff7d6",
      background: "rgba(255,176,32,0.12)",
      border: "1px solid rgba(255,176,32,0.22)",
    };
  }

  if (status === "picked" || status === "enroute") {
    return {
      ...base,
      color: "#eaffdc",
      background: "rgba(45,200,95,0.12)",
      border: "1px solid rgba(45,200,95,0.22)",
    };
  }

  if (status === "completed") {
    return {
      ...base,
      color: "#e8f0ff",
      background: "rgba(110,140,255,0.12)",
      border: "1px solid rgba(110,140,255,0.22)",
    };
  }

  return {
    ...base,
    color: "#f5f7fa",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

export default function DriverTripControls({
  trip,
  onTripUpdated,
  onTripCompleted,
}) {
  const [otpInput, setOtpInput] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const livePath = useMemo(() => {
    if (!trip?.tripId) return null;
    return `activeTrips/${trip.tripId}/driverLive`;
  }, [trip]);

  const canVerifyOtp = useMemo(() => {
    return trip?.status === "accepted" || trip?.status === "arrived";
  }, [trip]);

  const setTripStatus = async (nextStatus) => {
    if (!trip?.tripId) return;

    setError("");
    setSuccess("");
    setLoadingAction(nextStatus);

    try {
      await update(ref(db, `activeTrips/${trip.tripId}`), {
        status: nextStatus,
        updatedAt: Date.now(),
      });

      if (onTripUpdated) {
        onTripUpdated({
          ...trip,
          status: nextStatus,
          updatedAt: Date.now(),
        });
      }

      setSuccess(`Trip marked as ${nextStatus}.`);
    } catch (err) {
      console.error(err);
      setError(`Failed to mark trip as ${nextStatus}.`);
    } finally {
      setLoadingAction("");
    }
  };

  const verifyOtp = async () => {
    if (!trip?.tripId) return;

    setError("");
    setSuccess("");

    const entered = otpInput.trim();
    const realOtp = String(trip?.otp || "").trim();

    if (!entered) {
      setError("Enter OTP first.");
      return;
    }

    if (entered !== realOtp) {
      setError("Incorrect OTP.");
      return;
    }

    setLoadingAction("verify-otp");

    try {
      await update(ref(db, `activeTrips/${trip.tripId}`), {
        status: "picked",
        pickedAt: Date.now(),
        updatedAt: Date.now(),
      });

      if (onTripUpdated) {
        onTripUpdated({
          ...trip,
          status: "picked",
          pickedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      setSuccess("OTP verified. Trip started.");
      setOtpInput("");
    } catch (err) {
      console.error(err);
      setError("Failed to verify OTP.");
    } finally {
      setLoadingAction("");
    }
  };

  const completeTrip = async () => {
    if (!trip?.tripId) return;

    setError("");
    setSuccess("");
    setLoadingAction("complete");

    try {
      const completedPayload = {
        ...trip,
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };

      await set(ref(db, `completedTrips/${trip.tripId}`), completedPayload);
      await remove(ref(db, `activeTrips/${trip.tripId}`));

      if (onTripCompleted) {
        onTripCompleted(completedPayload);
      }

      setSuccess("Trip completed successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to complete trip.");
    } finally {
      setLoadingAction("");
    }
  };

  const updateDriverLocation = async ({ lat, lng, heading }) => {
    if (!livePath) return;

    try {
      await update(ref(db, livePath), {
        lat: lat ?? null,
        lng: lng ?? null,
        heading: heading ?? null,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error("driver live update failed", err);
    }
  };

  if (!trip) {
    return (
      <ActionCard>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>No active trip</div>
        <div style={{ fontSize: 13, color: "#9fb3c8" }}>
          Accept a ride request to start managing a trip.
        </div>
      </ActionCard>
    );
  }

  return (
    <ActionCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Trip controls</div>
          <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
            Manage pickup, trip start, and completion.
          </div>
        </div>

        <div style={statusPill(trip.status || "accepted")}>
          {trip.status || "accepted"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>
          {trip.pickupName} → {trip.dropoffName}
        </div>

        <div style={{ fontSize: 13, color: "#9fb3c8" }}>
          Rider: {trip.riderName || "Rider"}
        </div>

        <div style={{ fontSize: 13, color: "#9fb3c8" }}>
          Fare: ${Number(trip.agreedPrice || 0).toFixed(2)}
        </div>
      </div>

      {(error || success) && (
        <div style={{ marginTop: 12 }}>
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
        </div>
      )}

      {canVerifyOtp && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <input
            className="nx-input"
            type="text"
            placeholder="Enter rider OTP"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value)}
          />

          <button
            onClick={verifyOtp}
            disabled={loadingAction === "verify-otp"}
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
            {loadingAction === "verify-otp" ? "Verifying..." : "Verify OTP"}
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 14,
        }}
      >
        <button
          onClick={() => setTripStatus("arrived")}
          disabled={loadingAction === "arrived" || trip.status === "completed"}
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
          {loadingAction === "arrived" ? "Saving..." : "Mark arrived"}
        </button>

        <button
          onClick={() => setTripStatus("enroute")}
          disabled={loadingAction === "enroute" || trip.status === "completed"}
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
          {loadingAction === "enroute" ? "Saving..." : "Start route"}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          onClick={completeTrip}
          disabled={loadingAction === "complete"}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 16,
            padding: "14px",
            fontSize: 14,
            fontWeight: 1000,
            color: "#fff",
            background: "linear-gradient(90deg,#ff5b5b,#ff7a45)",
            boxShadow: "0 10px 24px rgba(255,91,91,0.20)",
          }}
        >
          {loadingAction === "complete" ? "Completing..." : "Complete trip"}
        </button>
      </div>
    </ActionCard>
  );
}

export async function pushDriverLivePosition(tripId, lat, lng, heading = null) {
  if (!tripId) return;

  try {
    await update(ref(db, `activeTrips/${tripId}/driverLive`), {
      lat: lat ?? null,
      lng: lng ?? null,
      heading: heading ?? null,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error("pushDriverLivePosition error", err);
  }
}
