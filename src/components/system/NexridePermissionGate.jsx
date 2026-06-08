"use client";

import { useEffect, useMemo, useState } from "react";
import PremiumButton from "../ui/PremiumButton";
import { unlockNexrideVoice } from "../../lib/nexrideVoice";

const DONE_KEY = "nexride_permission_center_done_v1";

function statusLabel(value) {
  if (!value || value === "pending") return "Pending";
  if (value === "ready" || value === "granted" || value === "sent") return "Ready";
  if (value === "skipped") return "Skipped";
  return value;
}

export default function NexridePermissionGate() {
  const [visible, setVisible] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [statuses, setStatuses] = useState({ gps: "pending", notifications: "pending", voice: "pending", network: "checking" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DONE_KEY) === "yes") return;

    const openIfNative = () => {
      const isNative = Boolean(window.NEXRIDE_IS_NATIVE);
      setNativeReady(Boolean(window.NEXRIDE_NATIVE_READY));
      if (isNative) setVisible(true);
    };

    const timer = setTimeout(openIfNative, 1200);
    window.addEventListener("nexride:native-ready", openIfNative);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("nexride:native-ready", openIfNative);
    };
  }, []);

  useEffect(() => {
    if (!visible || typeof window === "undefined") return;
    let alive = true;
    async function checkNetwork() {
      let network = navigator.onLine ? "online" : "offline";
      try {
        if (typeof window.nexrideGetNetworkStatus === "function") {
          const net = await window.nexrideGetNetworkStatus();
          network = net?.connected ? `online ${net.connectionType ? `(${net.connectionType})` : ""}` : "offline";
        }
      } catch {}
      if (alive) setStatuses((old) => ({ ...old, network }));
    }
    checkNetwork();
    return () => { alive = false; };
  }, [visible]);

  const readyCount = useMemo(() => {
    return [statuses.gps, statuses.notifications, statuses.voice].filter((x) => ["ready", "granted", "sent"].includes(x)).length;
  }, [statuses]);

  const testGps = async () => {
    setBusy("gps");
    setStatuses((old) => ({ ...old, gps: "requesting" }));
    try {
      const result = typeof window !== "undefined" && typeof window.nexrideRequestGpsPermission === "function"
        ? await window.nexrideRequestGpsPermission()
        : null;
      if (result?.granted || result?.location?.lat) {
        const accuracy = Math.round(Number(result.location?.accuracy || 0));
        setStatuses((old) => ({ ...old, gps: `ready${accuracy ? ` • ${accuracy}m` : ""}` }));
      } else {
        setStatuses((old) => ({ ...old, gps: "blocked" }));
      }
    } catch {
      setStatuses((old) => ({ ...old, gps: "failed" }));
    } finally {
      setBusy("");
    }
  };

  const testNotifications = async () => {
    setBusy("notifications");
    setStatuses((old) => ({ ...old, notifications: "requesting" }));
    try {
      const result = typeof window !== "undefined" && typeof window.nexrideRequestNotifications === "function"
        ? await window.nexrideRequestNotifications({ permission_center: "done" })
        : null;
      const ok = Boolean(result?.oneSignal || result?.local);
      setStatuses((old) => ({ ...old, notifications: ok ? "ready" : "blocked" }));
      if (typeof window.nexrideLocalNotify === "function") {
        await window.nexrideLocalNotify({ title: "NEXRIDE ready", body: "Notifications are ready on this device.", data: { type: "permission_check" } });
      }
    } catch {
      setStatuses((old) => ({ ...old, notifications: "failed" }));
    } finally {
      setBusy("");
    }
  };

  const testVoice = async () => {
    setBusy("voice");
    setStatuses((old) => ({ ...old, voice: "speaking" }));
    try {
      const ok = await unlockNexrideVoice("rider");
      setStatuses((old) => ({ ...old, voice: ok ? "ready" : "blocked" }));
    } catch {
      setStatuses((old) => ({ ...old, voice: "failed" }));
    } finally {
      setBusy("");
    }
  };

  const close = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(DONE_KEY, "yes");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="nx-permission-overlay" role="dialog" aria-modal="true">
      <section className="nx-permission-card">
        <div className="nx-permission-logo">NR</div>
        <div className="nx-eyebrow">First launch setup</div>
        <h2>Enable NEXRIDE features</h2>
        <p>
          Turn on GPS, notifications and voice so ride tracking, school transport alerts and trip updates work properly inside the APK.
        </p>

        <div className="nx-permission-status-grid">
          <div><span>Native bridge</span><strong>{nativeReady ? "Ready" : "Loading"}</strong></div>
          <div><span>Network</span><strong>{statuses.network}</strong></div>
          <div><span>GPS</span><strong>{statusLabel(statuses.gps)}</strong></div>
          <div><span>Notifications</span><strong>{statusLabel(statuses.notifications)}</strong></div>
          <div><span>Voice</span><strong>{statusLabel(statuses.voice)}</strong></div>
          <div><span>Ready</span><strong>{readyCount}/3</strong></div>
        </div>

        <div className="nx-button-stack compact">
          <PremiumButton type="button" onClick={testGps} disabled={busy === "gps"}>{busy === "gps" ? "Checking GPS..." : "Enable GPS"}</PremiumButton>
          <PremiumButton type="button" onClick={testNotifications} disabled={busy === "notifications"}>{busy === "notifications" ? "Opening permission..." : "Enable notifications"}</PremiumButton>
          <PremiumButton type="button" onClick={testVoice} disabled={busy === "voice"}>{busy === "voice" ? "Speaking..." : "Test NEXRIDE voice"}</PremiumButton>
          <button className="nx-btn nx-btn-secondary" type="button" onClick={close}>Continue to NEXRIDE</button>
          <a className="nx-btn nx-btn-ghost" href="/device-check" onClick={close}>Open device check</a>
        </div>
      </section>
    </div>
  );
}
