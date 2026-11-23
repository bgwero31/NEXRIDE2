"use client";

import { useState } from "react";
import MobileShell from "../../components/ui/MobileShell";
import NexrideBrand from "../../components/ui/NexrideBrand";
import PremiumButton from "../../components/ui/PremiumButton";
import { getNexrideLocation } from "../../lib/nexrideNative";
import { getNexridePush } from "../../lib/nexridePush";
import { unlockNexrideVoice } from "../../lib/nexrideVoice";

export default function DeviceHelpPage() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkDevice(action) {
    setBusy(true);
    setStatus("Checking…");
    try {
      if (action === "location") {
        const location = await getNexrideLocation({ allowWeak: true });
        setStatus(location ? "Location is working." : "Location is unavailable. Check location access for NEXRIDE in your device or browser settings.");
      } else if (action === "alerts") {
        const sdk = await getNexridePush();
        if (!sdk) setStatus("Ride push alerts are available in the configured NEXRIDE Android app.");
        else if (await sdk.Notifications.requestPermission(true)) {
          await sdk.User.pushSubscription.optIn();
          setStatus("Ride alerts enabled.");
        } else setStatus("Allow notifications for NEXRIDE in Android settings to receive ride alerts.");
      } else {
        const ok = await unlockNexrideVoice("rider");
        setStatus(ok ? "Voice test started." : "Voice is unavailable. Check your media volume and text-to-speech settings.");
      }
    } catch {
      setStatus("Could not check this device. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell decorators={false}>
      <main className="nx-page-pad nx-school-page">
        <NexrideBrand size="small" />
        <section className="nx-school-hero nx-glass-panel compact">
          <h1>Device help</h1>
          <p>Location starts when you open the ride map. Use these checks if something stops working.</p>
        </section>
        <section className="nx-card-pro nx-stack">
          <PremiumButton disabled={busy} onClick={() => checkDevice("location")}>Check location</PremiumButton>
          <PremiumButton variant="secondary" disabled={busy} onClick={() => checkDevice("alerts")}>Check ride alerts</PremiumButton>
          <PremiumButton variant="secondary" disabled={busy} onClick={() => checkDevice("voice")}>Test voice</PremiumButton>
          {status && <p className="nx-sheet-copy" role="status">{status}</p>}
        </section>
      </main>
    </MobileShell>
  );
}
