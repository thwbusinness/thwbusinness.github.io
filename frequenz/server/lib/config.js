"use strict";
/* Einstellungen kommen ausschließlich aus Umgebungsvariablen –
   nichts Geheimes liegt im Code oder im Repository. */

function pflicht(name) {
  const wert = process.env[name];
  if (!wert) {
    console.error(`Fehlende Umgebungsvariable: ${name}`);
    process.exit(1);
  }
  return wert;
}

const cfg = {
  port: parseInt(process.env.PORT || "8080", 10),
  datenbank: pflicht("DATABASE_URL"),
  jwtSecret: pflicht("JWT_SECRET"),            // mind. 32 zufällige Zeichen
  appUrl: (process.env.APP_URL || "https://thwbusinness.github.io/frequenz/").replace(/\/*$/, "/"),
  apiUrl: (process.env.API_URL || "http://localhost:8080").replace(/\/+$/, ""),

  /* Erlaubte Herkünfte für Browser-Anfragen. Mehrere mit Komma trennen. */
  erlaubteHerkuenfte: (process.env.ALLOWED_ORIGINS || "https://thwbusinness.github.io")
    .split(",").map((s) => s.trim()).filter(Boolean),

  /* Muss die E-Mail bestätigt werden, bevor man sich anmelden kann? */
  bestaetigungNoetig: (process.env.REQUIRE_EMAIL_CONFIRM || "true") !== "false",

  /* Bremse gegen Durchprobieren, pro IP und Zeitfenster. */
  bremse: {
    anmeldung: parseInt(process.env.RATE_LIMIT_TOKEN || "20", 10),
    konto: parseInt(process.env.RATE_LIMIT_AUTH || "10", 10),
    fensterMin: parseInt(process.env.RATE_LIMIT_WINDOW_MIN || "15", 10),
  },

  zugangsdauer: 60 * 60 * 1000,                // Zugangstoken: eine Stunde
  sitzungsdauer: 30 * 24 * 60 * 60 * 1000,     // Erneuerungstoken: 30 Tage
  linkdauer: 24 * 60 * 60 * 1000,              // Links aus Mails: ein Tag

  mail: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Frequenz-Tagebuch <noreply@example.com>",
    tls: (process.env.SMTP_MODE || "starttls").toLowerCase() === "tls",
  },

  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:noreply@example.com",
  },
};

cfg.mailAktiv = !!(cfg.mail.host && cfg.mail.from);
cfg.pushAktiv = !!(cfg.push.publicKey && cfg.push.privateKey);

module.exports = cfg;
