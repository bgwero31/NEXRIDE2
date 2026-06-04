// File: src/components/rider/WaitingSheet.jsx

"use client";

import { useEffect, useState } from "react";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function elapsed(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}m ${String(sec).padStart(2, "0")}s`;
}

export default function WaitingSheet({ requestData, driversNearby = 0, viewCount = 0, offersCount = 0, onCancel, onOpenOffers }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!requestData) return null;

  return (
    <div className="nx-stack">
      <ActionCard className="nx-live-card">
        <div className="nx-live-radar">
          <span className="nx-radar-ring one" />
          <span className="nx-radar-ring two" />
          <span className="nx-radar-ring three" />
          <span className="nx-radar-core">🚘</span>
        </div>
        <div className="nx-live-copy">
          <div className="nx-eyebrow">Request is live</div>
          <h2 className="nx-sheet-title">Waiting for drivers</h2>
          <p className="nx-sheet-copy">Drivers around {requestData.city} can view and negotiate your ride.</p>
        </div>
      </ActionCard>

      <div className="nx-stat-row">
        <div className="nx-stat-card">
          <span>Views</span>
          <strong>{viewCount}</strong>
          <small>{viewCount === 1 ? "driver viewed" : "drivers viewed"}</small>
        </div>
        <div className="nx-stat-card">
          <span>Offers</span>
          <strong>{offersCount}</strong>
          <small>counter prices</small>
        </div>
        <div className="nx-stat-card">
          <span>Fare</span>
          <strong>${money(requestData.offerPrice)}</strong>
          <small>{elapsed(seconds)}</small>
        </div>
      </div>

      <ActionCard className="nx-route-mini">
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-pickup" />{requestData.pickupName || "Pickup"}</div>
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-destination" />{requestData.dropoffName || "Destination"}</div>
        <div className="nx-soft-text">{driversNearby} nearby online driver{driversNearby === 1 ? "" : "s"}</div>
      </ActionCard>

      <div className="nx-button-grid two">
        <PremiumButton variant="secondary" onClick={onCancel}>Cancel request</PremiumButton>
        <PremiumButton onClick={onOpenOffers}>{offersCount > 0 ? "View offers" : "Refresh offers"}</PremiumButton>
      </div>
    </div>
  );
}
