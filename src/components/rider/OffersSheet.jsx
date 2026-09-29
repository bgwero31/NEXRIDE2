// File: src/components/rider/OffersSheet.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

/* ------------------------------ Helpers ------------------------------- */

function money(value) {
  return Number(value || 0).toFixed(2);
}

function deltaLabel(offerPrice, askPrice) {
  const offer = Number(offerPrice || 0);
  const ask = Number(askPrice || 0);
  if (!offer || !ask) return null;
  const diff = Math.round((offer - ask) * 100) / 100;
  if (Math.abs(diff) < 0.01) return { kind: "same", text: "Matches your price" };
  if (diff > 0)
    return { kind: "cheaper", text: `Saves you $${money(diff)}` };
  return { kind: "higher", text: `$${money(-diff)} above your price` };
}

function etaLabel(offer) {
  // Driver can provide etaMinutes or distanceMeters
  const etaMin = Number(offer.etaMinutes || 0);
  if (etaMin > 0) return `${Math.round(etaMin)} min away`;
  const meters = Number(offer.distanceMeters || 0);
  if (meters > 0) {
    const min = Math.max(1, Math.round((meters / 1000 / 30) * 60));
    return `~${min} min away`;
  }
  return null;
}

function rating(offer) {
  const r = Number(offer.driverRating || offer.rating || 0);
  if (!r) return null;
  return r.toFixed(1);
}

/**
 * Scoring: lower is better. Combines price, rating, ETA.
 * Weights are tunable — this is the inDrive "smart sort".
 */
function scoreOffer(offer, riderAsk) {
  const price = Number(offer.proposedPrice || riderAsk || 0);
  const ratingVal = Number(offer.driverRating || offer.rating || 4.5);
  const etaMin = Number(offer.etaMinutes || 0);
  const meters = Number(offer.distanceMeters || 0);
  const etaEstimate = etaMin > 0 ? etaMin : meters > 0 ? (meters / 1000 / 30) * 60 : 10;

  // Weights (0..1 scale)
  const priceScore = price;                    // $ magnitude
  const ratingScore = (5 - ratingVal) * 2;     // 0..2 → lower is better
  const etaScore = etaEstimate * 0.15;         // 0..3ish

  return priceScore + ratingScore + etaScore;
}

function sortOffers(offers, riderAsk) {
  return [...offers].sort(
    (a, b) => scoreOffer(a, riderAsk) - scoreOffer(b, riderAsk)
  );
}

/** Pick a "best" offer + tag special offers. */
function tagOffers(offers, riderAsk) {
  if (!offers.length) return [];

  const lowest = Math.min(...offers.map((o) => Number(o.proposedPrice || Infinity)));
  const highestRating = Math.max(
    ...offers.map((o) => Number(o.driverRating || o.rating || 0))
  );

  return offers.map((offer, index) => {
    const tags = [];
    const price = Number(offer.proposedPrice || riderAsk || 0);
    const r = Number(offer.driverRating || offer.rating || 0);

    if (index === 0) tags.push({ kind: "best", label: "Best value" });
    if (price === lowest && offers.length > 1)
      tags.push({ kind: "cheap", label: "Lowest price" });
    if (r && r === highestRating && r >= 4.7 && offers.length > 1)
      tags.push({ kind: "top", label: "Top rated" });

    return { ...offer, _tags: tags };
  });
}

/* ---------------------------- Component ------------------------------- */

