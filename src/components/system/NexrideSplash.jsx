"use client";

import { useEffect, useState } from "react";

export default function NexrideSplash() {
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // One short branded intro per tab session; avoid unprompted speech/audio.
    try {
      if (sessionStorage.getItem("nexride-splash-seen") === "yes") {
        setIsDone(true);
        return;
      }
      sessionStorage.setItem("nexride-splash-seen", "yes");
    } catch {}
    const timer = setTimeout(() => setIsDone(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`nx-splash-overlay ${isDone ? "is-done" : ""}`}>
      <div className="nx-splash-road" />
      
      {/* The Blue Arrow Car */}
      <div className="nx-splash-car">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <ellipse cx="32" cy="58" rx="10" ry="3" fill="#06152b" opacity="0.22"/>
          <circle cx="32" cy="32" r="22" fill="#ffffff"/>
          <path
            d="M32 12 L48 48 L32 40 L16 48 Z"
            fill="#1bb469"
            stroke="#1bb469"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M32 12 L46 44"
            stroke="#a8ffd0"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.75"
          />
        </svg>
      </div>

      <div className="nx-splash-text">NEXRIDE</div>
      <div className="nx-splash-sub">Where Every Ride Feels Right</div>
    </div>
  );
}
