// File: src/components/rider/CompletedSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

export default function CompletedSheet({
  completedTrip,
  onRequestAgain,
}) {
  if (!completedTrip) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* HERO */}
      <ActionCard
        style={{
          padding: 14,
          borderRadius: 22,
          background:
            "linear-gradient(135deg, rgba(10,16,20,0.98) 0%, rgba(12,22,18,0.98) 55%, rgba(8,14,16,0.98) 100%)",
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
            background: "rgba(45,200,95,0.10)",
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
            background: "rgba(0,198,255,0.08)",
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
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  letterSpacing: "-0.03em",
                  color: "#fff",
                }}
              >
                Trip completed
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#a7c4b0",
                  marginTop: 5,
                  lineHeight: 1.45,
                }}
              >
                Your ride has ended successfully. Thanks for riding with NEXRIDE.
              </div>
            </div>

            <div
              style={{
                minWidth: 92,
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(45,200,95,0.12)",
                border: "1px solid rgba(45,200,95,0.22)",
                color: "#eaffdc",
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Completed
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
              <div style={{ fontSize: 12, color: "#8ea2ba" }}>Fare paid</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  marginTop: 4,
                  color: "#fff",
                }}
              >
                ${formatMoney(completedTrip.agreedPrice)}
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
              <div style={{ fontSize: 12, color: "#8ea2ba" }}>Driver</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 1000,
                  marginTop: 4,
                  color: "#fff",
                  lineHeight: 1.2,
                }}
              >
                {completedTrip.driverName || "Driver"}
              </div>
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ROUTE */}
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
                {completedTrip.pickupName || "Pickup location"}
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
                {completedTrip.dropoffName || "Destination"}
              </div>
            </div>
          </div>
        </div>
      </ActionCard>

      {/* DRIVER SUMMARY */}
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
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              background:
                "linear-gradient(135deg, rgba(45,200,95,1) 0%, rgba(0,198,255,1) 100%)",
              boxShadow: "0 14px 30px rgba(0,198,255,0.20)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 1000,
              color: "#fff",
            }}
          >
            {(completedTrip.driverName || "D").charAt(0).toUpperCase()}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 1000,
                color: "#fff",
              }}
            >
              {completedTrip.driverName || "Driver"}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#9fb3c8",
                marginTop: 4,
              }}
            >
              {completedTrip.driverPhone || "Phone not available"}
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ACTION */}
      <button
        type="button"
        onClick={onRequestAgain}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 20,
          padding: "15px 16px",
          fontSize: 15,
          fontWeight: 1000,
          color: "#001018",
          background: "linear-gradient(90deg,#00c6ff,#0066ff)",
          boxShadow: "0 14px 28px rgba(0,102,255,0.22)",
        }}
      >
        Request another ride
      </button>
    </div>
  );
}
