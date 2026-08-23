const { chromium, devices } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  // iPhone-ähnlicher Viewport
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  // Service Worker registriert?
  const sw = await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r ? (r.active ? 'active' : 'installing') : 'keine';
  });
  // Manifest erreichbar + Icons
  const mf = await p.evaluate(async () => {
    const r = await fetch('manifest.webmanifest');
    return r.ok ? await r.json() : null;
  });
  const iconOk = await p.evaluate(async () => {
    const r = await fetch('icon-180.png');
    return r.ok && r.headers.get('content-type');
  });
  // Kein horizontales Scrollen
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // Inputs >= 16px (sonst zoomt iOS beim Fokus rein)
  const smallInputs = await p.evaluate(() =>
    [...document.querySelectorAll('input,textarea,select')]
      .map(el => parseFloat(getComputedStyle(el).fontSize))
      .filter(s => s < 16).length);
  console.log('Service Worker:', sw);
  console.log('Manifest:', mf && mf.name, '| display', mf && mf.display, '| start_url', mf && mf.start_url);
  console.log('apple-touch-icon 180:', iconOk);
  console.log('Horizontaler Überlauf (px):', overflow);
  console.log('Inputs unter 16px (iOS-Zoom-Falle):', smallInputs);
  console.log('Fehler:', errs.length ? errs : 'keine');
  await p.screenshot({ path: 'ios-view.png' });
  await b.close();
})();
