import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getNexrideAdminApp } from "@/lib/nexrideAdminFirebase";

export const runtime = "nodejs";
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: "Sign in to request account deletion." }, 401);
  try {
    const app = getNexrideAdminApp();
    if (!app) return json({ error: "Account deletion requests are temporarily unavailable." }, 503);
    const identity = await getAuth(app).verifyIdToken(token, true).catch(() => null);
    if (!identity || !/^[\w-]{1,128}$/.test(identity.uid)) return json({ error: "Sign in again and try once more." }, 401);
    const requestedAt = Date.now();
    const result = await getDatabase(app).ref(`accountDeletionRequests/${identity.uid}`).transaction((current) =>
      current || { requestedAt, email: identity.email || "" }
    );
    if (!result.committed) return json({ error: "The request could not be saved. Try again." }, 503);
    return json({ requestedAt: result.snapshot.val()?.requestedAt });
  } catch {
    return json({ error: "The request could not be saved. Try again." }, 503);
  }
}
