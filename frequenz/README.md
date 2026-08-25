# Frequenz-Tagebuch

Tägliches Tagebuch, in dem Frequenz (Stimmung/Bewusstseinsebene) und Manifestation
zusammenlaufen – begleitend zu einem 8-Wochen-Manifestationsprogramm.

**Live:** https://thwbusinness.github.io/frequenz/

## Aufbau

| Bereich | Inhalt |
|---|---|
| **Tagebuch** | Ein Tagesbogen pro Tag: Morgenseite (Frequenz, Emotion, „Wie fühle ich mich?", „Wie will ich mich fühlen?", 3x Dankbarkeit), Tagsüber (Zeichen & Synchronizitäten, freies Schreiben), Abendseite (gelungen / dankbar / losgelassen / wie will ich morgen aufwachen). Autosave, Blättern durch alle Tage, Nachtragen jederzeit möglich. |
| **8 Wochen** | Programm mit Startdatum, 8 Wochenkarten mit editierbarem Titel, Fokus, Aufgabe und Wochenreflexion. Die sieben Tagespunkte je Woche füllen sich **automatisch** aus dem Tagebuch – nichts wird von Hand abgehakt. Antippen öffnet den jeweiligen Tag. Die Vorbelegung der Wochen ist ein Gerüst – überschreibbar mit den Kapiteln des eigenen Buches. |
| **Frequenz** | 30-Tage-Verlaufskurve, Ø-Werte, Streak, häufigste Emotion, Wochenüberblick zum direkten Nachtragen, abhakbare Booster (eigene ergänzbar), Box-Atmung. |
| **Ziele** | Manifestationsziele im Präsens, Vertrauens-Level, Schreibmethoden 3-6-9 / 55x5 mit Tageszähler, „Ist eingetroffen"-Archiv. |
| **Archiv** | Alle Einträge chronologisch, Volltextsuche, Sprung zum jeweiligen Tag. |
| **Mehr** | Konto & Sync (Passwort ändern, Konto löschen), Erinnerungen, Name, JSON-Backup & Import, Tagebuch als Textdatei exportieren, Reset. |

## Wenn der Abgleich klemmt

Meldet die App unter *Mehr* etwas wie „Could not find the table 'public.app_meta' in the
schema cache", fehlt das Schema in der Datenbank. Dann erscheint dort ein Knopf
**Verbindung prüfen**, der jede Tabelle einzeln testet und auflistet, welche fehlt.

Behebung: **`supabase-alles.sql`** im SQL-Editor vollständig ausführen – die Datei
enthält Schema und Erinnerungen zusammen und ist so geschrieben, dass mehrfaches
Ausführen nichts kaputt macht. Danach in der App erneut prüfen.

Direkt zum Kopieren:
`https://raw.githubusercontent.com/thwbusinness/thwbusinness.github.io/main/frequenz/supabase-alles.sql`

Bleibt es dabei, obwohl die Tabellen im Table Editor sichtbar sind, hängt der
Schema-Zwischenspeicher von PostgREST. Ein `notify pgrst, 'reload schema';` im
SQL-Editor löst das.

## Wann zählt ein Tag?

Ein Tag zählt für das 8-Wochen-Programm, wenn drei Dinge im Tagesbogen stehen:

1. **Frequenz eingetragen** (morgens oder abends)
2. **Morgens ausgerichtet oder gedankt** (Absicht oder mindestens ein Dankbarkeitsfeld)
3. **Abendseite ausgefüllt** (mindestens eines der vier Abendfelder)

Der Fortschritt lässt sich damit nicht per Häkchen erzeugen – er entsteht aus dem,
was tatsächlich geschrieben wurde. Im Tagebuch zeigt die Karte *Tagesabschluss* live,
was noch fehlt.

## Erinnerungen (Web Push)

Morgens und abends ein Stups aufs Handy – übersprungen, wenn der Tag schon steht.
Einrichtung in vier Schritten:

1. **Schlüsselpaar erzeugen:** `npx web-push generate-vapid-keys`
2. **Öffentlichen Teil** in `config.js` bei `vapidPublicKey` eintragen.
3. **Datenbank vorbereiten:** `supabase-push.sql` im SQL-Editor ausführen; danach die
   Extensions `pg_cron` und `pg_net` aktivieren und den auskommentierten
   `cron.schedule`-Block mit Projekt-Ref und einem selbst gewählten `CRON_SECRET` ausführen.
