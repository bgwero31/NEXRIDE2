// File: src/components/rider/WaitingSheet.jsx

"use client";

import { useEffect, useState } from "react";
import ActionCard from "../ui/ActionCard";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function cityLabel(city) {
  if (!city) return "City";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function RadarPulse() {
  const ring = (delay, size, opacity) => ({
    position: "absolute",
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1px solid rgba(139,92,246,${opacity})`,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    animation: `nxRadar 2.4s ease-out ${delay}s infinite`,
  });

  return (
    <>
      <style>{`
        @keyframes nxRadar {
          0% {
            transform: translate(-50%, -50%) scale(0.45);
            opacity: 0.95;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.25);
            opacity: 0;
          }
        }
        @keyframes nxSweep {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes nxDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
      `}</style>

      <div
        style={{
          position: "relative",
          width: 116,
          height: 116,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at center, rgba(168,85,247,0.18), rgba(124,58,237,0.05) 45%, rgba(124,58,237,0) 72%)",
          }}
        />

        <div style={ring(0, 44, 0.52)} />
        <div style={ring(0.5, 72, 0.34)} />
        <div style={ring(1, 100, 0.22)} />

        <div
          style={{
            position: "absolute",
            width: 88,
            height: 88,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "1px solid rgba(124,58,237,0.12)",
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.66), rgba(240,232,255,0.28))",
            backdropFilter: "blur(6px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 56,
            height: 2,
            top: "50%",
            left: "50%",
            transformOrigin: "0% 50%",
            background:
              "linear-gradient(90deg, rgba(168,85,247,0), rgba(168,85,247,0.92))",
            animation: "nxSweep 1.8s linear infinite",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: "50%",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
            boxShadow: "0 0 18px rgba(124,58,237,0.45)",
            animation: "nxDot 1.2s ease-in-out infinite",
          }}
        />
      </div>
    </>
  );
}

export default function WaitingSheet({
  requestData,
  onCancel,
  onOpenOffers,
  driversNearby = 0,
}) {
  const [searchSeconds, setSearchSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(id);
  }, []);

  if (!requestData) return null;

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
            top: -30,
            right: -20,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(168,85,247,0.10)",
            filter: "blur(16px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -35,
            left: -20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(124,58,237,0.08)",
            filter: "blur(16px)",
          }}
        />

        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "116px 1fr",
              gap: 12,
              alignItems: "center",
            }}
          >
            <RadarPulse />

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 1000,
                    color: "#23153d",
                    lineHeight: 1.1,
                  }}
                >
                  Searching for drivers
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(124,58,237,0.10)",
                    border: "1px solid rgba(124,58,237,0.12)",
                    color: "#6d28d9",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  Live
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#615682",
                  marginTop: 6,
                  lineHeight: 1.45,
                }}
              >
                Nearby drivers are checking your fare now.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 10,
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
                      color: "#23153d",
                      marginTop: 3,
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
                    Drivers nearby
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 1000,
                      color: "#23153d",
                      marginTop: 3,
                    }}
                  >
                    {driversNearby}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "#7a6f97",
                  fontWeight: 700,
                }}
              >
                Searching for {searchSeconds}s
              </div>
            </div>
          </div>
        </div>
      </ActionCard>

      <ActionCard
        style={{
          padding: 12,
          borderRadius: 22,
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

        {(requestData.people || requestData.notes) && (
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gap: 8,
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

            {requestData.notes ? (
              <div
                style={{
                  padding: 10,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.54)",
                  border: "1px solid rgba(124,58,237,0.08)",
                  color: "#51466f",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                {requestData.notes}
              </div>
            ) : null}
          </div>
        )}
      </ActionCard>

      <ActionCard
        style={{
          padding: 12,
          borderRadius: 20,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.56), rgba(247,241,255,0.82))",
          border: "1px solid rgba(124,58,237,0.10)",
          boxShadow: "0 10px 30px rgba(41,19,78,0.12)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 1000,
            marginBottom: 5,
            color: "#23153d",
          }}
        >
          Waiting for offers
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#615682",
            lineHeight: 1.45,
          }}
        >
          Keep this screen open while we search. Driver offers will appear here as
          soon as they respond.
        </div>

        {onOpenOffers ? (
          <button
            type="button"
            onClick={onOpenOffers}
            style={{
              marginTop: 10,
              width: "100%",
              border: "1px solid rgba(124,58,237,0.10)",
              borderRadius: 16,
              padding: "12px",
              fontSize: 13,
              fontWeight: 900,
              color: "#5b21b6",
              background: "rgba(124,58,237,0.08)",
            }}
          >
            Refresh offers
          </button>
        ) : null}
      </ActionCard>

      <button
        type="button"
        onClick={onCancel}
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
        Cancel request
      </button>
    </div>
  );
            }
