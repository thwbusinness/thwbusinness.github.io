# Frequenz-Tagebuch

Tägliches Tagebuch, in dem Frequenz (Stimmung/Bewusstseinsebene) und Manifestation
zusammenlaufen – begleitend zu einem 8-Wochen-Manifestationsprogramm.

**Live:** https://thwbusinness.github.io/frequenz/

## Aufbau

| Bereich | Inhalt |
|---|---|
| **Tagebuch** | Ein Tagesbogen pro Tag: Morgenseite (Frequenz, Emotion, „Wie fühle ich mich?", „Wie will ich mich fühlen?", 3x Dankbarkeit), Tagsüber (Zeichen & Synchronizitäten, freies Schreiben), Abendseite (gelungen / dankbar / losgelassen / wie will ich morgen aufwachen). Autosave, Blättern durch alle Tage, Nachtragen jederzeit möglich. |
| **8 Wochen** | Programm mit Startdatum, 8 Wochenkarten mit je 7 Tageshaken, editierbarem Titel, Fokus, Aufgabe und Wochenreflexion. Die Vorbelegung ist ein Gerüst – überschreibbar mit den Kapiteln des eigenen Buches. |
| **Frequenz** | 30-Tage-Verlaufskurve, Ø-Werte, Streak, häufigste Emotion, Wochenüberblick zum direkten Nachtragen, Booster-Liste, Box-Atmung. |
| **Ziele** | Manifestationsziele im Präsens, Vertrauens-Level, Schreibmethoden 3-6-9 / 55x5 mit Tageszähler, „Ist eingetroffen"-Archiv. |
| **Archiv** | Alle Einträge chronologisch, Volltextsuche, Sprung zum jeweiligen Tag. |
| **Mehr** | Konto & Sync, Name, JSON-Backup & Import, Tagebuch als Textdatei exportieren, Reset. |

## Datenbank & Sync (optional)

Ohne Konfiguration läuft die App rein lokal. Mit einem Supabase-Projekt dahinter
synchronisiert sie über alle Geräte:

1. Auf supabase.com ein kostenloses Projekt anlegen.
2. `supabase.sql` im SQL-Editor ausführen – legt die drei Tabellen an und schaltet
   Row Level Security ein, sodass jeder Nutzer ausschließlich seine eigenen Zeilen sieht.
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
