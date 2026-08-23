const { chromium } = require('playwright-core');
const B = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8100/index.html';
const R = Math.random().toString(36).slice(2,7);
const MAIL = `sync_${R}@example.de`;
const MAIL_B = `fremd_${R}@example.de`;
const CFG = { url: 'http://localhost:8123', anonKey: 'anon_public_key_for_testing_1234567890' };

async function device(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(`[${label}] PAGEERROR`, e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  return { ctx, p };
}
const openSec = async (p, n) => {
  await p.evaluate((name) => {
    const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes(name));
    if (d && !d.open) d.open = true;
  }, n);
  await p.waitForTimeout(120);
};

(async () => {
  const b = await chromium.launch({ executablePath: B, args: ['--no-sandbox'] });

  // ---------- Gerät A: iPhone ----------
  const A = await device(b, 'A');
  await A.p.click('[data-mode="signup"]'); await A.p.waitForTimeout(200);
  await A.p.fill('#regName', 'Thomas');
  await A.p.fill('#regMail', MAIL);
  await A.p.fill('#regPw', 'geheim12345');
  await A.p.fill('#regPw2', 'geheim12345');
  await A.p.click('#doRegister');
  await A.p.waitForTimeout(1200);
  console.log('A registriert, App offen:', await A.p.locator('nav.tabs').isVisible());

  // Tagebuch schreiben
  await A.p.click('a[href="#/tagebuch"]'); await A.p.waitForTimeout(250);
  await openSec(A.p, 'Morgenseite');
  await A.p.click('text=Liebe'); await A.p.waitForTimeout(250);
  await openSec(A.p, 'Morgenseite');
  await A.p.fill('[data-j="morning.gefuehl"]', 'Vom iPhone geschrieben.');
  await A.p.fill('[data-j="morning.dank.0"]', 'Für den Sync.');
  // Ziel anlegen
  await A.p.click('a[href="#/ziele"]'); await A.p.waitForTimeout(250);
  await A.p.click('#newGoal');
  await A.p.fill('#gTitle', 'Buch fertig lesen');
  await A.p.fill('#gAff', 'Ich lebe die 8 Wochen konsequent.');
  await A.p.click('#saveGoal'); await A.p.waitForTimeout(300);
  // Programm starten
  await A.p.click('a[href="#/wochen"]'); await A.p.waitForTimeout(250);
  await A.p.click('#startProg'); await A.p.waitForTimeout(300);
  // synchronisieren
  await A.p.click('a[href="#/mehr"]'); await A.p.waitForTimeout(250);
  await A.p.click('#btnSync'); await A.p.waitForTimeout(1200);
  console.log('A Status:', await A.p.textContent('#syncStatus'));

  // ---------- Gerät B: Laptop, frischer Browser ----------
  const C = await device(b, 'B');
  await C.p.click('[data-mode="login"]'); await C.p.waitForTimeout(200);
  await C.p.fill('#logMail', MAIL);
  await C.p.fill('#logPw', 'geheim12345');
  await C.p.click('#doLogin');
  await C.p.waitForTimeout(1800);
  await C.p.click('a[href="#/mehr"]'); await C.p.waitForTimeout(300);
  console.log('B Status:', await C.p.textContent('#syncStatus'));

  const got = await C.p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    const k = Object.keys(s.journal).sort().pop();
    return {
      tag: k,
      gefuehl: s.journal[k].morning.gefuehl,
      emotion: s.journal[k].morning.emotion,
      dank: s.journal[k].morning.dank[0],
      ziele: s.goals.map(g => g.title),
      programmStart: s.program && s.program.start,
      wochenTitel: s.program && s.program.weeks[0].title
    };
  });
  console.log('B übernommen:', JSON.stringify(got));

  // ---------- Gegenrichtung: B schreibt, A holt ab ----------
  await C.p.click('a[href="#/tagebuch"]'); await C.p.waitForTimeout(250);
  await openSec(C.p, 'Abendseite');
  await C.p.fill('[data-j="evening.gelungen"]', 'Am Laptop ergänzt.');
  await C.p.waitForTimeout(700);
  await C.p.click('a[href="#/mehr"]'); await C.p.waitForTimeout(200);
  await C.p.click('#btnSync'); await C.p.waitForTimeout(1200);

  await A.p.click('#btnSync'); await A.p.waitForTimeout(1400);
  const back = await A.p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    const k = Object.keys(s.journal).sort().pop();
    return { abends: s.journal[k].evening.gelungen, morgens: s.journal[k].morning.gefuehl };
  });
  console.log('A nach Rücksync:', JSON.stringify(back));

  // ---------- Löschen synchronisiert? ----------
  await A.p.click('a[href="#/ziele"]'); await A.p.waitForTimeout(250);
  await A.p.click('[data-open]'); await A.p.waitForTimeout(200);
  A.p.on('dialog', d => d.accept());
  await A.p.click('[data-del]'); await A.p.waitForTimeout(400);
  await A.p.click('a[href="#/mehr"]'); await A.p.waitForTimeout(200);
  await A.p.click('#btnSync'); await A.p.waitForTimeout(1200);
  await C.p.click('#btnSync'); await C.p.waitForTimeout(1400);
  const afterDel = await C.p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    return { gesamt: s.goals.length, sichtbar: s.goals.filter(g => !g.deleted).length };
  });
  console.log('B nach Löschung:', JSON.stringify(afterDel));

  // ---------- Fremde Daten? Zweites Konto ----------
  const D = await device(b, 'C');
  await D.p.click('[data-mode="signup"]'); await D.p.waitForTimeout(200);
  await D.p.fill('#regName', 'Klientin');
  await D.p.fill('#regMail', MAIL_B);
  await D.p.fill('#regPw', 'klient12345');
  await D.p.fill('#regPw2', 'klient12345');
  await D.p.click('#doRegister'); await D.p.waitForTimeout(1600);
  const foreign = await D.p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    return { eintraege: Object.keys(s.journal).length, ziele: s.goals.length };
  });
  console.log('Zweites Konto sieht:', JSON.stringify(foreign), '(muss 0/0 sein)');

  await b.close();
})();
