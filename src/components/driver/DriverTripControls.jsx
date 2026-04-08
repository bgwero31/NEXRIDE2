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
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };

  if (status === "accepted") {
    return {
      ...base,
      color: "#6d28d9",
      background: "rgba(124,58,237,0.10)",
      border: "1px solid rgba(124,58,237,0.12)",
    };
  }

  if (status === "arrived") {
    return {
      ...base,
      color: "#a16207",
      background: "rgba(245,158,11,0.10)",
      border: "1px solid rgba(245,158,11,0.16)",
    };
  }

  if (status === "picked" || status === "enroute") {
    return {
      ...base,
      color: "#0f7a4e",
      background: "rgba(31,214,122,0.10)",
      border: "1px solid rgba(31,214,122,0.16)",
    };
  }

  if (status === "completed") {
    return {
      ...base,
      color: "#4338ca",
      background: "rgba(99,102,241,0.10)",
      border: "1px solid rgba(99,102,241,0.16)",
    };
  }

  return {
    ...base,
    color: "#5f557c",
    background: "rgba(255,255,255,0.58)",
    border: "1px solid rgba(124,58,237,0.08)",
  };
}

function statusText(status) {
  if (status === "accepted") return "Head to pickup and verify rider OTP when they board.";
  if (status === "arrived") return "You have arrived at pickup. Wait for rider and verify OTP.";
  if (status === "picked") return "Trip has started. You can now continue the route.";
  if (status === "enroute") return "You are on the route to the destination.";
  if (status === "completed") return "Trip completed successfully.";
  return "Manage this trip from pickup to completion.";
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
      <ActionCard
        style={{
          padding: 12,
          borderRadius: 20,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.86))",
          border: "1px solid rgba(124,58,237,0.10)",
          boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            fontWeight: 1000,
            fontSize: 13,
            color: "#23153d",
            marginBottom: 5,
          }}
        >
          No active trip
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#615682",
            lineHeight: 1.45,
          }}
        >
          Accept a ride request to start managing a trip.
        </div>
      </ActionCard>
    );
  }

  return (
    <ActionCard
      style={{
        padding: 12,
        borderRadius: 22,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.60), rgba(247,241,255,0.88))",
        border: "1px solid rgba(124,58,237,0.10)",
        boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
        backdropFilter: "blur(16px)",
      }}
    >
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
          <div
            style={{
              fontSize: 15,
              fontWeight: 1000,
              color: "#23153d",
              lineHeight: 1.1,
            }}
          >
            Trip controls
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#615682",
              marginTop: 4,
              lineHeight: 1.45,
            }}
          >
            {statusText(trip.status || "accepted")}
          </div>
        </div>

        <div style={statusPill(trip.status || "accepted")}>
          {trip.status || "accepted"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          padding: 10,
          borderRadius: 18,
          background: "rgba(255,255,255,0.58)",
          border: "1px solid rgba(124,58,237,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 1000,
            color: "#23153d",
            lineHeight: 1.3,
          }}
        >
          {trip.pickupName} → {trip.dropoffName}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#74698f",
          }}
        >
          Rider: {trip.riderName || "Rider"}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#615682",
          }}
        >
          Fare: ${Number(trip.agreedPrice || 0).toFixed(2)}
        </div>
      </div>

      {(error || success) && (
        <div style={{ marginTop: 10 }}>
          {error ? (
            <div
              style={{
                padding: 10,
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
                padding: 10,
                borderRadius: 12,
                background: "rgba(31,214,122,0.10)",
                border: "1px solid rgba(31,214,122,0.18)",
                color: "#0f7a4e",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {success}
            </div>
          ) : null}
        </div>
      )}

      {canVerifyOtp && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
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
              padding: "13px 14px",
              fontSize: 13,
              fontWeight: 1000,
              color: "#fff",
              background: "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
              boxShadow: "0 10px 22px rgba(124,58,237,0.18)",
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
          gap: 8,
          marginTop: 10,
        }}
      >
        <button
          onClick={() => setTripStatus("arrived")}
          disabled={loadingAction === "arrived" || trip.status === "completed"}
          style={{
            width: "100%",
            border: "1px solid rgba(124,58,237,0.10)",
            borderRadius: 16,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 1000,
            color: "#5b21b6",
            background: "rgba(255,255,255,0.58)",
          }}
        >
          {loadingAction === "arrived" ? "Saving..." : "Mark arrived"}
        </button>

        <button
          onClick={() => setTripStatus("enroute")}
          disabled={loadingAction === "enroute" || trip.status === "completed"}
          style={{
            width: "100%",
            border: "1px solid rgba(124,58,237,0.10)",
            borderRadius: 16,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 1000,
            color: "#5b21b6",
            background: "rgba(255,255,255,0.58)",
          }}
        >
          {loadingAction === "enroute" ? "Saving..." : "Start route"}
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          onClick={completeTrip}
          disabled={loadingAction === "complete"}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 16,
            padding: "13px 14px",
            fontSize: 13,
            fontWeight: 1000,
            color: "#fff",
            background: "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
            boxShadow: "0 10px 22px rgba(124,58,237,0.18)",
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
