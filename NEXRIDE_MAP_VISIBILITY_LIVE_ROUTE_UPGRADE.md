# NEXRIDE Map Visibility + Live Route Upgrade

This package keeps all visible app wording under the NEXRIDE brand only.

## What changed

- Reduced map overlay card sizes so the map stays visible.
- Added collapsible bottom sheets on rider and driver pages.
- Added a toggle: show details / hide details to see map.
- Added live Google Maps route arrows on the route line.
- Added live distance and ETA from Google Directions to map cards and trip sheets.
- Hid the custom fallback pins/route once real Google Maps loads, so the real map is clean.
- Added profile photo support on the top-left NEXRIDE badge.
- Added profile photo upload from Settings for rider and driver accounts.
- Added driver photo support in request views, offers, and active trips.
- Added rider popup when a driver views a request.

## Required setup

Google Maps still requires:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

Firebase Storage must be enabled for profile photo and driver document uploads.
