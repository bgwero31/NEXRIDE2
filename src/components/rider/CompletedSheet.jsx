// File: src/components/rider/CompletedSheet.jsx

"use client";

import { useEffect, useRef } from "react";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";
import { speakNexrideStage } from "../../lib/nexrideVoice";

function money(value) {
  return Number(value || 0).toFixed(2);
}

export default function CompletedSheet({ completedTrip, onRequestAgain }) {
  const spokenRef = useRef("");

  useEffect(() => {
    if (!completedTrip) return;
    const key = completedTrip.tripId || completedTrip.id || "completed";
    if (spokenRef.current === key) return;
    spokenRef.current = key;
    speakNexrideStage("completed", "rider", completedTrip, { force: true });
  }, [completedTrip]);

  if (!completedTrip) return null;

  return (
    <div className="nx-stack">
      <ActionCard className="nx-complete-card nx-final-summary-card">
        <div className="nx-complete-icon">✓</div>
        <div className="nx-eyebrow">Final route summary</div>
        <h2 className="nx-sheet-title">Trip completed</h2>
        <p className="nx-sheet-copy">
          Your NEXRIDE trip is done. Fare paid: ${money(completedTrip.agreedPrice)}.
        </p>
      </ActionCard>

      <ActionCard className="nx-route-mini nx-final-route-card">
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-pickup" />{completedTrip.pickupName || "Pickup"}</div>
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-destination" />{completedTrip.dropoffName || "Destination"}</div>
        <div className="nx-map-metrics nx-request-metrics">
          <span>{completedTrip.distanceText || "Distance saved"}</span>
          <span>{completedTrip.durationText || "Time saved"}</span>
          <span>{completedTrip.driverName || "Driver"}</span>
        </div>
      </ActionCard>

      <PremiumButton onClick={onRequestAgain}>Request another ride</PremiumButton>
    </div>
  );
}
