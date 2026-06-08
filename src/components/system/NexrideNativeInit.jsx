"use client";

import { useEffect, useRef } from "react";

const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
  "4fdf776a-9b4f-464f-acef-a7b123cd4b68";

async function importOneSignal() {
  const mod = await import("@onesignal/capacitor-plugin");
  return mod.default || mod.OneSignal || mod;
}

export default function NexrideNativeInit() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function bootNative() {
      if (typeof window === "undefined") return;

      window.NEXRIDE_NATIVE_READY = false;
      window.NEXRIDE_ONESIGNAL_APP_ID = ONESIGNAL_APP_ID;

      try {
        const { Capacitor } = await import("@capacitor/core");
        const isNative = Boolean(Capacitor?.isNativePlatform?.());
        window.NEXRIDE_IS_NATIVE = isNative;

        // Notification permission must be triggered by a tap on Android 13+.
        window.nexrideRequestNotifications = async function nexrideRequestNotifications(tags = {}) {
          const result = { oneSignal: false, local: false, native: isNative };

          try {
            const OneSignal = await importOneSignal();
            if (OneSignal && ONESIGNAL_APP_ID) {
              OneSignal.initialize?.(ONESIGNAL_APP_ID);
              const accepted = await OneSignal.Notifications?.requestPermission?.(true);
              result.oneSignal = Boolean(accepted);
              window.NEXRIDE_ONESIGNAL_PERMISSION = accepted;

              try {
                await OneSignal.User?.addTags?.({
                  app: "NEXRIDE",
                  platform: isNative ? "android" : "web",
                  wrapper: isNative ? "capacitor" : "browser",
                  ...tags,
                });
              } catch {}
            }
          } catch (err) {
            console.warn("NEXRIDE OneSignal request failed:", err);
          }

          try {
            const { LocalNotifications } = await import("@capacitor/local-notifications");
            const perm = await LocalNotifications.requestPermissions();
            result.local = perm?.display === "granted";
            window.NEXRIDE_LOCAL_NOTIFICATION_PERMISSION = perm?.display || "unknown";
          } catch (err) {
            console.warn("NEXRIDE local notification permission failed:", err);
          }

          return result;
        };

        window.nexrideGetOneSignalState = async function nexrideGetOneSignalState() {
          try {
            const OneSignal = await importOneSignal();
            const optedIn = await OneSignal.User?.pushSubscription?.optedIn;
            const id = await OneSignal.User?.pushSubscription?.id;
            const token = await OneSignal.User?.pushSubscription?.token;
            return { appId: ONESIGNAL_APP_ID, optedIn: Boolean(optedIn), id: id || "", token: token || "" };
          } catch (err) {
            return { appId: ONESIGNAL_APP_ID, optedIn: false, id: "", token: "", error: String(err?.message || err) };
          }
        };

        // Initialize quietly. The actual permission prompt happens from the permission center button.
        try {
          const OneSignal = await importOneSignal();
          if (OneSignal && ONESIGNAL_APP_ID) {
            OneSignal.initialize?.(ONESIGNAL_APP_ID);
            await OneSignal.User?.addTags?.({ app: "NEXRIDE", platform: isNative ? "android" : "web" });
          }
        } catch (err) {
          console.warn("NEXRIDE OneSignal quiet init failed:", err);
        }

        window.nexrideSpeak = async function nexrideSpeak(message) {
          if (!message) return false;
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
            console.warn("NEXRIDE native voice failed, falling back:", err);
          }

          try {
            if ("speechSynthesis" in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(message);
              utterance.lang = "en-US";
              utterance.rate = 1;
              utterance.pitch = 1;
              window.speechSynthesis.speak(utterance);
              return true;
            }
          } catch (err) {
            console.warn("NEXRIDE browser voice failed:", err);
          }
          return false;
        };

        window.nexrideLocalNotify = async function nexrideLocalNotify({ title = "NEXRIDE", body = "NEXRIDE update", data = {} } = {}) {
          try {
            const { LocalNotifications } = await import("@capacitor/local-notifications");
            const perm = await LocalNotifications.requestPermissions();
            if (perm?.display !== "granted") return false;
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: Math.floor(Date.now() % 2147483647),
                  title,
                  body,
                  schedule: { at: new Date(Date.now() + 300) },
                  extra: data,
                },
              ],
            });
            return true;
          } catch (err) {
            console.warn("NEXRIDE local notification failed:", err);
            return false;
          }
        };

        window.nexrideRequestGpsPermission = async function nexrideRequestGpsPermission() {
          try {
            const { Geolocation } = await import("@capacitor/geolocation");
            const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 3000,
            });
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              source: "capacitor",
              updatedAt: Date.now(),
            };
            window.NEXRIDE_LAST_LOCATION = loc;
            return { granted: true, permission: perm, location: loc };
          } catch (err) {
            console.warn("NEXRIDE GPS permission failed:", err);
            return { granted: false, error: String(err?.message || err) };
          }
        };

        window.nexrideGetLocation = async function nexrideGetLocation() {
          try {
            const { Geolocation } = await import("@capacitor/geolocation");
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 5000,
            });
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              source: "capacitor",
              updatedAt: Date.now(),
            };
            window.NEXRIDE_LAST_LOCATION = loc;
            return loc;
          } catch (err) {
            console.warn("NEXRIDE native GPS failed:", err);
            return null;
          }
        };

        window.nexrideWatchLocation = async function nexrideWatchLocation(callback, onError) {
          try {
            const { Geolocation } = await import("@capacitor/geolocation");
            await Geolocation.requestPermissions({ permissions: ["location"] });
            const id = await Geolocation.watchPosition(
              { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 },
              (position, err) => {
                if (err) {
                  onError?.(err);
                  return;
                }
                if (!position?.coords) return;
                const loc = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  heading: position.coords.heading,
                  speed: position.coords.speed,
                  source: "capacitor",
                  updatedAt: Date.now(),
                };
                window.NEXRIDE_LAST_LOCATION = loc;
                callback?.(loc);
              }
            );
            return async () => Geolocation.clearWatch({ id });
          } catch (err) {
            console.warn("NEXRIDE native watch failed:", err);
            onError?.(err);
            return null;
          }
        };

        window.nexrideGetNetworkStatus = async function nexrideGetNetworkStatus() {
          try {
            const { Network } = await import("@capacitor/network");
            return await Network.getStatus();
          } catch {
            return { connected: navigator.onLine };
          }
        };

        window.NEXRIDE_NATIVE_READY = true;
        window.dispatchEvent(new CustomEvent("nexride:native-ready", { detail: { native: isNative } }));
      } catch (err) {
        console.warn("NEXRIDE native boot failed:", err);
        window.dispatchEvent(new CustomEvent("nexride:native-ready", { detail: { native: false, error: String(err?.message || err) } }));
      }
    }

    bootNative();
  }, []);

  return null;
}
