/* Prüft den kompletten Mailweg der eigenen API gegen einen echten
   SMTP-Empfänger: Registrierung bestätigen und Passwort zurücksetzen,
   jeweils über den Link aus der tatsächlich verschickten Mail. */
const fs = require("fs");
const API = process.env.API || "http://localhost:8080";
const SINK = process.env.SINK_FILE || "/tmp/smtp-sink.jsonl";
const APP = process.env.APP_URL || "http://localhost:8100/index.html";
const R = Math.random().toString(36).slice(2, 7);
const MAIL = `mail_${R}@test.de`;

let ok = 0, fail = 0;
const pruefe = (name, ist, soll) => {
  const gleich = typeof soll === "function" ? soll(ist) : JSON.stringify(ist) === JSON.stringify(soll);
  gleich ? ok++ : fail++;
  console.log(`${gleich ? "✓" : "✗"} ${name}${gleich ? "" : `\n   ist=${JSON.stringify(ist)}`}`);
};
const ruf = async (pfad, opt = {}) => {
  const r = await fetch(API + pfad, {
    method: opt.method || "GET", redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:8100", ...(opt.kopf || {}) },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: r.status, d, ort: r.headers.get("location") };
};
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/* Mailkodierungen auflösen: Quoted-Printable im Rumpf und die
   kodierten Wörter in Kopfzeilen (=?UTF-8?B?…?=), sonst findet man
   weder die URL noch den Betreff. */
function entwirre(text) {
  let t = String(text).replace(/=\?UTF-8\?B\?([^?]+)\?=/gi,
    (_, b) => Buffer.from(b, "base64").toString("utf8"));
  t = t.replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi,
    (_, qp) => qp.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (__, h) => String.fromCharCode(parseInt(h, 16))));
  t = t.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return Buffer.from(t, "binary").toString("utf8");
}
async function letzteMail(an) {
  for (let i = 0; i < 30; i++) {
    const zeilen = fs.readFileSync(SINK, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
    const treffer = zeilen.reverse().find((m) => m.an.join(" ").includes(an));
    if (treffer) return treffer;
    await warte(200);
  }
  return null;
}
const linkAus = (m) => (entwirre(m.daten).match(/https?:\/\/[^\s"<>]*auth\/v1\/verify[^\s"<>]*/) || [])[0];

(async () => {
  // ---------- Registrierung mit Bestätigung ----------
  const reg = await ruf("/auth/v1/signup", { method: "POST",
    body: { email: MAIL, password: "geheim12345", data: { name: "Mia" } } });
  pruefe("Registrierung liefert noch keine Sitzung", !reg.d.access_token, true);

  const m1 = await letzteMail(MAIL);
  pruefe("Bestätigungsmail kam an", !!m1, true);
  pruefe("Betreff auf Deutsch", /Willkommen im Frequenz-Tagebuch/.test(entwirre(m1.daten)), true);

  pruefe("Anmeldung vor der Bestätigung scheitert",
    (await ruf("/auth/v1/token?grant_type=password", { method: "POST", body: { email: MAIL, password: "geheim12345" } })).d.error_description,
    "Email not confirmed");

  const link = linkAus(m1);
  pruefe("Link in der Mail gefunden", !!link, true);
  const einloesen = await ruf(link.replace(API, ""));
  pruefe("Link leitet weiter", einloesen.status, 302);
  pruefe("Weiterleitung geht zur App", einloesen.ort.startsWith(APP), true);
  pruefe("Sitzung hängt im Anker", /access_token=.+refresh_token=/.test(einloesen.ort), true);
  pruefe("Typ steht dabei", /type=signup/.test(einloesen.ort), true);

  pruefe("Derselbe Link ein zweites Mal ist wertlos",
    /error=/.test((await ruf(link.replace(API, ""))).ort || ""), true);

  pruefe("Anmeldung nach der Bestätigung klappt",
    (await ruf("/auth/v1/token?grant_type=password", { method: "POST", body: { email: MAIL, password: "geheim12345" } })).status, 200);

  // ---------- Passwort zurücksetzen ----------
  const vorher = fs.readFileSync(SINK, "utf8").length;
  await ruf("/auth/v1/recover", { method: "POST", body: { email: MAIL } });
  await warte(400);
  const m2 = await letzteMail(MAIL);
  pruefe("Zweite Mail kam an", fs.readFileSync(SINK, "utf8").length > vorher, true);
  pruefe("Passwortmail auf Deutsch", /Neues Passwort/.test(entwirre(m2.daten)), true);

  const reset = linkAus(m2);
  const r2 = await ruf(reset.replace(API, ""));
  pruefe("Reset-Link liefert Sitzung mit Typ recovery", /type=recovery/.test(r2.ort || ""), true);

  const token = new URLSearchParams((r2.ort || "").split("#")[1] || "").get("access_token");
  pruefe("Neues Passwort setzen",
    (await ruf("/auth/v1/user", { method: "PUT", kopf: { Authorization: "Bearer " + token }, body: { password: "ganzneu12345" } })).status, 200);
  pruefe("Anmeldung mit dem neuen Passwort",
    (await ruf("/auth/v1/token?grant_type=password", { method: "POST", body: { email: MAIL, password: "ganzneu12345" } })).status, 200);

  // ---------- Unbekannte Adresse verrät nichts ----------
  const fremd = await ruf("/auth/v1/recover", { method: "POST", body: { email: `gibtsnicht_${R}@test.de` } });
  pruefe("Reset für unbekannte Adresse antwortet gleich", fremd.status, 200);

  console.log(`\n${ok} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
