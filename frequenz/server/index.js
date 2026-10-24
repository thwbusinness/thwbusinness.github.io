"use strict";
/*
 * Frequenz-Tagebuch – eigene API.
 *
 * Spricht bewusst dieselben Endpunkte wie Supabase, damit in der App
 * nur die URL getauscht werden muss. Start: node index.js
 */
const http = require("http");
const cfg = require("./lib/config");
const { pool, q } = require("./lib/db");
const auth = require("./lib/auth");
const rest = require("./lib/rest");
const push = require("./lib/push");

/* ---------- einfache Bremse gegen Durchprobieren ---------- */
const versuche = new Map();   // schluessel -> {anzahl, bis}
function zuOft(schluessel, grenze, fensterMs) {
  const jetzt = Date.now();
  const e = versuche.get(schluessel);
  if (!e || e.bis < jetzt) {
    versuche.set(schluessel, { anzahl: 1, bis: jetzt + fensterMs });
    return false;
  }
  e.anzahl++;
  return e.anzahl > grenze;
}
setInterval(() => {
  const jetzt = Date.now();
  for (const [kk, v] of versuche) if (v.bis < jetzt) versuche.delete(kk);
}, 60000).unref();

/* ---------- Antworthilfen ---------- */
function antwort(req, res) {
  const herkunft = req.headers.origin;
  const erlaubt = herkunft && cfg.erlaubteHerkuenfte.includes(herkunft);
  const basis = {
    "Access-Control-Allow-Origin": erlaubt ? herkunft : cfg.erlaubteHerkuenfte[0] || "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, prefer, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  return {
    json(code, daten) {
      res.writeHead(code, { ...basis, "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(daten));
    },
    leer(code) { res.writeHead(code, basis); res.end(); },
    weiter(ziel) { res.writeHead(302, { ...basis, Location: ziel }); res.end(); },
    text(code, s) { res.writeHead(code, { ...basis, "Content-Type": "text/plain; charset=utf-8" }); res.end(s); },
  };
}

function koerperLesen(req) {
  return new Promise((loese, scheitere) => {
    let roh = "", zuViel = false;
    req.on("data", (teil) => {
      roh += teil;
      if (roh.length > 2 * 1024 * 1024) { zuViel = true; req.destroy(); }
    });
    req.on("end", () => {
      if (zuViel) return scheitere(new Error("Anfrage zu groß"));
      if (!roh) return loese({});
      try { loese(JSON.parse(roh)); } catch { scheitere(new Error("kein gültiges JSON")); }
    });
    req.on("error", scheitere);
  });
}

const server = http.createServer(async (req, rohRes) => {
  const res = antwort(req, rohRes);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pfad = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") return res.leer(204);
  if (pfad === "/" || pfad === "/health") {
    try { await q("select 1"); return res.json(200, { status: "ok", mail: cfg.mailAktiv, push: cfg.pushAktiv }); }
    catch { return res.json(503, { status: "Datenbank nicht erreichbar" }); }
  }

  let body = {};
  if (req.method !== "GET" && req.method !== "DELETE") {
    try { body = await koerperLesen(req); }
    catch (e) { return res.json(400, { message: e.message }); }
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
             || req.socket.remoteAddress || "unbekannt";

  try {
    /* ---------- Anmeldung ---------- */
    if (pfad.startsWith("/auth/v1/")) {
      const was = pfad.slice("/auth/v1/".length);

      if (["signup", "token", "recover"].includes(was)) {
        const grenze = was === "token" ? cfg.bremse.anmeldung : cfg.bremse.konto;
        if (zuOft(`${ip}:${was}`, grenze, cfg.bremse.fensterMin * 60 * 1000)) {
          return res.json(429, { message: "Zu viele Versuche. Bitte warte einen Moment." });
        }
      }
      if (was === "signup" && req.method === "POST") return auth.signup(req, res, body, url);
      if (was === "token" && req.method === "POST") return auth.token(req, res, body, url);
      if (was === "recover" && req.method === "POST") return auth.recover(req, res, body, url);
      if (was === "verify" && req.method === "GET") return auth.verify(req, res, body, url);

      const nutzer = await auth.nutzerAusAnfrage(req);
      if (was === "logout" && req.method === "POST") return auth.logout(req, res, body, url, nutzer);
      if (was === "user" && req.method === "GET") return auth.nutzerLesen(req, res, body, url, nutzer);
      if (was === "user" && req.method === "PUT") return auth.nutzerAendern(req, res, body, url, nutzer);
      return res.json(404, { message: "Unbekannter Endpunkt" });
    }

    /* ---------- Daten ---------- */
    if (pfad.startsWith("/rest/v1/")) {
      const nutzer = await auth.nutzerAusAnfrage(req);
      return rest.behandeln(req, res, body, url, nutzer, pfad.slice("/rest/v1/".length));
    }

    return res.json(404, { message: "Unbekannter Pfad" });
  } catch (e) {
    console.error("Fehler bei", req.method, pfad, "-", e.message);
    return res.json(500, { message: "Serverfehler" });
  }
});

server.listen(cfg.port, () => {
  console.log(`Frequenz-API läuft auf Port ${cfg.port}`);
  console.log(`  App:  ${cfg.appUrl}`);
  console.log(`  API:  ${cfg.apiUrl}`);
  console.log(`  Mail: ${cfg.mailAktiv ? cfg.mail.host : "nicht konfiguriert"}`);
  push.starten();
});

function beenden() {
  console.log("Fahre herunter …");
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", beenden);
process.on("SIGINT", beenden);
