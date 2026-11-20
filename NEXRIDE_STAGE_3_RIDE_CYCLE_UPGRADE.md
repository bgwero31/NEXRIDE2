# NEXRIDE Stage 3 — Rider location pin and ride-cycle review

## Rider map pin fix
- `LiveGoogleMap` already supports a dedicated `riderLocation` prop and renders a custom pulsing rider marker.
- `RiderMap` was collecting `riderCurrentLocation` via `navigator.geolocation.watchPosition`, but did not pass that location into `LiveGoogleMap`.
- Stage 3 now passes `riderLocation={riderCurrentLocation}` so the rider's own position can render as the pulsing marker.
- During an active trip, the rider map also passes the live assigned driver location through `driverLocation`.

## Existing ride-cycle infrastructure found
The project already contains Firebase listeners and UI/state handling for:
- Rider ride requests under `rideRequests/{city}`.
- Driver offers under `rideOffers/{requestId}`.
- Driver request views under `rideViews/{requestId}`.
- Active trips under `activeTrips/{tripId}`.
- Completed trips under `completedTrips/{tripId}`.
- Driver online location under `driversOnline/{city}/{uid}`.
- Driver GPS broadcast and active-trip `driverLive` updates.
- Rider GPS broadcast to `activeTrips/{tripId}/riderLive` during accepted/arrived states.

## Important verification limits
This source-only update does not prove that the live Firebase security rules, database indexes, Google Maps billing/API enablement, deployed Vercel environment, Android permissions, or production build are correct. No live Firebase or Vercel credentials were accessed. Dependencies were not installed in this environment, so `next build` was not run.

## Next implementation/QA gates
1. Verify Firebase Realtime Database rules permit only the rider/assigned driver to read/write their trip data.
2. Verify the rider and driver agree on the same trip status vocabulary and transitions.
3. Exercise request → offer → rider selection → driver arrival → trip start → completion against a test Firebase project.
4. Test GPS permission denied, location unavailable, stale driver, offline/reconnect, and app background/resume.
5. Verify Google Maps JavaScript, Directions, Places/Geocoding as actually used, billing, referrer restrictions and Android key restrictions.
6. Run `npm ci`, `npm run build`, then Capacitor Android sync and device testing.
