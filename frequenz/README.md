# Frequenz & Manifestation

Kleine Web-App, um die eigene Frequenz (Stimmung/Bewusstseinsebene) täglich zu führen
und Manifestation als feste Routine im Alltag zu verankern.

**Live:** https://thwbusinness.github.io/frequenz/

## Was drin ist

| Bereich | Funktion |
|---|---|
| **Heute** | Tagesüberblick, Affirmation des Tages, Tagesritual-Checkliste, Dankbarkeit, Zielübersicht |
| **Frequenz** | Täglicher Check-in (Regler 0–100 + Emotions-Skala), Notiz, passende Frequenz-Booster, 30-Tage-Verlaufskurve, Historie |
| **Ziele** | Ziele im Präsens formulieren, Vertrauens-Level tracken, Schreibmethoden 3-6-9 / 55x5 mit Tageszähler, „Ist eingetroffen" |
| **Journal** | Abendreflexion (gelungen / loslassen / morgen), Dankbarkeitseinträge, Zeitstrahl aller Tage |
| **Mehr** | Statistik (Streak, Ø-Werte), Name, JSON-Export/-Import, Reset |

Dazu: Box-Atmung (4-4-4-4) als geführte Übung.

## Technik

- Eine einzige `index.html` – kein Build, kein Framework, keine externen Abhängigkeiten.
- Daten liegen ausschließlich im `localStorage` des Browsers. Kein Server, kein Konto, kein Tracking.
- PWA: `manifest.webmanifest` + `sw.js` (network-first). Auf dem Handy über „Zum Home-Bildschirm"
  installierbar, läuft danach auch offline.

## Skala

Die Emotions-Skala orientiert sich an den Bewusstseinsebenen nach David R. Hawkins
(Scham → Frieden), umgerechnet auf 0–100. Jede Emotion setzt einen Richtwert,
der Regler bleibt frei anpassbar.

## Datensicherung

Browser-Speicher kann verloren gehen (Cache leeren, neues Gerät). Unter **Mehr → Export**
lässt sich jederzeit ein JSON-Backup ziehen und später wieder importieren.
