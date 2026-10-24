#!/bin/sh
# Tägliche Sicherung der Datenbank. In die Crontab des Servers eintragen:
#   0 3 * * * /pfad/zu/server/sicherung.sh >> /var/log/frequenz-backup.log 2>&1
set -eu
cd "$(dirname "$0")"
ZIEL="./backups/frequenz-$(date +%F).sql.gz"
mkdir -p ./backups
docker compose exec -T db pg_dump -U frequenz frequenz | gzip > "$ZIEL"
echo "$(date +%F' '%T) Sicherung geschrieben: $ZIEL"
# Älter als 30 Tage wegräumen
find ./backups -name 'frequenz-*.sql.gz' -mtime +30 -delete