4. **Funktion deployen:**
   ```
   supabase functions deploy send-reminders --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
                        VAPID_SUBJECT=mailto:deine@adresse.de CRON_SECRET=...
   ```

Der private Schlüssel gehört ausschließlich in die Supabase-Secrets, nie ins Repository.

**Auf dem iPhone** funktionieren Mitteilungen nur, wenn die App über *Teilen → Zum
Home-Bildschirm* installiert ist und von dort geöffnet wird (Vorgabe von iOS seit 16.4).

Die Funktion läuft alle fünf Minuten, vergleicht die Ortszeit jeder Anmeldung mit den
eingestellten Uhrzeiten und prüft vor dem Senden, ob der Tagesbogen an dieser Stelle
schon ausgefüllt ist. Tote Anmeldungen (Antwort 404/410) werden automatisch entfernt.

## Mailversand über den eigenen Server

Die Anmelde- und Passwortmails gehen **nicht** über Supabase raus, sondern über die
Edge Function `send-email`. Supabase ruft sie als *Send Email Hook* auf, die Funktion
baut die Mail und verschickt sie per SMTP. Vorteile: deutsche Texte und das Design
liegen im Code, der Absender ist deine Domain, und die Mengenbegrenzung des
Supabase-Versands entfällt.

### Einrichten

1. **Zugangsdaten besorgen** – funktioniert mit jedem SMTP-Anbieter:

   | Anbieter | Host | Port | Bemerkung |
   |---|---|---|---|
   | Eigener Mailserver | z.B. `smtp.deine-domain.de` | 587 | Zugangsdaten vom Hoster |
   | Resend | `smtp.resend.com` | 587 | Benutzer `resend`, Passwort = API-Key |
   | Brevo | `smtp-relay.brevo.com` | 587 | Server in der EU |
   | Mailjet | `in-v3.mailjet.com` | 587 | Server in der EU |

2. **Funktion deployen und Zugangsdaten hinterlegen:**
   ```
   supabase functions deploy send-email --no-verify-jwt
   supabase secrets set SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... \
     SMTP_FROM='Frequenz-Tagebuch <noreply@deine-domain.de>' SMTP_MODE=starttls
   ```
   `SMTP_MODE=tls` nur bei Port 465.

3. **Hook aktivieren:** Dashboard → *Authentication → Hooks → Send Email Hook*,
   auf `send-email` zeigen lassen, einschalten. Supabase erzeugt dabei ein Secret
   (`v1,whsec_…`) – das gehört als `SEND_EMAIL_HOOK_SECRET` in die Secrets der Funktion:
   ```
   supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...'
   ```
   Ohne dieses Secret prüft die Funktion die Signatur nicht und würde Aufrufe von
   überall annehmen – also unbedingt setzen.

4. **Absenderdomain verifizieren** (SPF, DKIM, bei eigenem Server auch DMARC), sonst
   landen die Mails im Spam.

5. **Mengenbegrenzung anheben:** Dashboard → *Authentication → Rate Limits* → „Rate limit
   for sending emails". Die Vorgabe passt zum Testversand, nicht zum echten Betrieb.

### Was die Funktion abdeckt

Registrierung, Passwort vergessen, Magic Link, Einladung, Adressänderung und
Bestätigungscode – alle auf Deutsch. Der Bestätigungslink wird selbst gebaut
(`/auth/v1/verify?token=…&type=…&redirect_to=…`).

Der Aufruf von Supabase ist nach dem Standard-Webhooks-Verfahren signiert; die Funktion
prüft die Signatur und weist Aufrufe ab, die älter als fünf Minuten sind.

### Prüfen

```
node tests/mail-test.js     # Linkaufbau, alle Vorlagen, Signaturprüfung
```

Nach dem Deployen: in der App ein Testkonto anlegen und unter *Edge Functions → Logs*
nachsehen, ob der Aufruf ankam und der Versand geklappt hat.

## Registrierung & Anmeldung

Sobald eine Verbindung konfiguriert ist, startet die App mit einem Willkommensbildschirm:

- **Konto anlegen** – Vorname, E-Mail, Passwort (mit Wiederholung). Verlangt Supabase eine
  Bestätigungsmail, wird darauf hingewiesen; der Link aus der Mail meldet direkt an.
- **Anmelden** – inklusive **Passwort vergessen**: Der Link aus der Mail führt auf einen
  Bildschirm zum Setzen eines neuen Passworts.
