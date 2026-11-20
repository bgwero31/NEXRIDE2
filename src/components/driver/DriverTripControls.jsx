// File: src/components/driver/DriverTripControls.jsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ref, remove, runTransaction, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import { googleMapsDirectionsUrl, toLatLng } from "../../lib/googleMaps";
import {
  nexrideNotificationTypes,
  queueNexrideEvent,
} from "../../lib/nexrideNotifications";
import {
  isNexrideVoiceEnabled,
  muteNexrideVoice,
  speakNexrideStage,
  unlockNexrideVoice,
} from "../../lib/nexrideVoice";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

/* ------------------------------ Helpers ------------------------------- */

function money(value) {
  return Number(value || 0).toFixed(2);
}

function statusCopy(status) {
  switch (status) {
    case "accepted": return "Head to pickup";
    case "arrived":  return "Verify rider OTP";
    case "picked":   return "Trip started";
    case "enroute":  return "Driving to destination";
    case "completed": return "Trip complete";
    case "cancelled": return "Trip cancelled";
    default:         return "Manage trip";
  }
}

function hasPhone(phone) {
  return phone && String(phone).trim().length > 0;
}

/** How long the trip has been active. */
function useTripElapsed(createdAt) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!createdAt) return;
    const start = Number(createdAt);
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/* ---------------------------- Component ------------------------------- */

