// File: src/components/rider/CompletedSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

export default function CompletedSheet({ completedTrip, onRequestAgain }) {
  if (!completedTrip) return null;

  return (
    <div className="nx-stack">
      <ActionCard className="nx-complete-card">
        <div className="nx-complete-icon">✓</div>
        <h2 className="nx-sheet-title">Trip completed</h2>
        <p className="nx-sheet-copy">Your NEXRIDE trip is done. Fare paid: ${Number(completedTrip.agreedPrice || 0).toFixed(2)}.</p>
      </ActionCard>
      <PremiumButton onClick={onRequestAgain}>Request another ride</PremiumButton>
    </div>
  );
}
