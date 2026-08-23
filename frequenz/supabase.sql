-- ============================================================
-- Frequenz-Tagebuch – Datenbankschema für Supabase
--
-- Einmal ausführen: Supabase → SQL Editor → einfügen → Run.
-- Danach in der App unter "Mehr" Projekt-URL und Anon-Key
-- eintragen (oder in config.js hinterlegen) und anmelden.
--
-- Grundregel: jede Zeile gehört einer user_id. Row Level Security
-- sorgt dafür, dass jeder Nutzer ausschließlich seine eigenen
-- Zeilen lesen und schreiben kann – auch mit dem öffentlichen
-- Anon-Key, der in der App steht.
--
-- updated_at ist ein Zeitstempel in Millisekunden vom Client.
-- Bei einem Konflikt gewinnt der neuere Stand (last write wins).
-- ============================================================

-- ---------- Tagebucheinträge: ein Datensatz pro Tag ----------
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
