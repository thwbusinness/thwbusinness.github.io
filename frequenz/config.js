/* Verbindung zur Datenbank (Supabase).

   Der Publishable Key ist ein öffentlicher Schlüssel – er gehört in den
   Client und darf im Repository stehen. Geschützt werden die Daten über
   Row Level Security (siehe supabase.sql): jede Zeile gehört einer
   user_id, und niemand sieht fremde Zeilen.

   Ist hier nichts eingetragen, läuft die App rein lokal; die Werte
   lassen sich dann in der App unter "Mehr" hinterlegen. */
window.FREQUENZ_CONFIG = {
  url: "https://rqgjpnmiudgcvowiuefx.supabase.co",
  anonKey: "sb_publishable_YMOtUpe7rkVNHOEuOlmxjg_T2r2bWOD"
};
