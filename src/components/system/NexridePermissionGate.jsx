"use client";

import { useEffect, useState } from "react";

/** A small native/web onboarding screen without a Tailwind dependency. */
export default function NexridePermissionGate() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("Allow location access for accurate pickup and live ride tracking.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("nexride-permissions-ready") !== "yes") setShow(true);
    } catch { setShow(true); }
  }, []);

  async function enableGps() {
    setBusy(true);
    setStatus("Checking location permission…");
    try {
      if (typeof window.nexrideRequestGpsPermission === "function") {
        const result = await window.nexrideRequestGpsPermission();
        setStatus(result?.allowed ? "Location enabled. Your live pin can now appear on the map." : "Location is unavailable. Allow location in your phone or browser settings.");
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => setStatus("Location enabled. Your live pin can now appear on the map."),
          () => setStatus("Location denied. Allow it in phone or browser settings."),
          { enableHighAccuracy: true, timeout: 12000 }
        );
      } else setStatus("This device cannot provide GPS location.");
    } catch {
      setStatus("Could not request location. Check location services.");
    } finally { setBusy(false); }
  }

  async function enableNotifications() {
    setBusy(true);
    try {
      const result = await window.nexrideRequestNotifications?.();
      setStatus(result?.allowed ? "Notifications enabled." : "Notifications not enabled. You can still use NEXRIDE.");
    } catch { setStatus("Notification access is unavailable here."); }
    finally { setBusy(false); }
  }

  function continueApp() {
    try { window.localStorage.setItem("nexride-permissions-ready", "yes"); } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="nx-permissions-overlay" role="dialog" aria-modal="true" aria-labelledby="nx-permissions-title">
      <div className="nx-permissions-card">
        <div className="nx-permissions-symbol" aria-hidden="true">↗</div>
        <p className="nx-eyebrow">NEXRIDE · LET'S GET MOVING</p>
        <h1 id="nx-permissions-title">A better ride starts with your location.</h1>
        <p className="nx-permissions-copy">See your rider pin, find nearby drivers and track the route to pickup in real time.</p>
        <div className="nx-permissions-actions">
          <button type="button" className="nx-permissions-primary" onClick={enableGps} disabled={busy}>Enable live location</button>
          <button type="button" className="nx-permissions-secondary" onClick={enableNotifications} disabled={busy}>Enable ride notifications</button>
        </div>
        <p className="nx-permissions-feedback" role="status">{status}</p>
        <button type="button" className="nx-permissions-skip" onClick={continueApp}>Continue to NEXRIDE</button>
        <p className="nx-permissions-footnote">You can change permissions later in your device settings.</p>
      </div>
    </div>
  );
}
