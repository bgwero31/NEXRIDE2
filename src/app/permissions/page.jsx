"use client";

import { useState } from "react";
import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import PremiumButton from "../../components/ui/PremiumButton";
import { getNexrideLocation, nexrideDeviceNotify } from "../../lib/nexrideNative";
import { unlockNexrideVoice } from "../../lib/nexrideVoice";

export default function PermissionsPage() {
  const [log, setLog] = useState([]);
  const add = (msg) => setLog((old) => [msg, ...old].slice(0, 8));

  const enableGps = async () => {
    add("Requesting GPS permission...");
    let loc = null;
    try {
      if (typeof window !== "undefined" && typeof window.nexrideRequestGpsPermission === "function") {
        const result = await window.nexrideRequestGpsPermission();
        loc = result?.location || null;
      }
      if (!loc) loc = await getNexrideLocation({ allowWeak: true });
      add(loc ? `GPS ready: ${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)} • ${Math.round(Number(loc.accuracy || 0))}m` : "GPS blocked or unavailable.");
    } catch (err) { add(`GPS failed: ${String(err?.message || err)}`); }
  };

  const enableNotifications = async () => {
    add("Requesting notification permission...");
    try {
      const result = typeof window !== "undefined" && typeof window.nexrideRequestNotifications === "function" ? await window.nexrideRequestNotifications({ permission_page: "yes" }) : null;
      await nexrideDeviceNotify("NEXRIDE permissions", "Notification test from NEXRIDE is working.", { type: "permissions" });
      add(result?.oneSignal || result?.local ? "Notifications ready." : "Notification permission may be blocked. Check Android app settings.");
    } catch (err) { add(`Notification failed: ${String(err?.message || err)}`); }
  };

  const enableVoice = async () => {
    add("Testing NEXRIDE voice...");
    const ok = await unlockNexrideVoice("rider");
    add(ok ? "Voice ready." : "Voice failed. Check phone media volume/Text-to-Speech settings.");
  };

  const checkOneSignal = async () => {
    try {
      const state = typeof window !== "undefined" && typeof window.nexrideGetOneSignalState === "function" ? await window.nexrideGetOneSignalState() : null;
      add(state ? `OneSignal: ${state.optedIn ? "subscribed" : "not subscribed yet"} • ${state.id || "no id"}` : "OneSignal native bridge not ready.");
    } catch (err) { add(`OneSignal check failed: ${String(err?.message || err)}`); }
  };

  return (
    <MobileShell>
      <FloatingTopBar title="NEXRIDE" subtitle="Device permissions" role="rider" />
      <main className="nx-page-pad nx-school-page">
        <section className="nx-school-hero nx-glass-panel compact">
          <div className="nx-eyebrow">NEXRIDE APK setup</div>
          <h1>Permission center</h1>
          <p>Use this page in the APK to force Android to ask for GPS, notifications and voice testing before ride or school tracking.</p>
        </section>
        <section className="nx-card-pro nx-stack">
          <PremiumButton type="button" onClick={enableGps}>Enable GPS</PremiumButton>
          <PremiumButton type="button" onClick={enableNotifications}>Enable notifications</PremiumButton>
          <PremiumButton type="button" onClick={enableVoice}>Enable/test voice</PremiumButton>
          <button className="nx-btn nx-btn-secondary" onClick={checkOneSignal}>Check OneSignal subscription</button>
          <a className="nx-btn nx-btn-ghost" href="/device-check">Open advanced device check</a>
        </section>
        <section className="nx-card-pro nx-stack">
          <div className="nx-eyebrow">Live log</div>
          {log.length ? log.map((item, i) => <p className="nx-school-log" key={`${item}-${i}`}>{item}</p>) : <p className="nx-sheet-copy">Tap a button to test the APK bridge.</p>}
        </section>
      </main>
    </MobileShell>
  );
}
