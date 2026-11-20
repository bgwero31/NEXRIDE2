# NEXRIDE Evergreen Upgrade — 20 November 2026

This package is a modified **full copy of the latest uploaded NEXRIDE2-main source**, not a replacement Firebase project or new app ID.

## Direction

A NEXRIDE-branded ride-hailing product using an inDrive-style **fare negotiation marketplace** and Uber-style **live trip navigation**, but without copying either company's proprietary graphics or identity. Global surface design now uses forest green, neutral dark panels, high-contrast green actions, real map content, and consistent controls.

## Implemented changes

1. **Real-time trip state:** Driver Firebase subscription no longer ignores all updates for the same active trip ID. The rider's fresh `riderLive` data and trip status changes are now consumed.
2. **Rider location:** Rider's GPS location is explicitly passed to the map and shown as a separate pulsing pin.
3. **Driver location:** Rider sees assigned driver's live marker when valid coordinates exist. Driver sees their own vehicle marker.
4. **Pickup and destination:** Dedicated map pins represent the booked pickup and drop-off coordinates. These are not masqueraded as live GPS points.
5. **Nearby drivers and requests:** Online drivers appear on the rider map; valid open request pins appear on the driver map.
6. **Map routes:** Green Google Directions polylines, route refresh distance threshold, and correct route bounds (`result.routes[0].bounds`) for camera fitting. Failed routing does not hide an otherwise loaded Google map.
7. **Coordinate validation:** Missing, null, out-of-range and `(0,0)` point values cannot create misleading map markers.
8. **Ride matching:** Rider offer selection and driver direct acceptance use Firebase transactions to reduce two-driver acceptance races. A claim is rolled back on trip-creation failure.
9. **GPS reliability:** Drivers must obtain a location before going online. Missing/stale driver positions are filtered from rider nearby results. GPS warnings are shown instead of silently hiding pins.
10. **City continuity:** Rider's ongoing request keeps its original city subscription when GPS detects a nearby city change.
11. **Android:** Explicit foreground fine/coarse location permissions in `AndroidManifest.xml`. Existing Capacitor package and app ID retained.
12. **Design:** New `src/app/nexride-design.css` imported globally. Login, main maps, bottom sheets, drawer, profile/settings, booking, fare offers and other major components now share a design system. Native/web permissions screen is redesigned without a missing Tailwind dependency. Splash screen no longer auto-plays speech on every visit.
13. **Source smoke checks:** `npm run test:smoke` runs 12 dependency-free regression checks.

## Critical scope/verification notes

- **Source checks passed**: 12/12 source regression checks; 49 JavaScript/JSX/TS/TSX files parsed without syntax errors; Android manifest and stylesheets parsed successfully.
- **Not yet proven live**: The Next.js production build was not completed here. `npm ci --offline` failed because the dependency cache was incomplete; a subsequent network `npm ci` attempt timed out. No browser/device session or live Firebase backend was connected. These source changes have *not* been verified on two phones or uploaded to Vercel.
- **Firebase rules**: Transactions reduce ordinary matching races, but Firebase Realtime Database security rules must still enforce user ownership, rider/driver access, allowed status transitions and correct permissions server-side.
- **Google APIs**: The key being in Vercel does not prove that Directions/Maps/Places are enabled. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is intentionally sent to browsers, so restrict it by allowed HTTP referrers and Google APIs in Google Cloud; never treat it as a private server-side secret.
- **GPS and Android**: A native Capacitor app that loads the Vercel site still requires appropriate WebView/device permission handling. This package adds manifest permissions but does not prove all Android runtime permission dialogs work.
- **Payments**: Displayed cash/EcoCash/card options are app preferences; there is no claim of integrated real payment capture, payouts or automated settlement.
- **Safeguarding**: Keep the existing Android package identity and signing keys; don't create a new release signing key or overwrite production database rules without review.

## How to test

1. In project root run `npm ci`, `npm run test:smoke`, `npm run build` in a terminal with internet access.
2. Commit the entire modified source to the existing NEXRIDE GitHub repository and let Vercel redeploy. Confirm Vercel has the existing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and Firebase environment values.
3. Test on **two separate devices/accounts** with GPS enabled. Driver goes online in the same city. Rider sees own pulsing marker plus driver's car. Driver sees their own location and a newly posted request pickup pin.
4. Rider posts a request, driver offers or accepts. Verify both screens display pickup/drop-off and a real green Google route. Verify changes when rider/driver physically move.
5. Test acceptance, arrival, pickup OTP, started/picked, completed, cancelled, app refresh, offline/reconnect, and denied GPS.
6. Review Firebase RTDB rules, indexes, API restrictions and crash reports before releasing to real customers. For Android, run the app on a real device after the production Vercel update and rebuild/sync native project when necessary.

## Main modified files

- `src/app/driver/page.jsx`
- `src/app/rider/page.jsx`
- `src/components/maps/LiveGoogleMap.jsx`
- `src/components/rider/RiderMap.jsx`
- `src/components/driver/DriverMap.jsx`
- `src/app/nexride-design.css` (new)
- `src/app/layout.jsx`
- `src/lib/googleMaps.js`
- `src/lib/nexrideNative.js`
- `src/components/system/NexridePermissionGate.jsx`
- `src/components/system/NexrideSplash.jsx`
- `android/app/src/main/AndroidManifest.xml`
- `qa/verify-ride-cycle.mjs` (new)
- `package.json`

**Status:** source-level upgrade and checks completed; real-world acceptance test and release verification required.