export default function DriverTripControls({
  trip,
  liveRouteInfo = null,
  onTripUpdated,
  onTripCompleted,
}) {
  const [otpInput, setOtpInput] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [voiceOn, setVoiceOn] = useState(() =>
    typeof window !== "undefined" ? isNexrideVoiceEnabled() : true
  );

  // Track last spoken status to avoid repeating.
  const lastSpokenStatusRef = useRef("");

  const tripStatus = trip?.status;
  const tripId = trip?.tripId;

  /* ---------- Auto-speak on status change ---------- */
  useEffect(() => {
    if (!tripStatus || !voiceOn || !tripId) return;
    const key = `${tripId}:${tripStatus}`;
    if (lastSpokenStatusRef.current === key) return;
    lastSpokenStatusRef.current = key;
    speakNexrideStage(tripStatus, "driver", trip, { force: true });
  }, [tripStatus, voiceOn, tripId, trip]);

  /* ---------- Live elapsed timer ---------- */
  const elapsed = useTripElapsed(trip?.createdAt);

  /* ---------- Derived flags ---------- */
  const canVerifyOtp = useMemo(
    () => tripStatus === "accepted" || tripStatus === "arrived",
    [tripStatus]
  );

  const riderPhoneOk = hasPhone(trip?.riderPhone);

  const navigatingToPickup =
    tripStatus === "accepted" || tripStatus === "arrived";

  /* ---------- Directions URL (recomputes when driver moves) ---------- */
  const driverLive = useMemo(() => toLatLng(trip?.driverLive), [trip?.driverLive]);

  const navigateHref = useMemo(() => {
    if (!trip) return "#";
    return googleMapsDirectionsUrl({
      origin: driverLive || trip.pickupName || "My location",
      destination: navigatingToPickup
        ? trip.pickupName || "Pickup"
        : trip.dropoffName || "Destination",
      city: trip.city || "harare",
    });
  }, [driverLive, navigatingToPickup, trip]);

  /* -------------------- Status update (guarded) -------------------- */
  const updateStatus = useCallback(
    async (nextStatus, extra = {}) => {
      if (!tripId || !trip) return;
      setError("");
      setSuccess("");
      setLoadingAction(nextStatus);

      try {
        const payload = {
          status: nextStatus,
          updatedAt: Date.now(),
          ...extra,
        };
        if (nextStatus === "arrived") payload.arrivedAt = Date.now();
        if (nextStatus === "enroute") payload.enrouteAt = Date.now();

        await update(ref(db, `activeTrips/${tripId}`), payload);

        // Notify rider for rider-facing transitions.
        const events = {
          arrived: [
            nexrideNotificationTypes.DRIVER_ARRIVED,
            "Driver arrived",
            `${trip.driverName || "Your driver"} has arrived at pickup.`,
          ],
          enroute: [
            nexrideNotificationTypes.TRIP_ENROUTE,
            "Trip started route",
            `You are now heading to ${trip.dropoffName || "destination"}.`,
          ],
        };

        const evt = events[nextStatus];
        if (evt) {
          const [type, title, message] = evt;
          queueNexrideEvent({
            type,
            city: trip.city || "",
            targetUid: trip.riderId,
            title,
            message,
            url: "/rider",
            data: { tripId, status: nextStatus },
          }).catch(() => {});
        }

        const updatedTrip = { ...trip, ...payload };
        onTripUpdated?.(updatedTrip);
        setSuccess(`Marked ${nextStatus}.`);
      } catch (err) {
        console.error("[DriverTripControls] update status failed:", err);
        setError("Failed to update trip.");
      } finally {
        setLoadingAction("");
      }
    },
    [trip, tripId, onTripUpdated]
  );

  /* -------------------------- Verify OTP -------------------------- */
  const verifyOtp = useCallback(async () => {
    const entered = otpInput.trim();
    if (!entered) {
      setError("Enter the rider OTP first.");
      return;
    }
    if (entered !== String(trip?.otp || "").trim()) {
      setError("Wrong OTP. Ask rider to show the code again.");
      return;
    }

    setLoadingAction("otp");
    setError("");
    setSuccess("");

    try {
      // Atomic guard: only proceed if still in accepted/arrived status.
      const statusRef = ref(db, `activeTrips/${tripId}/status`);
      const result = await runTransaction(statusRef, (current) => {
        if (current === "picked" || current === "enroute" || current === "completed") {
          return; // abort — already advanced
        }
        return "picked";
      });

      if (!result.committed) {
        setError("Trip already started.");
        setLoadingAction("");
        return;
      }

      const now = Date.now();
      await update(ref(db, `activeTrips/${tripId}`), {
        pickedAt: now,
        updatedAt: now,
      });

      queueNexrideEvent({
        type: nexrideNotificationTypes.OTP_VERIFIED,
        city: trip.city || "",
        targetUid: trip.riderId,
        title: "OTP verified",
        message: `${trip.driverName || "Your driver"} verified the pickup code.`,
        url: "/rider",
        data: { tripId, status: "picked", step: "otp_verified" },
      }).catch(() => {});

      queueNexrideEvent({
        type: nexrideNotificationTypes.TRIP_STARTED,
        city: trip.city || "",
        targetUid: trip.riderId,
        title: "Trip started",
        message: "Your NEXRIDE trip has started. Live route is now following the destination.",
        url: "/rider",
        data: { tripId, status: "picked", step: "trip_started" },
      }).catch(() => {});

      const updatedTrip = { ...trip, status: "picked", pickedAt: now };
      onTripUpdated?.(updatedTrip);
      setOtpInput("");
      setSuccess("OTP verified. Trip started.");
    } catch (err) {
      console.error("[DriverTripControls] verify OTP failed:", err);
      setError("Failed to verify OTP.");
    } finally {
      setLoadingAction("");
    }
  }, [otpInput, trip, tripId, onTripUpdated]);

  /* ------------------------- Complete trip ------------------------ */
  const completeTrip = useCallback(async () => {
    if (!tripId || !trip) return;

    setLoadingAction("complete");
    setError("");
    setSuccess("");

    try {
      const now = Date.now();
      const completed = {
        ...trip,
        status: "completed",
        distanceText: liveRouteInfo?.distanceText || trip.distanceText || "",
        distanceMeters: liveRouteInfo?.distanceMeters || trip.distanceMeters || null,
        durationText: liveRouteInfo?.durationText || trip.durationText || "",
        durationSeconds: liveRouteInfo?.durationSeconds || trip.durationSeconds || null,
        routeSource: liveRouteInfo?.source || trip.routeSource || "google",
        completedAt: now,
        updatedAt: now,
      };

      // Write to completedTrips first (so we never lose the record).
      await set(ref(db, `completedTrips/${tripId}`), completed);

      // Then remove from activeTrips.
      await remove(ref(db, `activeTrips/${tripId}`));

      // Also clean up any lingering requests/offers/views.
      if (trip.requestId) {
        await Promise.allSettled([
          remove(ref(db, `rideRequests/${trip.city}/${trip.requestId}`)).catch(() => {}),
          remove(ref(db, `rideOffers/${trip.requestId}`)).catch(() => {}),
          remove(ref(db, `rideViews/${trip.requestId}`)).catch(() => {}),
        ]);
      }

      queueNexrideEvent({
        type: nexrideNotificationTypes.TRIP_COMPLETED,
        city: trip.city || "",
        targetUid: trip.riderId,
        title: "Trip completed",
        message: "Your NEXRIDE trip has been completed.",
        url: "/rider",
        data: { tripId, status: "completed" },
      }).catch(() => {});

      onTripCompleted?.(completed);
      setConfirmComplete(false);
    } catch (err) {
      console.error("[DriverTripControls] complete failed:", err);
      setError("Failed to complete trip.");
    } finally {
      setLoadingAction("");
    }
  }, [trip, tripId, liveRouteInfo, onTripCompleted]);

  /* ------------------------- Cancel trip -------------------------- */
  const cancelTrip = useCallback(async () => {
    if (!tripId || !trip) return;

    setLoadingAction("cancel");
    setError("");
    setSuccess("");

    try {
      const now = Date.now();
      const cancelled = {
        ...trip,
        status: "cancelled",
        cancelledBy: "driver",
        cancelledAt: now,
        updatedAt: now,
      };

      // Move to cancelledTrips for audit.
      await set(ref(db, `cancelledTrips/${tripId}`), cancelled);
      await remove(ref(db, `activeTrips/${tripId}`));

      if (trip.requestId) {
        await Promise.allSettled([
          remove(ref(db, `rideRequests/${trip.city}/${trip.requestId}`)).catch(() => {}),
          remove(ref(db, `rideOffers/${trip.requestId}`)).catch(() => {}),
          remove(ref(db, `rideViews/${trip.requestId}`)).catch(() => {}),
        ]);
      }

      queueNexrideEvent({
        type: nexrideNotificationTypes.TRIP_CANCELLED,
        city: trip.city || "",
        targetUid: trip.riderId,
        title: "Driver cancelled",
        message: "Your driver cancelled the trip. Please request another ride.",
        url: "/rider",
        data: { tripId, status: "cancelled" },
      }).catch(() => {});

      onTripCompleted?.(cancelled);
      setConfirmCancel(false);
    } catch (err) {
      console.error("[DriverTripControls] cancel failed:", err);
      setError("Failed to cancel trip.");
    } finally {
      setLoadingAction("");
    }
  }, [trip, tripId, onTripCompleted]);

  /* ------------------------ Voice toggle -------------------------- */
  const handleVoiceToggle = useCallback(() => {
    if (voiceOn) {
      muteNexrideVoice();
      setVoiceOn(false);
    } else {
      unlockNexrideVoice("driver");
      setVoiceOn(true);
    }
  }, [voiceOn]);

  /* ---------------------------- Empty state ----------------------- */
  if (!trip) {
    return (
      <ActionCard>
        <h3 className="nx-card-title">No active trip</h3>
        <p className="nx-sheet-copy">
          Accept a rider request to start the NEXRIDE trip flow.
        </p>
      </ActionCard>
    );
  }

  /* ---------------------------- Render ---------------------------- */
  return (
    <div className="nx-stack">
      {error ? <div className="nx-alert-error">{error}</div> : null}
      {success ? <div className="nx-alert-success">{success}</div> : null}

      {/* Header card — status + rider + fare + elapsed */}
      <ActionCard className="nx-driver-card">
        <div className="nx-offer-top">
          <div className="nx-driver-avatar">OTP</div>
          <div className="nx-offer-mid">
            <h3 className="nx-card-title">{statusCopy(tripStatus)}</h3>
            <p className="nx-sheet-copy">
              {trip.riderName || "Rider"} • ${money(trip.agreedPrice)} •{" "}
              {trip.people || 1} pax
            </p>
          </div>
          <div className="nx-trip-status-col">
            <div className="nx-status-pill">{tripStatus || "accepted"}</div>
            <span className="nx-trip-elapsed">{elapsed}</span>
          </div>
        </div>

        <div className="nx-route-mini compact">
          <div className="nx-route-mini-row">
            <span className="nx-dot nx-dot-pickup" />
            {trip.pickupName || "Pickup"}
          </div>
          <div className="nx-route-mini-row">
            <span className="nx-dot nx-dot-destination" />
            {trip.dropoffName || "Destination"}
          </div>
        </div>

        <div className="nx-map-metrics nx-request-metrics">
          <span>{liveRouteInfo?.distanceText || trip.distanceText || "—"}</span>
          <span>{liveRouteInfo?.durationText || trip.durationText || "—"}</span>
          <span>{navigatingToPickup ? "To pickup" : "To destination"}</span>
        </div>
      </ActionCard>

      {/* OTP verification (only in accepted/arrived) */}
      {canVerifyOtp ? (
        <ActionCard>
          <div className="nx-field-grid two">
            <label className="nx-field">
              <span>Rider OTP</span>
              <input
                className="nx-input"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6 digits"
                autoComplete="off"
              />
            </label>
            <label className="nx-field">
              <span>Status</span>
              <input
                className="nx-input"
                readOnly
                value={tripStatus === "arrived" ? "Ready to verify" : "Tap 'I arrived' first"}
              />
            </label>
          </div>

          <div className="nx-button-grid two" style={{ marginTop: 10 }}>
            <PremiumButton
              onClick={() => updateStatus("arrived")}
              disabled={
                tripStatus !== "accepted" ||
                loadingAction === "arrived"
              }
              loading={loadingAction === "arrived"}
            >
              I arrived
            </PremiumButton>
            <PremiumButton
              variant="secondary"
              onClick={verifyOtp}
              disabled={!otpInput || loadingAction === "otp"}
              loading={loadingAction === "otp"}
            >
              Verify OTP
            </PremiumButton>
          </div>
        </ActionCard>
      ) : null}

      {/* Voice toggle — compact */}
      <ActionCard className="nx-voice-card compact">
        <div className="nx-voice-copy">
          <div className="nx-eyebrow">Voice guidance</div>
          <p className="nx-soft-text">
            Speaks on arrival, OTP, enroute, and completion.
          </p>
        </div>
        <button
          type="button"
          className={`nx-voice-toggle ${voiceOn ? "active" : ""}`}
          onClick={handleVoiceToggle}
          aria-pressed={voiceOn}
        >
          {voiceOn ? "Voice on" : "Voice off"}
        </button>
      </ActionCard>

      {/* Primary trip actions */}
      <div className="nx-button-grid two">
        <a className="nx-btn" href={`/trip/${tripId}/navigate`}>
          NEXRIDE nav
        </a>
        <a
          className="nx-btn nx-btn-secondary"
          href={navigateHref}
          target="_blank"
          rel="noreferrer"
        >
          Open Google
        </a>

        {riderPhoneOk ? (
          <a className="nx-btn nx-btn-secondary" href={`tel:${trip.riderPhone}`}>
            Call rider
          </a>
        ) : (
          <button type="button" className="nx-btn nx-btn-secondary" disabled>
            No phone
          </button>
        )}

        {tripStatus === "picked" ? (
          <PremiumButton
            onClick={() => updateStatus("enroute")}
            disabled={loadingAction === "enroute"}
            loading={loadingAction === "enroute"}
          >
            Start route
          </PremiumButton>
        ) : (
          <PremiumButton
            onClick={() => setConfirmComplete(true)}
            disabled={loadingAction === "complete"}
          >
            Complete trip
          </PremiumButton>
        )}
      </div>

      {/* Confirm complete */}
      {confirmComplete ? (
        <div className="nx-confirm-row">
          <div className="nx-confirm-copy">
            Complete the trip now? Rider will be charged $
            {money(trip.agreedPrice)}.
          </div>
          <div className="nx-button-grid two">
            <PremiumButton variant="ghost" onClick={() => setConfirmComplete(false)}>
              Back
            </PremiumButton>
            <PremiumButton
              onClick={completeTrip}
              loading={loadingAction === "complete"}
            >
              Yes, complete
            </PremiumButton>
          </div>
        </div>
      ) : null}

      {/* Cancel (driver side) */}
      {confirmCancel ? (
        <div className="nx-confirm-row nx-confirm-danger">
          <div className="nx-confirm-copy">
            Cancel this trip? The rider will be notified immediately.
          </div>
          <div className="nx-button-grid two">
            <PremiumButton variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep trip
            </PremiumButton>
            <PremiumButton
              variant="danger"
              onClick={cancelTrip}
              loading={loadingAction === "cancel"}
            >
              Yes, cancel
            </PremiumButton>
          </div>
        </div>
      ) : (
        <PremiumButton
          variant="ghost"
          onClick={() => setConfirmCancel(true)}
        >
          Cancel trip
        </PremiumButton>
      )}
    </div>
  );
}
