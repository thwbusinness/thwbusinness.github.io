/*
 * send-reminders – verschickt die Push-Erinnerungen.
 *
 * Wird alle fünf Minuten von pg_cron aufgerufen (siehe supabase-push.sql).
 * Für jede Anmeldung wird die Ortszeit bestimmt; passt sie zur eingestellten
 * Uhrzeit, geht eine Mitteilung raus – es sei denn, der Tagesbogen ist an
 * dieser Stelle schon ausgefüllt. Doppelte Sendungen verhindert ein Datum
 * pro Anmeldung und Tageshälfte.
 *
 * Deploy:  supabase functions deploy send-reminders --no-verify-jwt
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
 */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@example.com";
const CRON_SECRET  = Deno.env.get("CRON_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Ortszeit einer Zeitzone als { datum: "YYYY-MM-DD", minuten: seit Mitternacht } */
function localNow(tz: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date());
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date());
  }
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    datum: `${get("year")}-${get("month")}-${get("day")}`,
    minuten: parseInt(hour, 10) * 60 + parseInt(get("minute"), 10),
  };
}

/** "07:30" -> 450 */
function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Fällig, wenn die Uhrzeit im gerade vergangenen Fenster lag. */
function faellig(ziel: number | null, jetzt: number, fenster = 6): boolean {
  if (ziel === null) return false;
  const diff = jetzt - ziel;
  return diff >= 0 && diff < fenster;
}

type Entry = { data?: { morning?: Record<string, unknown>; evening?: Record<string, unknown> } };

function morgenErledigt(e: Entry | null): boolean {
  if (!e?.data?.morning) return false;
  const m = e.data.morning as Record<string, unknown>;
  const dank = Array.isArray(m.dank) ? (m.dank as string[]).filter((x) => String(x || "").trim()).length : 0;
  return m.level !== null && m.level !== undefined && (dank > 0 || String(m.absicht ?? "").trim() !== "");
}
function abendErledigt(e: Entry | null): boolean {
  if (!e?.data?.evening) return false;
  const v = e.data.evening as Record<string, unknown>;
  return ["gelungen", "dankbar", "losgelassen", "morgen"].some((k) => String(v[k] ?? "").trim() !== "");
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const { data: subs, error } = await db.from("push_subscriptions").select("*");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let gesendet = 0, uebersprungen = 0, entfernt = 0;

  for (const s of subs ?? []) {
    const jetzt = localNow(s.tz || "Europe/Berlin");
    const istMorgen = faellig(toMinutes(s.morning), jetzt.minuten) && s.last_morning !== jetzt.datum;
    const istAbend  = faellig(toMinutes(s.evening), jetzt.minuten) && s.last_evening !== jetzt.datum;
    if (!istMorgen && !istAbend) continue;

    const { data: eintrag } = await db
      .from("journal_entries")
      .select("data")
      .eq("user_id", s.user_id)
      .eq("date", jetzt.datum)
      .maybeSingle();

    // Schon erledigt? Dann nicht stören – aber als gesendet vermerken.
    if ((istMorgen && morgenErledigt(eintrag)) || (istAbend && abendErledigt(eintrag))) {
      await db.from("push_subscriptions")
        .update(istMorgen ? { last_morning: jetzt.datum } : { last_evening: jetzt.datum })
        .eq("endpoint", s.endpoint);
      uebersprungen++;
      continue;
    }

    const inhalt = istMorgen
      ? { title: "Guten Morgen ✦", body: "Wo stehst du gerade? Frequenz eintragen und den Tag ausrichten.", tag: "morgen", url: "./index.html#/tagebuch" }
      : { title: "Tag abschließen ✦", body: "Was ist dir gelungen, wofür bist du dankbar, was lässt du los?", tag: "abend", url: "./index.html#/tagebuch" };

    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(inhalt),
      );
      await db.from("push_subscriptions")
        .update(istMorgen ? { last_morning: jetzt.datum } : { last_evening: jetzt.datum })
        .eq("endpoint", s.endpoint);
      gesendet++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {   // Anmeldung ist tot
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        entfernt++;
      }
    }
  }

  return new Response(JSON.stringify({ gesendet, uebersprungen, entfernt }), {
    headers: { "Content-Type": "application/json" },
  });
});
