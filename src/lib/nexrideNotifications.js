// File: src/lib/nexrideNotifications.js

import { push, ref, set } from "firebase/database";
import { db } from "./firebase";
import { nexrideDeviceNotify } from "./nexrideNative";

function cleanPayload(value) {
  return JSON.parse(JSON.stringify(value || {}, (_key, item) => (item === undefined ? null : item)));
}

export async function queueNexrideEvent(event = {}) {
  const now = Date.now();
  const queueRef = push(ref(db, "notificationQueue"));
  const payload = cleanPayload({
    id: queueRef.key,
    app: "nexride",
    channel: event.channel || "push",
    type: event.type || "nexride_event",
    title: event.title || "NEXRIDE",
    message: event.message || "New NEXRIDE update",
    city: event.city || "",
    targetRole: event.targetRole || "",
    targetUid: event.targetUid || "",
    targetUids: event.targetUids || [],
    url: event.url || "/",
    data: event.data || {},
    status: "queued",
    createdAt: now,
    updatedAt: now,
  });

  try {
    await set(queueRef, payload);
  } catch (error) {
    console.warn("NEXRIDE notification queue write failed. Continuing app flow.", error);
  }

  const endpoint = process.env.NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT || "";
  if (endpoint) {
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      try {
        await set(ref(db, `notificationQueue/${queueRef.key}/status`), "sent_to_endpoint");
      } catch {}
    } catch (error) {
      console.warn("NEXRIDE notification endpoint failed; event remains queued if database rules allow it.", error);
    }
  }

  // Native APK fallback: this shows an immediate device notification on the phone.
  // Real remote OneSignal push still needs the Render endpoint + REST key.
  try {
    await nexrideDeviceNotify(payload.title, payload.message, payload.data);
  } catch {}

  return payload;
}

export const nexrideNotificationTypes = {
  REQUEST_CREATED: "ride_request_created",
  REQUEST_VIEWED: "ride_request_viewed",
  OFFER_SENT: "ride_offer_sent",
  REQUEST_ACCEPTED: "ride_request_accepted",
  OFFER_ACCEPTED: "ride_offer_accepted",
  DRIVER_ARRIVED: "driver_arrived",
  OTP_VERIFIED: "otp_verified",
  TRIP_STARTED: "trip_started",
  TRIP_ENROUTE: "trip_enroute",
  TRIP_COMPLETED: "trip_completed",
  REQUEST_CANCELLED: "ride_request_cancelled",
  TRIP_CANCELLED: "trip_cancelled",
  SCHOOL_REGISTERED: "school_registered",
  SCHOOL_ROUTE_STARTED: "school_route_started",
  SCHOOL_CHILD_BOARDED: "school_child_boarded",
  SCHOOL_CHILD_DROPPED: "school_child_dropped",
  SCHOOL_ROUTE_COMPLETED: "school_route_completed",
  SCHOOL_EMERGENCY: "school_emergency",
};