- **Ohne Konto starten** – die App bleibt rein lokal nutzbar. Unter *Mehr → Konto & Sync*
  lässt sich später ein Konto anlegen; die bis dahin lokal geschriebenen Einträge werden
  beim ersten Abgleich übernommen.

Fehlermeldungen von Supabase werden auf Deutsch übersetzt (falsches Passwort, Konto
existiert bereits, E-Mail nicht bestätigt, Datenbank nicht eingerichtet, keine Verbindung).

**In Supabase einzustellen:** Unter *Authentication → URL Configuration* muss
`https://thwbusinness.github.io/frequenz/` als Site URL und als Redirect URL eingetragen sein –
sonst zeigen die Links aus den Bestätigungs- und Passwort-Mails ins Leere.

## Datenbank & Sync (optional)

Ohne Konfiguration läuft die App rein lokal. Mit einem Supabase-Projekt dahinter
synchronisiert sie über alle Geräte:

1. Auf supabase.com ein kostenloses Projekt anlegen.
2. **`supabase-alles.sql`** im SQL-Editor ausführen – legt alle vier Tabellen an,
   schaltet Row Level Security ein und richtet die Erinnerungen mit ein. Die Datei fasst
   `supabase.sql` und `supabase-push.sql` zusammen, damit einmal Einfügen reicht;
   mehrfaches Ausführen schadet nicht.
3. Projekt-URL und den `anon public` Key in `config.js` eintragen (oder in der App unter
   **Mehr → Konto & Sync** hinterlegen, dann bleiben sie nur auf dem Gerät).
4. In der App Konto anlegen und anmelden.

Der Anon-Key darf öffentlich im Repository stehen – der Schutz liegt in den RLS-Policies,
nicht im Schlüssel. Mehrere Nutzer (z.B. Coaching-Klienten) können sich mit eigenem Konto
anmelden und sehen jeweils nur ihr eigenes Tagebuch.

**Konfliktregel:** Bei gleichzeitiger Bearbeitung gewinnt pro Datensatz (Tag / Ziel) der
zuletzt geschriebene Stand. Für ein persönliches Tagebuch ist das in der Praxis unkritisch,
solange nicht derselbe Tag parallel auf zwei Geräten offline bearbeitet wird.

**Datenschutz:** Die Einträge liegen unverschlüsselt in der Datenbank. Wer Zugriff auf das
Supabase-Projekt hat, kann sie lesen. Für Klientendaten ist das mitzudenken.

**Konto löschen:** Unter *Mehr → Konto & Sync → Konto löschen* entfernt die App alle
serverseitigen Daten und anschließend das Konto selbst (SQL-Funktion `delete_own_account`
aus `supabase.sql`). Vorher bietet sie ein Backup an.

**Vor dem ersten Klientenzugang** durchgehen: `supabase-mailvorlagen.md` (deutsche
Mailtexte, eigener SMTP-Versand), `ENTWURF-datenschutz.md` und `ENTWURF-impressum.md`
ausfüllen und prüfen lassen, Projektregion kontrollieren (EU), und einen bezahlten
Supabase-Plan wegen der Sicherungen erwägen.

## Technik

- Eine einzige `index.html` – kein Build, kein Framework, keine externen Abhängigkeiten.
- Ohne Sync liegen die Daten ausschließlich im `localStorage` des Browsers.
- Mit Sync: `localStorage` bleibt die Arbeitskopie, Supabase ist die Ablage. Angesprochen wird
  sie direkt per `fetch` (Auth + PostgREST) – ohne SDK, ohne Build-Schritt.
- Synchronisiert wird beim Start, beim Zurückkehren zur App, nach Änderungen und auf Knopfdruck.
- Autosave beim Tippen (400 ms Verzögerung) plus Speichern beim Verlassen der Seite.
- PWA: `manifest.webmanifest` + `sw.js` (network-first). Über „Zum Home-Bildschirm" installierbar,
  läuft danach offline.
- Bestehende Daten aus v1 (Check-ins, Dankbarkeit, Reflexionen) werden beim ersten Start
  automatisch in Tagesbögen überführt.

## Skala

Die Emotionsliste orientiert sich an den Bewusstseinsebenen nach David R. Hawkins
(Scham → Frieden), umgerechnet auf 0–100. Jede Emotion setzt einen Richtwert,
der Regler bleibt frei anpassbar.

## Datensicherung

Browser-Speicher kann verloren gehen (Cache leeren, neues Gerät). Unter **Mehr** gibt es
ein JSON-Backup zum Wiedereinspielen und einen Textexport des ganzen Tagebuchs.
