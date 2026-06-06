# NEXRIDE Real Trip Camera + Notifications Upgrade

This package upgrades NEXRIDE from a normal map page into a more real ride-hailing trip experience.

## Added

- Real trip camera mode
  - Driver mode follows the live driver car marker.
  - Rider trip mode follows the driver coming to pickup.
  - After pickup/OTP verification, routing switches to destination.
  - Completed trips show a final route summary.

- Better map markers
  - Rotating live car marker using GPS heading when the device provides heading.
  - Rider profile photo marker.
  - Driver photo badge on the car marker.
  - Glowing destination marker.
  - Nearby driver car markers on rider map.

- Trip phase routing
  - accepted / arrived: driver to rider pickup.
  - picked / enroute: driver to destination.
  - completed: pickup to destination final summary.

- Notification trigger queue prepared for OneSignal + Render
  - ride_request_created
  - ride_request_viewed
  - ride_offer_sent
  - ride_request_accepted
  - ride_offer_accepted
  - driver_arrived
  - otp_verified
  - trip_started
  - trip_enroute
  - trip_completed

## Important

For live GPS, users must allow location permission. Use the Vercel HTTPS link or installed PWA. Laptop GPS can be inaccurate; phone GPS is usually much better.

## Required environment variables

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT=https://your-render-service.onrender.com/nexride/notify
```

Google Cloud APIs required:

- Maps JavaScript API
- Directions API
- Geocoding API
- Places API

## Render/OneSignal note

The app writes every notification event to Firebase under:

```text
notificationQueue/{eventId}
```

If `NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT` is set, the app also POSTs the event payload to your Render service. Your Render service should read the event type and target user/role/city, then send the correct OneSignal push.
