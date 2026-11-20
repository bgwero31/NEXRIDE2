"use client";

import { useEffect, useState } from "react";
import { speakNexride } from "../../lib/nexrideVoice";

export default function NexrideSplash() {
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // 1. Play the voice when splash mounts
    const voiceTimer = setTimeout(() => {
      try {
        speakNexride("Welcome to NEXRIDE", { force: true });
      } catch (err) {
        console.warn("Splash voice failed", err);
      }
    }, 300);

    // 2. Hide the splash after 2.8 seconds
    const hideTimer = setTimeout(() => {
      setIsDone(true);
    }, 2800);

    return () => {
      clearTimeout(voiceTimer);
      clearTimeout(hideTimer);
    };
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
            fill="#0b6dff"
            stroke="#0b6dff"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M32 12 L46 44"
            stroke="#00d4ff"
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
