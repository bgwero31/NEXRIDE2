// File: src/components/driver/DriverTripControls.jsx

"use client";

import { useMemo, useState } from "react";
import { ref, remove, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { googleMapsDirectionsUrl, toLatLng } from "../../lib/googleMaps";
import { nexrideNotificationTypes, queueNexrideEvent } from "../../lib/nexrideNotifications";
import { isNexrideVoiceEnabled, muteNexrideVoice, speakNexrideStage, unlockNexrideVoice } from "../../lib/nexrideVoice";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function copy(status) {
  if (status === "accepted") return "Head to pickup";
  if (status === "arrived") return "Verify rider OTP";
  if (status === "picked") return "Trip started";
  if (status === "enroute") return "Driving to destination";
  return "Manage trip";
}

export async function pushDriverLivePosition(tripId, { lat, lng, heading }) {
  if (!tripId) return;
  await update(ref(db, `activeTrips/${tripId}/driverLive`), {
    lat: lat ?? null,
    lng: lng ?? null,
    heading: heading ?? null,
    updatedAt: Date.now(),
  });
}

export default function DriverTripControls({ trip, liveRouteInfo = null, onTripUpdated, onTripCompleted }) {
  const [otpInput, setOtpInput] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [voiceOn, setVoiceOn] = useState(() => (typeof window !== "undefined" ? isNexrideVoiceEnabled() : true));

  const canVerifyOtp = useMemo(() => trip?.status === "accepted" || trip?.status === "arrived", [trip?.status]);

  if (!trip) {
    return (
      <ActionCard>
        <h3 className="nx-card-title">No active trip</h3>
        <p className="nx-sheet-copy">Accept a rider request to start the NEXRIDE trip flow.</p>
      </ActionCard>
    );
  }

  const updateStatus = async (nextStatus) => {
    setError("");
    setSuccess("");
    setLoadingAction(nextStatus);
    try {
      const payload = { status: nextStatus, updatedAt: Date.now() };
      if (nextStatus === "arrived") payload.arrivedAt = Date.now();
      if (nextStatus === "enroute") payload.enrouteAt = Date.now();
      await update(ref(db, `activeTrips/${trip.tripId}`), payload);
      const eventMap = {
        arrived: [nexrideNotificationTypes.DRIVER_ARRIVED, "Driver arrived", `${trip.driverName || "Your driver"} has arrived at pickup.`],
        enroute: [nexrideNotificationTypes.TRIP_ENROUTE, "Trip started route", `You are now heading to ${trip.dropoffName || "destination"}.`],
      };
      if (eventMap[nextStatus]) {
        const [type, title, message] = eventMap[nextStatus];
        await queueNexrideEvent({
          type,
          city: trip.city || "",
          targetUid: trip.riderId,
          title,
          message,
          url: "/rider",
          data: { tripId: trip.tripId, status: nextStatus },
        });
      }
      const updatedTrip = { ...trip, ...payload };
      speakNexrideStage(nextStatus, "driver", updatedTrip, { force: voiceOn });
      onTripUpdated?.(updatedTrip);
      setSuccess(`Trip marked: ${nextStatus}`);
    } catch (err) {
      console.error(err);
      setError("Failed to update trip.");
    } finally {
      setLoadingAction("");
    }
  };

  const verifyOtp = async () => {
    const entered = otpInput.trim();
    if (!entered) {
      setError("Enter the rider OTP first.");
      return;
    }
    if (entered !== String(trip.otp || "").trim()) {
      setError("Wrong OTP. Ask rider to show the code again.");
      return;
    }

    setLoadingAction("otp");
    setError("");
    setSuccess("");
    try {
      const payload = { status: "picked", pickedAt: Date.now(), updatedAt: Date.now() };
      await update(ref(db, `activeTrips/${trip.tripId}`), payload);
      await queueNexrideEvent({
        type: nexrideNotificationTypes.OTP_VERIFIED,
        city: trip.city || "",
        targetUid: trip.riderId,
        title: "OTP verified",
        message: `${trip.driverName || "Your driver"} verified the pickup code.`,
        url: "/rider",
        data: { tripId: trip.tripId, status: "picked", step: "otp_verified" },
      });
      await queueNexrideEvent({
        type: nexrideNotificationTypes.TRIP_STARTED,
        city: trip.city || "",
        targetUid: trip.riderId,
        title: "Trip started",
        message: `Your NEXRIDE trip has started. Live route is now following the destination.`,
        url: "/rider",
        data: { tripId: trip.tripId, status: "picked", step: "trip_started" },
      });
      const updatedTrip = { ...trip, ...payload };
      speakNexrideStage("picked", "driver", updatedTrip, { force: voiceOn });
      onTripUpdated?.(updatedTrip);
      setOtpInput("");
      setSuccess("OTP verified. Trip started.");
    } catch (err) {
      console.error(err);
      setError("Failed to verify OTP.");
    } finally {
      setLoadingAction("");
    }
  };

  const completeTrip = async () => {
    setLoadingAction("complete");
    setError("");
    setSuccess("");
    try {
      const completed = {
        ...trip,
        status: "completed",
        distanceText: liveRouteInfo?.distanceText || trip.distanceText || "",
        distanceMeters: liveRouteInfo?.distanceMeters || trip.distanceMeters || null,
        durationText: liveRouteInfo?.durationText || trip.durationText || "",
        durationSeconds: liveRouteInfo?.durationSeconds || trip.durationSeconds || null,
        routeSource: liveRouteInfo?.source || trip.routeSource || "google",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };
      await set(ref(db, `completedTrips/${trip.tripId}`), completed);
      await queueNexrideEvent({
        type: nexrideNotificationTypes.TRIP_COMPLETED,
        city: trip.city || "",
        targetUid: trip.riderId,
        title: "Trip completed",
        message: `Your NEXRIDE trip has been completed.`,
        url: "/rider",
        data: { tripId: trip.tripId, status: "completed" },
      });
      speakNexrideStage("completed", "driver", completed, { force: voiceOn });
      await remove(ref(db, `activeTrips/${trip.tripId}`));
      onTripCompleted?.(completed);
    } catch (err) {
      console.error(err);
      setError("Failed to complete trip.");
    } finally {
      setLoadingAction("");
    }
  };

  const driverLive = toLatLng(trip.driverLive);
  const navigatingToPickup = trip.status === "accepted" || trip.status === "arrived";
  const navigateHref = googleMapsDirectionsUrl({
    origin: driverLive || trip.pickupName || "My location",
    destination: navigatingToPickup ? (trip.pickupName || "Pickup") : (trip.dropoffName || "Destination"),
    city: trip.city || "harare",
  });

  return (
    <div className="nx-stack">
      {error ? <div className="nx-alert-error">{error}</div> : null}
      {success ? <div className="nx-alert-success">{success}</div> : null}

      <ActionCard className="nx-voice-card">
        <div>
          <div className="nx-eyebrow">Voice guidance</div>
          <p className="nx-soft-text">NEXRIDE will speak trip stages like accepted, arrived, OTP verified, enroute and completed.</p>
        </div>
        <button
          type="button"
          className={`nx-voice-toggle ${voiceOn ? "active" : ""}`}
          onClick={() => {
            if (voiceOn) {
              muteNexrideVoice();
              setVoiceOn(false);
            } else {
              unlockNexrideVoice("driver");
              setVoiceOn(true);
            }
          }}
        >
          {voiceOn ? "Voice on" : "Voice off"}
        </button>
      </ActionCard>

      <ActionCard className="nx-driver-card">
        <div className="nx-offer-top">
          <div className="nx-driver-avatar">OTP</div>
          <div>
            <h3 className="nx-card-title">{copy(trip.status)}</h3>
            <p className="nx-sheet-copy">{trip.riderName || "Rider"} • ${money(trip.agreedPrice)} • {trip.people || 1} passenger</p>
          </div>
          <div className="nx-status-pill">{trip.status || "accepted"}</div>
        </div>

        <div className="nx-route-mini compact">
          <div className="nx-route-mini-row"><span className="nx-dot nx-dot-pickup" />{trip.pickupName || "Pickup"}</div>
          <div className="nx-route-mini-row"><span className="nx-dot nx-dot-destination" />{trip.dropoffName || "Destination"}</div>
        </div>
        <div className="nx-map-metrics nx-request-metrics">
          <span>{liveRouteInfo?.distanceText || trip.distanceText || "Distance loading"}</span>
          <span>{liveRouteInfo?.durationText || trip.durationText || "ETA loading"}</span>
          <span>{navigatingToPickup ? "To pickup" : "To destination"}</span>
        </div>
      </ActionCard>

      {canVerifyOtp ? (
        <ActionCard>
          <div className="nx-field-grid two">
            <label className="nx-field">
              <span>Rider OTP</span>
              <input className="nx-input" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} placeholder="Enter 6 digits" />
            </label>
            <label className="nx-field">
              <span>Expected</span>
              <input className="nx-input" readOnly value="Ask rider" />
            </label>
          </div>
          <div className="nx-button-grid two" style={{ marginTop: 10 }}>
            <PremiumButton onClick={() => updateStatus("arrived")} disabled={loadingAction === "arrived"}>I arrived</PremiumButton>
            <PremiumButton variant="secondary" onClick={verifyOtp} disabled={loadingAction === "otp"}>Verify OTP</PremiumButton>
          </div>
        </ActionCard>
      ) : null}

      <div className="nx-button-grid two">
        <a className="nx-btn nx-btn-secondary" href={navigateHref} target="_blank" rel="noreferrer">Navigate</a>
        {trip.status === "picked" ? (
          <PremiumButton onClick={() => updateStatus("enroute")} disabled={loadingAction === "enroute"}>Start route</PremiumButton>
        ) : (
          <PremiumButton onClick={completeTrip} disabled={loadingAction === "complete"}>Complete trip</PremiumButton>
        )}
      </div>
    </div>
  );
}
