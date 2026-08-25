/*
 * send-email – verschickt die Anmelde- und Passwortmails über den eigenen
 * Mailserver, statt sie von Supabase verschicken zu lassen.
 *
 * Supabase ruft diese Funktion als "Send Email Hook" auf. Der Aufruf ist
 * nach dem Standard-Webhooks-Verfahren signiert; die Signatur wird geprüft,
 * bevor irgendetwas passiert.
 *
 * Deploy:
 *   supabase functions deploy send-email --no-verify-jwt
 *   supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...' \
 *     SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... \
 *     SMTP_FROM='Frequenz-Tagebuch <noreply@deine-domain.de>'
 *
 * Danach im Dashboard unter Authentication → Hooks den "Send Email Hook"
 * auf diese Funktion zeigen lassen und aktivieren.
 */
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const HOOK_SECRET  = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const SMTP_HOST    = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT    = parseInt(Deno.env.get("SMTP_PORT") ?? "587", 10);
const SMTP_USER    = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS    = Deno.env.get("SMTP_PASS") ?? "";
const SMTP_FROM    = Deno.env.get("SMTP_FROM") ?? "Frequenz-Tagebuch <noreply@example.com>";
/* "starttls" (Port 587, Standard) oder "tls" (Port 465) */
const SMTP_MODE    = (Deno.env.get("SMTP_MODE") ?? "starttls").toLowerCase();

/* ===================== PURE START ===================== */
/* Alles hier drin ist frei von Deno und Netzwerk – und damit testbar. */

/** Baut den Link, den Supabase sonst selbst in die Mail setzen würde. */
function bestaetigungsUrl(supabaseUrl, d) {
  const basis = String(supabaseUrl || "").replace(/\/+$/, "");
  const ziel = d.redirect_to || d.site_url || "";
  const params = new URLSearchParams({
    token: d.token_hash || "",
    type: d.email_action_type || "signup",
  });
  if (ziel) params.set("redirect_to", ziel);
  return basis + "/auth/v1/verify?" + params.toString();
}

function knopf(url, text) {
  return '<p style="margin:26px 0"><a href="' + url + '" ' +
    'style="display:inline-block;padding:13px 24px;border-radius:12px;' +
    'background:#8b5cf6;color:#ffffff;text-decoration:none;font-weight:600;' +
    'font-family:-apple-system,Segoe UI,Roboto,sans-serif">' + text + "</a></p>";
}

function huelle(inhalt, url) {
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,sans-serif;' +
    'font-size:16px;line-height:1.6;color:#1c1626;max-width:560px;margin:0 auto;padding:8px">' +
    '<div style="font-size:26px;letter-spacing:.02em;color:#8b5cf6">&#10022;</div>' +
    inhalt +
    '<hr style="border:0;border-top:1px solid #e7e2f0;margin:28px 0">' +
    '<p style="color:#6b6480;font-size:13px">Falls der Knopf nicht funktioniert, ' +
    'kopiere diesen Link in deinen Browser:<br>' +
    '<span style="word-break:break-all">' + url + "</span></p>" +
    '<p style="color:#9a93ad;font-size:12px">Frequenz-Tagebuch</p></div>';
}

