// Brand assignment checks for device.js.
//
// Brand matching falls back to the app's display name because the hardcoded
// Tizen IDs are unverified guesses. That fallback must never let one app take
// another's identity: a brand makes an app primary, and main.js rebinds the
// branded tile's launch target to whichever app claims it.
//
// Run: node scripts/check-brands.mjs
import { readFileSync } from 'node:fs';
const src = readFileSync('app/device.js', 'utf8');

function run(list) {
  const win = {};
  const tizen = { application: { getAppsInfo: (ok) => ok(list) } };
  new Function('window', 'tizen', 'setTimeout', 'clearTimeout', src)(
    win, tizen, (fn) => 0, () => {});
  win.tizen = tizen;
  let out = null;
  win.FrameDevice.apps((e, r) => { out = r; });
  return out;
}

const REAL = [
  { id: 'org.tizen.netflix-app', name: 'Netflix', show: true, iconPath: '/n.png' },
  { id: 'AbCdEfGhIj.YouTube',    name: 'YouTube', show: true, iconPath: '/y.png' },
  { id: 'QwErTyUiOp.Tubi',       name: 'Tubi - Free Movies & TV', show: true, iconPath: '/t.png' },
];
const ATTACK = [
  { id: 'ZzZzZzZzZz.Evil', name: 'Netflix Free Movies', show: true, iconPath: '/e.png' },
  ...REAL,
];

for (const [label, list] of [['legitimate only', REAL], ['with impostor', ATTACK]]) {
  console.log('\n=== ' + label + ' ===');
  for (const r of run(list)) console.log(`  ${r.brand.padEnd(12)} <- ${r.appId.padEnd(26)} "${r.name}"`);
}

const got = run(ATTACK);
const netflix = got.find(r => r.brand === 'netflix');
console.log('\nnetflix brand bound to :', netflix ? netflix.appId : '(none)');
console.log('HIJACK BLOCKED         :', netflix && netflix.appId === 'org.tizen.netflix-app' ? 'YES' : 'NO *** FAIL ***');
const impostor = got.find(r => r.appId === 'ZzZzZzZzZz.Evil');
console.log('impostor brand         :', impostor ? `"${impostor.brand}" (listed, unbranded)` : '(filtered out)');

if (!netflix || netflix.appId !== 'org.tizen.netflix-app') { console.error('FAIL: brand hijack'); process.exit(1); }
if (impostor && impostor.brand) { console.error('FAIL: impostor kept a brand'); process.exit(1); }
if (!got.some(r => r.brand === 'youtube') || !got.some(r => r.brand === 'tubi')) {
  console.error('FAIL: legitimate name matching regressed'); process.exit(1);
}
console.log('\nbrand checks passed');
