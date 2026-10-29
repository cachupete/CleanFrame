// Dev-only: render the home screen with a chosen wallpaper and save a PNG.
// Usage: node scripts/shot-wallpaper.mjs <wallpaperId> [outfile]
import { openPreview, root } from './browser.mjs';

const id = process.argv[2] || 'curious';
const out = process.argv[3] || root + `.local/shots/${id}.png`;

const preview = await openPreview();
try {
  const page = await preview.browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });

  // Seed preferences before the app boots so it starts on this wallpaper.
  await page.addInitScript(wall => {
    try {
      localStorage.setItem('cleanframe.home.v1', JSON.stringify({
        version: 2,
        look: { bg: 'photo', layout: 'dock', apps: 'both', font: 'manrope',
                controls: 'icons', focus: 'glass', material: 'frost' },
        wallpaper: wall,
        mode: 'fixed',
      }));
    } catch (e) { /* private mode: fall through to defaults */ }
  }, id);

  await page.goto(preview.baseURL + '/home/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const applied = await page.evaluate(() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('cleanframe.home.v1') || 'null'); } catch (e) {}
    return { saved, title: document.title };
  });

  await page.screenshot({ path: out });
  console.log('wallpaper requested :', id);
  console.log('saved prefs         :', JSON.stringify(applied.saved));
  console.log('screenshot          :', out);
  if (problems.length) console.log('PAGE PROBLEMS:\n  ' + problems.join('\n  '));
  else console.log('no page errors');
} finally {
  await preview.close?.();
  process.exit(0);
}
