# Tests

Endprüfungen im echten Browser (Chromium über Playwright) gegen einen
nachgebauten Supabase-Server. Kein Build nötig.

## Starten

```bash
npm i playwright-core                 # einmalig
node tests/mock-supabase.js &         # Nachbau von Auth + PostgREST auf :8123

# Testkopie der App mit Verbindung zum Nachbau
cp -r . /tmp/testapp && rm -rf /tmp/testapp/tests
echo 'window.FREQUENZ_CONFIG = { url: "http://localhost:8123", anonKey: "test" };' > /tmp/testapp/config.js
(cd /tmp/testapp && python3 -m http.server 8100 &)

node tests/smoke2.js       # lokal ohne Konto: Migration, Autosave, Navigation, Archiv, Export
node tests/auth-test.js    # Registrierung, Anmeldung, Passwort vergessen, Rücksprung aus der Mail
node tests/sync-test.js    # zwei Geräte, Rückrichtung, Löschung, Fremdkonto sieht nichts
node tests/konto-test.js   # abgelaufene Sitzung, Passwort ändern, Konto löschen
node tests/reset-test.js   # "Alle Daten löschen" räumt wirklich auf
node tests/boost-test.js   # Frequenz-Booster abhaken, eigene ergänzen
node tests/days-test.js    # Tagesabschluss und abgeleitete Wochenpunkte
node tests/push-test.js    # Erinnerungen: Zustände, Zeiten, sauberes Scheitern ohne Push-Dienst
node tests/ios.js          # Manifest, Service Worker, Schriftgrößen, kein Querscrollen
node tests/fn-test.js      # Kernlogik der Edge Function (Zeitzonen, Fenster, "schon erledigt?")
```

`fn-test.js` braucht keinen Browser und keinen Server.

## Wozu der Nachbau

Er ahmt Auth und PostgREST so weit nach, wie die App sie nutzt – inklusive
Zugriffstrennung zwischen Konten. Dadurch laufen die Tests ohne echtes
Supabase-Projekt und ohne echte Daten anzufassen.
