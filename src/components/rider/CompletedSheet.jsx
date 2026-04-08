// File: src/components/rider/CompletedSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

export default function CompletedSheet({
  completedTrip,
  onRequestAgain,
}) {
  if (!completedTrip) return null;

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
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 1000,
                  letterSpacing: "-0.03em",
                  color: "#23153d",
                  lineHeight: 1.1,
                }}
              >
                Trip completed
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#615682",
                  marginTop: 5,
                  lineHeight: 1.4,
                }}
              >
                Your ride ended successfully. Thanks for riding with NEXRIDE.
              </div>
            </div>

            <div
              style={{
                minWidth: 84,
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
              Completed
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
                Fare paid
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 1000,
                  marginTop: 3,
                  color: "#23153d",
                }}
              >
                ${formatMoney(completedTrip.agreedPrice)}
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
                Driver
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 1000,
                  marginTop: 3,
                  color: "#23153d",
                  lineHeight: 1.2,
                }}
              >
                {completedTrip.driverName || "Driver"}
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
                {completedTrip.pickupName || "Pickup location"}
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
                {completedTrip.dropoffName || "Destination"}
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
            {cityLabel(completedTrip.city)}
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
            Paid ${formatMoney(completedTrip.agreedPrice)}
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
            gridTemplateColumns: "44px 1fr",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 1000,
              color: "#fff",
              boxShadow: "0 10px 20px rgba(124,58,237,0.18)",
            }}
          >
            {(completedTrip.driverName || "D").charAt(0).toUpperCase()}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 1000,
                color: "#23153d",
              }}
            >
              {completedTrip.driverName || "Driver"}
            </div>

            <div
              style={{
                fontSize: 11,
                color: "#74698f",
                marginTop: 3,
              }}
            >
              {completedTrip.driverPhone || "Phone not available"}
            </div>
          </div>
        </div>
      </ActionCard>

      <button
        type="button"
        onClick={onRequestAgain}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 18,
          padding: "14px 16px",
          fontSize: 14,
          fontWeight: 1000,
          color: "#fff",
          background: "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
          boxShadow: "0 12px 28px rgba(124,58,237,0.18)",
        }}
      >
        Request another ride
      </button>
    </div>
  );
            }
