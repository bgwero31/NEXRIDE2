# NEXRIDE Stage 2 – Rider map and nearby-driver visibility

## Changes
- Replaced the light Google Maps style with a restrained dark-green map palette.
- Added map overlays for every fresh, online driver received from `driversOnline/<cityKey>` on the rider map.
- Kept the active trip driver marker separate from nearby-driver markers.
- Preserved the existing Next.js, React, Firebase Realtime Database, Google Maps and Capacitor architecture.
- Preserved the existing 120 m route-refresh threshold and stale Directions response guard.

## Data and visibility behavior
- RiderMap subscribes to `driversOnline/<normalized city>`.
- Only online records with numeric latitude/longitude are eligible.
- Records with a lastSeen/updatedAt timestamp older than 90 seconds are filtered out.
- All eligible records are passed to LiveGoogleMap and rendered as nearby vehicle pins.
- The active trip driver continues to use the prominent live-driver marker.

## Important verification
This is a source-level upgrade. A production build and live Firebase/Google Maps test have not been completed in this environment because `npm ci` did not finish before the execution timeout. Verify the following after installing dependencies:
1. `npm run build`
2. Ensure Google Maps JavaScript API is enabled for the Vercel key and its allowed referrers include the deployed domain.
3. Confirm `driversOnline/<cityKey>` records contain `online`, numeric `lat`/`lng`, and current `lastSeen` or `updatedAt` timestamps.
4. Test with multiple online driver accounts in the same city and confirm each appears on the rider map.
5. Test trip acceptance and confirm the assigned driver's prominent marker remains distinct from nearby pins.
