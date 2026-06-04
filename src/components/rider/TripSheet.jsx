// File: src/components/rider/TripSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function statusLabel(status) {
  if (status === "accepted") return "Driver coming";
  if (status === "arrived") return "Driver arrived";
  if (status === "picked") return "Trip started";
  if (status === "enroute") return "On the way";
  if (status === "completed") return "Completed";
  return "Active trip";
}

export default function TripSheet({ tripData, onCancelTrip, onContactDriver }) {
  if (!tripData) return null;

  const steps = ["accepted", "arrived", "picked", "enroute", "completed"];
  const activeIndex = Math.max(0, steps.indexOf(tripData.status || "accepted"));

  return (
    <div className="nx-stack">
      <div className="nx-sheet-head">
        <div>
          <div className="nx-eyebrow">Uber-style trip tracking</div>
          <h2 className="nx-sheet-title">{statusLabel(tripData.status)}</h2>
          <p className="nx-sheet-copy">{tripData.driverName || "Driver"} is handling your ride.</p>
        </div>
        <div className="nx-price-badge">${money(tripData.agreedPrice)}</div>
      </div>

      <ActionCard className="nx-driver-card">
        <div className="nx-offer-top">
          <div className="nx-driver-avatar">🚘</div>
          <div>
            <h3 className="nx-card-title">{tripData.driverName || "NEXRIDE Driver"}</h3>
            <p className="nx-sheet-copy">{tripData.carName || "Verified car"}{tripData.plateNumber ? ` • ${tripData.plateNumber}` : ""}</p>
          </div>
          <div className="nx-status-pill">{tripData.status || "accepted"}</div>
        </div>
        <div className="nx-otp-box">
          <span>Pickup OTP</span>
          <strong>{tripData.otp || "------"}</strong>
          <small>Give this code to the driver when you enter the car.</small>
        </div>
      </ActionCard>

      <ActionCard className="nx-trip-timeline">
        {steps.map((step, index) => (
          <div key={step} className={`nx-trip-step ${index <= activeIndex ? "active" : ""}`}>
            <span />
            <div>{statusLabel(step)}</div>
          </div>
        ))}
      </ActionCard>

      <ActionCard className="nx-route-mini">
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-pickup" />{tripData.pickupName || "Pickup"}</div>
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-destination" />{tripData.dropoffName || "Destination"}</div>
        <div className="nx-soft-text">Payment: {(tripData.preferredPayment || "cash").toUpperCase()} • Ride: {tripData.rideMode || "standard"}</div>
      </ActionCard>

      <div className="nx-button-grid two">
        <PremiumButton variant="secondary" onClick={onContactDriver}>Call driver</PremiumButton>
        <PremiumButton variant="ghost" onClick={onCancelTrip}>Cancel trip</PremiumButton>
      </div>
    </div>
  );
}
