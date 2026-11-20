import { Capacitor } from "@capacitor/core";

let sdkPromise;

export function getNexridePush() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId || !Capacitor.isNativePlatform()) return Promise.resolve(null);

  if (!sdkPromise) {
    sdkPromise = import("@onesignal/capacitor-plugin")
      .then(async ({ default: OneSignal }) => {
        await OneSignal.initialize(appId);
        return OneSignal;
      })
      .catch((error) => {
        sdkPromise = undefined;
        throw error;
      });
  }
  return sdkPromise;
}
