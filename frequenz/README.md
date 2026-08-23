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
| **Mehr** | Name, JSON-Backup & Import, Tagebuch als Textdatei exportieren, Reset. |

## Technik

- Eine einzige `index.html` – kein Build, kein Framework, keine externen Abhängigkeiten.
- Daten liegen ausschließlich im `localStorage` des Browsers. Kein Server, kein Konto, kein Tracking.
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
