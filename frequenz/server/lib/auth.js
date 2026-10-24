"use strict";
/* Anmeldung, Registrierung, Passwort – mit denselben Endpunkten,
   die die App bisher bei Supabase angesprochen hat. */
const cfg = require("./config");
const { q, eine } = require("./db");
const k = require("./krypto");
const mail = require("./mail");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- Hilfen ---------- */
async function sitzungFuer(nutzer) {
  const erneuerung = k.zufallsToken(48);
  await q(`insert into refresh_tokens (token, user_id, expires_at)
           values ($1, $2, now() + ($3 || ' milliseconds')::interval)`,
          [erneuerung, nutzer.id, String(cfg.sitzungsdauer)]);
  return {
    access_token: k.jwtErzeugen({ sub: nutzer.id, email: nutzer.email }, cfg.zugangsdauer),
    token_type: "bearer",
    expires_in: Math.floor(cfg.zugangsdauer / 1000),
    refresh_token: erneuerung,
    user: oeffentlich(nutzer),
  };
}
function oeffentlich(n) {
  return {
    id: n.id,
    email: n.email,
    user_metadata: { name: n.name || "" },
    email_confirmed_at: n.email_confirmed_at,
    created_at: n.created_at,
  };
}
async function linkErzeugen(nutzerId, typ) {
  const token = k.zufallsToken(32);
  await q(`insert into email_tokens (token_hash, user_id, typ, expires_at)
           values ($1, $2, $3, now() + ($4 || ' milliseconds')::interval)`,
          [k.tokenAbdruck(token), nutzerId, typ, String(cfg.linkdauer)]);
  return token;
}
function verifyUrl(token, typ, ziel) {
  const p = new URLSearchParams({ token, type: typ });
  if (ziel) p.set("redirect_to", ziel);
  return `${cfg.apiUrl}/auth/v1/verify?${p.toString()}`;
}
/* Nur eigene Adressen als Rücksprungziel zulassen – sonst ließe sich
   der Link missbrauchen, um Tokens auf fremde Seiten zu schicken. */
function zielErlaubt(ziel) {
  if (!ziel) return cfg.appUrl;
  try {
    const u = new URL(ziel);
    const erlaubt = cfg.erlaubteHerkuenfte.some((h) => u.origin === h);
    return erlaubt ? ziel : cfg.appUrl;
  } catch {
    return cfg.appUrl;
  }
}

/* ---------- Endpunkte ---------- */
async function signup(req, res, body, url) {
  const email = String(body.email || "").trim().toLowerCase();
  const passwort = String(body.password || "");
  const name = String((body.data && body.data.name) || "").slice(0, 60);
  if (!EMAIL.test(email)) return res.json(400, { message: "Ungültige E-Mail-Adresse" });
  if (passwort.length < 8) return res.json(422, { message: "Password should be at least 8 characters" });

  const vorhanden = await eine(`select id from users where lower(email) = $1`, [email]);
  if (vorhanden) return res.json(422, { message: "User already registered" });

  const nutzer = await eine(
    `insert into users (email, password_hash, name, email_confirmed_at)
     values ($1, $2, $3, $4) returning *`,
    [email, k.passwortHash(passwort), name, cfg.bestaetigungNoetig ? null : new Date()]);

  if (cfg.bestaetigungNoetig) {
    const token = await linkErzeugen(nutzer.id, "signup");
    await mail.schicke(email, "signup", verifyUrl(token, "signup", zielErlaubt(url.searchParams.get("redirect_to"))), name);
    return res.json(200, oeffentlich(nutzer));      // noch keine Sitzung
  }
  return res.json(200, await sitzungFuer(nutzer));
}

