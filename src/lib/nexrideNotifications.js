// File: src/lib/nexrideNotifications.js
/**
 * NEXRIDE notification bus.
 * Writes events to Firebase RTDB, forwards to an optional HTTP endpoint,
 * and triggers an optional native device notification (Android/iOS wrapper).
 *
 * Design goals:
 *  - Never throw into the caller. Notifications are best-effort.
 *  - Never block the main app flow.
 *  - Deduplicated within a short window to survive double-taps.
 *  - Fully documented + tree-shakeable constants.
 */

import { push, ref, set, update } from "firebase/database";
import { db } from "./firebase";
import { nexrideDeviceNotify } from "./nexrideNative";

/* ------------------------------ Constants ----------------------------- */

/** Root path in RTDB where queued notifications live. */
const QUEUE_PATH = "notificationQueue";

/** Prevent duplicate events fired within this window (ms). */
const DEDUPE_WINDOW_MS = 2500;

/** Max length for free-text fields (protects DB rules + UI). */
const MAX_TITLE_LEN = 120;
const MAX_MESSAGE_LEN = 400;

/** Event types — single source of truth for the whole app. */
export const nexrideNotificationTypes = Object.freeze({
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
});

/* ------------------------------ Utilities ----------------------------- */

const isBrowser = typeof window !== "undefined";

/**
 * Deep-clone a value while replacing `undefined` with `null`.
 * Firebase RTDB rejects `undefined` anywhere in the tree, so this is required.
 * Handles Date, arrays, and nested plain objects safely.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function sanitizeForFirebase(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  // Primitives
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;

  // Dates → epoch millis
  if (value instanceof Date) return value.getTime();

  // Arrays
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForFirebase(v));
  }

  // Plain objects
  if (t === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeForFirebase(v);
    }
    return out;
  }

  // Functions/symbols → drop
  return null;
}

function truncate(str, max) {
  const s = String(str ?? "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** In-memory dedupe cache: key = type|targetUid|title|message. */
const recentKeys = new Map();

function dedupeKey(evt) {
  return [evt.type, evt.targetUid, evt.city, evt.title, evt.message].join("|");
}

function isDuplicate(key) {
  const now = Date.now();
  const last = recentKeys.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  recentKeys.set(key, now);

  // Opportunistic cleanup — keeps the map small.
  if (recentKeys.size > 200) {
    for (const [k, ts] of recentKeys) {
      if (now - ts > DEDUPE_WINDOW_MS) recentKeys.delete(k);
    }
  }
  return false;
}

/* ------------------------------- Main API ----------------------------- */

/**
 * @typedef {Object} NexrideEvent
 * @property {string} [type]         One of `nexrideNotificationTypes`.
 * @property {string} [title]        Short notification title.
 * @property {string} [message]      Body text.
 * @property {string} [city]         City key (e.g. "harare").
 * @property {"driver"|"rider"|"admin"|""} [targetRole]
 * @property {string} [targetUid]    Single recipient uid.
 * @property {string[]} [targetUids] Multi-recipient uids.
 * @property {string} [url]          Deep link inside the app.
 * @property {Record<string, unknown>} [data] Arbitrary payload.
 * @property {"push"|"sms"|"email"|"inapp"} [channel]
 */

/**
 * Queue a notification event. Never throws.
 * @param {NexrideEvent} event
 * @returns {Promise<{ id:string|null, delivered:boolean, reason?:string }>}
 */
export async function queueNexrideEvent(event = {}) {
  const now = Date.now();

  const base = {
    type: event.type || "nexride_event",
    title: truncate(event.title || "NEXRIDE", MAX_TITLE_LEN),
    message: truncate(event.message || "New NEXRIDE update", MAX_MESSAGE_LEN),
    city: event.city || "",
    targetRole: event.targetRole || "",
    targetUid: event.targetUid || "",
    targetUids: Array.isArray(event.targetUids) ? event.targetUids.filter(Boolean) : [],
    url: event.url || "/",
  };

  if (isDuplicate(dedupeKey(base))) {
    return { id: null, delivered: false, reason: "duplicate" };
  }

  const queueRef = push(ref(db, QUEUE_PATH));
  const payload = sanitizeForFirebase({
    id: queueRef.key,
    app: "nexride",
    channel: event.channel || "push",
    ...base,
    data: event.data || {},
    status: "queued",
    createdAt: now,
    updatedAt: now,
  });

  /* 1) Write to RTDB queue (primary channel). */
  try {
    await set(queueRef, payload);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[nexrideNotifications] RTDB write failed:", err?.message || err);
    }
    // Continue — endpoint/native may still work.
  }

  /* 2) Optional HTTP forward. */
  const endpoint = process.env.NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT || "";
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (res.ok) {
        try {
          await update(ref(db, `${QUEUE_PATH}/${queueRef.key}`), {
            status: "sent_to_endpoint",
            updatedAt: Date.now(),
          });
        } catch {
          // Non-fatal.
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[nexrideNotifications] endpoint failed:", err?.message || err);
      }
    }
  }

  /* 3) Native device notification (Android wrapper). Fire-and-forget — don't block. */
  if (isBrowser) {
    Promise.resolve()
      .then(() => nexrideDeviceNotify?.(payload.title, payload.message, payload.data))
      .catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[nexrideNotifications] native notify failed:", err?.message || err);
        }
      });
  }

  return { id: queueRef.key, delivered: true };
}
