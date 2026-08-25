/* Prüft die Kernlogik der Mailfunktion direkt aus der Quelldatei:
   Linkaufbau, Vorlagen und die Signaturprüfung. Node hat dieselbe
   Web-Crypto-API wie Deno, der Code läuft also unverändert. */
const fs = require('fs');
const crypto = require('crypto');
const src = fs.readFileSync('/home/user/thwbusinness.github.io/frequenz/supabase/functions/send-email/index.ts', 'utf8');
const code = src.slice(src.indexOf('/* ===================== PURE START'), src.indexOf('/* ====================== PURE END'));
eval(code);

let ok = 0, fail = 0;
const pruefe = (name, ist, soll) => {
  const gleich = typeof soll === 'function' ? soll(ist) : JSON.stringify(ist) === JSON.stringify(soll);
  gleich ? ok++ : fail++;
  console.log(`${gleich ? '✓' : '✗'} ${name}` + (gleich ? '' : `\n   ist=${JSON.stringify(ist)}`));
};

// ---------- Link ----------
const d = { token_hash: 'abc123', email_action_type: 'signup',
            redirect_to: 'https://thwbusinness.github.io/frequenz/', site_url: 'https://x' };
const url = bestaetigungsUrl('https://rqgjpnmiudgcvowiuefx.supabase.co/', d);
pruefe('Link zeigt auf verify', url.startsWith('https://rqgjpnmiudgcvowiuefx.supabase.co/auth/v1/verify?'), true);
pruefe('Token enthalten', url.includes('token=abc123'), true);
pruefe('Typ enthalten', url.includes('type=signup'), true);
pruefe('Rücksprungziel kodiert', url.includes('redirect_to=https%3A%2F%2Fthwbusinness.github.io%2Ffrequenz%2F'), true);
pruefe('kein doppelter Schrägstrich', !url.includes('.co//auth'), true);
pruefe('ohne redirect_to kein leerer Parameter',
  !bestaetigungsUrl('https://x.supabase.co', { token_hash: 't', email_action_type: 'recovery' }).includes('redirect_to='), true);

// ---------- Vorlagen ----------
for (const typ of ['signup', 'recovery', 'magiclink', 'invite', 'email_change', 'reauthentication', 'unbekannt']) {
  const v = vorlage(typ, 'https://link.example/x', 'Thomas');
  const gut = v.betreff && v.html.includes('https://link.example/x') && v.text.includes('https://link.example/x')
              && v.html.includes('Hallo Thomas,');
  pruefe(`Vorlage ${typ} vollständig`, gut, true);
}
pruefe('Registrierung: deutscher Betreff', vorlage('signup', 'u', '').betreff, 'Willkommen im Frequenz-Tagebuch – bitte bestätigen');
pruefe('Passwort: deutscher Betreff', vorlage('recovery', 'u', '').betreff, 'Neues Passwort für dein Frequenz-Tagebuch');
pruefe('ohne Namen neutrale Anrede', vorlage('signup', 'u', '').html.includes('Hallo,'), true);

// ---------- Signaturprüfung ----------
const secret = 'v1,whsec_' + Buffer.from('supergeheim-1234567890').toString('base64');
const rumpf = JSON.stringify({ user: { email: 'a@b.de' }, email_data: { token_hash: 't' } });
const id = 'msg_1', ts = String(Math.floor(Date.now() / 1000));
const roh = Buffer.from(secret.slice('v1,whsec_'.length), 'base64');
const echte = crypto.createHmac('sha256', roh).update(`${id}.${ts}.${rumpf}`).digest('base64');
const kopf = (o) => ({ get: (k) => o[k] ?? null });

(async () => {
  pruefe('gültige Signatur akzeptiert',
    await signaturGueltig(secret, kopf({ 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': 'v1,' + echte }), rumpf, Date.now()), true);
  pruefe('mehrere Signaturen im Header',
    await signaturGueltig(secret, kopf({ 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': 'v1,falsch v1,' + echte }), rumpf, Date.now()), true);
  pruefe('falsche Signatur abgelehnt',
    await signaturGueltig(secret, kopf({ 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': 'v1,AAAA' }), rumpf, Date.now()), false);
  pruefe('veränderter Rumpf abgelehnt',
    await signaturGueltig(secret, kopf({ 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': 'v1,' + echte }), rumpf + 'x', Date.now()), false);
  pruefe('fehlende Kopfzeilen abgelehnt',
    await signaturGueltig(secret, kopf({}), rumpf, Date.now()), false);
  const alt = String(Math.floor(Date.now() / 1000) - 600);
  const alteSig = crypto.createHmac('sha256', roh).update(`${id}.${alt}.${rumpf}`).digest('base64');
  pruefe('zu alter Aufruf abgelehnt (Replay)',
    await signaturGueltig(secret, kopf({ 'webhook-id': id, 'webhook-timestamp': alt, 'webhook-signature': 'v1,' + alteSig }), rumpf, Date.now()), false);
  pruefe('ohne Secret keine Prüfung', await signaturGueltig('', kopf({}), rumpf, Date.now()), true);

  console.log(`\n${ok} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
