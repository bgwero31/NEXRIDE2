# NEXRIDE merged visible-map + school upgrade

This package uses the visible light Google Map / collapsible bottom-sheet UI as the base, then adds:
- NEXRIDE School pages: `/school`, `/school/admin`, `/school/driver`, `/school/parent`
- Hamburger menu links for School Transport and Device Permissions
- Permission Center pages/components
- Native helper files for GPS/Voice/OneSignal foundation
- JSON Capacitor config only; no TypeScript config
- `node_modules` is excluded

After copying into your repo:
```bash
cd /e/NEXRIDE2-github
cp -a ../NEXRIDE2-main/. .
rm -f capacitor.config.ts
git status
npm run dev
```

Open:
- `http://localhost:3000/rider` to confirm visible map and collapsible request sheet
- `http://localhost:3000/school` to open school module

Then push:
```bash
git add .
git commit -m "Merge visible map UI with NEXRIDE school transport"
git push
```