export default function OffersSheet({
  requestData,
  offers = [],
  viewCount = 0,
  onAcceptOffer,
  onCancelRequest,
  onBoostFare, // optional
}) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [pulseId, setPulseId] = useState(null);
  const lastOfferCountRef = useRef(offers.length);

  /* -------- Pulse new offers when count increases -------- */
  useEffect(() => {
    if (offers.length > lastOfferCountRef.current) {
      const newest = [...offers].sort(
        (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
      )[0];
      if (newest?.id) {
        setPulseId(newest.id);
        const t = setTimeout(() => setPulseId(null), 2200);
        return () => clearTimeout(t);
      }
    }
    lastOfferCountRef.current = offers.length;
  }, [offers]);

  /* ------------------------ Derived list ------------------------- */
  const riderAsk = Number(requestData?.offerPrice || 0);

  const sorted = useMemo(() => {
    const pending = offers.filter((o) => o.status !== "closed");
    return tagOffers(sortOffers(pending, riderAsk), riderAsk);
  }, [offers, riderAsk]);

  const cheapest = useMemo(
    () =>
      sorted.length
        ? Math.min(...sorted.map((o) => Number(o.proposedPrice || riderAsk)))
        : 0,
    [sorted, riderAsk]
  );

  const hasPhone = (offer) =>
    offer.driverPhone && String(offer.driverPhone).trim().length > 0;

  /* ---------------------------- Render ---------------------------- */
  return (
    <div className="nx-stack">
      <div className="nx-sheet-head">
        <div>
          <div className="nx-eyebrow">Choose your driver</div>
          <h2 className="nx-sheet-title">
            {sorted.length} driver offer{sorted.length === 1 ? "" : "s"}
          </h2>
          <p className="nx-sheet-copy">
            Your price was ${money(riderAsk)}. Compare drivers and pick the
            best one.
          </p>
        </div>
        <div className="nx-price-badge">{viewCount} views</div>
      </div>

      {/* Empty state with a boost path */}
      {sorted.length === 0 ? (
        <ActionCard className="nx-offers-empty">
          <h3 className="nx-card-title">No offers yet</h3>
          <p className="nx-sheet-copy">
            Drivers are viewing your request. Offers usually land within a
            minute.
          </p>
          {typeof onBoostFare === "function" ? (
            <div className="nx-boost-row" style={{ marginTop: 10 }}>
              {[0.5, 1, 2].map((bump) => (
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
          ) : null}
        </ActionCard>
      ) : null}

      {/* Offer cards */}
      {sorted.map((offer, index) => {
        const delta = deltaLabel(offer.proposedPrice, riderAsk);
        const eta = etaLabel(offer);
        const rate = rating(offer);
        const isPulsing = pulseId === offer.id;
        const isConfirming = confirmingId === offer.id;

        return (
          <ActionCard
            key={offer.id}
            className={`nx-offer-card ${isPulsing ? "is-new" : ""} ${
              index === 0 ? "is-best" : ""
            }`}
          >
            {/* Tags row */}
            {offer._tags?.length ? (
              <div className="nx-offer-tags">
                {offer._tags.map((tag) => (
                  <span
                    key={tag.kind}
                    className={`nx-offer-tag nx-offer-tag-${tag.kind}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="nx-offer-top">
              <div className="nx-driver-avatar">
                {offer.driverPhotoUrl ? (
                  <img src={offer.driverPhotoUrl} alt="" />
                ) : (
                  index + 1
                )}
              </div>

              <div className="nx-offer-mid">
                <h3 className="nx-card-title">
                  {offer.driverName || "NEXRIDE Driver"}
                  {rate ? (
                    <span className="nx-offer-rating">★ {rate}</span>
                  ) : null}
                </h3>
                <p className="nx-sheet-copy">
                  {offer.carName || "Verified driver"}
                  {offer.plateNumber ? ` • ${offer.plateNumber}` : ""}
                  {eta ? ` • ${eta}` : ""}
                </p>
              </div>

              <div className="nx-offer-price-col">
                <div className="nx-offer-price">
                  ${money(offer.proposedPrice || riderAsk)}
                </div>
                {delta ? (
                  <div className={`nx-offer-delta nx-offer-delta-${delta.kind}`}>
                    {delta.text}
                  </div>
                ) : null}
              </div>
            </div>

            {offer.message ? (
              <p className="nx-offer-message">"{offer.message}"</p>
            ) : null}

            {/* Confirm bar or actions */}
            {isConfirming ? (
              <div className="nx-confirm-row">
                <div className="nx-confirm-copy">
                  Lock in {offer.driverName || "this driver"} for $
                  {money(offer.proposedPrice || riderAsk)}?
                </div>
                <div className="nx-button-grid two">
                  <PremiumButton
                    variant="ghost"
                    onClick={() => setConfirmingId(null)}
                  >
                    Back
                  </PremiumButton>
                  <PremiumButton
                    onClick={() => {
                      setConfirmingId(null);
                      onAcceptOffer?.(offer);
                    }}
                  >
                    Confirm
                  </PremiumButton>
                </div>
              </div>
            ) : (
              <div className="nx-button-grid two">
                {hasPhone(offer) ? (
                  <a
                    className="nx-btn nx-btn-secondary"
                    href={`tel:${offer.driverPhone}`}
                  >
                    Call
                  </a>
                ) : (
                  <button
                    type="button"
                    className="nx-btn nx-btn-secondary"
                    disabled
                  >
                    No phone
                  </button>
                )}
                <PremiumButton onClick={() => setConfirmingId(offer.id)}>
                  Accept driver
                </PremiumButton>
              </div>
            )}
          </ActionCard>
        );
      })}

      {/* Bottom actions */}
      {sorted.length > 0 ? (
        <PremiumButton variant="ghost" onClick={onCancelRequest}>
          Cancel ride request
        </PremiumButton>
      ) : (
        <PremiumButton variant="ghost" onClick={onCancelRequest}>
          Cancel request
        </PremiumButton>
      )}
    </div>
  );
}
