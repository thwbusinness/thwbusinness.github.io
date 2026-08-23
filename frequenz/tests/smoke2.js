const { chromium } = require('playwright-core');
const B = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8100/index.html';

(async () => {
  const b = await chromium.launch({ executablePath: B, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  // --- 1. Migration aus v1-Daten (vor dem ersten Laden gesetzt) ---
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('__seeded', '1');
      localStorage.setItem('frequenz-app-v1', JSON.stringify({
        version: 1, name: 'Thomas',
        checkins: { '2026-08-20': { level: 71, emotion: 'Annahme', note: 'Alter Eintrag aus v1.' } },
        gratitude: [{ id: 'a', date: '2026-08-20', text: 'Für den Spaziergang.' }],
        reflections: [{ id: 'b', date: '2026-08-20', gelungen: 'Newsletter fertig.', loslassen: 'Die Sorge.', morgen: 'Wach und klar.' }],
        goals: [], createdAt: '2026-08-20'
      }));
    }
  });
  await p.goto(URL, { waitUntil: 'networkidle' });
  // Ohne Konto weiter – prüft zugleich, dass die App rein lokal nutzbar bleibt
  if (await p.locator('#skipAuth').count()) { await p.click('#skipAuth'); await p.waitForTimeout(300); }
  const mig = await p.evaluate(() => JSON.parse(localStorage.getItem('frequenz-app-v1')));
  const m20 = mig.journal['2026-08-20'];
  console.log('MIGRATION v1→v2:', 'version', mig.version,
    '| 20.8. level', m20.morning.level, '|', m20.morning.emotion,
    '| Dank:', m20.morning.dank[0], '| Notiz:', m20.day.frei,
    '| Abend:', m20.evening.gelungen,
    '| alte Keys entfernt:', !mig.checkins && !mig.gratitude && !mig.reflections,
    '| Name übernommen:', mig.name);

  // --- 2. Tagebuch schreiben (Autosave) ---
  const openSec = async (name) => {
    await p.evaluate((n) => {
      const d = [...document.querySelectorAll('details.sec')].find(x => x.querySelector('summary').textContent.includes(n));
      if (d && !d.open) d.open = true;
    }, name);
    await p.waitForTimeout(120);
  };
  await openSec('Morgenseite');
  await p.click('text=Freude');
  await p.waitForTimeout(200);
  await p.fill('[data-j="morning.gefuehl"]', 'Wach, ein bisschen aufgeregt wegen des Calls.');
  await p.fill('[data-j="morning.absicht"]', 'Ruhig und klar, ich strahle Sicherheit aus.');
  await p.fill('[data-j="morning.dank.0"]', 'Für den ruhigen Morgen.');
  await p.fill('[data-j="morning.dank.1"]', 'Für meinen Körper.');
  await p.waitForTimeout(700);
  await openSec('Tagsüber');
  await p.fill('[data-j="day.zeichen"]', 'Dreimal die 11:11 gesehen.');
  await openSec('Abendseite');
  await p.fill('[data-j="evening.gelungen"]', 'Der Call lief besser als gedacht.');
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'v2-tagebuch.png', fullPage: true });

  // Persistenz nach Reload
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  if (await p.locator('#skipAuth').count()) { await p.click('#skipAuth'); await p.waitForTimeout(300); }
  const today = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('frequenz-app-v1'));
    const k = Object.keys(s.journal).sort().pop();
    return { k, e: s.journal[k] };
  });
  console.log('AUTOSAVE:', today.k, '| level', today.e.morning.level, '| emotion', today.e.morning.emotion,
              '| gefuehl:', today.e.morning.gefuehl.slice(0, 30),
              '| zeichen:', today.e.day.zeichen, '| abends:', today.e.evening.gelungen.slice(0, 20));

  // --- 3. Tages-Navigation (zurückblättern) ---
  await p.click('#prevDay'); await p.waitForTimeout(200);
  await p.click('#prevDay'); await p.waitForTimeout(200);
  const navTitle = await p.textContent('.daynav .cur b');
  const nextDisabled = await p.getAttribute('#nextDay', 'disabled');
  await p.click('#nextDay'); await p.click('#nextDay'); await p.waitForTimeout(200);
  const backToday = await p.textContent('.daynav .cur b');
  console.log('NAVIGATION: 2 Tage zurück =', navTitle, '| zurück auf', backToday,
              '| Zukunft gesperrt:', nextDisabled === null ? 'nein(heute erlaubt vorwärts?)' : 'ja');

  // --- 4. 8-Wochen-Programm ---
  await p.click('a[href="#/wochen"]'); await p.waitForTimeout(250);
  await p.click('#startProg'); await p.waitForTimeout(300);
  await p.click('[data-week="0"]'); await p.waitForTimeout(250);
  await p.fill('[data-w="0.title"]', 'Woche 1: Dein Warum');
  await p.fill('[data-w="0.reflexion"]', 'Erste Woche lief gut.');
  await p.waitForTimeout(700);
  await p.screenshot({ path: 'v2-wochen.png', fullPage: true });
  const prog = await p.evaluate(() => JSON.parse(localStorage.getItem('frequenz-app-v1')).program);
  console.log('PROGRAMM: Start', prog.start, '| W1 Titel:', prog.weeks[0].title,
              '| abgeleitete Tage W1:', await p.evaluate(() => { let n=0; for(let i=0;i<7;i++){ const d=new Date(); d.setDate(d.getDate()-d.getDay()); } let c=0; const st=JSON.parse(localStorage.getItem('frequenz-app-v1')).program.start; for(let i=0;i<7;i++){ const dt=new Date(st+'T12:00:00'); dt.setDate(dt.getDate()+i); dt.setMinutes(dt.getMinutes()-dt.getTimezoneOffset()); if(dayComplete(dt.toISOString().slice(0,10))) c++; } return c; }),
              '| Reflexion:', prog.weeks[0].reflexion);

  // --- 5. Archiv & Suche ---
  await p.click('a[href="#/tagebuch"]'); await p.waitForTimeout(200);
  await p.click('a[href="#/archiv"]'); await p.waitForTimeout(250);
  const allDays = await p.locator('[data-day]').count();
  await p.fill('#searchInp', '11:11'); await p.waitForTimeout(350);
  const found = await p.locator('[data-day]').count();
  console.log('ARCHIV: Tage gesamt', allDays, '| Treffer für "11:11":', found);
  await p.screenshot({ path: 'v2-archiv.png', fullPage: true });

  // --- 6. Frequenz-Auswertung ---
  await p.click('a[href="#/frequenz"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'v2-frequenz.png', fullPage: true });

  // --- 7. Textexport ---
  const txt = await p.evaluate(() => journalAsText());
  console.log('TEXTEXPORT:', txt.split('\n').length, 'Zeilen | enthält Wochenblock:', txt.includes('8-WOCHEN-PROGRAMM'));

  console.log('KONSOLENFEHLER:', errs.length ? errs : 'keine');
  await b.close();
})();
