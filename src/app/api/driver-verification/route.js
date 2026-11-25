import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getOperationsApp } from "../../../lib/nexrideOperations";

export const runtime = "nodejs";

export async function GET(request) {
  const headers = { "Cache-Control": "no-store" };
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  const driverId = new URL(request.url).searchParams.get("driverId");
  if (!token) return Response.json({}, { status: 401, headers });
  if (!driverId || !/^[\w-]{1,128}$/.test(driverId)) {
    return Response.json({}, { status: 400, headers });
  }

  try {
    const app = getOperationsApp();
    if (!app) return Response.json({}, { status: 503, headers });
    const identity = await getAuth(app).verifyIdToken(token, true).catch(() => null);
    if (!identity) return Response.json({}, { status: 401, headers });
    const status = await getDatabase(app).ref(`driverVerification/${driverId}/verificationStatus`).get();
    return Response.json({ verified: status.val() === "approved" }, { headers });
  } catch {
    return Response.json({}, { status: 503, headers });
  }
}
