import { cert, getApps, initializeApp } from "firebase-admin/app";

export function getNexrideAdminApp() {
  const name = "nexride-operations";
  const { NEXRIDE_FIREBASE_SERVICE_ACCOUNT_JSON: credentials, NEXRIDE_FIREBASE_DATABASE_URL: databaseURL } = process.env;
  if (!credentials || !databaseURL) return null;
  return getApps().find((app) => app.name === name) ||
    initializeApp({ credential: cert(JSON.parse(credentials)), databaseURL }, name);
}
