const { chromium } = require('playwright-core');
const URL = 'http://localhost:8100/index.html';
const MAIL = `boost_${Math.random().toString(36).slice(2,7)}@example.de`;
const openSec = async (p, n) => {
  await p.evaluate((name) => {
    const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes(name));
    if (d && !d.open) d.open = true;
  }, n);
  await p.waitForTimeout(150);
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);

  // Registrieren (damit auch der Sync mitgeprüft wird)
  await p.click('[data-mode="signup"]'); await p.waitForTimeout(200);
  await p.fill('#regName', 'Booster'); await p.fill('#regMail', MAIL);
  await p.fill('#regPw', 'booster12345'); await p.fill('#regPw2', 'booster12345');
  await p.click('#doRegister'); await p.waitForTimeout(1200);

  // Frequenz eintragen, damit die Booster-Karte im Tagebuch erscheint
  await openSec(p, 'Morgenseite');
  await p.click('text=Mut'); await p.waitForTimeout(300);

  const vorhanden = await p.locator('[data-boost]').count();
  const ersteDrei = (await p.locator('[data-boost] .lbl').allTextContents()).slice(0, 3);
  console.log('Booster im Tagebuch:', vorhanden, '|', ersteDrei.join(' / '));

  // Zwei einzeln antippen
  await p.locator('[data-boost]').nth(0).click(); await p.waitForTimeout(350);
  await p.locator('[data-boost]').nth(2).click(); await p.waitForTimeout(350);
  console.log('Zähler:', await p.locator('.card .tag').first().textContent());
  const gespeichert = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    const k = Object.keys(s.journal).sort().pop();
    return s.journal[k].day.booster;
  });
  console.log('Gespeichert:', JSON.stringify(gespeichert));

  // Abwählen funktioniert auch
  await p.locator('[data-boost]').nth(0).click(); await p.waitForTimeout(350);
  console.log('Nach Abwählen:', JSON.stringify(await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    return s.journal[Object.keys(s.journal).sort().pop()].day.booster;
  })));

  // Eigenen Booster ergänzen (Frequenz-Ansicht)
  await p.click('a[href="#/frequenz"]'); await p.waitForTimeout(300);
  await p.fill('#newBooster', 'Kaltdusche');
  await p.click('#addBooster'); await p.waitForTimeout(400);
  const mitEigenem = await p.locator('[data-boost]').count();
  await p.locator('[data-boost]').last().click(); await p.waitForTimeout(400);
  console.log('Eigener Booster:', mitEigenem, 'Einträge | abgehakt:', JSON.stringify(await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    return { custom: s.customBoosters, heute: s.journal[Object.keys(s.journal).sort().pop()].day.booster };
  })));
  await p.screenshot({ path: 'boost-frequenz.png', fullPage: true });

  // Synchronisieren und auf zweitem Gerät prüfen
  await p.click('a[href="#/mehr"]'); await p.waitForTimeout(250);
  await p.click('#btnSync'); await p.waitForTimeout(1300);

  const p2 = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p2.goto(URL, { waitUntil: 'networkidle' }); await p2.waitForTimeout(300);
  await p2.click('[data-mode="login"]'); await p2.waitForTimeout(200);
  await p2.fill('#logMail', MAIL); await p2.fill('#logPw', 'booster12345');
  await p2.click('#doLogin'); await p2.waitForTimeout(1800);
  console.log('Gerät 2:', JSON.stringify(await p2.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    return { custom: s.customBoosters, heute: s.journal[Object.keys(s.journal).sort().pop()].day.booster };
  })));

  // Textexport enthält die Booster
  const txt = await p2.evaluate(() => journalAsText());
  console.log('Im Textexport:', txt.includes('Frequenz-Booster:'));
  await b.close();
})();
