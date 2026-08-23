const { chromium } = require('playwright-core');
const URL = 'http://localhost:8100/index.html';
const R = Math.random().toString(36).slice(2,7);
const MAIL = `push_a_${R}@example.de`;
const MAIL2 = `push_b_${R}@example.de`;

async function anmelden(ctx, mail) {
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  await p.click('[data-mode="signup"]'); await p.waitForTimeout(200);
  await p.fill('#regName', 'Push'); await p.fill('#regMail', mail);
  await p.fill('#regPw', 'pushpush123'); await p.fill('#regPw2', 'pushpush123');
  await p.click('#doRegister'); await p.waitForTimeout(1300);
  await p.click('a[href="#/mehr"]'); await p.waitForTimeout(400);
  return p;
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

  // --- ohne hinterlegten VAPID-Schlüssel ---
  const ctx1 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p1 = await anmelden(ctx1, MAIL);
  console.log('1 ohne Schlüssel – Status:', (await p1.textContent('#remStatus')).trim());
  console.log('1b Knopf gesperrt:', await p1.locator('#remToggle').isDisabled(),
              '| Zeitfelder gesperrt:', await p1.locator('#remMorning').isDisabled());
  await p1.screenshot({ path: 'push-ohne-key.png', fullPage: true });

  // --- mit Schlüssel, ohne Erlaubnis ---
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(() => {
    window.__cfgPatch = true;
  });
  // Schlüssel per config-Override simulieren
  await ctx2.route('**/config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.FREQUENZ_CONFIG = { url: "http://localhost:8123", anonKey: "sb_publishable_TESTKEY_1234567890", vapidPublicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" };'
  }));
  await ctx2.grantPermissions(['notifications'], { origin: 'http://localhost:8100' });
  const p2 = await anmelden(ctx2, MAIL2);
  console.log('2 mit Schlüssel – Status:', (await p2.textContent('#remStatus')).trim(),
              '| Knopf gesperrt:', await p2.locator('#remToggle').isDisabled());

  // Zeiten ändern (auch ohne aktive Anmeldung speicherbar)
  await p2.fill('#remMorning', '06:45'); await p2.dispatchEvent('#remMorning', 'change'); await p2.waitForTimeout(600);
  await p2.fill('#remEvening', '22:15'); await p2.dispatchEvent('#remEvening', 'change'); await p2.waitForTimeout(600);
  console.log('3 Zeiten gespeichert:', JSON.stringify(await p2.evaluate(() =>
    JSON.parse(localStorage.getItem('frequenz-app-v1')).reminders)));

  // Einschalten versuchen – im Headless-Browser gibt es keinen echten Push-Dienst
  await p2.click('#remToggle'); await p2.waitForTimeout(2500);
  const nachher = await p2.evaluate(() => ({
    status: (document.querySelector('#remStatus') || {}).textContent,
    enabled: (JSON.parse(localStorage.getItem('frequenz-app-v1')).reminders || {}).enabled,
    erlaubnis: Notification.permission
  }));
  console.log('4 nach Einschalten:', JSON.stringify(nachher));
  console.log('   (im Headless-Browser ohne Push-Dienst erwartet: Fehlermeldung statt Absturz)');

  // Zeiten überstehen einen Neustart und wandern in den Sync
  await p2.reload({ waitUntil: 'networkidle' }); await p2.waitForTimeout(600);
  await p2.click('a[href="#/mehr"]'); await p2.waitForTimeout(400);
  console.log('5 nach Neuladen:', await p2.inputValue('#remMorning'), '/', await p2.inputValue('#remEvening'));
  await p2.click('#btnSync'); await p2.waitForTimeout(1200);

  const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx3.route('**/config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.FREQUENZ_CONFIG = { url: "http://localhost:8123", anonKey: "sb_publishable_TESTKEY_1234567890", vapidPublicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" };'
  }));
  const p3 = await ctx3.newPage();
  await p3.goto(URL, { waitUntil: 'networkidle' }); await p3.waitForTimeout(300);
  await p3.click('[data-mode="login"]'); await p3.waitForTimeout(200);
  await p3.fill('#logMail', MAIL2); await p3.fill('#logPw', 'pushpush123');
  await p3.click('#doLogin'); await p3.waitForTimeout(1800);
  console.log('6 Zeiten auf Gerät 2:', JSON.stringify(await p3.evaluate(() =>
    JSON.parse(localStorage.getItem('frequenz-app-v1')).reminders)));

  // Service Worker: Push-Handler vorhanden und Mitteilung wird gezeigt
  const swQuelle = await p3.evaluate(async () => (await (await fetch('sw.js')).text()));
  console.log('7 SW hat push-Handler:', swQuelle.includes('addEventListener("push"'),
              '| notificationclick:', swQuelle.includes('notificationclick'));
  const gezeigt = await p3.evaluate(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Test', { body: 'x' });
      const n = await reg.getNotifications();
      const anzahl = n.length;
      n.forEach(x => x.close());
      return anzahl;
    } catch (e) { return 'Fehler: ' + e.message; }
  });
  console.log('8 Mitteilung anzeigbar:', gezeigt);
  await b.close();
})();
