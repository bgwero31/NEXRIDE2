// File: src/components/rider/WaitingSheet.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

/* ------------------------------ Helpers ------------------------------- */

function money(value) {
  return Number(value || 0).toFixed(2);
}

/** Human-friendly elapsed: "5s", "1m 20s", "1h 04m" */
function elapsed(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 5) return "Just now";
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${String(rem).padStart(2, "0")}s`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Contextual headline that reflects real state. */
function statusCopy({ viewCount, offersCount, driversNearby }) {
  if (offersCount > 0) {
    return {
      eyebrow: "Offers waiting",
      title: offersCount === 1 ? "1 driver sent an offer" : `${offersCount} drivers sent offers`,
      copy: "Open offers to compare prices and choose your driver.",
    };
  }
  if (viewCount > 0) {
    return {
      eyebrow: "Request is live",
      title: viewCount === 1 ? "1 driver viewed your ride" : `${viewCount} drivers viewed your ride`,
      copy: "Negotiations are happening. Sit tight — offers usually land within a minute.",
    };
  }
  if (driversNearby > 0) {
    return {
      eyebrow: "Request is live",
      title: `Waiting for drivers`,
      copy: `${driversNearby} driver${driversNearby === 1 ? " is" : "s are"} nearby. Your request is visible to them now.`,
    };
  }
  return {
    eyebrow: "Request is live",
    title: "Finding drivers nearby",
    copy: "Your request is posted. Drivers in your city can see and negotiate now.",
  };
}

const OVERFLOW_LIMIT = 5;

/* ---------------------------- Component ------------------------------- */

export default function WaitingSheet({
  requestData,
  driversNearby = 0,
  viewCount = 0,
  viewers = [],
  offersCount = 0,
  onCancel,
  onOpenOffers,
  onBoostFare, // optional — enables inDrive-style fare boost
}) {
  const [seconds, setSeconds] = useState(0);

  /* -------- Elapsed timer (only ticks while request is live) -------- */
  useEffect(() => {
    const start = Number(requestData?.createdAt) || Date.now();
    const tick = () => {
      setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [requestData?.createdAt]);

  /* --------------------------- Derived --------------------------- */
  const copy = useMemo(
    () => statusCopy({ viewCount, offersCount, driversNearby }),
    [viewCount, offersCount, driversNearby]
  );

  const visibleViewers = useMemo(
    () => viewers.slice(0, OVERFLOW_LIMIT),
    [viewers]
  );
  const overflowViewers = Math.max(0, viewers.length - OVERFLOW_LIMIT);

  const boostAmounts = useMemo(() => [0.5, 1, 2], []);
  const currentFare = Number(requestData?.offerPrice || 0);
  const canBoost = typeof onBoostFare === "function";

  if (!requestData) return null;

  /* ---------------------------- Render ---------------------------- */

  return (
    <div className="nx-stack">
      {/* Live radar + contextual status */}
      <ActionCard className="nx-live-card">
        <div className="nx-live-radar">
          <span className="nx-radar-ring" />
          <span className="nx-radar-ring two" />
          <span className="nx-radar-ring three" />
          <span className="nx-radar-core" aria-hidden="true">🚘</span>
        </div>
        <div className="nx-live-copy">
          <div className="nx-eyebrow">{copy.eyebrow}</div>
          <h2 className="nx-sheet-title">{copy.title}</h2>
          <p className="nx-sheet-copy">{copy.copy}</p>
        </div>
      </ActionCard>

      {/* Viewers strip — only when at least one driver has viewed */}
      {viewers.length ? (
        <ActionCard className="nx-viewers-card">
          <div>
            <div className="nx-eyebrow">Drivers viewing</div>
            <div className="nx-card-title">
              {viewCount} driver{viewCount === 1 ? "" : "s"} viewing your request
            </div>
          </div>
          <div className="nx-viewer-avatars">
            {visibleViewers.map((viewer, index) => (
              <div
                key={viewer.driverId || index}
                className="nx-view-avatar mini"
                title={viewer.driverName || "Driver"}
              >
                {viewer.driverPhotoUrl ? (
                  <img src={viewer.driverPhotoUrl} alt="" />
                ) : (
                  "🚘"
                )}
              </div>
            ))}
            {overflowViewers > 0 ? (
              <div className="nx-view-avatar mini nx-viewer-more">
                +{overflowViewers}
              </div>
            ) : null}
          </div>
        </ActionCard>
      ) : null}

      {/* Stat row: views / offers / fare+time */}
      <div className="nx-stat-row">
        <div className="nx-stat-card">
          <span>Views</span>
          <strong>{viewCount}</strong>
          <small>{viewCount === 1 ? "driver viewed" : "drivers viewed"}</small>
        </div>
        <div className="nx-stat-card">
          <span>Offers</span>
          <strong>{offersCount}</strong>
          <small>{offersCount === 1 ? "counter price" : "counter prices"}</small>
        </div>
        <div className="nx-stat-card">
          <span>Fare</span>
          <strong>${money(requestData.offerPrice)}</strong>
          <small>{elapsed(seconds)}</small>
        </div>
      </div>

      {/* Route summary */}
      <ActionCard className="nx-route-mini">
        <div className="nx-route-mini-row">
          <span className="nx-dot nx-dot-pickup" />
          {requestData.pickupName || "Pickup"}
        </div>
        <div className="nx-route-mini-row">
          <span className="nx-dot nx-dot-destination" />
          {requestData.dropoffName || "Destination"}
        </div>
        {driversNearby > 0 ? (
          <div className="nx-soft-text">
            {driversNearby} nearby online driver
            {driversNearby === 1 ? "" : "s"} in {requestData.city || "your city"}
          </div>
        ) : (
          <div className="nx-soft-text">
            No drivers online nearby yet — hang tight
          </div>
        )}
      </ActionCard>

      {/* Optional inDrive-style fare boost */}
      {canBoost && offersCount === 0 ? (
        <ActionCard className="nx-boost-card">
          <div className="nx-boost-head">
            <div>
              <div className="nx-eyebrow">Attract drivers faster</div>
              <div className="nx-card-title">
                Boost your fare from ${money(currentFare)}
              </div>
            </div>
          </div>
          <div className="nx-boost-row">
            {boostAmounts.map((bump) => (
              <button
                key={bump}
                type="button"
                className="nx-boost-btn"
                onClick={() => onBoostFare(bump)}
              >
                +${bump.toFixed(2)}
              </button>
            ))}
          </div>
        </ActionCard>
      ) : null}

      {/* Actions */}
      <div className="nx-button-grid two">
        <PremiumButton variant="ghost" onClick={onCancel}>
          Cancel request
        </PremiumButton>
        <PremiumButton onClick={onOpenOffers}>
          {offersCount > 0
            ? `View ${offersCount} offer${offersCount === 1 ? "" : "s"}`
            : "Refresh offers"}
        </PremiumButton>
      </div>
    </div>
  );
}
