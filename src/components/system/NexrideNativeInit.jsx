"use client";

import { useEffect } from "react";

export default function NexrideNativeInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.NEXRIDE_NATIVE_READY = true;

    window.nexrideSpeak = async (message) => {
      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(message || "NEXRIDE voice is ready.");
          u.lang = "en-US";
          u.rate = 1;
          u.pitch = 1;
          window.speechSynthesis.speak(u);
          return true;
        }
      } catch (e) {
        console.warn("NEXRIDE voice failed", e);
      }
      return false;
    };

    window.nexrideGetLocation = async () => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);

        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              source: "browser-gps",
            }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
        );
      });
    };

    window.nexrideRequestGpsPermission = async () => {
      const location = await window.nexrideGetLocation();
      return { allowed: Boolean(location), location };
    };

    window.nexrideRequestNotifications = async () => {
      if (!("Notification" in window)) return { allowed: false };
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      return { allowed: permission === "granted", permission };
    };
  }, []);

  return null;
}