/** Betreff, HTML und Textfassung je nach Anlass. */
function vorlage(typ, url, name) {
  const anrede = name ? "Hallo " + name + "," : "Hallo,";

  switch (typ) {
    case "signup":
      return {
        betreff: "Willkommen im Frequenz-Tagebuch – bitte bestätigen",
        html: huelle(
          "<h2>Fast geschafft</h2><p>" + anrede + " schön, dass du dabei bist. " +
          "Bestätige noch kurz deine E-Mail-Adresse, dann ist dein Tagebuch startklar.</p>" +
          knopf(url, "E-Mail bestätigen") +
          "<p>Du hast dich nicht angemeldet? Dann ignorier diese Nachricht einfach.</p>", url),
        text: anrede + "\n\nBestätige deine E-Mail-Adresse, dann ist dein Tagebuch startklar:\n" +
              url + "\n\nDu hast dich nicht angemeldet? Dann ignorier diese Nachricht.\n",
      };

    case "recovery":
      return {
        betreff: "Neues Passwort für dein Frequenz-Tagebuch",
        html: huelle(
          "<h2>Passwort zurücksetzen</h2><p>" + anrede + " klick auf den Knopf, " +
          "dann kannst du direkt ein neues Passwort vergeben.</p>" +
          knopf(url, "Neues Passwort vergeben") +
          "<p>Du hast das nicht angefordert? Dann ändert sich nichts.</p>", url),
        text: anrede + "\n\nNeues Passwort vergeben:\n" + url +
              "\n\nDu hast das nicht angefordert? Dann ändert sich nichts.\n",
      };

    case "magiclink":
      return {
        betreff: "Dein Anmeldelink fürs Frequenz-Tagebuch",
        html: huelle(
          "<h2>Anmelden ohne Passwort</h2><p>" + anrede + " dieser Link meldet dich direkt an. " +
          "Er gilt nur kurz und nur einmal.</p>" + knopf(url, "Anmelden"), url),
        text: anrede + "\n\nAnmelden:\n" + url + "\n",
      };

    case "invite":
      return {
        betreff: "Du bist zum Frequenz-Tagebuch eingeladen",
        html: huelle(
          "<h2>Eingeladen</h2><p>" + anrede + " für dich wurde ein Zugang zum Frequenz-Tagebuch " +
          "angelegt. Über den Knopf vergibst du dein Passwort und legst los.</p>" +
          knopf(url, "Zugang einrichten"), url),
        text: anrede + "\n\nZugang einrichten:\n" + url + "\n",
      };

    case "email_change":
    case "email_change_new":
    case "email_change_current":
      return {
        betreff: "Neue E-Mail-Adresse bestätigen",
        html: huelle(
          "<h2>Adresse bestätigen</h2><p>" + anrede + " bestätige deine neue E-Mail-Adresse, " +
          "damit sie für dein Tagebuch gilt.</p>" + knopf(url, "Adresse bestätigen"), url),
        text: anrede + "\n\nNeue Adresse bestätigen:\n" + url + "\n",
      };

    case "reauthentication":
      return {
        betreff: "Bestätigungscode fürs Frequenz-Tagebuch",
        html: huelle(
          "<h2>Kurz bestätigen</h2><p>" + anrede + " zur Sicherheit brauchen wir noch " +
          "eine Bestätigung.</p>" + knopf(url, "Bestätigen"), url),
        text: anrede + "\n\nBestätigen:\n" + url + "\n",
      };

    default:
      return {
        betreff: "Nachricht vom Frequenz-Tagebuch",
        html: huelle("<p>" + anrede + "</p>" + knopf(url, "Weiter"), url),
        text: anrede + "\n\n" + url + "\n",
      };
  }
}

/** Standard Webhooks: HMAC-SHA256 über "id.timestamp.body". */
async function signaturGueltig(secret, headers, rumpf, jetztMs) {
  if (!secret) return true;                       // ohne Secret keine Prüfung
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sig = headers.get("webhook-signature");
  if (!id || !ts || !sig) return false;

  const alter = Math.abs(jetztMs / 1000 - parseInt(ts, 10));
  if (!isFinite(alter) || alter > 300) return false;   // höchstens fünf Minuten alt

  const roh = secret.startsWith("v1,whsec_") ? secret.slice("v1,whsec_".length)
            : secret.startsWith("whsec_")    ? secret.slice("whsec_".length)
            : secret;
  const schluessel = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(roh), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const daten = new TextEncoder().encode(id + "." + ts + "." + rumpf);
  const roher = new Uint8Array(await crypto.subtle.sign("HMAC", schluessel, daten));
  const erwartet = btoa(String.fromCharCode(...roher));

  // Der Header kann mehrere Signaturen enthalten: "v1,abc v1,def"
  return sig.split(" ").some((teil) => {
    const wert = teil.includes(",") ? teil.split(",")[1] : teil;
    if (wert.length !== erwartet.length) return false;
    let gleich = 0;                                // konstante Laufzeit
    for (let i = 0; i < wert.length; i++) gleich |= wert.charCodeAt(i) ^ erwartet.charCodeAt(i);
    return gleich === 0;
  });
}
/* ====================== PURE END ====================== */

async function verschicke(an, betreff, html, text) {
  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_MODE === "tls",
      auth: { username: SMTP_USER, password: SMTP_PASS },
    },
  });
  try {
    await client.send({ from: SMTP_FROM, to: an, subject: betreff, content: text, html: html });
  } finally {
    await client.close();
  }
}

Deno.serve(async (req) => {
  const rumpf = await req.text();

  if (!(await signaturGueltig(HOOK_SECRET, req.headers, rumpf, Date.now()))) {
    return new Response(JSON.stringify({ error: "ungültige Signatur" }), { status: 401 });
  }

  let nutzlast;
  try {
    nutzlast = JSON.parse(rumpf);
  } catch {
    return new Response(JSON.stringify({ error: "kein gültiges JSON" }), { status: 400 });
  }

  const nutzer = nutzlast.user ?? {};
  const daten = nutzlast.email_data ?? {};
  const empfaenger = nutzer.email;
  if (!empfaenger) {
    return new Response(JSON.stringify({ error: "keine Empfängeradresse" }), { status: 400 });
  }

  const url = bestaetigungsUrl(SUPABASE_URL, daten);
  const name = (nutzer.user_metadata && nutzer.user_metadata.name) || "";
  const { betreff, html, text } = vorlage(daten.email_action_type, url, name);

  try {
    await verschicke(empfaenger, betreff, html, text);
  } catch (err) {
    // Supabase zeigt die Meldung im Log an; 500 sorgt für einen erneuten Versuch.
    console.error("Versand fehlgeschlagen:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }

  return new Response("{}", { headers: { "Content-Type": "application/json" } });
});
