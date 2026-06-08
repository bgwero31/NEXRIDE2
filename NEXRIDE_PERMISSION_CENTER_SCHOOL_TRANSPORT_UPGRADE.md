# NEXRIDE Permission Center + School Transport Upgrade

This upgrade adds the missing first-launch APK permission flow and the first NEXRIDE School module.

## Added

### APK permission center
- Global first-launch permission overlay in the APK.
- `/permissions` page for manual testing.
- Buttons to force:
  - GPS permission
  - OneSignal / local notification permission
  - NEXRIDE voice test
- More native helper functions in `NexrideNativeInit`:
  - `window.nexrideRequestGpsPermission()`
  - `window.nexrideRequestNotifications()`
  - `window.nexrideGetOneSignalState()`
  - `window.nexrideSpeak()`
  - `window.nexrideGetLocation()`
  - `window.nexrideWatchLocation()`

### NEXRIDE School
- `/school` main school transport landing page.
- `/school/admin` to register/manage:
  - schools
  - kombies/vehicles
  - drivers
  - children
  - fixed routes
  - kombi colors
  - monthly paid/unpaid status
- `/school/driver` for school transport driver mode:
  - start morning pickup route
  - start afternoon drop-off route
  - live GPS sharing
  - mark child boarded / dropped / absent
  - route completed
- `/school/parent` for parent tracking:
  - find children by parent phone
  - see assigned kombi, color, route and live status
  - live map with school vehicle location

### OneSignal-ready school events
School transport now queues events through the same `notificationQueue` system:
- school registered
- route started
- child boarded
- child absent
- arrived/dropped
- route completed
- emergency-ready event type

## Important
Real remote OneSignal push still needs the Render notification sender with your OneSignal REST API key. The app is now ready to register and queue events, but Render is the secure sender.

## After copying this upgrade
Run:

```bash
cd /e/NEXRIDE2-github
cp -a ../NEXRIDE2-main/. .
npm install
npx cap sync android
npm run dev
```

Then push:

```bash
git add .
git commit -m "Add NEXRIDE permission center and school transport module"
git push
```

After Vercel is ready, rebuild the APK in Android Studio.
