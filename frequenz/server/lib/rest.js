"use strict";
/* Datenendpunkte. Jede einzelne Abfrage ist auf den angemeldeten
   Nutzer eingegrenzt – es gibt hier keinen Pfad ohne user_id. */
const { q, eine } = require("./db");

/* Nur diese Tabellen sind überhaupt ansprechbar, und nur diese Spalten. */
const TABELLEN = {
  journal_entries: {
    schluessel: ["user_id", "date"],
    felder: ["user_id", "date", "data", "updated_at"],
  },
  goals: {
    schluessel: ["user_id", "id"],
    felder: ["user_id", "id", "data", "deleted", "updated_at"],
  },
  app_meta: {
    schluessel: ["user_id"],
    felder: ["user_id", "data", "updated_at"],
  },
  push_subscriptions: {
    schluessel: ["endpoint"],
    felder: ["endpoint", "user_id", "p256dh", "auth", "morning", "evening", "tz", "updated_at"],
  },
};

/* "eq.abc" → "abc"; alles andere wird ignoriert. */
function gleichheit(wert) {
  if (typeof wert !== "string") return null;
  return wert.startsWith("eq.") ? wert.slice(3) : null;
}

/* Fragt jemand ausdrücklich nach einer fremden Kennung, ist die Antwort
   leer – und nicht etwa die eigene Zeilenmenge. */
function fremdeKennung(url, nutzer) {
  const gewuenscht = gleichheit(url.searchParams.get("user_id"));
  return gewuenscht !== null && gewuenscht !== nutzer.id;
}

async function lesen(res, name, nutzer, url) {
  if (fremdeKennung(url, nutzer)) return res.json(200, []);
  const t = TABELLEN[name];
  const bedingungen = ["user_id = $1"];
  const werte = [nutzer.id];

  // Zusätzliche Filter nur für bekannte Spalten
  for (const spalte of ["date", "id", "endpoint"]) {
    const wert = gleichheit(url.searchParams.get(spalte));
    if (wert !== null && t.felder.includes(spalte)) {
      werte.push(wert);
      bedingungen.push(`${spalte} = $${werte.length}`);
    }
  }
  const grenze = Math.min(parseInt(url.searchParams.get("limit") || "5000", 10) || 5000, 5000);
  const zeilen = await q(
    `select ${t.felder.join(", ")} from ${name} where ${bedingungen.join(" and ")} limit ${grenze}`, werte);
  return res.json(200, zeilen);
}

async function schreiben(res, name, nutzer, body) {
  const t = TABELLEN[name];
  const zeilen = Array.isArray(body) ? body : [body];
  if (!zeilen.length) return res.json(201, []);
  if (zeilen.length > 500) return res.json(413, { message: "Zu viele Datensätze auf einmal" });

  for (const roh of zeilen) {
    // Die Kennung kommt immer aus dem Token, nie aus der Anfrage.
    const zeile = { user_id: nutzer.id };
    for (const feld of t.felder) {
      if (feld === "user_id") continue;
      if (roh[feld] !== undefined) zeile[feld] = roh[feld];
    }
    for (const s of t.schluessel) {
      if (zeile[s] === undefined || zeile[s] === null) {
        return res.json(400, { message: `Feld ${s} fehlt` });
      }
    }
    const spalten = Object.keys(zeile);
    const platzhalter = spalten.map((_, i) => `$${i + 1}`);
    const aktualisieren = spalten.filter((s) => !t.schluessel.includes(s))
      .map((s) => `${s} = excluded.${s}`);
    await q(
      `insert into ${name} (${spalten.join(", ")}) values (${platzhalter.join(", ")})
       on conflict (${t.schluessel.join(", ")}) do update set ${aktualisieren.join(", ")}, synced_at = now()`,
      spalten.map((s) => zeile[s]));
  }
  return res.json(201, []);
}

async function loeschen(res, name, nutzer, url) {
  if (fremdeKennung(url, nutzer)) return res.leer(204);   // nichts tun
  const t = TABELLEN[name];
  const bedingungen = ["user_id = $1"];
  const werte = [nutzer.id];
  for (const spalte of ["date", "id", "endpoint"]) {
    const wert = gleichheit(url.searchParams.get(spalte));
    if (wert !== null && t.felder.includes(spalte)) {
      werte.push(wert);
      bedingungen.push(`${spalte} = $${werte.length}`);
    }
  }
  await q(`delete from ${name} where ${bedingungen.join(" and ")}`, werte);
  return res.leer(204);
}

/* Konto samt allem löschen – das Gegenstück zu delete_own_account. */
async function kontoLoeschen(res, nutzer) {
  await q(`delete from users where id = $1`, [nutzer.id]);   // der Rest hängt per cascade dran
  return res.json(200, null);
}

async function behandeln(req, res, body, url, nutzer, pfad) {
  if (!nutzer) return res.json(401, { message: "JWT missing" });

  if (pfad === "rpc/delete_own_account") {
    if (req.method !== "POST") return res.json(405, { message: "Methode nicht erlaubt" });
    return kontoLoeschen(res, nutzer);
  }

  const name = pfad;
  if (!Object.prototype.hasOwnProperty.call(TABELLEN, name)) {
    return res.json(404, {
      code: "PGRST205",
      message: `Could not find the table 'public.${name}' in the schema cache`,
    });
  }
  if (req.method === "GET") return lesen(res, name, nutzer, url);
  if (req.method === "POST") return schreiben(res, name, nutzer, body);
  if (req.method === "DELETE") return loeschen(res, name, nutzer, url);
  return res.json(405, { message: "Methode nicht erlaubt" });
}

module.exports = { behandeln, TABELLEN };
