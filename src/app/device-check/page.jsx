// File: src/app/device-check/page.jsx

"use client";

import { useEffect, useState } from "react";
import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import PremiumButton from "../../components/ui/PremiumButton";
import { getNexrideLocation, nexrideDeviceNotify } from "../../lib/nexrideNative";
import { unlockNexrideVoice } from "../../lib/nexrideVoice";

export default function DeviceCheckPage() {
  const [status, setStatus] = useState({
    native: "checking",
    gps: "not tested",
    voice: "not tested",
    notify: "not tested",
    network: "checking",
  });
  const [location, setLocation] = useState(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      let network = navigator.onLine ? "online" : "offline";
      try {
        if (typeof window !== "undefined" && typeof window.nexrideGetNetworkStatus === "function") {
          const net = await window.nexrideGetNetworkStatus();
          network = net?.connected ? `online (${net.connectionType || "connected"})` : "offline";
        }
      } catch {}
      setStatus((old) => ({
        ...old,
        native: window.NEXRIDE_NATIVE_READY ? "ready" : window.NEXRIDE_IS_NATIVE ? "loading" : "browser / PWA",
        network,
      }));
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const testGps = async () => {
    setStatus((old) => ({ ...old, gps: "checking" }));
    const loc = await getNexrideLocation({ allowWeak: true });
    if (loc?.lat && loc?.lng) {
      setLocation(loc);
      setStatus((old) => ({ ...old, gps: `ready • accuracy ${Math.round(Number(loc.accuracy || 0))}m • ${loc.source}` }));
    } else {
      setStatus((old) => ({ ...old, gps: "blocked or unavailable" }));
    }
  };

  const testVoice = async () => {
    setStatus((old) => ({ ...old, voice: "speaking" }));
    const ok = await unlockNexrideVoice("rider");
    setStatus((old) => ({ ...old, voice: ok ? "ready" : "failed or blocked" }));
  };

  const testNotify = async () => {
    setStatus((old) => ({ ...old, notify: "sending" }));
    const ok = await nexrideDeviceNotify("NEXRIDE test", "Native notification test is working.", { type: "device_check" });
    setStatus((old) => ({ ...old, notify: ok ? "sent" : "blocked or unavailable" }));
  };

  return (
    <MobileShell>
      <FloatingTopBar profile={{ fullName: "Device check", city: "NEXRIDE" }} />
      <main className="nx-page-pad" style={{ paddingTop: 110 }}>
        <section className="nx-settings-hero">
          <div className="nx-eyebrow">Native APK check</div>
          <h1>GPS, voice and notifications</h1>
          <p>Use this page inside the APK to confirm permissions before testing rides.</p>
        </section>

        <section className="nx-settings-card">
          <div className="nx-settings-row"><span>Native bridge</span><strong>{status.native}</strong></div>
          <div className="nx-settings-row"><span>Network</span><strong>{status.network}</strong></div>
          <div className="nx-settings-row"><span>GPS</span><strong>{status.gps}</strong></div>
          <div className="nx-settings-row"><span>Voice</span><strong>{status.voice}</strong></div>
          <div className="nx-settings-row"><span>Notification</span><strong>{status.notify}</strong></div>
          {location ? (
            <p className="nx-sheet-copy">Lat {location.lat}, lng {location.lng}, accuracy {Math.round(Number(location.accuracy || 0))}m.</p>
          ) : null}
        </section>

        <div className="nx-button-stack">
          <PremiumButton type="button" onClick={testGps}>Test GPS</PremiumButton>
          <PremiumButton type="button" onClick={testVoice}>Enable/test voice</PremiumButton>
          <PremiumButton type="button" onClick={testNotify}>Test notification</PremiumButton>
        </div>
      </main>
    </MobileShell>
  );
}
