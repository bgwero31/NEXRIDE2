// File: src/components/rider/OffersSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function statusPill(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.35,
    border: "1px solid transparent",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  if (status === "pending") {
    return {
      ...base,
      color: "#6d28d9",
      background: "rgba(124,58,237,0.10)",
      border: "1px solid rgba(124,58,237,0.12)",
    };
  }

  if (status === "accepted") {
    return {
      ...base,
      color: "#0f7a4e",
      background: "rgba(31,214,122,0.10)",
      border: "1px solid rgba(31,214,122,0.16)",
    };
  }

  return {
    ...base,
    color: "#5f557c",
    background: "rgba(255,255,255,0.58)",
    border: "1px solid rgba(124,58,237,0.08)",
  };
}

export default function OffersSheet({
  requestData,
  offers = [],
  acceptingOfferId = "",
  onAcceptOffer,
  onCancelRequest,
}) {
  if (!requestData) return null;

  const sortedOffers = [...offers].sort((a, b) => {
    const priceA = Number(a?.proposedPrice || 0);
    const priceB = Number(b?.proposedPrice || 0);
    if (priceA !== priceB) return priceA - priceB;
    return (a?.createdAt || 0) - (b?.createdAt || 0);
  });

  const bestOffer = sortedOffers[0] || null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ActionCard
        style={{
          padding: 12,
          borderRadius: 22,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.60), rgba(247,241,255,0.88))",
          border: "1px solid rgba(124,58,237,0.10)",
          boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
          backdropFilter: "blur(16px)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -28,
            right: -18,
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "rgba(168,85,247,0.10)",
            filter: "blur(16px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: -18,
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "rgba(124,58,237,0.08)",
            filter: "blur(16px)",
          }}
        />

        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 1000,
                  letterSpacing: "-0.03em",
                  color: "#23153d",
                  lineHeight: 1.1,
                }}
              >
                Driver offers
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#615682",
                  marginTop: 5,
                  lineHeight: 1.4,
                }}
              >
                Pick the best driver for your trip.
              </div>
            </div>

            <div
              style={{
                minWidth: 74,
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(124,58,237,0.10)",
                border: "1px solid rgba(124,58,237,0.12)",
                color: "#6d28d9",
                fontSize: 10,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {sortedOffers.length} offer{sortedOffers.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div
              style={{
                borderRadius: 16,
                padding: 10,
                background: "rgba(255,255,255,0.58)",
                border: "1px solid rgba(124,58,237,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#7c3aed",
                  fontWeight: 800,
                }}
              >
                Your fare
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 1000,
                  marginTop: 3,
                  color: "#23153d",
                }}
              >
                ${formatMoney(requestData.offerPrice)}
              </div>
            </div>

            <div
              style={{
                borderRadius: 16,
                padding: 10,
                background: "rgba(255,255,255,0.58)",
                border: "1px solid rgba(124,58,237,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#7c3aed",
                  fontWeight: 800,
                }}
              >
                Best offer
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 1000,
                  marginTop: 3,
                  color: "#23153d",
                }}
              >
                {bestOffer ? `$${formatMoney(bestOffer.proposedPrice)}` : "--"}
              </div>
            </div>
          </div>
        </div>
      </ActionCard>

      <ActionCard
        style={{
          padding: 12,
          borderRadius: 20,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.86))",
          border: "1px solid rgba(124,58,237,0.10)",
          boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "14px 1fr",
            gap: 10,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 2,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#7c3aed",
                boxShadow: "0 0 10px rgba(124,58,237,0.34)",
              }}
            />
            <div
              style={{
                width: 2,
                flex: 1,
                minHeight: 28,
                background:
                  "linear-gradient(180deg, rgba(124,58,237,0.32), rgba(124,58,237,0.10))",
                margin: "6px 0",
              }}
            />
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#a855f7",
                boxShadow: "0 0 10px rgba(168,85,247,0.34)",
              }}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "#7c3aed",
                  fontWeight: 900,
                  marginBottom: 4,
                }}
              >
                Pickup
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  lineHeight: 1.3,
                  color: "#23153d",
                }}
              >
                {requestData.pickupName || "Pickup location"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "#7c3aed",
                  fontWeight: 900,
                  marginBottom: 4,
                }}
              >
                Destination
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  lineHeight: 1.3,
                  color: "#23153d",
                }}
              >
                {requestData.dropoffName || "Destination"}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "7px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.08)",
              color: "#5b21b6",
            }}
          >
            {Number(requestData.people || 1)} passenger
            {Number(requestData.people || 1) > 1 ? "s" : ""}
          </div>

          <div
            style={{
              padding: "7px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.08)",
              color: "#5b21b6",
            }}
          >
            {cityLabel(requestData.city)}
          </div>
        </div>
      </ActionCard>

      <div style={{ display: "grid", gap: 8 }}>
        {sortedOffers.map((offer, index) => {
          const isBest = bestOffer?.id === offer.id;
          const isAccepting = acceptingOfferId === offer.id;

          return (
            <ActionCard
              key={offer.id}
              style={{
                padding: 12,
                borderRadius: 20,
                background: isBest
                  ? "linear-gradient(180deg, rgba(248,243,255,0.92), rgba(241,232,255,0.96))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.84))",
                border: isBest
                  ? "1px solid rgba(124,58,237,0.16)"
                  : "1px solid rgba(124,58,237,0.10)",
                boxShadow: isBest
                  ? "0 12px 26px rgba(124,58,237,0.12)"
                  : "0 10px 24px rgba(41,19,78,0.10)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 10,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: isBest
                      ? "linear-gradient(135deg,#8b5cf6,#6d28d9)"
                      : "linear-gradient(135deg,#c4b5fd,#8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 1000,
                    color: "#fff",
                    boxShadow: isBest
                      ? "0 10px 20px rgba(124,58,237,0.18)"
                      : "none",
                  }}
                >
                  {(offer.driverName || "D").charAt(0).toUpperCase()}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 1000,
                        color: "#23153d",
                        lineHeight: 1.15,
                      }}
                    >
                      {offer.driverName || "Driver"}
                    </div>

                    {isBest ? (
                      <div
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: 0.35,
                          color: "#6d28d9",
                          background: "rgba(124,58,237,0.10)",
                          border: "1px solid rgba(124,58,237,0.12)",
                        }}
                      >
                        Best
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "#74698f",
                      marginTop: 3,
                    }}
                  >
                    Driver {index + 1}
                  </div>

                  {offer.message ? (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.60)",
                        border: "1px solid rgba(124,58,237,0.08)",
                        color: "#51466f",
                        fontSize: 12,
                        lineHeight: 1.45,
                      }}
                    >
                      {offer.message}
                    </div>
                  ) : null}
                </div>

                <div style={{ textAlign: "right", minWidth: 82 }}>
                  <div style={statusPill(offer.status || "pending")}>
                    {offer.status || "pending"}
                  </div>

                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 1000,
                      marginTop: 8,
                      color: "#23153d",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    ${formatMoney(offer.proposedPrice)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  marginTop: 10,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#655b81",
                    lineHeight: 1.45,
                  }}
                >
                  Accept to start the live trip and receive your OTP.
                </div>

                <button
                  type="button"
                  onClick={() => onAcceptOffer?.(offer)}
                  disabled={!!acceptingOfferId || offer.status === "closed"}
                  style={{
                    minWidth: 102,
                    border: "none",
                    borderRadius: 16,
                    padding: "11px 14px",
                    fontSize: 13,
                    fontWeight: 1000,
                    color: "#fff",
                    background: "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
                    boxShadow: "0 10px 22px rgba(124,58,237,0.18)",
                  }}
                >
                  {isAccepting ? "Accepting..." : "Accept"}
                </button>
              </div>
            </ActionCard>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCancelRequest}
        style={{
          width: "100%",
          border: "1px solid rgba(124,58,237,0.10)",
          borderRadius: 18,
          padding: "14px 16px",
          fontSize: 13,
          fontWeight: 1000,
          color: "#5b21b6",
          background: "rgba(255,255,255,0.58)",
          boxShadow: "0 10px 24px rgba(41,19,78,0.10)",
        }}
      >
        Cancel request
      </button>
    </div>
  );
            }
