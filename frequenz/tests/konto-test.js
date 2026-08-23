const { chromium } = require('playwright-core');
const URL = 'http://localhost:8100/index.html';
const R = Math.random().toString(36).slice(2,7);
const MAIL = `konto_${R}@example.de`, MAIL2 = `konto2_${R}@example.de`;

const openSec = async (p, n) => {
  await p.evaluate((name) => {
    const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes(name));
    if (d && !d.open) d.open = true;
  }, n);
  await p.waitForTimeout(200);
};
async function konto(b, mail, pw) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  await p.click('[data-mode="signup"]'); await p.waitForTimeout(200);
  await p.fill('#regName', 'Test'); await p.fill('#regMail', mail);
  await p.fill('#regPw', pw); await p.fill('#regPw2', pw);
  await p.click('#doRegister'); await p.waitForTimeout(1300);
  return p;
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

  // ---------- 2) Abgelaufene Sitzung ----------
  const p = await konto(b, MAIL, 'altespw12345');
  await openSec(p, 'Morgenseite');
  await p.fill('[data-j="morning.gefuehl"]', 'Eintrag vor dem Ablauf.');
  await p.waitForTimeout(800);
  // Token serverseitig entwerten und Ablauf erzwingen
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-session'));
    s.access_token = 'tot'; s.refresh_token = 'r_tot'; s.expires_at = Date.now() - 1000;
    localStorage.setItem('frequenz-session', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });   // damit die Seite die tote Sitzung wirklich lädt
  await p.waitForTimeout(1800);
  const nachAblauf = await p.evaluate(() => ({
    gate: authGateActive(),
    meldung: ui.auth.msg,
    sitzung: !!JSON.parse(localStorage.getItem('frequenz-session') || 'null'),
    eintragNochDa: (function(){ const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
      const k = Object.keys(s.journal).sort().pop(); return s.journal[k].morning.gefuehl; })()
  }));
  console.log('2 Sitzung abgelaufen:', JSON.stringify(nachAblauf));

  // Neu anmelden – nichts darf verloren sein
  await p.fill('#logMail', MAIL); await p.fill('#logPw', 'altespw12345');
  await p.click('#doLogin'); await p.waitForTimeout(1800);
  console.log('2b Nach Neuanmeldung, Eintrag da:', await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    const k = Object.keys(s.journal).sort().pop();
    return s.journal[k].morning.gefuehl;
  }));

  // ---------- 3) Passwort ändern ----------
  await p.click('a[href="#/mehr"]'); await p.waitForTimeout(300);
  await openSec(p, 'Passwort ändern');
  await p.fill('#pwNeu', 'kurz'); await p.fill('#pwNeu2', 'kurz');
  await p.click('#btnPwChange'); await p.waitForTimeout(400);
  console.log('3 zu kurz:', (await p.textContent('#pwHinweis')).trim());
  await p.fill('#pwNeu', 'neuespw12345'); await p.fill('#pwNeu2', 'anderes12345');
  await p.click('#btnPwChange'); await p.waitForTimeout(400);
  console.log('3b ungleich:', (await p.textContent('#pwHinweis')).trim());
  await p.fill('#pwNeu', 'neuespw12345'); await p.fill('#pwNeu2', 'neuespw12345');
  await p.click('#btnPwChange'); await p.waitForTimeout(1000);
  console.log('3c geändert:', (await p.textContent('#pwHinweis')).trim(),
              '| Felder geleert:', (await p.inputValue('#pwNeu')) === '');

  const p2 = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p2.goto(URL, { waitUntil: 'networkidle' }); await p2.waitForTimeout(300);
  await p2.click('[data-mode="login"]'); await p2.waitForTimeout(200);
  await p2.fill('#logMail', MAIL); await p2.fill('#logPw', 'neuespw12345');
  await p2.click('#doLogin'); await p2.waitForTimeout(1600);
  console.log('3d Anmeldung mit neuem Passwort:', await p2.locator('nav.tabs').isVisible());

  // ---------- 6) Konto löschen ----------
  const p3 = await konto(b, MAIL2, 'loeschen1234');
  await openSec(p3, 'Morgenseite');
  await p3.fill('[data-j="morning.gefuehl"]', 'Kommt gleich weg.');
  await p3.waitForTimeout(900);
  await p3.click('a[href="#/mehr"]'); await p3.waitForTimeout(300);
  await p3.click('#btnSync'); await p3.waitForTimeout(1200);
  await openSec(p3, 'Konto löschen');
  await p3.click('#btnKontoLoeschen'); await p3.waitForTimeout(400);
  console.log('6 ohne Bestätigungswort:', (await p3.textContent('#toast')).trim());
  p3.on('dialog', d => d.accept());
  await p3.fill('#delBestaetigung', 'LÖSCHEN');
  await p3.click('#btnKontoLoeschen'); await p3.waitForTimeout(1800);
  console.log('6b nach Löschen – Startbildschirm:', await p3.evaluate(() => authGateActive()),
              '| lokale Daten:', await p3.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('frequenz-app-v1')).journal).length));

  const p4 = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p4.goto(URL, { waitUntil: 'networkidle' }); await p4.waitForTimeout(300);
  await p4.click('[data-mode="login"]'); await p4.waitForTimeout(200);
  await p4.fill('#logMail', MAIL2); await p4.fill('#logPw', 'loeschen1234');
  await p4.click('#doLogin'); await p4.waitForTimeout(1400);
  console.log('6c Anmeldung mit gelöschtem Konto:', await p4.evaluate(() => ui.auth.msg));

  await b.close();
})();
