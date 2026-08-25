const { chromium } = require('playwright-core');
const URL = 'http://localhost:8100/index.html';
const MAIL = `diag_${Math.random().toString(36).slice(2,7)}@example.de`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  await p.click('[data-mode="signup"]'); await p.waitForTimeout(200);
  await p.fill('#regName', 'Diag'); await p.fill('#regMail', MAIL);
  await p.fill('#regPw', 'diagdiag1234'); await p.fill('#regPw2', 'diagdiag1234');
  await p.click('#doRegister'); await p.waitForTimeout(1500);

  await p.click('a[href="#/mehr"]'); await p.waitForTimeout(300);
  await p.click('#btnSync'); await p.waitForTimeout(1500);
  console.log('1 Fehlermeldung:', (await p.textContent('#syncStatus')).trim());
  console.log('2 Prüfknopf sichtbar:', await p.locator('#btnDiag').count() > 0);
  await p.click('#btnDiag'); await p.waitForTimeout(1500);
  console.log('3 Diagnose:\n' + (await p.textContent('#diagAusgabe')).split('\n').map(l => '   ' + l).join('\n'));
  await p.screenshot({ path: 'diag.png', fullPage: true });
  await b.close();
})();