async function token(req, res, body, url) {
  const art = url.searchParams.get("grant_type") || "password";

  if (art === "refresh_token") {
    const zeile = await eine(
      `select r.*, u.* from refresh_tokens r join users u on u.id = r.user_id
       where r.token = $1 and r.expires_at > now()`, [String(body.refresh_token || "")]);
    if (!zeile) return res.json(400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
    // Einmalgebrauch: altes Token sofort entwerten
    await q(`delete from refresh_tokens where token = $1`, [body.refresh_token]);
    return res.json(200, await sitzungFuer(zeile));
  }

  const email = String(body.email || "").trim().toLowerCase();
  const nutzer = await eine(`select * from users where lower(email) = $1`, [email]);
  if (!nutzer || !k.passwortPasst(String(body.password || ""), nutzer.password_hash)) {
    return res.json(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
  }
  if (cfg.bestaetigungNoetig && !nutzer.email_confirmed_at) {
    return res.json(400, { error: "invalid_grant", error_description: "Email not confirmed" });
  }
  return res.json(200, await sitzungFuer(nutzer));
}

async function logout(req, res, body, url, nutzer) {
  if (nutzer) await q(`delete from refresh_tokens where user_id = $1`, [nutzer.id]);
  return res.leer(204);
}

async function nutzerLesen(req, res, body, url, nutzer) {
  if (!nutzer) return res.json(401, { message: "JWT missing" });
  return res.json(200, oeffentlich(nutzer));
}

async function nutzerAendern(req, res, body, url, nutzer) {
  if (!nutzer) return res.json(401, { message: "JWT missing" });
  if (body.password) {
    if (String(body.password).length < 8) {
      return res.json(422, { message: "Password should be at least 8 characters" });
    }
    await q(`update users set password_hash = $1 where id = $2`,
            [k.passwortHash(String(body.password)), nutzer.id]);
    // Alle anderen Geräte abmelden
    await q(`delete from refresh_tokens where user_id = $1`, [nutzer.id]);
  }
  if (typeof body.data?.name === "string") {
    await q(`update users set name = $1 where id = $2`, [body.data.name.slice(0, 60), nutzer.id]);
  }
  const frisch = await eine(`select * from users where id = $1`, [nutzer.id]);
  return res.json(200, oeffentlich(frisch));
}

async function recover(req, res, body, url) {
  const email = String(body.email || "").trim().toLowerCase();
  const nutzer = await eine(`select * from users where lower(email) = $1`, [email]);
  // Immer dieselbe Antwort – sonst verrät die API, welche Adressen es gibt.
  if (nutzer) {
    const token = await linkErzeugen(nutzer.id, "recovery");
    await mail.schicke(email, "recovery",
      verifyUrl(token, "recovery", zielErlaubt(url.searchParams.get("redirect_to"))), nutzer.name);
  }
  return res.json(200, {});
}

/* Aufruf aus der Mail: Token einlösen und mit Sitzung zur App zurück. */
async function verify(req, res, body, url) {
  const token = url.searchParams.get("token") || "";
  const typ = url.searchParams.get("type") || "signup";
  const ziel = zielErlaubt(url.searchParams.get("redirect_to"));

  const zeile = await eine(
    `select * from email_tokens where token_hash = $1 and typ = $2
       and used_at is null and expires_at > now()`, [k.tokenAbdruck(token), typ]);
  if (!zeile) {
    return res.weiter(`${ziel}#error=access_denied&error_description=${encodeURIComponent("Link ungültig oder abgelaufen")}`);
  }
  await q(`update email_tokens set used_at = now() where token_hash = $1`, [zeile.token_hash]);

  const nutzer = await eine(`select * from users where id = $1`, [zeile.user_id]);
  if (!nutzer) return res.weiter(`${ziel}#error=access_denied`);
  if (typ === "signup" && !nutzer.email_confirmed_at) {
    await q(`update users set email_confirmed_at = now() where id = $1`, [nutzer.id]);
  }
  const s = await sitzungFuer(nutzer);
  const p = new URLSearchParams({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: String(s.expires_in),
    token_type: "bearer",
    type: typ,
  });
  return res.weiter(`${ziel}#${p.toString()}`);
}

/* Aus einem Authorization-Kopf den Nutzer bestimmen. */
async function nutzerAusAnfrage(req) {
  const kopf = req.headers.authorization || "";
  if (!kopf.startsWith("Bearer ")) return null;
  const daten = k.jwtPruefen(kopf.slice(7));
  if (!daten || !daten.sub) return null;
  return await eine(`select * from users where id = $1`, [daten.sub]);
}

module.exports = { signup, token, logout, nutzerLesen, nutzerAendern, recover, verify, nutzerAusAnfrage, oeffentlich };
