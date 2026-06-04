# NEXRIDE Uber + inDrive Merge Upgrade

This version changes NEXRIDE into a map-first ride app direction:

- Uber-style login animation with NEXRIDE blue/black gradient branding.
- NEXRIDE brand stays top-left through the main app top bars.
- Rider page is map-first with route line, pickup/destination pins, driver pins, and bottom request sheet.
- Rider request flow is inDrive-style: pickup, destination, custom fare, payment, ride style, notes.
- Driver page is map-first with nearby ride request marketplace.
- Driver automatically records a view to `rideViews/{requestId}/{driverId}` when online and seeing a request.
- Rider sees driver view count, offer count, fare, and nearby driver count.
- Drivers can accept the rider fare directly or send a counter offer.
- Rider can accept an offer and create an active trip.
- Active trip includes OTP pickup verification, driver details, payment, ride style, and trip timeline.
- Settings remain connected through `appSettings/{uid}` and localStorage defaults.

Key Realtime Database paths used:

- `profiles/{uid}`
- `appSettings/{uid}`
- `driversOnline/{city}/{driverId}`
- `rideRequests/{city}/{requestId}`
- `rideViews/{requestId}/{driverId}`
- `rideOffers/{requestId}/{offerId}`
- `activeTrips/{tripId}`
- `completedTrips/{tripId}`

Important: this is a premium no-map-library prototype. It gives the Uber/inDrive feeling without adding Google Maps or Mapbox dependencies. Real turn-by-turn navigation can be added later with Google Maps/Mapbox APIs.
