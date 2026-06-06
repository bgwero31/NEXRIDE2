# NEXRIDE Map Markers + Live Recenter Upgrade

This upgrade focuses on the issue where Google Maps was visible but the live trip markers and route line were not obvious after accepting a ride.

## Fixed / improved

- Driver live GPS is now saved immediately when the driver goes online.
- Accepted trips now copy the driver's last known online GPS into `activeTrips/{tripId}/driverLive` immediately.
- Rider offer acceptance also copies the selected driver's last known GPS immediately.
- Google Maps now uses stronger custom markers for:
  - driver/current phone location
  - rider live pickup location
  - pickup point
  - destination point
  - open requests
- Route drawing now adds both:
  - a solid blue Google Directions route line
  - repeated blue directional arrows on top of the route
- The map now auto-follows the live phone marker.
- The map fits the route when the route loads, then pans back to the live marker as GPS updates.
- The dark map overlay was reduced so route/markers remain easier to see.

## Important testing note

Live route and marker accuracy depends on the browser/device GPS permission. On a laptop, Chrome can sometimes return an approximate location far from the real position, which can create a long route such as hundreds of kilometers. On an HTTPS phone deployment, GPS is normally much more accurate.

## Firebase paths used

- `driversOnline/{city}/{driverId}` stores live driver GPS while online.
- `activeTrips/{tripId}/driverLive` stores the driver GPS during the active trip.
- `activeTrips/{tripId}/riderLive` stores the rider GPS before pickup.
