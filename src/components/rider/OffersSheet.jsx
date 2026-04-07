// File: src/components/rider/OffersSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function statusPill(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    border: "1px solid transparent",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  if (status === "pending") {
    return {
      ...base,
      color: "#e9d5ff",
      background: "rgba(168,85,247,0.14)",
      border: "1px solid rgba(168,85,247,0.24)",
    };
  }

  if (status === "accepted") {
    return {
      ...base,
      color: "#eaffdc",
      background: "rgba(45,200,95,0.12)",
      border: "1px solid rgba(45,200,95,0.22)",
    };
  }

  return {
    ...base,
    color: "#f5f7fa",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
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
    <div style={{ display: "grid", gap: 12 }}>
      {/* HEADER */}
      <ActionCard
        style={{
          padding: 14,
          borderRadius: 22,
          background:
            "linear-gradient(135deg, rgba(12,10,22,0.98) 0%, rgba(18,12,34,0.98) 58%, rgba(10,10,18,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -16,
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: "rgba(168,85,247,0.10)",
            filter: "blur(10px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -40,
            left: -20,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(99,102,241,0.10)",
            filter: "blur(12px)",
          }}
        />

        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  letterSpacing: "-0.03em",
                  color: "#fff",
                }}
              >
                Driver offers
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#a7a7c4",
                  marginTop: 5,
                  lineHeight: 1.45,
                }}
              >
                Choose the best driver offer for your trip.
              </div>
            </div>

            <div
              style={{
                minWidth: 88,
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.22)",
                color: "#e9d5ff",
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {sortedOffers.length} offer{sortedOffers.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div
            style={{
              marginTop: 15,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div
              style={{
                borderRadius: 18,
                padding: 12,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontSize: 12, color: "#8ea2ba" }}>Your fare</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  marginTop: 4,
                  color: "#fff",
                }}
              >
                ${formatMoney(requestData.offerPrice)}
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 12,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontSize: 12, color: "#8ea2ba" }}>Best offer</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  marginTop: 4,
                  color: "#fff",
                }}
              >
                {bestOffer ? `$${formatMoney(bestOffer.proposedPrice)}` : "--"}
              </div>
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ROUTE SUMMARY */}
      <ActionCard
        style={{
          padding: 14,
          borderRadius: 22,
          background:
            "linear-gradient(180deg, rgba(12,14,22,0.98), rgba(8,10,18,0.98))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              width: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 4,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#00c26f",
                boxShadow: "0 0 10px rgba(0,194,111,0.55)",
              }}
            />
            <div
              style={{
                width: 2,
                flex: 1,
                minHeight: 34,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.06))",
                margin: "7px 0",
              }}
            />
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#ff8a00",
                boxShadow: "0 0 10px rgba(255,138,0,0.55)",
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "#87a0bb",
                  fontWeight: 800,
                  marginBottom: 6,
                }}
              >
                Pickup
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  lineHeight: 1.3,
                  color: "#fff",
                }}
              >
                {requestData.pickupName || "Pickup location"}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "#87a0bb",
                  fontWeight: 800,
                  marginBottom: 6,
                }}
              >
                Dropoff
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  lineHeight: 1.3,
                  color: "#fff",
                }}
              >
                {requestData.dropoffName || "Destination"}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#d8e3f0",
            }}
          >
            {Number(requestData.people || 1)} passenger
            {Number(requestData.people || 1) > 1 ? "s" : ""}
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#d8e3f0",
            }}
          >
            {cityLabel(requestData.city)}
          </div>
        </div>
      </ActionCard>

      {/* OFFERS */}
      <div style={{ display: "grid", gap: 10 }}>
        {sortedOffers.map((offer, index) => {
          const isBest = bestOffer?.id === offer.id;
          const isAccepting = acceptingOfferId === offer.id;

          return (
            <ActionCard
              key={offer.id}
              style={{
                padding: 14,
                borderRadius: 22,
                background: isBest
                  ? "linear-gradient(180deg, rgba(20,14,34,0.98), rgba(10,10,18,0.98))"
                  : "linear-gradient(180deg, rgba(12,14,22,0.98), rgba(8,10,18,0.98))",
                border: isBest
                  ? "1px solid rgba(168,85,247,0.20)"
                  : "1px solid rgba(255,255,255,0.06)",
                boxShadow: isBest
                  ? "0 16px 30px rgba(124,58,237,0.14)"
                  : "0 10px 24px rgba(0,0,0,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 1000,
                        color: "#fff",
                      }}
                    >
                      {offer.driverName || "Driver"}
                    </div>

                    {isBest ? (
                      <div
                        style={{
                          padding: "5px 9px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: 0.45,
                          color: "#e9d5ff",
                          background: "rgba(168,85,247,0.12)",
                          border: "1px solid rgba(168,85,247,0.22)",
                        }}
                      >
                        Best offer
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: "#9fb3c8",
                      marginTop: 6,
                    }}
                  >
                    Driver {index + 1}
                  </div>

                  {offer.message ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#c5d3df",
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      {offer.message}
                    </div>
                  ) : null}
                </div>

                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div style={statusPill(offer.status || "pending")}>
                    {offer.status || "pending"}
                  </div>

                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 1000,
                      marginTop: 12,
                      color: "#fff",
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
                  gap: 10,
                  marginTop: 14,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#8fa5bc",
                    lineHeight: 1.5,
                  }}
                >
                  Accept this driver to create your live trip and receive your OTP.
                </div>

                <button
                  type="button"
                  onClick={() => onAcceptOffer?.(offer)}
                  disabled={!!acceptingOfferId || offer.status === "closed"}
                  style={{
                    minWidth: 126,
                    border: "none",
                    borderRadius: 18,
                    padding: "13px 16px",
                    fontSize: 14,
                    fontWeight: 1000,
                    color: "#fff",
                    background: isBest
                      ? "linear-gradient(90deg,#a855f7,#7c3aed,#4f46e5)"
                      : "linear-gradient(90deg,#00c6ff,#0066ff)",
                    boxShadow: isBest
                      ? "0 12px 26px rgba(124,58,237,0.24)"
                      : "0 12px 26px rgba(0,102,255,0.20)",
                  }}
                >
                  {isAccepting ? "Accepting..." : "Accept"}
                </button>
              </div>
            </ActionCard>
          );
        })}
      </div>

      {/* CANCEL */}
      <button
        type="button"
        onClick={onCancelRequest}
        style={{
          width: "100%",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 20,
          padding: "15px 16px",
          fontSize: 15,
          fontWeight: 1000,
          color: "#fff",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        Cancel request
      </button>
    </div>
  );
}
