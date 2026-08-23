# Deutsche E-Mail-Vorlagen für Supabase

Supabase verschickt die Bestätigungs- und Passwort-Mails standardmäßig **auf Englisch**.
Hier die deutschen Fassungen zum Einfügen unter
*Authentication → Emails → Templates*.

Vorher unter *Authentication → URL Configuration* eintragen:

- **Site URL:** `https://thwbusinness.github.io/frequenz/`
- **Redirect URLs:** `https://thwbusinness.github.io/frequenz/`

Sonst zeigen alle Links ins Leere.

> **Eigener Versand nötig:** Der eingebaute Mailversand von Supabase ist zum Testen
> gedacht und auf wenige Nachrichten pro Stunde begrenzt. Sobald Klienten Zugänge
> bekommen, unter *Project Settings → Authentication → SMTP Settings* einen eigenen
> Anbieter hinterlegen (z.B. Resend, Postmark, Brevo) – mit einer Absenderadresse
> auf einer eigenen Domain, sonst landen die Mails im Spam.

---

## Confirm signup (Registrierung bestätigen)

**Betreff:** `Willkommen im Frequenz-Tagebuch – bitte bestätigen`

```html
<h2>Fast geschafft ✦</h2>
<p>Schön, dass du dabei bist. Bestätige noch kurz deine E-Mail-Adresse,
   dann ist dein Tagebuch startklar.</p>
<p><a href="{{ .ConfirmationURL }}"
      style="display:inline-block;padding:12px 22px;border-radius:12px;
             background:#8b5cf6;color:#ffffff;text-decoration:none;font-weight:600">
   E-Mail bestätigen
</a></p>
<p style="color:#666;font-size:13px">
   Falls der Knopf nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
   {{ .ConfirmationURL }}
</p>
<p style="color:#666;font-size:13px">
   Du hast dich nicht angemeldet? Dann ignoriere diese Nachricht einfach.
</p>
```

---

## Reset password (Passwort zurücksetzen)

**Betreff:** `Neues Passwort für dein Frequenz-Tagebuch`

```html
<h2>Passwort zurücksetzen</h2>
<p>Klick auf den Knopf, dann kannst du direkt ein neues Passwort vergeben.</p>
<p><a href="{{ .ConfirmationURL }}"
      style="display:inline-block;padding:12px 22px;border-radius:12px;
             background:#8b5cf6;color:#ffffff;text-decoration:none;font-weight:600">
   Neues Passwort vergeben
</a></p>
<p style="color:#666;font-size:13px">
   Falls der Knopf nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
   {{ .ConfirmationURL }}
</p>
<p style="color:#666;font-size:13px">
   Du hast das nicht angefordert? Dann ändert sich nichts – ignoriere die Nachricht.
</p>
```

---

## Change Email Address (E-Mail-Adresse ändern)

**Betreff:** `Neue E-Mail-Adresse bestätigen`

```html
<h2>Adresse bestätigen</h2>
<p>Bestätige deine neue E-Mail-Adresse, damit sie für dein Tagebuch gilt.</p>
<p><a href="{{ .ConfirmationURL }}"
      style="display:inline-block;padding:12px 22px;border-radius:12px;
             background:#8b5cf6;color:#ffffff;text-decoration:none;font-weight:600">
   Adresse bestätigen
</a></p>
<p style="color:#666;font-size:13px">{{ .ConfirmationURL }}</p>
```

---

## Magic Link (falls du ihn später aktivierst)

**Betreff:** `Dein Anmeldelink fürs Frequenz-Tagebuch`

```html
<h2>Anmelden ohne Passwort</h2>
<p>Dieser Link meldet dich direkt an. Er gilt nur kurz und nur einmal.</p>
<p><a href="{{ .ConfirmationURL }}"
      style="display:inline-block;padding:12px 22px;border-radius:12px;
             background:#8b5cf6;color:#ffffff;text-decoration:none;font-weight:600">
   Anmelden
</a></p>
<p style="color:#666;font-size:13px">{{ .ConfirmationURL }}</p>
```
