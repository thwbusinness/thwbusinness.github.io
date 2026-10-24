/* Sicherheits- und Verhaltenstest der eigenen API – ohne Browser.
   Prüft vor allem, dass die Trennung zwischen Konten im Code wirklich
   hält: Bei Supabase erledigt das die Datenbank, hier muss die API es
   selbst leisten. Server und Datenbank müssen laufen. */
const API = process.env.API || "http://localhost:8080";
const HERKUNFT = process.env.ORIGIN || "http://localhost:8100";
const R = Math.random().toString(36).slice(2, 7);

let ok = 0, fail = 0;
const pruefe = (name, ist, soll) => {
  const gleich = typeof soll === "function" ? soll(ist) : JSON.stringify(ist) === JSON.stringify(soll);
  gleich ? ok++ : fail++;
  console.log(`${gleich ? "✓" : "✗"} ${name}${gleich ? "" : `\n   ist=${JSON.stringify(ist)} soll=${JSON.stringify(soll)}`}`);
};

async function ruf(pfad, { method = "GET", token, body, kopf = {} } = {}) {
  const h = { "Content-Type": "application/json", Origin: HERKUNFT, apikey: "egal", ...kopf };
  if (token) h.Authorization = "Bearer " + token;
  const r = await fetch(API + pfad, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: r.status, d };
}
const heute = new Date().toISOString().slice(0, 10);
const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

(async () => {
  // ---------- Konten anlegen ----------
  const a = await ruf("/auth/v1/signup", { method: "POST",
    body: { email: `a_${R}@test.de`, password: "geheim12345", data: { name: "Anna" } } });
  const b = await ruf("/auth/v1/signup", { method: "POST",
    body: { email: `b_${R}@test.de`, password: "geheim12345", data: { name: "Bert" } } });
  pruefe("Registrierung liefert Sitzung", !!(a.d.access_token && b.d.access_token), true);
  const tokA = a.d.access_token, tokB = b.d.access_token;
  const idA = a.d.user.id, idB = b.d.user.id;
  pruefe("Name landet im Konto", a.d.user.user_metadata.name, "Anna");

  pruefe("Doppelte Registrierung abgelehnt",
    (await ruf("/auth/v1/signup", { method: "POST", body: { email: `a_${R}@test.de`, password: "geheim12345" } })).status, 422);
  pruefe("Zu kurzes Passwort abgelehnt",
    (await ruf("/auth/v1/signup", { method: "POST", body: { email: `c_${R}@test.de`, password: "kurz" } })).status, 422);

  // ---------- Anna schreibt ----------
  await ruf("/rest/v1/journal_entries", { method: "POST", token: tokA,
    body: [{ user_id: idA, date: heute, data: { morning: { gefuehl: "Annas Geheimnis" } }, updated_at: 1 }] });
  await ruf("/rest/v1/app_meta", { method: "POST", token: tokA,
    body: [{ user_id: idA, data: { name: "Anna" }, updated_at: 1 }] });
  const annaSicht = await ruf("/rest/v1/journal_entries", { token: tokA });
  pruefe("Anna sieht den eigenen Eintrag", annaSicht.d.length, 1);

  // ---------- Bert versucht alles Mögliche ----------
  const bertSicht = await ruf("/rest/v1/journal_entries", { token: tokB });
  pruefe("Bert sieht Annas Einträge nicht", bertSicht.d.length, 0);
  pruefe("Bert sieht Annas Stammdaten nicht", (await ruf("/rest/v1/app_meta", { token: tokB })).d.length, 0);

  // Fremde Kennung im Rumpf unterschieben
  await ruf("/rest/v1/journal_entries", { method: "POST", token: tokB,
    body: [{ user_id: idA, date: gestern, data: { morning: { gefuehl: "untergeschoben" } }, updated_at: 2 }] });
  const annaDanach = await ruf("/rest/v1/journal_entries", { token: tokA });
  pruefe("Untergeschobene Kennung landet nicht bei Anna", annaDanach.d.length, 1);
  pruefe("…sondern beim Absender", (await ruf("/rest/v1/journal_entries", { token: tokB })).d.length, 1);

  // Fremde Zeilen löschen
  await ruf(`/rest/v1/journal_entries?user_id=eq.${idA}`, { method: "DELETE", token: tokB });
  pruefe("Bert kann Annas Einträge nicht löschen",
    (await ruf("/rest/v1/journal_entries", { token: tokA })).d.length, 1);

  // Filter auf fremde Zeile
  pruefe("Gezielter Zugriff auf fremden Tag liefert nichts",
    (await ruf(`/rest/v1/journal_entries?date=eq.${heute}&user_id=eq.${idA}`, { token: tokB })).d.length, 0);

  // ---------- Tokens ----------
  pruefe("Ohne Token kein Zugriff", (await ruf("/rest/v1/journal_entries")).status, 401);
  pruefe("Unsinnstoken abgelehnt", (await ruf("/rest/v1/journal_entries", { token: "abc.def.ghi" })).status, 401);
  const geaendert = tokA.split(".");
  const nutzlast = JSON.parse(Buffer.from(geaendert[1], "base64url").toString());
  nutzlast.sub = idB;
  geaendert[1] = Buffer.from(JSON.stringify(nutzlast)).toString("base64url");
  pruefe("Manipuliertes Token abgelehnt",
    (await ruf("/rest/v1/journal_entries", { token: geaendert.join(".") })).status, 401);

  // Erneuerungstoken nur einmal gültig
  const neu = await ruf("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: a.d.refresh_token } });
  pruefe("Erneuern klappt einmal", neu.status, 200);
  pruefe("Zweites Erneuern mit demselben Token scheitert",
    (await ruf("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: a.d.refresh_token } })).status, 400);

  // ---------- Unbekannte Tabelle ----------
  const unbekannt = await ruf("/rest/v1/geheim", { token: tokA });
  pruefe("Unbekannte Tabelle mit klarer Meldung", unbekannt.d.code, "PGRST205");

  // ---------- Passwort ändern meldet andere Geräte ab ----------
  const tokNeu = neu.d.access_token;
  pruefe("Passwort ändern geht", (await ruf("/auth/v1/user", { method: "PUT", token: tokNeu, body: { password: "nochgeheimer123" } })).status, 200);
  pruefe("Altes Erneuerungstoken danach ungültig",
    (await ruf("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: neu.d.refresh_token } })).status, 400);
  pruefe("Anmeldung mit neuem Passwort",
    (await ruf("/auth/v1/token?grant_type=password", { method: "POST", body: { email: `a_${R}@test.de`, password: "nochgeheimer123" } })).status, 200);

  // ---------- Konto löschen ----------
  const anmeldungA = await ruf("/auth/v1/token?grant_type=password", { method: "POST", body: { email: `a_${R}@test.de`, password: "nochgeheimer123" } });
  await ruf("/rest/v1/rpc/delete_own_account", { method: "POST", token: anmeldungA.d.access_token });
  pruefe("Anmeldung mit gelöschtem Konto scheitert",
    (await ruf("/auth/v1/token?grant_type=password", { method: "POST", body: { email: `a_${R}@test.de`, password: "nochgeheimer123" } })).status, 400);
  pruefe("Berts Daten bleiben unberührt",
    (await ruf("/rest/v1/journal_entries", { token: tokB })).d.length, 1);

  console.log(`\n${ok} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
