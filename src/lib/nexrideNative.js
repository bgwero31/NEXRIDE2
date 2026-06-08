// File: src/lib/nexrideNative.js

"use client";

function browserLocationOnce(options = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
        speed: typeof pos.coords.speed === "number" ? pos.coords.speed : null,
        source: "browser",
        updatedAt: Date.now(),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000, ...options }
    );
  });
}

export async function getNexrideLocation({ allowWeak = true } = {}) {
  if (typeof window !== "undefined" && typeof window.nexrideGetLocation === "function") {
    const native = await window.nexrideGetLocation();
    if (native?.lat && native?.lng && (allowWeak || Number(native.accuracy || 9999) <= 1000)) return native;
  }

  const fallback = await browserLocationOnce();
  if (fallback?.lat && fallback?.lng && (allowWeak || Number(fallback.accuracy || 9999) <= 1000)) return fallback;
  return null;
}

export function watchNexrideLocation(callback, onError, options = {}) {
  let stopped = false;
  let cleanup = null;

  async function start() {
    if (typeof window !== "undefined" && typeof window.nexrideWatchLocation === "function") {
      cleanup = await window.nexrideWatchLocation(callback, onError);
      if (cleanup) return;
    }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (stopped) return;
          callback?.({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
            speed: typeof pos.coords.speed === "number" ? pos.coords.speed : null,
            source: "browser",
            updatedAt: Date.now(),
          });
        },
        (err) => onError?.(err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000, ...options }
      );
      cleanup = () => navigator.geolocation.clearWatch(watchId);
    }
  }

  start();

  return () => {
    stopped = true;
    try {
      if (typeof cleanup === "function") cleanup();
    } catch {}
  };
}

export async function nexrideDeviceNotify(title, body, data = {}) {
  if (typeof window !== "undefined" && typeof window.nexrideLocalNotify === "function") {
    return window.nexrideLocalNotify({ title, body, data });
  }
  return false;
}
