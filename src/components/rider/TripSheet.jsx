// File: src/components/rider/TripSheet.jsx

"use client";

function safeTime(ts) {
  if (!ts) return "Waiting...";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "Waiting...";
  }
}

export default function TripSheet({
  tripData,
  onCancelTrip,
  onContactDriver,
}) {
  if (!tripData) return null;

  const live = tripData.driverLive || {};
  const showCancel =
    tripData.status === "accepted" || tripData.status === "arrived";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          borderRadius: 22,
          padding: 10,
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
            gridTemplateColumns: "50px 1fr auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 1000,
              color: "#fff",
            }}
          >
            {(tripData.driverName || "D").charAt(0).toUpperCase()}
          </div>

          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 1000,
                color: "#1f1635",
              }}
            >
              {tripData.driverName || "Driver"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#4c3d73",
                marginTop: 2,
              }}
            >
              {tripData.driverPhone || "Phone not available"}
            </div>
          </div>

          <button
            type="button"
            onClick={onContactDriver}
            style={{
              border: "1px solid rgba(124,58,237,0.12)",
              background: "rgba(124,58,237,0.08)",
              color: "#5b21b6",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            Call
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 22,
          padding: 12,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.86))",
          border: "1px solid rgba(124,58,237,0.10)",
          boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 1000,
            color: "#1f1635",
            marginBottom: 8,
          }}
        >
          Your OTP
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 140,
            padding: "14px 18px",
            borderRadius: 18,
            background: "rgba(124,58,237,0.10)",
            border: "1px solid rgba(124,58,237,0.14)",
            fontSize: 24,
            fontWeight: 1000,
            letterSpacing: 4,
            color: "#3b1b77",
          }}
        >
          {tripData.otp || "------"}
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#5f5581",
            marginTop: 8,
          }}
        >
          Show this code to the driver when pickup starts.
        </div>
      </div>

      <div
        style={{
          borderRadius: 22,
          padding: 12,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(247,241,255,0.86))",
          border: "1px solid rgba(124,58,237,0.10)",
          boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 1000,
            color: "#1f1635",
            marginBottom: 8,
          }}
        >
          Live trip data
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {[
            ["Latitude", live.lat ?? "Waiting..."],
            ["Longitude", live.lng ?? "Waiting..."],
            ["Heading", live.heading ?? "Waiting..."],
            ["Updated", safeTime(live.updatedAt)],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: 10,
                borderRadius: 16,
                background: "rgba(255,255,255,0.50)",
                border: "1px solid rgba(124,58,237,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#7c3aed",
                  fontWeight: 800,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#1f1635",
                  fontWeight: 900,
                  marginTop: 4,
                }}
              >
                {String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCancel ? (
        <button
          type="button"
          onClick={onCancelTrip}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 18,
            padding: "14px",
            fontSize: 14,
            fontWeight: 1000,
            color: "#fff",
            background: "linear-gradient(90deg,#7c3aed,#8b5cf6,#a855f7)",
            boxShadow: "0 12px 28px rgba(124,58,237,0.18)",
          }}
        >
          Cancel trip
        </button>
      ) : null}
    </div>
  );
            }
