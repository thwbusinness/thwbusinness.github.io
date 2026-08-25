\pset tuples_only on
\set QUIET on

-- Aufräumen und zwei Nutzer anlegen
truncate public.journal_entries, public.goals, public.app_meta;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'thomas@example.de'),
  ('22222222-2222-2222-2222-222222222222', 'klient@example.de')
on conflict do nothing;
grant usage on schema public to authenticated, anon;
grant all on public.journal_entries, public.goals, public.app_meta to authenticated;
\set QUIET off

-- ---------- Thomas schreibt (in einer Transaktion, sonst greift SET LOCAL nicht) ----------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
  insert into public.journal_entries (user_id, date, data, updated_at)
    values ('11111111-1111-1111-1111-111111111111', current_date, '{"morning":{"gefuehl":"geheim"}}', 1);
  insert into public.app_meta (user_id, data, updated_at)
    values ('11111111-1111-1111-1111-111111111111', '{"name":"Thomas"}', 1);
  select 'Thomas sieht eigene Eintraege: ' || count(*) from public.journal_entries;
commit;

-- ---------- Klient schaut ----------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
  select 'Klient sieht fremde Eintraege (muss 0 sein): ' || count(*) from public.journal_entries;
  select 'Klient sieht fremde Stammdaten (muss 0 sein): ' || count(*) from public.app_meta;
commit;

-- ---------- Klient versucht unter fremder Kennung zu schreiben ----------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
  do $$
  begin
    insert into public.journal_entries (user_id, date, data, updated_at)
      values ('11111111-1111-1111-1111-111111111111', current_date + 1, '{"x":1}', 1);
    raise notice '*** FEHLER: Fremdschreiben war moeglich ***';
  exception when insufficient_privilege then
    raise notice 'OK: Fremdschreiben abgewiesen';
  end $$;
commit;

-- ---------- Klient versucht fremde Zeilen zu loeschen ----------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
  with weg as (delete from public.journal_entries returning 1)
  select 'Vom Klienten geloeschte fremde Zeilen (muss 0 sein): ' || count(*) from weg;
commit;

-- ---------- Nur mit dem oeffentlichen Schluessel, ohne Anmeldung ----------
begin;
  set local role anon;
  do $$
  declare n int;
  begin
    select count(*) into n from public.journal_entries;
    raise notice 'Anonym sichtbare Eintraege: % (muss 0 sein)', n;
  exception when insufficient_privilege then
    raise notice 'OK: Anonym gar kein Zugriff auf die Tabelle';
  end $$;
commit;

-- ---------- Und Thomas hat weiterhin alles ----------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
  select 'Thomas nach allem: ' || count(*) || ' Eintrag(e)' from public.journal_entries;
commit;
