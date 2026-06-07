# NEXRIDE Light Map + Profile Menu Upgrade

This upgrade makes the ride experience more map-first and easier to use:

- Light Google map style so roads, labels, landmarks and the route are easier to see.
- Strong custom route polyline: white halo + NEXRIDE blue route + direction arrows.
- Auto GPS pickup on rider request flow so riders mainly choose destination and fare.
- Live map preview while typing destination.
- Rider/driver markers and glowing destination marker remain visible on the light map.
- Top-right hamburger menu with profile image, profile, completed rides, notifications, safety, settings, help and support.
- New `/profile` page with completed ride history, distance, time, person and amount.
- Added `/safety`, `/help`, `/support`, and `/notifications` pages.
- Rider can cancel a live trip; cancelled trips are moved to `cancelledTrips/{tripId}` and a notification event is queued.

Keep using `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for real maps.
