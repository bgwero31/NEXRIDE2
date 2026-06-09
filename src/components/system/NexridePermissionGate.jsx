"use client";

import { useEffect, useState } from "react";

export default function NexridePermissionGate() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("nexride-permissions-ready") !== "yes") {
      setShow(true);
    }
  }, []);

  async function enableGps() {
    setStatus("Checking GPS...");
    const res = await window.nexrideRequestGpsPermission?.();
    setStatus(res?.allowed ? "GPS allowed ✅" : "GPS blocked ❌");
  }

  async function enableNotifications() {
    setStatus("Checking notifications...");
    const res = await window.nexrideRequestNotifications?.();
    setStatus(res?.allowed ? "Notifications allowed ✅" : "Notifications blocked ❌");
  }

  async function testVoice() {
    setStatus("Testing voice...");
    const ok = await window.nexrideSpeak?.("NEXRIDE voice is ready.");
    setStatus(ok ? "Voice ready ✅" : "Voice blocked ❌");
  }

  function continueApp() {
    localStorage.setItem("nexride-permissions-ready", "yes");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 p-5 text-white backdrop-blur-xl">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center">
        <div className="rounded-[32px] border border-cyan-300/20 bg-white/10 p-6 shadow-2xl">
          <div className="mb-5">
            <h1 className="text-3xl font-black">Enable NEXRIDE</h1>
            <p className="mt-2 text-sm text-slate-300">
              Turn on GPS, alerts and voice for live rides.
            </p>
          </div>

          <div className="space-y-3">
            <button onClick={enableGps} className="w-full rounded-2xl bg-cyan-400 px-4 py-4 font-black text-slate-950">
              Enable GPS
            </button>

            <button onClick={enableNotifications} className="w-full rounded-2xl bg-blue-600 px-4 py-4 font-black">
              Enable Notifications
            </button>

            <button onClick={testVoice} className="w-full rounded-2xl bg-white px-4 py-4 font-black text-slate-950">
              Test Voice
            </button>

            <p className="rounded-2xl bg-black/30 p-3 text-center text-sm text-cyan-200">{status}</p>

            <button onClick={continueApp} className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-4 font-black">
              Continue to NEXRIDE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
