// File: src/components/rider/CompletedSheet.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ref, update } from "firebase/database";
import { db } from "../../lib/firebase";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";
import { speakNexrideStage } from "../../lib/nexrideVoice";

/* ------------------------------ Helpers ------------------------------- */

function money(value) {
  return Number(value || 0).toFixed(2);
}

function nice(text, fallback = "—") {
  return text && String(text).trim() ? text : fallback;
}

const TIP_OPTIONS = [0, 0.5, 1, 2];

/* ---------------------------- Component ------------------------------- */

export default function CompletedSheet({
  completedTrip,
  onRequestAgain,
  onRateDriver, // optional — async (stars, tipAmount) => void
}) {
  const spokenRef = useRef("");
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [tip, setTip] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const tripId = completedTrip?.tripId || completedTrip?.id;
  const driverName = completedTrip?.driverName || "your driver";

  /* -------- Speak once on completion (contextual) -------- */
  useEffect(() => {
    if (!completedTrip) return;
    const key = tripId || "completed";
    if (spokenRef.current === key) return;
    spokenRef.current = key;
    speakNexrideStage("completed", "rider", completedTrip, { force: true });
  }, [completedTrip, tripId]);

  /* -------------------- Derived -------------------- */
  const fare = Number(completedTrip?.agreedPrice || 0);
  const total = useMemo(
    () => Math.round((fare + tip) * 100) / 100,
    [fare, tip]
  );

  const paymentMethod = (
    completedTrip?.preferredPayment || "cash"
  ).toUpperCase();

  /* -------------------- Rating submit -------------------- */
  const submitRating = async () => {
    if (!stars) {
      setError("Tap a star first.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      // Prefer parent handler if provided
      if (typeof onRateDriver === "function") {
        await onRateDriver(stars, tip);
      } else if (tripId) {
        // Fallback: write directly to Firebase
        await update(ref(db, `completedTrips/${tripId}`), {
          riderRating: stars,
          riderTip: tip,
          ratedAt: Date.now(),
        });
      }
      setSubmitted(true);
    } catch (err) {
      console.error("[CompletedSheet] rating failed:", err);
      setError("Could not save rating. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const skipRating = () => {
    setSubmitted(true);
  };

  if (!completedTrip) return null;

  /* ---------------------------- Render ---------------------------- */
  return (
    <div className="nx-stack">
      {/* Hero: animated success + fare */}
      <ActionCard className="nx-complete-card nx-final-summary-card">
        <div className="nx-complete-icon nx-complete-icon-animated">✓</div>
        <div className="nx-eyebrow">Trip completed</div>
        <h2 className="nx-sheet-title">You arrived</h2>
        <p className="nx-sheet-copy">
          Thanks for riding with {driverName}. Fare paid:{" "}
          <strong>${money(fare)}</strong>
        </p>
      </ActionCard>

      {/* Receipt breakdown */}
      <ActionCard className="nx-receipt-card">
        <div className="nx-receipt-row">
          <span>Trip fare</span>
          <strong>${money(fare)}</strong>
        </div>
        {tip > 0 ? (
          <div className="nx-receipt-row">
            <span>Tip for {driverName}</span>
            <strong>${money(tip)}</strong>
          </div>
        ) : null}
        <div className="nx-receipt-divider" />
        <div className="nx-receipt-row nx-receipt-total">
          <span>Total</span>
          <strong>${money(total)}</strong>
        </div>
        <div className="nx-receipt-meta">
          <span>Paid via {paymentMethod}</span>
          {completedTrip.distanceText ? (
            <span>• {completedTrip.distanceText}</span>
          ) : null}
          {completedTrip.durationText ? (
            <span>• {completedTrip.durationText}</span>
          ) : null}
        </div>
      </ActionCard>

      {/* Route recap */}
      <ActionCard className="nx-route-mini nx-final-route-card">
        <div className="nx-route-mini-row">
          <span className="nx-dot nx-dot-pickup" />
          {nice(completedTrip.pickupName, "Pickup")}
        </div>
        <div className="nx-route-mini-row">
          <span className="nx-dot nx-dot-destination" />
          {nice(completedTrip.dropoffName, "Destination")}
        </div>
      </ActionCard>

      {/* Rating flow */}
      {!submitted ? (
        <ActionCard className="nx-rating-card">
          <div className="nx-rating-head">
            <div>
              <div className="nx-eyebrow">Rate your driver</div>
              <h3 className="nx-card-title">
                How was {driverName}?
              </h3>
            </div>
          </div>

          {/* Stars */}
          <div
            className="nx-stars"
            onMouseLeave={() => setHoverStars(0)}
            role="radiogroup"
            aria-label="Rate your driver"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hoverStars || stars) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  className={`nx-star ${active ? "is-active" : ""}`}
                  onMouseEnter={() => setHoverStars(n)}
                  onFocus={() => setHoverStars(n)}
                  onBlur={() => setHoverStars(0)}
                  onClick={() => setStars(n)}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  aria-checked={stars === n}
                  role="radio"
                >
                  ★
                </button>
              );
            })}
          </div>

          {/* Tip row */}
          <div className="nx-tip-row">
            <div className="nx-tip-label">Add a tip?</div>
            <div className="nx-tip-buttons">
              {TIP_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`nx-tip-btn ${tip === t ? "is-active" : ""}`}
                  onClick={() => setTip(t)}
                >
                  {t === 0 ? "No tip" : `$${t.toFixed(2)}`}
                </button>
              ))}
            </div>
          </div>

          {error ? <div className="nx-alert-error">{error}</div> : null}

          <div className="nx-button-grid two">
            <PremiumButton variant="ghost" onClick={skipRating}>
              Skip
            </PremiumButton>
            <PremiumButton
              onClick={submitRating}
              disabled={!stars}
              loading={submitting}
            >
              Submit
            </PremiumButton>
          </div>
        </ActionCard>
      ) : (
        <ActionCard className="nx-alert-success">
          {stars
            ? `Thanks! You rated ${driverName} ${stars}★${
                tip > 0 ? ` and tipped $${money(tip)}.` : "."
              }`
            : "Thanks for riding with NEXRIDE."}
        </ActionCard>
      )}

      {/* CTA — request another */}
      <PremiumButton onClick={onRequestAgain}>
        Request another ride
      </PremiumButton>

      {/* Secondary actions */}
      <div className="nx-button-grid two">
        <a
          className="nx-btn nx-btn-secondary"
          href={`https://wa.me/?text=${encodeURIComponent(
            `I just rode with NEXRIDE. Trip: ${
              completedTrip.pickupName || "pickup"
            } → ${completedTrip.dropoffName || "destination"}. Fare: $${money(
              total
            )}.`
          )}`}
          target="_blank"
          rel="noreferrer"
        >
          Share trip
        </a>
        <a
          className="nx-btn nx-btn-ghost"
          href="mailto:support@nexride.app?subject=Trip%20issue"
        >
          Report issue
        </a>
      </div>
    </div>
  );
}
