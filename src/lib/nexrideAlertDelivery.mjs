import { createHash } from "node:crypto";

const RECENT_MS = 15 * 60 * 1000;
const ONLINE_MS = 90 * 1000;
export const validKey = (value) => typeof value === "string" && /^[\w-]{1,128}$/.test(value);

const messages = {
  ride_request_created: ["New ride request", "A rider in your city is looking for a driver."],
  ride_request_viewed: ["Ride request viewed", "A driver viewed your ride request."],
  ride_offer_sent: ["New driver offer", "Open NEXRIDE to review your driver’s offer."],
  ride_request_accepted: ["Driver accepted", "Your driver is heading to pickup."],
  ride_offer_accepted: ["Offer accepted", "Your rider accepted your offer. Head to pickup."],
  driver_arrived: ["Driver arrived", "Your driver is at the pickup point."],
  otp_verified: ["Pickup verified", "Your pickup code was verified."],
  trip_started: ["Trip started", "Your ride to the destination has started."],
  trip_enroute: ["On the way", "Your trip is en route to the drop-off."],
  trip_completed: ["Trip completed", "Your NEXRIDE trip is complete."],
  trip_cancelled: ["Trip cancelled", "The other participant cancelled the trip."],
  ride_request_cancelled: ["Ride request cancelled", "The rider cancelled the request."],
};

export async function deriveRideAlert({ event, uid, read, now = Date.now() }) {
  if (!event || event.app !== "nexride" || event.channel !== "push" || event.senderUid !== uid ||
      !Object.hasOwn(messages, event.type) || !validKey(uid)) return null;
  const recent = (timestamp) => typeof timestamp === "number" && timestamp <= now + 60_000 && now - timestamp <= RECENT_MS;
  if (!recent(event.createdAt)) return null;

  const { type, city, data = {} } = event;
  const { requestId, tripId, offerId } = data;
  const [title, body] = messages[type];
  const to = (recipients, path, subject) => ({
    recipients: [...new Set(recipients.filter((id) => validKey(id) && id !== uid))].sort(),
    path, title, body, dedupe: JSON.stringify([type, subject, uid]),
  });

  if (["ride_request_created", "ride_request_viewed", "ride_offer_sent", "ride_request_cancelled"].includes(type)) {
    if (!validKey(city) || !validKey(requestId)) return null;
    const request = await read(`rideRequests/${city}/${requestId}`);
    if (!request || !validKey(request.riderId)) return null;

    if (type === "ride_request_cancelled") {
      if (request.riderId !== uid || request.status !== "cancelled" || !recent(request.updatedAt)) return null;
      const [views, offers] = await Promise.all([read(`rideViews/${requestId}`), read(`rideOffers/${requestId}`)]);
      return to([...Object.keys(views ?? {}), ...Object.values(offers ?? {}).map((offer) => offer?.driverId)], "/driver", requestId);
    }

    if ((request.status || "open") !== "open" || !recent(request.createdAt)) return null;
    if (type === "ride_request_created") {
      if (request.riderId !== uid) return null;
      const drivers = await read(`driversOnline/${city}`);
      return to(Object.entries(drivers ?? {}).filter(([, driver]) =>
        driver?.online === true && now - Number(driver.lastSeen || driver.updatedAt || 0) <= ONLINE_MS
      ).map(([id]) => id), "/driver", requestId);
    }
    if (type === "ride_request_viewed") {
      if (!await read(`rideViews/${requestId}/${uid}`)) return null;
      return to([request.riderId], "/rider", requestId);
    }
    if (!validKey(offerId)) return null;
    const offer = await read(`rideOffers/${requestId}/${offerId}`);
    return offer?.driverId === uid ? to([request.riderId], "/rider", requestId) : null;
  }

  if (!validKey(tripId)) return null;
  const node = type === "trip_completed" ? "completedTrips" : type === "trip_cancelled" ? "cancelledTrips" : "activeTrips";
  const trip = await read(`${node}/${tripId}`);
  if (!trip || !validKey(trip.riderId) || !validKey(trip.driverId)) return null;
  if (type === "ride_offer_accepted") {
    return uid === trip.riderId && trip.status === "accepted" && recent(trip.createdAt)
      ? to([trip.driverId], "/driver", tripId) : null;
  }
  if (type === "trip_cancelled") {
    if (trip.status !== "cancelled" || !recent(trip.cancelledAt)) return null;
    if (trip.cancelledBy === "rider" && uid === trip.riderId) return to([trip.driverId], "/driver", tripId);
    if (trip.cancelledBy === "driver" && uid === trip.driverId) return to([trip.riderId], "/rider", tripId);
    return null;
  }
  if (uid !== trip.driverId) return null;
  const stage = {
    ride_request_accepted: [trip.status === "accepted", trip.createdAt],
    driver_arrived: [trip.status === "arrived", trip.arrivedAt],
    otp_verified: [trip.status === "picked", trip.pickedAt],
    trip_started: [trip.status === "picked", trip.pickedAt],
    trip_enroute: [trip.status === "enroute", trip.enrouteAt],
    trip_completed: [trip.status === "completed", trip.completedAt],
  }[type];
  return stage?.[0] && recent(stage[1]) ? to([trip.riderId], "/rider", tripId) : null;
}

export function rideAlertKey(subject) {
  const bytes = createHash("sha256").update("nexride:" + subject).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
