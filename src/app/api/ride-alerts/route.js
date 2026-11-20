import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { deriveRideAlert, rideAlertKey, validKey } from "@/lib/nexrideAlertDelivery.mjs";

export const runtime = "nodejs";

function getRelayApp() {
  const name = "nexride-alert-relay";
  return getApps().find((app) => app.name === name) || initializeApp({
    credential: cert(JSON.parse(process.env.NEXRIDE_FIREBASE_SERVICE_ACCOUNT_JSON)),
    databaseURL: process.env.NEXRIDE_FIREBASE_DATABASE_URL,
  }, name);
}

export async function POST(request) {
  const { ONESIGNAL_APP_ID: appId, ONESIGNAL_REST_API_KEY: apiKey } = process.env;
  if (!appId || !apiKey || !process.env.NEXRIDE_FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.NEXRIDE_FIREBASE_DATABASE_URL) {
    return Response.json({ status: "relay_unconfigured" }, { status: 503 });
  }
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i);
  if (!bearer) return Response.json({ status: "unauthorized" }, { status: 401 });

  try {
    const app = getRelayApp();
    const identity = await getAuth(app).verifyIdToken(bearer[1]).catch(() => null);
    if (!identity) return Response.json({ status: "unauthorized" }, { status: 401 });
    const input = await request.json().catch(() => null);
    if (!validKey(input?.id)) return Response.json({ status: "invalid_event" }, { status: 400 });

    const db = getDatabase(app);
    const read = async (path) => (await db.ref(path).get()).val();
    const event = await read(`notificationQueue/${input.id}`);
    const alert = await deriveRideAlert({ event, uid: identity.uid, read });
    if (!alert) return Response.json({ status: "event_not_eligible" }, { status: 403 });
    if (alert.recipients.length === 0) return Response.json({ status: "no_recipients" });

    for (let offset = 0; offset < alert.recipients.length; offset += 20_000) {
      const response = await fetch("https://api.onesignal.com/notifications?c=push", {
        method: "POST",
        headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          app_id: appId,
          include_aliases: { external_id: alert.recipients.slice(offset, offset + 20_000) },
          target_channel: "push",
          ttl: event.type === "ride_request_created" ? 90 : 900,
          headings: { en: alert.title },
          contents: { en: alert.body },
          data: { path: alert.path },
          idempotency_key: rideAlertKey(`${alert.dedupe}:${offset}`),
        }),
      });
      if (!response.ok) return Response.json({ status: "provider_error" }, { status: 502 });
      const result = await response.json();
      if (!result.id) return Response.json({ status: "no_subscribed_devices" });
    }
    return Response.json({ status: "provider_accepted" });
  } catch (error) {
    console.error("[NEXRIDE alert relay]", error?.code || error?.name || "UnknownError");
    return Response.json({ status: "relay_error" }, { status: 502 });
  }
}
