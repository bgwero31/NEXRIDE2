// File: src/components/rider/TripSheet.jsx

"use client";

import ActionCard from "../ui/ActionCard";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function tripStatusStyle(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };

  if (status === "accepted") {
    return {
      ...base,
      color: "#e9d5ff",
      background: "rgba(168,85,247,0.14)",
      border: "1px solid rgba(168,85,247,0.24)",
    };
  }

  if (status === "arrived") {
    return {
      ...base,
      color: "#fff7d6",
      background: "rgba(255,176,32,0.12)",
      border: "1px solid rgba(255,176,32,0.22)",
    };
  }

  if (status === "picked" || status === "enroute") {
    return {
      ...base,
      color: "#eaffdc",
      background: "rgba(45,200,95,0.12)",
      border: "1px solid rgba(45,200,95,0.22)",
    };
  }

  if (status === "completed") {
    return {
      ...base,
      color: "#e8f0ff",
      background: "rgba(110,140,255,0.12)",
      border: "1px solid rgba(110,140,255,0.22)",
    };
  }

  return {
    ...base,
    color: "#f5f7fa",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

function statusMessage(status) {
  if (status === "accepted") {
    return "Your driver accepted the trip and is heading to you.";
  }
  if (status === "arrived") {
    return "Your driver has arrived at the pickup point.";
  }
  if (status === "picked") {
    return "Trip started successfully. You're now on the ride.";
  }
  if (status === "enroute") {
    return "You are on the way to your destination.";
  }
  if (status === "completed") {
    return "Trip completed successfully.";
  }
  return "Waiting for live trip updates.";
}

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
  const showCancel = tripData.status === "accepted" || tripData.status === "arrived";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* HERO */}
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
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  letterSpacing: "-0.03em",
                  color: "#fff",
                }}
              >
                Active trip
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#a7a7c4",
                  marginTop: 5,
                  lineHeight: 1.45,
                }}
              >
                {statusMessage(tripData.status)}
              </div>
            </div>

            <div style={tripStatusStyle(tripData.status || "accepted")}>
              {tripData.status || "accepted"}
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
              <div style={{ fontSize: 12, color: "#8ea2ba" }}>Agreed fare</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  marginTop: 4,
                  color: "#fff",
                }}
              >
                ${formatMoney(tripData.agreedPrice)}
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
              <div style={{ fontSize: 12, color: "#8ea2ba" }}>Passengers</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  marginTop: 4,
                  color: "#fff",
                }}
              >
                {Number(tripData.people || 1)}
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
                {tripData.pickupName || "Pickup location"}
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
                {tripData.dropoffName || "Destination"}
              </div>
            </div>
          </div>
        </div>

        {tripData.notes ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#b7c9d9",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {tripData.notes}
          </div>
        ) : null}
      </ActionCard>

      {/* DRIVER CARD */}
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
            gridTemplateColumns: "auto 1fr auto",
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
                "linear-gradient(135deg, rgba(168,85,247,1) 0%, rgba(124,58,237,1) 55%, rgba(79,70,229,1) 100%)",
              boxShadow: "0 14px 30px rgba(124,58,237,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 1000,
              color: "#fff",
            }}
          >
            {(tripData.driverName || "D").charAt(0).toUpperCase()}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 1000,
                color: "#fff",
              }}
            >
              {tripData.driverName || "Driver"}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#9fb3c8",
                marginTop: 4,
              }}
            >
              {tripData.driverPhone || "Phone not available"}
            </div>
          </div>

          {onContactDriver ? (
            <button
              type="button"
              onClick={onContactDriver}
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 16,
                padding: "12px 14px",
                fontSize: 13,
                fontWeight: 900,
                color: "#fff",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              Call
            </button>
          ) : null}
        </div>
      </ActionCard>

      {/* OTP */}
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
            fontSize: 16,
            fontWeight: 1000,
            color: "#fff",
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
            minWidth: 150,
            padding: "15px 18px",
            borderRadius: 18,
            background: "rgba(168,85,247,0.10)",
            border: "1px solid rgba(168,85,247,0.18)",
            fontSize: 28,
            fontWeight: 1000,
            letterSpacing: 4,
            color: "#f3e8ff",
          }}
        >
          {tripData.otp || "------"}
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#9fb3c8",
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          Show this code to the driver when pickup starts.
        </div>
      </ActionCard>

      {/* LIVE DRIVER DATA */}
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
            fontSize: 16,
            fontWeight: 1000,
            color: "#fff",
            marginBottom: 10,
          }}
        >
          Live trip data
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: 12, color: "#8ea2ba" }}>Latitude</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
                marginTop: 5,
                wordBreak: "break-word",
              }}
            >
              {live.lat !== undefined && live.lat !== null ? live.lat : "Waiting..."}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: 12, color: "#8ea2ba" }}>Longitude</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
                marginTop: 5,
                wordBreak: "break-word",
              }}
            >
              {live.lng !== undefined && live.lng !== null ? live.lng : "Waiting..."}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: 12, color: "#8ea2ba" }}>Heading</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
                marginTop: 5,
              }}
            >
              {live.heading !== undefined && live.heading !== null
                ? live.heading
                : "Waiting..."}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: 12, color: "#8ea2ba" }}>Updated</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
                marginTop: 5,
              }}
            >
              {safeTime(live.updatedAt)}
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ACTIONS */}
      {showCancel ? (
        <button
          type="button"
          onClick={onCancelTrip}
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
          Cancel trip
        </button>
      ) : null}
    </div>
  );
}
