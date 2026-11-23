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

  if (isDone) return null;
  return (
    <div className="nx-splash-overlay nx-branded-splash" aria-hidden="true">
      <img src="/nexride-wordmark.webp" alt="" width="1200" height="600" fetchPriority="high" />
    </div>
  );
}
