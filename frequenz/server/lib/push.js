"use strict";
/* Erinnerungen. Was bei Supabase die Edge Function samt pg_cron war,
   läuft hier als Zeitgeber im Server selbst. */
const cfg = require("./config");
const { q } = require("./db");

let webpush = null;
function dienst() {
  if (!cfg.pushAktiv) return null;
  if (!webpush) {
    webpush = require("web-push");
    webpush.setVapidDetails(cfg.push.subject, cfg.push.publicKey, cfg.push.privateKey);
  }
  return webpush;
}

/* ---- dieselbe Logik wie in der Edge Function, hier in JavaScript ---- */
function ortszeit(tz) {
  let teile;
  try {
    teile = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date());
  } catch {
    teile = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", hour12: false,
      position: undefined, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date());
  }
  const hol = (t) => teile.find((p) => p.type === t).value;
  const stunde = hol("hour") === "24" ? "00" : hol("hour");
  return {
    datum: `${hol("year")}-${hol("month")}-${hol("day")}`,
    minuten: parseInt(stunde, 10) * 60 + parseInt(hol("minute"), 10),
  };
}
function zuMinuten(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}
function faellig(ziel, jetzt, fenster = 6) {
  if (ziel === null) return false;
  const diff = jetzt - ziel;
  return diff >= 0 && diff < fenster;
}
function morgenErledigt(e) {
  const m = e && e.data && e.data.morning;
  if (!m) return false;
  const dank = Array.isArray(m.dank) ? m.dank.filter((x) => String(x || "").trim()).length : 0;
  return m.level !== null && m.level !== undefined && (dank > 0 || String(m.absicht || "").trim() !== "");
}
function abendErledigt(e) {
  const v = e && e.data && e.data.evening;
  if (!v) return false;
  return ["gelungen", "dankbar", "losgelassen", "morgen"].some((kk) => String(v[kk] || "").trim() !== "");
}

async function durchlauf() {
  const d = dienst();
  if (!d) return { gesendet: 0, uebersprungen: 0, entfernt: 0, aus: true };
  const anmeldungen = await q(`select * from push_subscriptions`);
  let gesendet = 0, uebersprungen = 0, entfernt = 0;

  for (const s of anmeldungen) {
    const jetzt = ortszeit(s.tz || "Europe/Berlin");
    const heute = jetzt.datum;
    const alsDatum = (w) => (w ? new Date(w).toISOString().slice(0, 10) : null);
    const istMorgen = faellig(zuMinuten(s.morning), jetzt.minuten) && alsDatum(s.last_morning) !== heute;
    const istAbend = faellig(zuMinuten(s.evening), jetzt.minuten) && alsDatum(s.last_evening) !== heute;
    if (!istMorgen && !istAbend) continue;

    const eintrag = (await q(
      `select data from journal_entries where user_id = $1 and date = $2`, [s.user_id, heute]))[0] || null;

    if ((istMorgen && morgenErledigt(eintrag)) || (istAbend && abendErledigt(eintrag))) {
      await q(`update push_subscriptions set ${istMorgen ? "last_morning" : "last_evening"} = $1
               where endpoint = $2`, [heute, s.endpoint]);
      uebersprungen++;
      continue;
    }

    const inhalt = istMorgen
      ? { title: "Guten Morgen ✦", body: "Wo stehst du gerade? Frequenz eintragen und den Tag ausrichten.", tag: "morgen", url: "./index.html#/tagebuch" }
      : { title: "Tag abschließen ✦", body: "Was ist dir gelungen, wofür bist du dankbar, was lässt du los?", tag: "abend", url: "./index.html#/tagebuch" };

    try {
      await d.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(inhalt));
      await q(`update push_subscriptions set ${istMorgen ? "last_morning" : "last_evening"} = $1
               where endpoint = $2`, [heute, s.endpoint]);
      gesendet++;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await q(`delete from push_subscriptions where endpoint = $1`, [s.endpoint]);
        entfernt++;
      } else {
        console.error("Push fehlgeschlagen:", err && err.message);
      }
    }
  }
  return { gesendet, uebersprungen, entfernt };
}

function starten() {
  if (!cfg.pushAktiv) {
    console.log("Erinnerungen aus (kein VAPID-Schlüssel hinterlegt)");
    return null;
  }
  console.log("Erinnerungen an, Prüfung alle fünf Minuten");
  return setInterval(() => {
    durchlauf().catch((e) => console.error("Erinnerungslauf:", e.message));
  }, 5 * 60 * 1000);
}

module.exports = { starten, durchlauf, ortszeit, zuMinuten, faellig, morgenErledigt, abendErledigt };
