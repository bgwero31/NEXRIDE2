# NEXRIDE closed testing with Bubblewrap

Use package ID `com.nexride.app`. If you already created the NEXRIDE listing, confirm it uses that ID and use its assigned upload key and a version code greater than every previously uploaded code.

After deploying the web manifest, run these commands in a new folder on the computer where you build and sign the app:

```bash
npx @bubblewrap/cli@latest init --manifest=https://nexride-2.vercel.app/manifest.webmanifest
npx @bubblewrap/cli@latest build
```

Use the listed package ID and the NEXRIDE upload key when prompted. Keep the keystore and passwords outside the repository. Verify the generated bundle targets API 36 or higher before uploading it to Closed testing. Use the generated APK for direct device testing.

In Play Console, go to App integrity and copy the SHA-256 fingerprint under **App signing key certificate**. Set it as `NEXRIDE_ANDROID_CERT_FINGERPRINTS` in Vercel and redeploy. For local APK testing you may add the fingerprint of the actual APK signing key as a second, comma-separated entry. Verify the live response at `https://nexride-2.vercel.app/.well-known/assetlinks.json`. Until the correct certificate is linked, the wrapper can open with a browser toolbar.

The TWA uses NEXRIDE’s web app. Native Capacitor notifications are separate. Verify web push on two phones before presenting background ride alerts as a tested feature.
