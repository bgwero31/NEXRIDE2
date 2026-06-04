# Premium Settings Upgrade

This version pushes NEXRIDE further toward a SendIt-style premium mobile product.

## Added

- New `/settings` page connected to Firebase Auth, `profiles/{uid}`, and `appSettings/{uid}`.
- Settings shortcut added to the floating top bar on rider, driver, admin, offers, and trip screens.
- Settings can update profile name, phone, city, driver vehicle info, ride defaults, payment preference, ride style, and notification preference.
- Rider request form now reads saved settings from local storage and includes payment + ride style in new ride requests.

## Premium UI upgrade

- Stronger blue/cyan glass design system.
- Premium global button styling with glow, gradient, shimmer, and pressed states.
- Shared ActionCard now forces app cards into the premium dark glass style instead of old light demo cards.
- Inputs/selects upgraded to darker glass fields.
- Top bar upgraded with a settings icon button.

## Firebase nodes used

- `profiles/{uid}` for live user profile details.
- `appSettings/{uid}` for app preferences.
- `rideRequests/{city}/{requestId}` now includes `preferredPayment` and `rideMode`.
