# NEXRIDE Google Maps Live Route Upgrade

This version upgrades the NEXRIDE NEXRIDE Smart Ride flow with real Google Maps support.

## Added

- Real Google Maps JavaScript map layer.
- Real driving route drawing with Google Directions.
- Real route distance and ETA.
- Google route preview before posting a ride request.
- Ride request saves pickup/dropoff coordinates when Google can resolve them.
- Ride request saves `distanceText`, `durationText`, `distanceMeters`, `durationSeconds`, `mapsUrl` and `routeSource`.
- Rider map shows live distance/ETA and an **Open in Google Maps** button.
- Driver map shows live request markers where coordinates exist.
- Driver active trip map routes to pickup first, then destination after pickup starts.
- Driver GPS updates `driversOnline/{city}/{driverId}` and active trip `driverLive`.
- `/trip/[tripId]` now uses the live Google map layer instead of a static placeholder.
- Premium fallback map remains active when no Google Maps API key is configured.

## Required environment variable

Create this variable locally and in Vercel:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_browser_key_here
```

## Google APIs to enable

On the same Google Cloud project/key, enable:

- Maps JavaScript API
- Directions API
- Geocoding API
- Places API

## Local setup

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000/login
```

## Important

Without the API key, the app still opens and uses the premium NEXRIDE fallback map. With the key, it switches to real Google Maps route drawing, ETA and distance.
