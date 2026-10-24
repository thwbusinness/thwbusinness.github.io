"use strict";
/* Mailversand über den eigenen Server. Die Vorlagen sind dieselben
   wie in der Supabase-Variante – nur verschickt sie hier die API. */
const cfg = require("./config");

let transport = null;
function verbindung() {
  if (!cfg.mailAktiv) return null;
  if (!transport) {
    const nodemailer = require("nodemailer");
    transport = nodemailer.createTransport({
      host: cfg.mail.host,
      port: cfg.mail.port,
      secure: cfg.mail.tls,
      auth: cfg.mail.user ? { user: cfg.mail.user, pass: cfg.mail.pass } : undefined,
    });
  }
  return transport;
}

function knopf(url, text) {
  return `<p style="margin:26px 0"><a href="${url}" style="display:inline-block;padding:13px 24px;`
    + `border-radius:12px;background:#8b5cf6;color:#ffffff;text-decoration:none;font-weight:600;`
    + `font-family:-apple-system,Segoe UI,Roboto,sans-serif">${text}</a></p>`;
}
function huelle(inhalt, url) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,sans-serif;font-size:16px;`
    + `line-height:1.6;color:#1c1626;max-width:560px;margin:0 auto;padding:8px">`
    + `<div style="font-size:26px;color:#8b5cf6">&#10022;</div>${inhalt}`
    + `<hr style="border:0;border-top:1px solid #e7e2f0;margin:28px 0">`
    + `<p style="color:#6b6480;font-size:13px">Falls der Knopf nicht funktioniert, kopiere diesen Link `
    + `in deinen Browser:<br><span style="word-break:break-all">${url}</span></p>`
    + `<p style="color:#9a93ad;font-size:12px">Frequenz-Tagebuch</p></div>`;
}

function vorlage(typ, url, name) {
  const anrede = name ? `Hallo ${name},` : "Hallo,";
  if (typ === "signup") {
    return {
      betreff: "Willkommen im Frequenz-Tagebuch – bitte bestätigen",
      html: huelle(`<h2>Fast geschafft</h2><p>${anrede} schön, dass du dabei bist. Bestätige noch kurz `
        + `deine E-Mail-Adresse, dann ist dein Tagebuch startklar.</p>${knopf(url, "E-Mail bestätigen")}`
        + `<p>Du hast dich nicht angemeldet? Dann ignorier diese Nachricht einfach.</p>`, url),
      text: `${anrede}\n\nBestätige deine E-Mail-Adresse:\n${url}\n`,
    };
  }
  if (typ === "recovery") {
    return {
      betreff: "Neues Passwort für dein Frequenz-Tagebuch",
      html: huelle(`<h2>Passwort zurücksetzen</h2><p>${anrede} klick auf den Knopf, dann kannst du `
        + `direkt ein neues Passwort vergeben.</p>${knopf(url, "Neues Passwort vergeben")}`
        + `<p>Du hast das nicht angefordert? Dann ändert sich nichts.</p>`, url),
      text: `${anrede}\n\nNeues Passwort vergeben:\n${url}\n`,
    };
  }
  return {
    betreff: "Nachricht vom Frequenz-Tagebuch",
    html: huelle(`<p>${anrede}</p>${knopf(url, "Weiter")}`, url),
    text: `${anrede}\n\n${url}\n`,
  };
}

async function schicke(an, typ, url, name) {
  const { betreff, html, text } = vorlage(typ, url, name);
  const t = verbindung();
  if (!t) {
    // Ohne Mailkonfiguration: in die Ausgabe schreiben, damit man beim
    // Einrichten trotzdem an den Link kommt.
    console.log(`[Mail nicht konfiguriert] an ${an}: ${betreff}\n${url}`);
    return { verschickt: false, url };
  }
  await t.sendMail({ from: cfg.mail.from, to: an, subject: betreff, text, html });
  return { verschickt: true };
}

module.exports = { schicke, vorlage };
