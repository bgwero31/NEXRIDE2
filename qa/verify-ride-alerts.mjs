import assert from "node:assert/strict";
import { deriveRideAlert, rideAlertKey } from "../src/lib/nexrideAlertDelivery.mjs";

const now = 10_000_000;
const records = {
  "activeTrips/trip": { driverId: "driver", riderId: "rider", status: "arrived", arrivedAt: now },
  "rideRequests/zvishavane/request": { riderId: "rider", status: "open", createdAt: now },
  "driversOnline/zvishavane": {
    driver: { online: true, updatedAt: now },
    stale: { online: true, updatedAt: now - 100_000 },
    offline: { online: false, updatedAt: now },
  },
};
const read = async (path) => records[path];
const event = {
  app: "nexride", channel: "push", senderUid: "driver", type: "driver_arrived",
  createdAt: now, targetUid: "unrelated", message: "arbitrary message", data: { tripId: "trip" },
};
const check = (value, uid = "driver") => deriveRideAlert({ event: value, uid, read, now });
const alert = await check(event);
assert.deepEqual(alert.recipients, ["rider"]);
assert.equal(alert.body, "Your driver is at the pickup point.");
assert.equal(await check(event, "unrelated"), null);
assert.equal(await check({ ...event, senderUid: "unrelated" }, "unrelated"), null);
assert.equal(await check({ ...event, type: "trip_started" }), null);
assert.equal(await check({ ...event, createdAt: now - 1_000_000 }), null);
assert.equal(await check({ ...event, data: { tripId: "a/b" } }), null);

const newRide = await check({
  ...event, senderUid: "rider", type: "ride_request_created", city: "zvishavane", data: { requestId: "request" },
}, "rider");
assert.deepEqual(newRide.recipients, ["driver"]);
assert.equal(newRide.path, "/driver");
assert.equal(rideAlertKey(alert.dedupe), rideAlertKey((await check(event)).dedupe));
assert.match(rideAlertKey(alert.dedupe), /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
console.log("Ride alert authorization, targeting, expiry, and deduplication passed.");
