# NEXRIDE Android ride alerts

Set `NEXT_PUBLIC_ONESIGNAL_APP_ID` to the NEXRIDE app ID in the web deployment, then redeploy. Configure Firebase Cloud Messaging for the OneSignal app that handles `com.nexride.app`. A web deployment supplies the app's screens and a rebuilt Android app supplies the Capacitor OneSignal plugin. Run `npx cap sync android` after installing dependencies, and build the Android app. Open **Ride alerts** from the menu to grant permission and check the device subscription. Signing in binds the subscription to the Firebase user ID as the OneSignal external ID.

## Notification relay

Set `NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT` to the deployed relay URL. The app saves events in Firebase Realtime Database under `notificationQueue/{id}` and sends the relay a JSON POST with a Firebase ID token in the Authorization header. The relay must permit the NEXRIDE deployment origin and the Authorization and Content-Type headers. Keep the OneSignal app API key on the relay.

The relay must verify the Firebase token, check the event sender and the corresponding persisted ride or offer, and derive recipients and text from trusted records before delivering. Never use a caller-supplied recipient list as authorization. Use the queue ID for deduplication across HTTP and queue retries. For direct delivery, target OneSignal external IDs. For a new ride request, look up online drivers in its city. For request cancellation, use the drivers who viewed or made offers on the request. Set the OneSignal notification data path to the appropriate app screen, such as `/rider` or `/driver`. A relay can process queue records independently to handle events when the app loses its connection. Only the relay should record provider response status.

Test with a rider and driver on separate Android devices. Check a new request, a first view, a counteroffer, acceptance, arrival, OTP verification, trip start, en route, completion, and cancellation. Verify that background notifications reach the other participant and that tapping takes them to the matching screen.

## Built-in ride-alert relay

The Next.js application provides `POST /api/ride-alerts`. Leave `NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT` empty to use it. Add `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `NEXRIDE_FIREBASE_DATABASE_URL`, and `NEXRIDE_FIREBASE_SERVICE_ACCOUNT_JSON` as server environment variables. The service account must belong to the same Firebase project as the app and have access to read the ride and alert records. Set `NEXT_PUBLIC_ONESIGNAL_APP_ID` to the same app ID, then redeploy. Keep the service-account JSON and REST API key out of client configuration.

The built-in relay handles ride events. It checks the signed-in sender, the current ride state, and recent timestamps, then derives recipient IDs and message content on the server. Configure Realtime Database rules so only authorized participants can write the corresponding ride records and event records. The endpoint reports provider acceptance. Confirm device delivery separately. This endpoint processes live requests and does not drain historical queue entries.

The live map displays a blue dotted connection while it requests road geometry from Google Directions. A solid blue line appears when Google returns a driving route. The dotted line indicates the direction to the next stop.
