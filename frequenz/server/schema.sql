-- ============================================================
-- Frequenz-Tagebuch – Schema für den eigenen Server
--
-- Anders als bei Supabase gibt es hier keine Row Level Security:
-- Der Browser spricht nie direkt mit der Datenbank, sondern immer
-- über die API, und die hängt an jede Abfrage die Kennung des
-- angemeldeten Nutzers. Die Trennung passiert also eine Schicht
-- höher – dafür gibt es in lib/rest.js keinen einzigen Pfad, der
-- ohne user_id auskommt.
-- ============================================================

create extension if not exists pgcrypto;        -- gen_random_uuid()

-- ---------- Konten ----------
create table if not exists users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  password_hash      text not null,
  name               text not null default '',
  email_confirmed_at timestamptz,
  created_at         timestamptz not null default now()
);
create unique index if not exists users_email_idx on users (lower(email));

-- ---------- Sitzungen ----------
create table if not exists refresh_tokens (
  token      text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists refresh_tokens_user on refresh_tokens(user_id);

-- ---------- Links aus Mails (Bestätigung, Passwort) ----------
create table if not exists email_tokens (
  token_hash text primary key,       -- nur der Abdruck, nie das Original
  user_id    uuid not null references users(id) on delete cascade,
  typ        text not null,          -- 'signup' | 'recovery' | 'email_change'
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Inhalte ----------
create table if not exists journal_entries (
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  data       jsonb not null,
  updated_at bigint not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists goals (
  user_id    uuid not null references users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  deleted    boolean not null default false,
  updated_at bigint not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists app_meta (
  user_id    uuid primary key references users(id) on delete cascade,
  data       jsonb not null,
  updated_at bigint not null,
  synced_at  timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null references users(id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  morning      text,
  evening      text,
  tz           text not null default 'Europe/Berlin',
  last_morning date,
  last_evening date,
  updated_at   bigint not null,
  synced_at    timestamptz not null default now()
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);
