/** Dependency-free source regression checks.
 * These checks do NOT replace Next.js build or live Firebase integration tests.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const map=read('src/components/maps/LiveGoogleMap.jsx');
const driver=read('src/app/driver/page.jsx');
const rider=read('src/components/rider/RiderMap.jsx');
const driverMap=read('src/components/driver/DriverMap.jsx');
const riderPage=read('src/app/rider/page.jsx');
const google=read('src/lib/googleMaps.js');
const android=read('android/app/src/main/AndroidManifest.xml');
const layout=read('src/app/layout.jsx');
const checks=[
 ['rider live GPS passed to map',rider.includes('riderLocation={riderCurrentLocation}')],
 ['rider displays assigned driver separately',rider.includes('driverLocation={tripData ? driverLive : null}')],
 ['driver receives updated trip GPS snapshots',driver.includes('setActiveTrip(mine);') && !driver.includes('if (mineId === lastActiveTripIdRef.current) return')],
 ['driver sees true rider GPS instead of spoofed pickup',driverMap.includes('riderLocation={activeTrip ? riderLive : null}') && !driverMap.includes('toLatLng(activeTrip?.riderLive) || toLatLng(fallbackPickup)')],
 ['pickup and destination have dedicated map pins',map.includes('renderPlacePin(div, "Pickup"') && map.includes('renderPlacePin(div, "Drop-off"')],
 ['open ride request pins rendered',map.includes('markers = []') && map.includes('"Ride request"')],
 ['Google Directions route bounds corrected',map.includes('result.routes[0].bounds') && !map.includes('fitBounds(leg.bounds')],
 ['trip matching uses a transaction',driver.includes('runTransaction(requestNode') && riderPage.includes('runTransaction(requestNode')],
 ['invalid empty coordinates filtered',google.includes('value.lat == null || value.lng == null')],
 ['Android foreground GPS declared',android.includes('ACCESS_FINE_LOCATION') && android.includes('ACCESS_COARSE_LOCATION')],
 ['new theme active',layout.includes('nexride-design.css')],
 ['GPS permission notice shown',rider.includes('nx-gps-hint') && driverMap.includes('nx-gps-hint')],
];
for(const [label,ok] of checks){ console.log(`${ok?'PASS':'FAIL'}  ${label}`); }
assert.ok(checks.every(([,ok])=>ok),'One or more source checks failed');
console.log(`Passed ${checks.length} source checks. Live testing is still required.`);
