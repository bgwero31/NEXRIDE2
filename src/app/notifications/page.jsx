"use client";

import { useEffect, useState } from "react";
import MobileShell from "../../components/ui/MobileShell";
import ActionCard from "../../components/ui/ActionCard";
import PremiumButton from "../../components/ui/PremiumButton";
import { getNexridePush } from "../../lib/nexridePush";

export default function NotificationsPage() {
  const [status, setStatus] = useState("Checking this device…");
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    const sdk = await getNexridePush();
    if (!sdk) {
      setStatus("OneSignal ride alerts require a configured NEXRIDE Android app.");
      return;
    }
    const subscription = sdk.User.pushSubscription;
    const [id, enabled] = await Promise.all([subscription.getIdAsync(), subscription.getOptedInAsync()]);
    setStatus(enabled && id ? "This device is subscribed to ride alerts." : "Ride alerts are off or registration is still pending.");
  }

  useEffect(() => {
    refreshStatus().catch(() => setStatus("Could not check this device’s subscription."));
  }, []);

  async function enableAlerts() {
    setBusy(true);
    try {
      const sdk = await getNexridePush();
      if (sdk && await sdk.Notifications.requestPermission(true)) {
        await sdk.User.pushSubscription.optIn();
      }
      await refreshStatus();
    } catch {
      setStatus("Could not enable ride alerts. Check your connection and app permissions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell decorators={false}>
      <div className="nx-profile-page">
        <a className="nx-icon-btn" href="/rider" aria-label="Back to rider">←</a>
        <ActionCard className="nx-stack" style={{ padding: 20, marginTop: 16 }}>
          <h1 className="nx-auth-title">Ride alerts</h1>
          <p className="nx-auth-copy" role="status">{status}</p>
          <PremiumButton onClick={enableAlerts} loading={busy}>Enable ride alerts</PremiumButton>
        </ActionCard>
      </div>
    </MobileShell>
  );
}
