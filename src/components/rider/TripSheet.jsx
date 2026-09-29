// File: src/components/rider/TripSheet.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";
import { googleMapsDirectionsUrl, toLatLng } from "../../lib/googleMaps";
import {
  isNexrideVoiceEnabled,
  muteNexrideVoice,
  speakNexrideStage,
  unlockNexrideVoice,
} from "../../lib/nexrideVoice";

/* ------------------------------ Constants ----------------------------- */

const STEPS = ["accepted", "arrived", "picked", "enroute", "completed"];

const STATUS_LABEL = {
  accepted: "Driver coming",
  arrived: "Driver arrived",
  picked: "Trip started",
  enroute: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

function statusLabel(status) {
  return STATUS_LABEL[status] || "Active trip";
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

/* ------------------------------ Helpers ------------------------------- */

/** Parse an ETA in seconds from live route info, return friendly text. */
function etaText(liveRouteInfo, tripData) {
  const seconds =
    Number(liveRouteInfo?.durationSeconds) ||
    Number(tripData?.durationSeconds) ||
    0;
  if (!seconds) return null;
  const min = Math.max(1, Math.round(seconds / 60));
  return `${min} min`;
}

/** Calculate active step index safely. Returns -1 for unknown/cancelled. */
function activeStepIndex(status) {
  const idx = STEPS.indexOf(status);
  return idx;
}

/** Check phone is usable */
function hasPhone(phone) {
  return phone && String(phone).trim().length > 0;
}

/* ---------------------------- Component ------------------------------- */

export default function TripSheet({
  tripData,
  liveRouteInfo = null,
  onCancelTrip,
  onContactDriver,
  onShareTrip, // optional — future: share link
}) {
  const [voiceOn, setVoiceOn] = useState(() =>
    typeof window !== "undefined" ? isNexrideVoiceEnabled() : true
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);
  const lastSpokenRef = useRef("");

  const tripStatus = tripData?.status;

  /* -------- Voice announcements — only on status change -------- */
  // Dep only on status, NOT the whole tripData object.
  // Prevents the effect firing every 5s when driverLive updates.
  useEffect(() => {
    if (!tripStatus || !voiceOn) return;
    const key = `${tripData?.tripId || tripData?.id || "trip"}:${tripStatus}`;
    if (lastSpokenRef.current === key) return;
    lastSpokenRef.current = key;
    speakNexrideStage(tripStatus, "rider", tripData, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripStatus, voiceOn]);

  /* -------------------- Derived values -------------------- */
  const isCancelled = tripStatus === "cancelled";
  const activeIndex = activeStepIndex(tripStatus);

  const driverLive = useMemo(
    () => (tripData ? toLatLng(tripData.driverLive) : null),
    [tripData?.driverLive]
  );

  const navigatingToPickup =
    tripStatus === "accepted" || tripStatus === "arrived";

  const mapsHref = useMemo(() => {
    if (!tripData) return "#";
    return googleMapsDirectionsUrl({
      origin: driverLive || tripData.pickupName || "Pickup",
      destination: navigatingToPickup
        ? tripData.pickupName || "Pickup"
        : tripData.dropoffName || "Destination",
      city: tripData.city || "harare",
    });
  }, [driverLive, navigatingToPickup, tripData]);

  const eta = etaText(liveRouteInfo, tripData);
  const driverPhoneOk = hasPhone(tripData?.driverPhone);

  /* -------------------- Handlers -------------------- */
  const copyOtp = async () => {
    if (!tripData?.otp) return;
    try {
      await navigator.clipboard.writeText(String(tripData.otp));
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 1600);
    } catch {}
  };

  const handleVoiceToggle = () => {
    if (voiceOn) {
      muteNexrideVoice();
      setVoiceOn(false);
    } else {
      unlockNexrideVoice("rider");
      setVoiceOn(true);
    }
  };

  if (!tripData) return null;

  /* ---------------------------- Render ---------------------------- */
  return (
    <div className="nx-stack">
      {/* Header: friendly status + fare */}
      <div className="nx-sheet-head">
        <div>
          <div className="nx-eyebrow">NEXRIDE live trip</div>
          <h2 className="nx-sheet-title">
            {statusLabel(tripStatus)}
            {eta && !isCancelled ? (
              <span className="nx-trip-eta"> • {eta}</span>
            ) : null}
          </h2>
          <p className="nx-sheet-copy">
            {tripData.driverName || "Driver"} is handling your ride.
          </p>
        </div>
        <div className="nx-price-badge">${money(tripData.agreedPrice)}</div>
      </div>

      {/* Driver card with OTP */}
      <ActionCard className="nx-driver-card">
        <div className="nx-offer-top">
          <div className="nx-driver-avatar">
            {tripData.driverPhotoUrl ? (
              <img src={tripData.driverPhotoUrl} alt="" />
            ) : (
              "🚘"
            )}
          </div>
          <div className="nx-offer-mid">
            <h3 className="nx-card-title">
              {tripData.driverName || "NEXRIDE Driver"}
              {tripData.driverRating ? (
                <span className="nx-offer-rating">
                  ★ {Number(tripData.driverRating).toFixed(1)}
                </span>
              ) : null}
            </h3>
            <p className="nx-sheet-copy">
              {tripData.carName || "Verified car"}
              {tripData.plateNumber ? ` • ${tripData.plateNumber}` : ""}
            </p>
          </div>
          <div
            className={`nx-status-pill ${
              isCancelled ? "nx-status-cancelled" : ""
            }`}
          >
            {statusLabel(tripStatus)}
          </div>
        </div>

        {/* OTP — only show when relevant */}
        {!isCancelled && tripStatus !== "completed" && tripData.otp ? (
          <button
            type="button"
            className="nx-otp-box nx-otp-box-btn"
            onClick={copyOtp}
            aria-label="Copy OTP"
          >
            <span>Pickup OTP</span>
            <strong>{tripData.otp}</strong>
            <small>
              {otpCopied
                ? "✓ Copied to clipboard"
                : "Tap to copy • give to driver when you enter"}
            </small>
          </button>
        ) : null}
      </ActionCard>

      {/* Timeline (hide on cancelled) */}
      {!isCancelled ? (
        <ActionCard className="nx-trip-timeline">
          {STEPS.map((step, index) => {
            const isDone = index < activeIndex;
            const isActive = index === activeIndex;
            return (
              <div
                key={step}
                className={`nx-trip-step ${isDone ? "done" : ""} ${
                  isActive ? "active" : ""
                }`}
              >
                <span />
                <div>{statusLabel(step)}</div>
              </div>
            );
          })}
        </ActionCard>
      ) : (
        <ActionCard className="nx-alert-error">
          Trip was cancelled. You can request a new ride below.
        </ActionCard>
      )}

      {/* Route summary */}
      <ActionCard className="nx-route-mini">
        <div className="nx-route-mini-row">
          <span className="nx-dot nx-dot-pickup" />
          {tripData.pickupName || "Pickup"}
        </div>
        <div className="nx-route-mini-row">
          <span className="nx-dot nx-dot-destination" />
          {tripData.dropoffName || "Destination"}
        </div>
        <div className="nx-map-metrics nx-request-metrics">
          <span>
            {liveRouteInfo?.distanceText || tripData.distanceText || "—"}
          </span>
          <span>
            {liveRouteInfo?.durationText || tripData.durationText || "—"}
          </span>
          <span>{navigatingToPickup ? "Driver to pickup" : "To destination"}</span>
        </div>
        <div className="nx-soft-text">
          Payment: {(tripData.preferredPayment || "cash").toUpperCase()} • Ride:{" "}
          {tripData.rideMode || "standard"}
        </div>
      </ActionCard>

      {/* Voice toggle — compact */}
      <ActionCard className="nx-voice-card compact">
        <div className="nx-voice-copy">
          <div className="nx-eyebrow">Voice guidance</div>
          <p className="nx-soft-text">
            Speaks on accept, arrival, pickup, and completion.
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

      {/* Actions */}
      {!isCancelled ? (
        <>
          <div className="nx-button-grid two">
            <PremiumButton
              variant="secondary"
              onClick={onContactDriver}
              disabled={!driverPhoneOk}
            >
              {driverPhoneOk ? "Call driver" : "No phone yet"}
            </PremiumButton>
            <a
              className="nx-btn nx-btn-primary"
              href={`/trip/${tripData.tripId || tripData.id}/navigate`}
            >
              NEXRIDE nav
            </a>
          </div>

          <a
            className="nx-btn nx-btn-secondary"
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
          </a>

          {confirmCancel ? (
            <div className="nx-confirm-row">
              <div className="nx-confirm-copy">
                Cancel this trip? Your driver will be notified.
              </div>
              <div className="nx-button-grid two">
                <PremiumButton
                  variant="ghost"
                  onClick={() => setConfirmCancel(false)}
                >
                  Keep trip
                </PremiumButton>
                <PremiumButton
                  variant="danger"
                  onClick={() => {
                    setConfirmCancel(false);
                    onCancelTrip?.();
                  }}
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
        </>
      ) : (
        <PremiumButton onClick={onCancelTrip && (() => onCancelTrip())}>
          Request a new ride
        </PremiumButton>
      )}
    </div>
  );
}
