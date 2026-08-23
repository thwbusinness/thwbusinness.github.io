-- ============================================================
-- Erinnerungen: Tabelle für die Push-Anmeldungen + Zeitplan
--
-- Voraussetzung: supabase.sql ist bereits gelaufen.
-- Danach die Edge Function deployen:
--   supabase functions deploy send-reminders --no-verify-jwt
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint     text        primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  p256dh       text        not null,
  auth         text        not null,
  morning      text,                    -- "07:30" oder NULL
  evening      text,                    -- "21:00" oder NULL
  tz           text        not null default 'Europe/Berlin',
  last_morning date,                    -- zuletzt gesendet, verhindert Doppelte
  last_evening date,
  updated_at   bigint      not null,
  synced_at    timestamptz not null default now()
);

create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "eigene Anmeldungen" on public.push_subscriptions;
create policy "eigene Anmeldungen" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Zeitplan: alle fünf Minuten ----------
-- Extensions einmalig aktivieren (Dashboard → Database → Extensions):
--   pg_cron, pg_net
--
-- <PROJEKT-REF> und <CRON_SECRET> ersetzen. Das Secret muss identisch
-- als Secret CRON_SECRET in der Edge Function hinterlegt sein.

-- select cron.unschedule('frequenz-erinnerungen');
-- select cron.schedule(
--   'frequenz-erinnerungen',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJEKT-REF>.supabase.co/functions/v1/send-reminders',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );
