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
    textTransform: "uppercase",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };

  if (status === "accepted") {
    return {
      ...base,
      color: "#6d28d9",
      background: "rgba(124,58,237,0.10)",
      border: "1px solid rgba(124,58,237,0.12)",
    };
  }

  if (status === "arrived") {
    return {
      ...base,
      color: "#a16207",
      background: "rgba(245,158,11,0.10)",
      border: "1px solid rgba(245,158,11,0.16)",
    };
  }

  if (status === "picked" || status === "enroute") {
    return {
      ...base,
      color: "#0f7a4e",
      background: "rgba(31,214,122,0.10)",
      border: "1px solid rgba(31,214,122,0.16)",
    };
  }

  if (status === "completed") {
    return {
      ...base,
      color: "#4338ca",
      background: "rgba(99,102,241,0.10)",
      border: "1px solid rgba(99,102,241,0.16)",
    };
  }

  return {
    ...base,
    color: "#5f557c",
    background: "rgba(255,255,255,0.58)",
    border: "1px solid rgba(124,58,237,0.08)",
  };
}

function statusText(status) {
  if (status === "accepted") return "Driver accepted and is heading to pickup.";
  if (status === "arrived") return "Driver has arrived at pickup.";
  if (status === "picked") return "OTP verified. Trip has started.";
  if (status === "enroute") return "You are on the way to your destination.";
  if (status === "completed") return "Trip completed successfully.";
  return "Waiting for live trip updates.";
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
          padding: 12,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.60), rgba(247,241,255,0.88))",
          border: "1px solid rgba(124,58,237,0.10)",
          boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
          backdropFilter: "blur(16px)",
        }}
      >
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
                color: "#23153d",
                lineHeight: 1.1,
              }}
            >
              Active trip
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#615682",
                marginTop: 4,
                lineHeight: 1.45,
              }}
            >
              {statusText(tripData.status)}
            </div>
          </div>

          <div style={statusPill(tripData.status || "accepted")}>
            {tripData.status || "accepted"}
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
            <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 800 }}>
              Fare
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 1000,
                marginTop: 3,
                color: "#23153d",
              }}
            >
              ${Number(tripData.agreedPrice || 0).toFixed(2)}
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
            <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 800 }}>
              Updated
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 1000,
                marginTop: 5,
                color: "#23153d",
              }}
            >
              {safeTime(tripData.updatedAt || live.updatedAt)}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: 20,
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
            color: "#23153d",
            marginBottom: 6,
          }}
        >
          {tripData.pickupName} → {tripData.dropoffName}
        </div>

        <div style={{ fontSize: 11, color: "#74698f" }}>
          Driver: {tripData.driverName || "Driver"}
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={onContactDriver}
            style={{
              width: "100%",
              border: "1px solid rgba(124,58,237,0.10)",
              borderRadius: 16,
              padding: "12px 14px",
              fontSize: 13,
              fontWeight: 1000,
              color: "#5b21b6",
              background: "rgba(255,255,255,0.58)",
            }}
          >
            Call driver
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 20,
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
            color: "#23153d",
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
