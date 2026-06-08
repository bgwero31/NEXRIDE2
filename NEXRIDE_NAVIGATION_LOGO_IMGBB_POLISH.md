# NEXRIDE Navigation, Logo, IMGBB and Map Polish Upgrade

This upgrade focuses on making NEXRIDE feel closer to a real production ride-hailing app while keeping the brand fully NEXRIDE-only.

## Added / improved

- Replaced the fallback app mark with a new premium blue/black NEXRIDE logo SVG.
- Profile image upload now tries IMGBB first using `NEXT_PUBLIC_IMGBB_API_KEY`, then falls back to Firebase Storage.
- Added `NEXT_PUBLIC_IMGBB_API_KEY` to `.env.example`.
- Lightened the Google map so it stays visible and readable.
- Reduced the top cards and bottom sheet so they do not cover too much of the map.
- Added a faint glowing NEXRIDE logo watermark inside the top brand card.
- Strengthened the route polyline with dark casing, bright blue route, cyan highlight and direction arrows.
- Improved destination marker into a glowing premium pin.
- Improved car marker size and glow.
- Added stronger GPS accuracy guards to reduce wrong distance/ETA from weak location reads.
- Added `/trip/[tripId]/navigate` for a full-screen in-app NEXRIDE navigation mode.
- Added `NEXRIDE nav` links on rider and driver trip controls.

## Notes

The app still keeps the external `Open Google` link for official Google navigation. The new NEXRIDE navigation screen is an in-app map route mode for a smoother branded experience.
