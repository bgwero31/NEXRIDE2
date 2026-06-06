# NEXRIDE Brand, GPS and Notifications Upgrade

This version removes competitor names from the user-facing app and keeps the product branded as NEXRIDE.

## Brand-safe copy
Visible app pages now use NEXRIDE wording only:
- NEXRIDE ride marketplace
- Smart fare offers
- NEXRIDE live tracking
- NEXRIDE trip flow

## Logo
A new local SVG logo was added at:

```txt
public/nexride-logo.svg
```

`NexrideBrand` now shows the logo mark next to the NEXRIDE wordmark on the top-left app bar and on login/signup.

## Driver verification
Driver signup now requires:
- profile photo
- driver licence
- national ID
- vehicle photo
- car name
- plate number

Files upload to Firebase Storage under:

```txt
driverVerification/{uid}/...
```

Verification metadata is saved to Realtime Database under:

```txt
driverVerification/{uid}
profiles/{uid}
```

## GPS live tracking
Driver GPS is written to:

```txt
driversOnline/{city}/{driverId}
activeTrips/{tripId}/driverLive
```

Rider GPS during pickup is written to:

```txt
activeTrips/{tripId}/riderLive
```

The driver map routes to the rider's live phone location before pickup when GPS permission is allowed.

## Notifications / Render / OneSignal preparation
The app now queues notification events into:

```txt
notificationQueue/{eventId}
```

If this environment variable is set, the app also POSTs each queued event to your Render notifier:

```env
NEXT_PUBLIC_NEXRIDE_NOTIFY_ENDPOINT=https://your-render-service.onrender.com/nexride/notify
```

Events prepared:
- ride request created
- driver viewed request
- driver sent offer
- driver accepted ride
- rider accepted offer
- rider cancelled request
- driver arrived
- OTP verified / trip started
- trip enroute
- trip completed

Your Render server can read `targetUid`, `targetRole`, `city`, `title`, `message`, `url`, and `data` from each payload and send the correct OneSignal push.
