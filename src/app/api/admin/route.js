import { getNexrideAdminApp } from "@/lib/nexrideAdminFirebase";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

export const runtime = "nodejs";
const key = (value) => typeof value === "string" && /^[\w-]{1,128}$/.test(value);
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function authorize(request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: "Sign in to open the admin dashboard." }, 401);
  const owners = process.env.NEXRIDE_ADMIN_UIDS;
  const app = getNexrideAdminApp();
  if (!app) return json({ error: "The admin dashboard needs Firebase server configuration." }, 503);
  const identity = await getAuth(app).verifyIdToken(token, true).catch(() => null);
  if (!identity) return json({ error: "Sign in again to continue." }, 401);
  if (identity.admin !== true && !owners?.split(",").map((uid) => uid.trim()).includes(identity.uid)) {
    return json({ error: "This account does not have admin access." }, 403);
  }
  return { db: getDatabase(app), uid: identity.uid };
}

const entries = (value) => Object.entries(value ?? {}).filter(([, item]) => item && typeof item === "object");
const read = async (db, path) => (await db.ref(path).get()).val();
const documents = { profilePhotoUrl: "Driver photo", licenceUrl: "Licence", nationalIdUrl: "National ID", vehiclePhotoUrl: "Vehicle photo" };

function storageUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === "https://firebasestorage.googleapis.com" ? url.href : null;
  } catch { return null; }
}

function ride(id, item, group, city = item.city) {
  return {
    id, group, city, status: item.status || "open",
    rider: item.riderName, driver: item.driverName, pickup: item.pickupName, dropoff: item.dropoffName,
    fare: item.agreedPrice ?? item.offerPrice, time: item.completedAt ?? item.updatedAt ?? item.createdAt,
  };
}

export async function GET(request) {
  try {
    const auth = await authorize(request);
    if (auth instanceof Response) return auth;
    const { db } = auth;
    const [profiles, applications, requests, active, completed, cancelled, drivers, deletionRequests] = await Promise.all(
      ["profiles", "driverVerification", "rideRequests", "activeTrips", "completedTrips", "cancelledTrips", "driversOnline", "accountDeletionRequests"].map((path) => read(db, path))
    );
    const online = new Set();
    for (const [, city] of entries(drivers)) {
      for (const [id, record] of entries(city)) {
        if (record.online && Date.now() - Number(record.lastSeen || record.updatedAt || 0) <= 90_000) online.add(id);
      }
    }
    const people = entries(profiles).filter(([, profile]) => ["driver", "rider"].includes(profile.role)).map(([id, profile]) => ({
      id, name: profile.fullName, role: profile.role, city: profile.city, phone: profile.phone,
      car: profile.carName, plate: profile.plateNumber, online: online.has(id),
      verification: applications?.[id]?.verificationStatus ?? profile.verificationStatus,
    }));
    const reviews = entries(applications).map(([id, item]) => ({
      id, name: item.fullName, city: item.city, phone: item.phone, car: item.carName, plate: item.plateNumber,
      status: item.verificationStatus || "pending", time: item.submittedAt,
      documents: Object.entries(documents).flatMap(([field, name]) => {
        const url = storageUrl(item[field]);
        return url ? [{ name, url }] : [];
      }),
    })).sort((a, b) => (b.time || 0) - (a.time || 0));
    const rides = [
      ...entries(requests).flatMap(([city, items]) => entries(items)
        .filter(([, item]) => !["matched", "accepted"].includes(item.status))
        .map(([id, item]) => ride(id, item, "request", city))),
      ...entries(active).map(([id, item]) => ride(id, item, "active")),
      ...entries(completed).map(([id, item]) => ride(id, item, "completed")),
      ...entries(cancelled).map(([id, item]) => ride(id, item, "cancelled")),
    ].sort((a, b) => (b.time || 0) - (a.time || 0));
    const deletions = entries(deletionRequests).map(([id, item]) => ({
      id, email: item.email, requestedAt: item.requestedAt,
    })).sort((a, b) => b.requestedAt - a.requestedAt);
    return json({ people, reviews, rides, deletions, adminUid: auth.uid });
  } catch {
    return json({ error: "Could not load operations. Check the Firebase server configuration and try again." }, 503);
  }
}

export async function POST(request) {
  try {
    const auth = await authorize(request);
    if (auth instanceof Response) return auth;
    const { db, uid } = auth;
    const input = await request.json().catch(() => null);
    if (!key(input?.id)) return json({ error: "Choose a valid record." }, 400);
    const { action, id, city, group, decision } = input;
    if (action === "review" && ["approved", "rejected"].includes(decision)) {
      const result = await db.ref(`driverVerification/${id}`).transaction((item) => {
        if (!item) return null;
        if ((item.verificationStatus || "pending") !== "pending") return;
        if (decision === "approved" && !Object.keys(documents).every((field) => storageUrl(item[field]))) return;
        return { ...item, verificationStatus: decision, reviewedAt: Date.now(), reviewedBy: uid };
      });
      if (!result.committed || !result.snapshot.exists()) return json({ error: "The application was already reviewed or required documents are missing." }, 409);
      return json({ ok: true });
    }
    if (action === "delete") {
      const path = group === "request" && key(city) ? `rideRequests/${city}/${id}`
        : group === "completed" ? `completedTrips/${id}`
        : group === "cancelled" ? `cancelledTrips/${id}` : null;
      if (!path) return json({ error: "Deletion is available for pending requests and finished rides." }, 400);
      const result = await db.ref(path).transaction((item) => {
        if (!item) return null;
        if (group === "request" && !["open", "cancelled"].includes(item.status || "open")) return;
        return null;
      });
      if (!result.committed) return json({ error: "The ride changed or was already removed." }, 409);
      if (group === "request") {
        await db.ref().update({ [`rideOffers/${id}`]: null, [`rideViews/${id}`]: null }).catch(() => {});
      }
      return json({ ok: true });
    }
    return json({ error: "Choose a valid action." }, 400);
  } catch {
    return json({ error: "The action could not be completed. Refresh the dashboard and try again." }, 503);
  }
}
