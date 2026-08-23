const { chromium } = require('playwright-core');
const B = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8100/index.html';

async function fresh(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(`[${label}] PAGEERROR`, e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(350);
  return p;
}
const txt = async (p, sel) => (await p.locator(sel).first().textContent()).trim();

const R = Math.random().toString(36).slice(2,7);
const MAIL = `neu_${R}@example.de`;
const MAIL2 = `klient_${R}@example.de`;

(async () => {
  const b = await chromium.launch({ executablePath: B, args: ['--no-sandbox'] });

  // 1. Erster Start: Willkommensbildschirm statt App
  let p = await fresh(b, '1');
  console.log('1 Startbildschirm:', await txt(p, '#view h1'),
    '| Tableiste sichtbar:', await p.locator('nav.tabs').isVisible(),
    '| Knöpfe:', (await p.locator('.card button').allTextContents()).join(' / '));
  await p.screenshot({ path: 'auth-start.png', fullPage: true });

  // 2. Ohne Konto weiter
  await p.click('#skipAuth'); await p.waitForTimeout(300);
  console.log('2 Ohne Konto:', await txt(p, '#pageTitle'), '| Tableiste:', await p.locator('nav.tabs').isVisible());

  // 3. Registrierung: Passwörter ungleich
  p = await fresh(b, '3');
  await p.click('[data-mode="signup"]'); await p.waitForTimeout(200);
  await p.fill('#regName', 'Thomas');
  await p.fill('#regMail', MAIL);
  await p.fill('#regPw', 'geheim12345');
  await p.fill('#regPw2', 'vertippt12345');
  await p.click('#doRegister'); await p.waitForTimeout(300);
  console.log('3 Fehlermeldung:', await txt(p, '.card p.small'));

  // 4. Registrierung korrekt
  await p.fill('#regPw2', 'geheim12345');
  await p.click('#doRegister'); await p.waitForTimeout(1200);
  const st = await p.evaluate(() => ({
    titel: document.querySelector('#pageTitle').textContent,
    name: JSON.parse(localStorage.getItem('frequenz-app-v1')).name,
    session: !!JSON.parse(localStorage.getItem('frequenz-session') || 'null')
  }));
  console.log('4 Nach Registrierung:', JSON.stringify(st), '| Tableiste:', await p.locator('nav.tabs').isVisible());
  await p.screenshot({ path: 'auth-signup.png', fullPage: true });

  // 5. Falsches Passwort
  const p2 = await fresh(b, '5');
  await p2.click('[data-mode="login"]'); await p2.waitForTimeout(200);
  await p2.fill('#logMail', MAIL);
  await p2.fill('#logPw', 'falsch123456');
  await p2.click('#doLogin'); await p2.waitForTimeout(700);
  console.log('5 Falsches Passwort:', await txt(p2, '.card p.small'));

  // 6. Richtiges Passwort
  await p2.fill('#logPw', 'geheim12345');
  await p2.click('#doLogin'); await p2.waitForTimeout(1200);
  console.log('6 Anmeldung:', await txt(p2, '#pageTitle'), '| Tableiste:', await p2.locator('nav.tabs').isVisible());

  // 7. Passwort vergessen
  const p3 = await fresh(b, '7');
  await p3.click('[data-mode="login"]'); await p3.waitForTimeout(150);
  await p3.click('[data-mode="reset"]'); await p3.waitForTimeout(150);
  await p3.fill('#resMail', MAIL);
  await p3.click('#doReset'); await p3.waitForTimeout(700);
  console.log('7 Reset angefordert:', await txt(p3, '.card p.small'));

  // 8. Rücksprung aus der Passwort-Mail (Tokens im Fragment)
  const tok = await p3.evaluate(async () => (await (await fetch('http://localhost:8123/test/recovery-token')).json()));
  // wie beim Klick aus der E-Mail: vollständiger Seitenaufruf
  await p3.goto('about:blank');
  await p3.goto(URL + `#access_token=${tok.access_token}&refresh_token=${tok.refresh_token}&expires_in=3600&type=recovery`, { waitUntil: 'networkidle' });
  await p3.waitForTimeout(1200);
  console.log('8 Recovery-Link:', await txt(p3, '.card h2'), '| URL sauber:', !p3.url().includes('access_token'));
  await p3.fill('#npw1', 'neuespw12345');
  await p3.fill('#npw2', 'neuespw12345');
  await p3.click('#doNewPw'); await p3.waitForTimeout(1000);
  console.log('8b Nach Passwortwechsel:', await txt(p3, '#pageTitle'));

  // 9. Anmeldung mit dem neuen Passwort
  const p4 = await fresh(b, '9');
  await p4.click('[data-mode="login"]'); await p4.waitForTimeout(150);
  await p4.fill('#logMail', MAIL);
  await p4.fill('#logPw', 'neuespw12345');
  await p4.click('#doLogin'); await p4.waitForTimeout(1200);
  console.log('9 Neues Passwort funktioniert:', await p4.locator('nav.tabs').isVisible());

  // 10. Lokale Einträge wandern beim Registrieren ins Konto
  const p5 = await fresh(b, '10');
  await p5.click('#skipAuth'); await p5.waitForTimeout(300);
  await p5.evaluate(() => {
    const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes('Morgenseite'));
    if (d) d.open = true;
  });
  await p5.fill('[data-j="morning.gefuehl"]', 'Vor der Registrierung geschrieben.');
  await p5.waitForTimeout(800);
  await p5.click('a[href="#/mehr"]'); await p5.waitForTimeout(250);
  await p5.click('#btnConnect'); await p5.waitForTimeout(300);
  await p5.click('[data-mode="signup"]'); await p5.waitForTimeout(200);
  await p5.fill('#regName', 'Klient');
  await p5.fill('#regMail', MAIL2);
  await p5.fill('#regPw', 'klient12345');
  await p5.fill('#regPw2', 'klient12345');
  await p5.click('#doRegister'); await p5.waitForTimeout(1500);
  const p6 = await fresh(b, '10b');
  await p6.click('[data-mode="login"]'); await p6.waitForTimeout(150);
  await p6.fill('#logMail', MAIL2);
  await p6.fill('#logPw', 'klient12345');
  await p6.click('#doLogin'); await p6.waitForTimeout(1500);
  const carried = await p6.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    const k = Object.keys(s.journal).sort().pop();
    return { name: s.name, text: k ? s.journal[k].morning.gefuehl : null };
  });
  console.log('10 Lokale Einträge übernommen:', JSON.stringify(carried));

  await b.close();
})();
