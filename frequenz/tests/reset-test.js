const { chromium } = require('playwright-core');
const URL = 'http://localhost:8100/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('dialog', d => d.accept());
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  await p.click('#skipAuth'); await p.waitForTimeout(300);

  // Daten anlegen
  await p.evaluate(() => {
    const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes('Morgenseite'));
    if (d) d.open = true;
  });
  await p.fill('[data-j="morning.gefuehl"]', 'Muss beim Zurücksetzen verschwinden.');
  await p.waitForTimeout(800);
  await p.click('a[href="#/ziele"]'); await p.waitForTimeout(250);
  await p.click('#newGoal');
  await p.fill('#gTitle', 'Testziel'); await p.fill('#gAff', 'Ich bin ein Test.');
  await p.click('#saveGoal'); await p.waitForTimeout(400);
  console.log('vorher:', JSON.stringify(await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    return { tage: Object.keys(s.journal).length, ziele: s.goals.length };
  })));

  // Zurücksetzen
  await p.click('a[href="#/mehr"]'); await p.waitForTimeout(300);
  await p.click('#resetBtn'); await p.waitForTimeout(900);
  console.log('direkt danach:', JSON.stringify(await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    return { tage: Object.keys(s.journal).length, ziele: s.goals.length, name: s.name };
  })));

  // Und nach einem weiteren Speichervorgang (hier kam bisher alles zurück)
  await p.click('a[href="#/tagebuch"]'); await p.waitForTimeout(300);
  await p.evaluate(() => {
    const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes('Morgenseite'));
    if (d) d.open = true;
  });
  await p.fill('[data-j="morning.gefuehl"]', 'Neuer Anfang.');
  await p.waitForTimeout(900);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const nachher = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    const k = Object.keys(s.journal);
    return { tage: k.length, ziele: s.goals.length, text: k.length ? s.journal[k[0]].morning.gefuehl : null };
  });
  console.log('nach neuem Eintrag:', JSON.stringify(nachher));
  console.log(nachher.ziele === 0 && nachher.text === 'Neuer Anfang.' ? '✓ Zurücksetzen räumt wirklich auf' : '✗ Altlasten sind zurück');
  await b.close();
})();
