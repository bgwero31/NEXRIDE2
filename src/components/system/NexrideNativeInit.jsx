"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getNexridePush } from "@/lib/nexridePush";

export default function NexrideNativeInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.NEXRIDE_NATIVE_READY = true;

    let binding = Promise.resolve();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      binding = binding.then(async () => {
        const sdk = await getNexridePush();
        if (!sdk) return;
        if (user) await sdk.login(user.uid);
        else await sdk.logout();
      }).catch((error) => console.warn("[NEXRIDE push] Account setup failed", error));
    });

    const openRidePage = ({ notification }) => {
      const path = notification?.additionalData?.path;
      if (["/rider", "/driver", "/school/parent", "/school/driver"].includes(path)) {
        window.location.assign(path);
      }
    };
    let listening = true;
    let sdk;
    getNexridePush().then((result) => {
      if (!listening || !result) return;
      sdk = result;
      sdk.Notifications.addEventListener("click", openRidePage);
    }).catch((error) => console.warn("[NEXRIDE push] Initialization failed", error));

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
      const sdk = await getNexridePush();
      if (sdk) {
        const allowed = await sdk.Notifications.requestPermission(true);
        if (allowed) await sdk.User.pushSubscription.optIn();
        return { allowed };
      }
      if (!("Notification" in window)) return { allowed: false };
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      return { allowed: permission === "granted", permission };
    };

    window.nexrideGetOneSignalState = async () => {
      const sdk = await getNexridePush();
      if (!sdk) return null;
      const subscription = sdk.User.pushSubscription;
      const [id, optedIn] = await Promise.all([subscription.getIdAsync(), subscription.getOptedInAsync()]);
      return { id, optedIn };
    };

    return () => {
      listening = false;
      unsubscribe();
      sdk?.Notifications.removeEventListener("click", openRidePage);
      delete window.nexrideGetOneSignalState;
    };
  }, []);

  return null;
}
