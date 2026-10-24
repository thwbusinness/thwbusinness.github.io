"use strict";
/* Passwörter, Tokens und Signaturen – alles mit Bordmitteln von Node,
   ohne zusätzliche Abhängigkeiten. */
const crypto = require("crypto");
const cfg = require("./config");

/* ---------- Passwörter: scrypt mit zufälligem Salz ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1, laenge: 32 };

function passwortHash(passwort) {
  const salz = crypto.randomBytes(16);
  const abdruck = crypto.scryptSync(passwort.normalize("NFKC"), salz, SCRYPT.laenge,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p,
    salz.toString("base64"), abdruck.toString("base64")].join("$");
}

function passwortPasst(passwort, gespeichert) {
  try {
    const [art, n, r, p, salz, abdruck] = String(gespeichert).split("$");
    if (art !== "scrypt") return false;
    const erwartet = Buffer.from(abdruck, "base64");
    const berechnet = crypto.scryptSync(String(passwort).normalize("NFKC"),
      Buffer.from(salz, "base64"), erwartet.length,
      { N: +n, r: +r, p: +p });
    return crypto.timingSafeEqual(erwartet, berechnet);
  } catch {
    return false;
  }
}

/* ---------- Zugangstoken (JWT, HS256) ---------- */
const b64url = (buf) => Buffer.from(buf).toString("base64url");

function jwtErzeugen(nutzlast, gueltigMs) {
  const kopf = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const koerper = b64url(JSON.stringify({
    ...nutzlast,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + gueltigMs) / 1000),
  }));
  const sig = b64url(crypto.createHmac("sha256", cfg.jwtSecret).update(kopf + "." + koerper).digest());
  return `${kopf}.${koerper}.${sig}`;
}

function jwtPruefen(token) {
  try {
    const [kopf, koerper, sig] = String(token).split(".");
    if (!kopf || !koerper || !sig) return null;
    const erwartet = b64url(crypto.createHmac("sha256", cfg.jwtSecret).update(kopf + "." + koerper).digest());
    const a = Buffer.from(sig), b = Buffer.from(erwartet);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const daten = JSON.parse(Buffer.from(koerper, "base64url").toString());
    if (!daten.exp || daten.exp * 1000 < Date.now()) return null;
    return daten;
  } catch {
    return null;
  }
}

/* ---------- Zufallstoken für Mails und Sitzungen ---------- */
function zufallsToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}
/* In der Datenbank liegt nur der Abdruck: Wer die Tabelle liest,
   kann damit keinen Link bauen. */
function tokenAbdruck(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

module.exports = { passwortHash, passwortPasst, jwtErzeugen, jwtPruefen, zufallsToken, tokenAbdruck };
