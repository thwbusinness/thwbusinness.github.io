#!/usr/bin/env bash
# Spielt supabase.sql in eine echte Postgres-Datenbank ein und prüft, dass die
# Zugriffstrennung greift: fremde Einträge weder lesen noch schreiben noch
# löschen, und ohne Anmeldung gar kein Zugriff.
#
# Braucht: postgresql-16 (oder neuer) lokal installiert. Legt eine Wegwerf-
# Instanz an und räumt sie am Ende weg.
set -euo pipefail

HIER="$(cd "$(dirname "$0")" && pwd)"
DATEN="${TMPDIR:-/tmp}/frequenz-pgtest"
PORT=5433
export PATH="/usr/lib/postgresql/16/bin:$PATH"

aufraeumen() {
  pg_ctl -D "$DATEN" stop -m immediate >/dev/null 2>&1 || pkill -f "postgres -D $DATEN" || true
  rm -rf "$DATEN"
}
trap aufraeumen EXIT

rm -rf "$DATEN"; mkdir -p "$DATEN"
if [ "$(id -u)" = "0" ]; then                 # Postgres läuft nicht als root
  id -u postgres >/dev/null 2>&1 || useradd -m postgres
  chown postgres "$DATEN"; chmod 700 "$DATEN"
  ALS="su postgres -c"
else
  ALS="bash -c"
fi

$ALS "PATH=$PATH initdb -D $DATEN -U postgres --auth=trust" >/dev/null
$ALS "PATH=$PATH postgres -D $DATEN -k /tmp -p $PORT -c listen_addresses=" >"$DATEN/log" 2>&1 &
for _ in $(seq 1 20); do psql -h /tmp -p $PORT -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 0.5; done

psql -h /tmp -p $PORT -U postgres -q -c "drop database if exists probe;" -c "create database probe;"
psql -h /tmp -p $PORT -U postgres -d probe -q -f "$HIER/supabase-stub.sql"

echo "=== supabase.sql einspielen ==="
psql -h /tmp -p $PORT -U postgres -d probe -v ON_ERROR_STOP=1 -q -f "$HIER/../supabase.sql"
echo "ok"

echo "=== supabase-push.sql einspielen ==="
psql -h /tmp -p $PORT -U postgres -d probe -v ON_ERROR_STOP=1 -q -f "$HIER/../supabase-push.sql"
echo "ok"

echo "=== Zugriffstrennung prüfen ==="
psql -h /tmp -p $PORT -U postgres -d probe -f "$HIER/rls-test.sql" 2>&1 \
  | grep -viE "^(SET|BEGIN|COMMIT|DO|INSERT|GRANT|TRUNCATE)$" | grep -v "^$"
