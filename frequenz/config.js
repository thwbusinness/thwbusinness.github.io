/* Verbindung zur Datenbank.
   Der Anon-Key ist ein öffentlicher Schlüssel – er darf im Repository stehen.
   Geschützt werden die Daten über Row Level Security in Supabase:
   jede Zeile gehört einer user_id, und niemand sieht fremde Zeilen.
   Solange hier nichts eingetragen ist, läuft die App rein lokal;
   die Werte lassen sich dann auch direkt in der App unter "Mehr" hinterlegen. */
window.FREQUENZ_CONFIG = {
  url: "",       // z.B. "https://abcdefgh.supabase.co"
  anonKey: ""    // der "anon public" Key aus Supabase → Project Settings → API
};
