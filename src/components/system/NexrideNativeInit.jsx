"use client";

import { useEffect, useRef } from "react";

const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
  "4fdf776a-9b4f-464f-acef-a7b123cd4b68";

export default function NexrideNativeInit() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function bootNative() {
      if (typeof window === "undefined") return;

      try {
        const { Capacitor } = await import("@capacitor/core");
        const isNative = Capacitor?.isNativePlatform?.();

        if (!isNative) {
          window.NEXRIDE_NATIVE_READY = false;
          return;
        }

        // OneSignal native APK push
        try {
          const OneSignalModule = await import("@onesignal/capacitor-plugin");
          const OneSignal = OneSignalModule.default;
          const LogLevel = OneSignalModule.LogLevel;

          if (OneSignal && ONESIGNAL_APP_ID) {
            OneSignal.Debug?.setLogLevel?.(LogLevel?.Verbose);
            OneSignal.initialize(ONESIGNAL_APP_ID);

            const accepted = await OneSignal.Notifications.requestPermission(false);
            console.log("NEXRIDE OneSignal permission:", accepted);

            await OneSignal.User?.addTags?.({
              app: "NEXRIDE",
              platform: "android",
              wrapper: "capacitor",
            });
          }
        } catch (err) {
          console.warn("NEXRIDE OneSignal init failed:", err);
        }

        // Native voice helper
        window.nexrideSpeak = async function nexrideSpeak(message) {
          if (!message) return;

          try {
            const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
            await TextToSpeech.speak({
              text: message,
              lang: "en-US",
              rate: 1.0,
              pitch: 1.0,
              volume: 1.0,
              category: "ambient",
            });
            return true;
          } catch (err) {
            console.warn("Native voice failed, trying browser voice:", err);
          }

          try {
            if ("speechSynthesis" in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(message);
              utterance.lang = "en-US";
              utterance.rate = 1;
              window.speechSynthesis.speak(utterance);
              return true;
            }
          } catch (err) {
            console.warn("Browser voice failed:", err);
          }

          return false;
        };

        // Native GPS helper
        window.nexrideGetLocation = async function nexrideGetLocation() {
          try {
            const { Geolocation } = await import("@capacitor/geolocation");

            await Geolocation.requestPermissions();

            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 3000,
            });

            return {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              source: "capacitor",
            };
          } catch (err) {
            console.warn("Native GPS failed:", err);
            return null;
          }
        };

        // Network helper
        window.nexrideGetNetworkStatus = async function nexrideGetNetworkStatus() {
          try {
            const { Network } = await import("@capacitor/network");
            return await Network.getStatus();
          } catch {
            return { connected: navigator.onLine };
          }
        };

        window.NEXRIDE_NATIVE_READY = true;

        // Test-ready event hook. Later our trip events will call this.
        window.dispatchEvent(new CustomEvent("nexride:native-ready"));
      } catch (err) {
        console.warn("NEXRIDE native boot failed:", err);
      }
    }

    bootNative();
  }, []);

  return null;
}
