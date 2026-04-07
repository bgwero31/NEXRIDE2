// File: src/components/rider/WaitingSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

export default function WaitingSheet({
  requestData,
  onCancel,
  onOpenOffers,
  driversNearby = 0,
}) {
  if (!requestData) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* HERO STATUS */}
      <ActionCard
        style={{
          padding: 14,
          borderRadius: 22,
          background:
            "linear-gradient(135deg, rgba(10,12,22,0.98) 0%, rgba(14,18,32,0.98) 55%, rgba(10,12,22,0.98) 100%)",
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
            right: -10,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(0,198,255,0.09)",
            filter: "blur(10px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -35,
            left: -15,
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "rgba(0,102,255,0.10)",
            filter: "blur(12px)",
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
                  fontSize: 22,
                  fontWeight: 1000,
                  letterSpacing: "-0.03em",
                }}
              >
                Finding your ride
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#9fb3c8",
                  marginTop: 5,
                  lineHeight: 1.45,
                }}
              >
                Your request is live. Nearby drivers are reviewing your offer now.
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
                background: "rgba(0,198,255,0.10)",
                border: "1px solid rgba(0,198,255,0.20)",
                color: "#d9f6ff",
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Searching
            </div>
          </div>

          {/* animated bars */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                width: "100%",
                height: 8,
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "42%",
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg,#00c6ff,#0066ff)",
                  boxShadow: "0 0 16px rgba(0,198,255,0.45)",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 14,
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
              <div style={{ fontSize: 12, color: "#8ea2ba" }}>Nearby drivers</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  marginTop: 4,
                  color: "#fff",
                }}
              >
                {driversNearby}
              </div>
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ROUTE CARD */}
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

        {(requestData.people || requestData.notes) && (
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
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
                {requestData.city || "city"}
              </div>
            </div>

            {requestData.notes ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#b7c9d9",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {requestData.notes}
              </div>
            ) : null}
          </div>
        )}
      </ActionCard>

      {/* HINT CARD */}
      <ActionCard
        style={{
          padding: 14,
          borderRadius: 22,
          background:
            "linear-gradient(180deg, rgba(12,14,22,0.96), rgba(8,10,18,0.96))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            marginBottom: 6,
            color: "#fff",
          }}
        >
          Waiting for offers
        </div>

        <div
          style={{
            fontSize: 13,
            color: "#9fb3c8",
            lineHeight: 1.55,
          }}
        >
          We’ll show driver offers here as soon as they start responding. You
          can keep this screen open while we search.
        </div>

        {onOpenOffers ? (
          <button
            type="button"
            onClick={onOpenOffers}
            style={{
              marginTop: 14,
              width: "100%",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 18,
              padding: "14px",
              fontSize: 14,
              fontWeight: 900,
              color: "#fff",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            Refresh offers
          </button>
        ) : null}
      </ActionCard>

      {/* CANCEL BUTTON */}
      <button
        type="button"
        onClick={onCancel}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 20,
          padding: "15px 16px",
          fontSize: 15,
          fontWeight: 1000,
          color: "#fff",
          background: "linear-gradient(90deg,#ff5b5b,#ff7a45)",
          boxShadow: "0 14px 28px rgba(255,91,91,0.22)",
        }}
      >
        Cancel request
      </button>
    </div>
  );
}
