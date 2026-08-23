/* Prüft die Kernlogik der Edge Function direkt aus der Quelldatei:
   Zeitzonen, Fenster und "schon erledigt?" – die Teile, die man sonst
   erst auf dem Gerät bemerkt, wenn die Mitteilung falsch kommt. */
const fs = require('fs');
const src = fs.readFileSync('/home/user/thwbusinness.github.io/frequenz/supabase/functions/send-reminders/index.ts', 'utf8');

// Reine Funktionen herausschneiden und Typannotationen entfernen
const start = src.indexOf('function localNow');
const end = src.indexOf('Deno.serve');
let code = src.slice(start, end)
  // TypeScript-Annotationen entfernen, damit Node die Logik unverändert ausführt
  .replace(/!\./g, '.')                       // non-null assertions
  .replace(/!;/g, ';')
  .replace(/: Intl\.DateTimeFormatPart\[\]/g, '')
  .replace(/type Entry = \{[^}]*\}[^;]*;/g, '')
  .replace(/\(([a-zA-Z]+): [A-Za-z<>\[\]|,. ]+\)/g, '($1)')
  .replace(/\(ziel: [^,]+, jetzt: [^,]+, fenster = 6\)/g, '(ziel, jetzt, fenster = 6)')
  .replace(/\): [A-Za-z<>\[\]|,. ]+ \{/g, ') {')
  .replace(/ as Record<string, unknown>/g, '')
  .replace(/ as string\[\]/g, '')
  .replace(/\?\?/g, '||')
  .replace(/e\?\.data\?\.morning/g, '(e && e.data && e.data.morning)')
  .replace(/e\?\.data\?\.evening/g, '(e && e.data && e.data.evening)');
eval(code);

let ok = 0, fail = 0;
const pruefe = (name, ist, soll) => {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  gleich ? ok++ : fail++;
  console.log(`${gleich ? '✓' : '✗'} ${name}` + (gleich ? '' : `  ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`));
};

pruefe('07:30 → 450 Minuten', toMinutes('07:30'), 450);
pruefe('00:00 → 0', toMinutes('00:00'), 0);
pruefe('leer → null', toMinutes(null), null);
pruefe('Unsinn → null', toMinutes('abc'), null);

pruefe('genau zur Zeit fällig', faellig(450, 450), true);
pruefe('5 Min später noch fällig', faellig(450, 455), true);
pruefe('6 Min später nicht mehr', faellig(450, 456), false);
pruefe('vorher nicht fällig', faellig(450, 449), false);
pruefe('ohne Zeit nie fällig', faellig(null, 450), false);

const jetzt = localNow('Europe/Berlin');
pruefe('Datum im Format YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(jetzt.datum), true);
pruefe('Minuten im gültigen Bereich', jetzt.minuten >= 0 && jetzt.minuten < 1440, true);
const tokio = localNow('Asia/Tokyo'), la = localNow('America/Los_Angeles');
pruefe('Zeitzonen unterscheiden sich', tokio.minuten !== la.minuten, true);
pruefe('unbekannte Zeitzone fällt zurück', /^\d{4}-\d{2}-\d{2}$/.test(localNow('Quatsch/Nirgendwo').datum), true);

pruefe('Morgen offen (leer)', morgenErledigt(null), false);
pruefe('Morgen offen (nur Frequenz)', morgenErledigt({ data: { morning: { level: 60, dank: ['', '', ''], absicht: '' } } }), false);
pruefe('Morgen erledigt (Frequenz + Dank)', morgenErledigt({ data: { morning: { level: 60, dank: ['Kaffee', '', ''], absicht: '' } } }), true);
pruefe('Morgen erledigt (Frequenz + Absicht)', morgenErledigt({ data: { morning: { level: 0, dank: [], absicht: 'Ruhig bleiben' } } }), true);
pruefe('Frequenz 0 zählt trotzdem', morgenErledigt({ data: { morning: { level: 0, dank: ['x'], absicht: '' } } }), true);

pruefe('Abend offen', abendErledigt({ data: { evening: { gelungen: '', dankbar: '', losgelassen: '', morgen: '' } } }), false);
pruefe('Abend erledigt', abendErledigt({ data: { evening: { gelungen: 'Newsletter fertig', dankbar: '' } } }), true);
pruefe('Abend: nur Leerzeichen zählt nicht', abendErledigt({ data: { evening: { gelungen: '   ' } } }), false);

console.log(`\n${ok} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
