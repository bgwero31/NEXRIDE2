# NEXRIDE Native GPS Voice Events Upgrade

This upgrade fixes the issue where the APK foundation existed but ride events did not use it.

## Added / changed

- `NexrideNativeInit` is loaded globally from `layout.jsx`.
- Native voice helper is used first through `window.nexrideSpeak`.
- Native GPS helper is used first through `window.nexrideGetLocation` and `window.nexrideWatchLocation`.
- Rider pickup now tries Capacitor GPS before browser GPS.
- Rider and driver live maps now use Capacitor GPS watch first.
- Native local notification fallback is added so stage events can show phone notifications while the Render/OneSignal server is not ready.
- `notificationQueue` is still written for Render/OneSignal remote push.
- `/device-check` page added for testing GPS, voice, network and notifications inside the APK.
- `www/offline.html` and `server.errorPath` included for a branded offline screen.

## Important

OneSignal SDK initialization lets the APK register for push. Real remote pushes to other phones still require a Render server with the OneSignal REST API key. Client apps cannot safely send OneSignal REST pushes directly.

## Required after copying this upgrade

```bash
cd /e/NEXRIDE2-github
npm install
npx cap sync android
git add .
git commit -m "Wire NEXRIDE native GPS voice and notification events"
git push
```

Then redeploy Vercel and rebuild the APK in Android Studio.

## Test page

Open this route inside the APK:

```text
/device-check
```

Tap:

- Test GPS
- Enable/test voice
- Test notification

