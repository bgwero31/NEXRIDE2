// File: src/components/driver/DriverMap.jsx

"use client";

function cityLabel(city) {
  if (!city) return "City";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function modeCopy(mode) {
  if (mode === "offline") return "Go online";
  if (mode === "queue") return "Requests near you";
  if (mode === "trip") return "Active trip";
  if (mode === "completed") return "Trip complete";
  return "Driver map";
}

export default function DriverMap({ mode, city, activeTrip, requests = [] }) {
  const pickup = activeTrip?.pickupName || requests[0]?.pickupName || "Waiting for rider requests";
  const dropoff = activeTrip?.dropoffName || requests[0]?.dropoffName || "Open request marketplace";

  return (
    <section className="nx-live-map driver-map">
      <div className="nx-map-grid" />
      <div className="nx-map-glow one" />
      <div className="nx-map-glow two" />

      <svg className="nx-route-svg" viewBox="0 0 400 760" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="routeGradientDriver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06152b" />
            <stop offset="48%" stopColor="#0066ff" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
        </defs>
        <path className="nx-route-shadow" d="M330 585 C230 520 300 430 187 355 C90 291 164 210 72 126" />
        <path className="nx-route-path" d="M330 585 C230 520 300 430 187 355 C90 291 164 210 72 126" stroke="url(#routeGradientDriver)" />
      </svg>

      {requests.slice(0, 5).map((request, index) => {
        const positions = [
          { left: "23%", top: "33%" },
          { left: "70%", top: "37%" },
          { left: "48%", top: "52%" },
          { left: "78%", top: "63%" },
          { left: "30%", top: "69%" },
        ];
        return (
          <div key={request.id || index} className="nx-rider-pin" style={positions[index]}>${Number(request.offerPrice || 0).toFixed(0)}</div>
        );
      })}

      <div className="nx-car-pin driver-self" style={{ left: "48%", top: "70%" }}>🚘</div>

      <div className="nx-map-card nx-map-status-card">
        <div>
          <span className="nx-eyebrow">Driver command center</span>
          <h3>{modeCopy(mode)}</h3>
          <p>{cityLabel(city)} • {requests.length} open request{requests.length === 1 ? "" : "s"}</p>
        </div>
        <div className="nx-map-chip">NEXRIDE</div>
      </div>

      <div className="nx-map-card nx-map-route-card">
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-pickup" />{pickup}</div>
        <div className="nx-route-mini-row"><span className="nx-dot nx-dot-destination" />{dropoff}</div>
        <div className="nx-map-metrics">
          <span>{mode === "trip" ? "Trip live" : "Marketplace"}</span>
          <span>{requests.length} bids</span>
          <span>Low data map</span>
        </div>
      </div>
    </section>
  );
}
