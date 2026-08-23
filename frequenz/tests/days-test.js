const { chromium } = require('playwright-core');
const URL = 'http://localhost:8100/index.html';
const openSec = async (p, n) => {
  await p.evaluate((name) => {
    const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes(name));
    if (d && !d.open) d.open = true;
  }, n);
  await p.waitForTimeout(150);
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  await p.click('#skipAuth'); await p.waitForTimeout(300);

  const stand = async () => await p.evaluate(() => {
    const k = (function(){ const t=new Date(); t.setMinutes(t.getMinutes()-t.getTimezoneOffset()); return t.toISOString().slice(0,10); })();
    return { erfuellt: dayChecklist(k).map(x => x.k + ':' + (x.ok ? 'ja' : 'nein')).join(' '), fertig: dayComplete(k) };
  });
  console.log('0 Startzustand:', JSON.stringify(await stand()));

  // Programm starten
  await p.click('a[href="#/wochen"]'); await p.waitForTimeout(250);
  await p.click('#startProg'); await p.waitForTimeout(350);
  console.log('1 Punkte anklickbar?', await p.locator('[data-tick]').count(), '(muss 0 sein) | Tage-Knöpfe:', await p.locator('[data-goday]').count());
  console.log('1b Fortschritt:', (await p.textContent('.card .tiny.muted')).trim());

  // Schritt für Schritt erfüllen
  await p.click('a[href="#/tagebuch"]'); await p.waitForTimeout(250);
  await openSec(p, 'Morgenseite');
  await p.click('text=Mut'); await p.waitForTimeout(350);
  console.log('2 nach Frequenz:', JSON.stringify(await stand()));

  await openSec(p, 'Morgenseite');
  await p.fill('[data-j="morning.dank.0"]', 'Für den ruhigen Start.');
  await p.waitForTimeout(700);
  console.log('3 nach Dankbarkeit:', JSON.stringify(await stand()));

  await openSec(p, 'Abendseite');
  await p.fill('[data-j="evening.gelungen"]', 'Der Tag lief rund.');
  await p.waitForTimeout(900);
  const nach = await stand();
  console.log('4 nach Abendseite:', JSON.stringify(nach));

  // Anzeige im Tagebuch
  await p.click('a[href="#/tagebuch"]'); await p.waitForTimeout(400);
  const karte = await p.evaluate(() => {
    const h = [...document.querySelectorAll('.card h2')].find(x => x.textContent.includes('Tagesabschluss'));
    return h ? h.parentElement.parentElement.innerText.replace(/\n+/g, ' | ').slice(0, 160) : 'fehlt';
  });
  console.log('5 Karte:', karte);

  // Wochenansicht: Punkt 1 muss jetzt gefüllt sein
  await p.click('a[href="#/wochen"]'); await p.waitForTimeout(400);
  const punkte = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-goday]')].slice(0, 7);
    return btns.map(b => b.className.includes('on') ? '●' : (b.className.includes('future') ? '·' : '○')).join('');
  });
  console.log('6 Woche 1:', punkte, '| Zähler:', (await p.locator('.week .tiny.muted').first().textContent()).trim());

  // Antippen öffnet den Tag statt zu haken
  await p.locator('[data-goday]').first().click(); await p.waitForTimeout(500);
  console.log('7 Antippen führt zu:', await p.textContent('#pageTitle'), '|', (await p.textContent('.daynav .cur b')).trim());

  // Zukünftiger Tag lässt sich nicht öffnen
  await p.click('a[href="#/wochen"]'); await p.waitForTimeout(300);
  await p.locator('[data-goday].future').first().click(); await p.waitForTimeout(400);
  console.log('8 Zukunft:', await p.textContent('#pageTitle'), '| Hinweis:', (await p.textContent('#toast')).trim());

  await p.screenshot({ path: 'days-wochen.png', fullPage: true });
  await b.close();
})();
