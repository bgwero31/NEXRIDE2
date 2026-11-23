# NEXRIDE Google Play release

Package `com.nexride.app`, Android target API 36. Confirm the package and highest uploaded version code in Play Console before signing. The repository defaults to version code 1 for an initial upload. For an existing listing, pass a higher version code and use its existing upload key. Create a new upload key only for an initial listing with no assigned upload key.

## Build the AAB

Install Android SDK Platform 36, current Android build tools, and JDK 21. From the repository root run `npm ci` and `npx cap sync android`. Configure these local environment variables outside Git: `NEXRIDE_UPLOAD_KEYSTORE` (absolute path), `NEXRIDE_UPLOAD_STORE_PASSWORD`, `NEXRIDE_UPLOAD_KEY_ALIAS`, and `NEXRIDE_UPLOAD_KEY_PASSWORD`. Then run `cd android` and `gradlew.bat bundleRelease -PnexrideVersionCode=1 -PnexrideVersionName=1.0` on Windows. Replace version values with the ones for the actual release. The AAB is under `android/app/build/outputs/bundle/release/`. Check its certificate with `jarsigner -verify -verbose -certs app-release.aab` before uploading. Enable Play App Signing in the NEXRIDE listing.

## Activate free ride notifications

Use the existing OneSignal integration on the Free plan, subject to its monthly active-user limit. Add the Firebase Android app for `com.nexride.app` to the same Firebase project and configure Android FCM in the NEXRIDE OneSignal dashboard. Set `NEXT_PUBLIC_ONESIGNAL_APP_ID` and `ONESIGNAL_APP_ID` to the NEXRIDE OneSignal app ID. Set `ONESIGNAL_REST_API_KEY`, `NEXRIDE_FIREBASE_SERVICE_ACCOUNT_JSON`, and `NEXRIDE_FIREBASE_DATABASE_URL` as server settings in Vercel. Keep the REST key and service account out of Git and the Android bundle. Leave `NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT` unset to use the built-in relay. Verify rider and driver external IDs in OneSignal and test signed Android builds on two phones with the screens locked.

## Store listing

Name: NEXRIDE

Short description: Request a ride, agree on a fare, and track your driver.

Full description: NEXRIDE connects riders with nearby drivers in supported cities. Set a pickup and destination, propose a fare, compare offers, and choose a driver. Follow pickup and trip progress on the live map, and use a pickup code when you meet your driver.

The 512 × 512 icon is `google-play-icon.png`. Capture actual Android screens for the listing and prepare the feature graphic. Avoid advertising a first free ride unless the offer is active and its terms are published.

## Before inviting testers

- Deploy this branch after review, then verify sign-up, sign-in, GPS, matching, OTP pickup, cancellation, trip completion, notifications, offline recovery and the account-deletion flow with test accounts. The Android app loads the deployed web app, so the release test must use the matching deployment.
- Publish a privacy policy with the operator name, working contact, actual retention periods, handling of driver documents and minors’ school transport data if enabled, and named service providers. Review Firebase Storage and Realtime Database access rules against the release data. Driver ID and licence documents require restricted access.
- Submit Data safety based on actual collection and sharing. Review identity and contact data, ride and location data, profile photos, driver documents, and notifications or device identifiers. Audit Firebase, Google Maps, OneSignal, and ImgBB use before selecting answers.
- Add `https://nexride-2.vercel.app/delete-account` as the web deletion link after deployment. Confirm a request appears under **Account deletion requests** in the admin dashboard and assign an operator to process requests. The feature records requests for manual processing. For each request, check active rides and any valid retention obligations, remove the account and associated personal data in Auth, RTDB, Storage, and any connected vendors, confirm with the user, and remove the pending queue entry in Firebase after resolution. Do not tell a user that a request has been completed before the associated data has been handled.
- Create reviewer test accounts and enter working credentials and test instructions in **App access**. Complete content rating, ads declaration, and other App content questions based on the tested release.
- Upload the signed AAB to an internal test first. Follow the closed-testing requirements shown for your Play account before requesting production access.
