"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getNexridePush } from "@/lib/nexridePush";

let attemptedNativePrompt = false;
const NATIVE_PROMPT_KEY = "nexride-native-push-prompt";

export default function NexrideNativeInit() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/rider" && pathname !== "/driver") return;
    let stopped = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || attemptedNativePrompt) return;
      try {
        const sdk = await getNexridePush();
        if (stopped || !sdk || attemptedNativePrompt) return;
        try { if (localStorage.getItem(NATIVE_PROMPT_KEY) === "yes") return; } catch {}
        if (await sdk.Notifications.hasPermission() || !await sdk.Notifications.canRequestPermission()) return;
        if (stopped || attemptedNativePrompt) return;
        attemptedNativePrompt = true;
        try { localStorage.setItem(NATIVE_PROMPT_KEY, "yes"); } catch {}
        if (await sdk.Notifications.requestPermission(false)) await sdk.User.pushSubscription.optIn();
      } catch (error) {
        console.warn("[NEXRIDE push] Permission setup failed", error);
      }
    });
    return () => { stopped = true; unsubscribe(); };
  }, [pathname]);

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
