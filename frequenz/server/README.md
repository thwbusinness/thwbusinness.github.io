# Eigene API für das Frequenz-Tagebuch

Ersetzt Supabase vollständig: Postgres, Anmeldung, Datenabgleich, Mailversand und
Erinnerungen laufen auf deinem Server. Die App bleibt unverändert – sie spricht
dieselben Endpunkte wie vorher, es ändert sich nur die URL in `config.js`.

## Was läuft wo

| Teil | vorher (Supabase) | jetzt |
|---|---|---|
| Datenbank | Supabase-Postgres | Postgres im Container |
| Anmeldung | GoTrue | `lib/auth.js` |
| Datenabgleich | PostgREST | `lib/rest.js` |
| Zugriffstrennung | Row Level Security | jede Abfrage im Code an die Kennung gebunden |
| Mailversand | Edge Function | `lib/mail.js` |
| Erinnerungen | Edge Function + pg_cron | Zeitgeber im Server |

## Einrichten

Vorausgesetzt: ein Server mit Docker und eine Domain, die darauf zeigt
(z.B. `api.deine-domain.de`).

```bash
git clone <dieses Repo> && cd frequenz/server
cp .env.example .env
nano .env                      # Passwort, JWT_SECRET, Domain, SMTP eintragen
openssl rand -base64 36        # taugt für DB_PASSWORT und JWT_SECRET
docker compose up -d
docker compose exec api node bin/schema.js
curl https://api.deine-domain.de/health
```

Danach in `frequenz/config.js`:

```js
window.FREQUENZ_CONFIG = {
  url: "https://api.deine-domain.de",
  anonKey: "wird-nicht-mehr-gebraucht",
  vapidPublicKey: "..."
};
```

Der Schlüssel bleibt im Objekt, damit die App unverändert bleibt – die eigene API
prüft ausschließlich das Anmeldetoken und ignoriert ihn.

## Sicherungen

`sicherung.sh` schreibt einen täglichen Abzug nach `backups/` und räumt nach 30 Tagen
auf. In die Crontab des Servers:

```
0 3 * * * /pfad/zu/server/sicherung.sh >> /var/log/frequenz-backup.log 2>&1
```

**Die Sicherungen gehören auf einen anderen Rechner.** Ein Abzug, der neben der
Datenbank liegt, hilft beim Serverausfall nicht.

## Was du ab jetzt selbst machst

Das ist der Preis der Unabhängigkeit, und er ist dauerhaft:

- Sicherheitsupdates: `docker compose pull && docker compose up -d`, regelmäßig
- Sicherungen prüfen – eine Sicherung, die nie zurückgespielt wurde, ist keine
- Erreichbarkeit im Blick behalten (`/health` taugt für jede Überwachung)
- Postgres-Hauptversionen wandern nicht von selbst; ein Wechsel will geplant sein

## Umzug von Supabase

1. In der App unter *Mehr → Backup (.json)* auf jedem Gerät ein Backup ziehen.
2. Server aufsetzen, `config.js` umstellen, Konto neu anlegen.
3. Backup unter *Mehr → Import* einspielen – beim ersten Abgleich wandert alles hoch.

Für mehrere Klienten ginge auch ein Abzug der Supabase-Tabellen mit anschließendem
Einspielen; dabei müssen die Konten aus `auth.users` auf die neue `users`-Tabelle
abgebildet werden. Sag Bescheid, wenn das gebraucht wird – dafür schreibe ich ein
Umzugsskript.

## Prüfen

```bash
node ../tests/api-test.js        # Trennung zwischen Konten, Tokens, Löschen
node ../tests/smtp-sink.js &     # Mailempfänger für den Test
node ../tests/api-mail-test.js   # Bestätigung und Passwort-Reset über echte Mails
```

Dazu laufen sämtliche Browser-Testläufe aus `../tests/` unverändert gegen diese API –
sie wissen nicht, ob dahinter Supabase oder dieser Server steht.
