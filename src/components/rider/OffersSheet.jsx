// File: src/components/rider/OffersSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";
import PremiumButton from "../ui/PremiumButton";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function sortOffers(a, b) {
  const priceA = Number(a.proposedPrice || 0);
  const priceB = Number(b.proposedPrice || 0);
  if (priceA !== priceB) return priceA - priceB;
  return Number(b.createdAt || 0) - Number(a.createdAt || 0);
}

export default function OffersSheet({ requestData, offers = [], viewCount = 0, onAcceptOffer, onCancelRequest }) {
  const pending = offers.filter((item) => item.status !== "closed").sort(sortOffers);

  return (
    <div className="nx-stack">
      <div className="nx-sheet-head">
        <div>
          <div className="nx-eyebrow">Choose your driver</div>
          <h2 className="nx-sheet-title">{pending.length} driver offer{pending.length === 1 ? "" : "s"}</h2>
          <p className="nx-sheet-copy">Your price was ${money(requestData?.offerPrice)}. Pick the best driver or wait for more.</p>
        </div>
        <div className="nx-price-badge">{viewCount} views</div>
      </div>

      {pending.length === 0 ? (
        <ActionCard>
          <h3 className="nx-card-title">No offers yet</h3>
          <p className="nx-sheet-copy">Drivers have viewed your trip, but no one has sent an offer yet.</p>
        </ActionCard>
      ) : (
        pending.map((offer, index) => (
          <ActionCard key={offer.id} className="nx-offer-card">
            <div className="nx-offer-top">
              <div className="nx-driver-avatar">{offer.driverPhotoUrl ? <img src={offer.driverPhotoUrl} alt="" /> : index + 1}</div>
              <div>
                <h3 className="nx-card-title">{offer.driverName || "NEXRIDE Driver"}</h3>
                <p className="nx-sheet-copy">{offer.carName || "Verified driver"}{offer.plateNumber ? ` • ${offer.plateNumber}` : ""}</p>
              </div>
              <div className="nx-offer-price">${money(offer.proposedPrice || requestData?.offerPrice)}</div>
            </div>
            {offer.message ? <p className="nx-offer-message">“{offer.message}”</p> : null}
            <div className="nx-button-grid two">
              <a className="nx-btn nx-btn-secondary" href={offer.driverPhone ? `tel:${offer.driverPhone}` : "#"}>Call</a>
              <PremiumButton onClick={() => onAcceptOffer?.(offer)}>Accept driver</PremiumButton>
            </div>
          </ActionCard>
        ))
      )}

      <PremiumButton variant="ghost" onClick={onCancelRequest}>Cancel ride request</PremiumButton>
    </div>
  );
}
