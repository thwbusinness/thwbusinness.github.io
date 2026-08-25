-- ============================================================
-- Frequenz-Tagebuch – komplette Einrichtung in einem Rutsch
--
-- Alles hier einfügen: Supabase → SQL Editor → New query →
-- einfügen → Run. Mehrfaches Ausführen schadet nicht.
--
-- Danach in der App unter "Mehr" auf "Verbindung prüfen" tippen –
-- dort muss bei allen vier Tabellen ein Haken stehen.
--
-- Erzeugt aus supabase.sql + supabase-push.sql. Beide Dateien
-- bleiben einzeln bestehen; diese hier ist nur die Kurzfassung.
-- ============================================================

-- ############ Tabellen, Policies, Trigger ############

create table if not exists public.journal_entries (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null,
  data       jsonb       not null,
  updated_at bigint      not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------- Manifestationsziele ----------
create table if not exists public.goals (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at bigint      not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- Name und 8-Wochen-Programm ----------
create table if not exists public.app_meta (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  data       jsonb       not null,
  updated_at bigint      not null,
  synced_at  timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.journal_entries enable row level security;
alter table public.goals           enable row level security;
alter table public.app_meta        enable row level security;

drop policy if exists "eigene Eintraege" on public.journal_entries;
create policy "eigene Eintraege" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene Ziele" on public.goals;
create policy "eigene Ziele" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene Stammdaten" on public.app_meta;
create policy "eigene Stammdaten" on public.app_meta
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- synced_at bei jedem Schreibvorgang mitziehen ----------
create or replace function public.set_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at := now();
  return new;
end $$;

drop trigger if exists trg_journal_synced on public.journal_entries;
create trigger trg_journal_synced before insert or update on public.journal_entries
  for each row execute function public.set_synced_at();

drop trigger if exists trg_goals_synced on public.goals;
create trigger trg_goals_synced before insert or update on public.goals
  for each row execute function public.set_synced_at();

drop trigger if exists trg_meta_synced on public.app_meta;
create trigger trg_meta_synced before insert or update on public.app_meta
  for each row execute function public.set_synced_at();

-- ============================================================
-- Konto selbst löschen (DSGVO: Recht auf Löschung)
--
-- Die App löscht zuerst die eigenen Zeilen und ruft dann diese
-- Funktion auf. security definer erlaubt das Entfernen aus
-- auth.users, ohne dass der Client Adminrechte braucht –
-- gelöscht wird ausschließlich das eigene Konto.
--
-- Gegen lokales Postgres geprüft (tests/sql-test.sh). Sollte Supabase
-- beim Aufruf "permission denied for table users" melden, fehlen dem
-- Eigentümer der Funktion die Rechte auf auth.users; dann hilft
--   alter function public.delete_own_account() owner to supabase_auth_admin;
-- ============================================================
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  wer uuid := auth.uid();
begin
  if wer is null then
    raise exception 'nicht angemeldet';
  end if;

  delete from public.journal_entries where user_id = wer;
  delete from public.goals           where user_id = wer;
  delete from public.app_meta        where user_id = wer;
  delete from auth.users             where id      = wer;   -- Push-Anmeldungen hängen per cascade dran
end $$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;


-- ############ Erinnerungen (Push) ############

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
