#!/usr/bin/env bash
# Nightly off-site backup: database dump, uploads and .env into an encrypted
# restic repository. Credentials come from /etc/easyrisparmio-backup.env
# (RESTIC_REPOSITORY, RESTIC_PASSWORD and the storage provider's keys).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/easyrisparmio/moreno-server}"
STAGING="${STAGING:-/var/backups/easyrisparmio}"

set -a
# shellcheck disable=SC1091
. /etc/easyrisparmio-backup.env
set +a

compose() {
  docker compose -f "$APP_DIR/docker-compose.prod.yml" --project-directory "$APP_DIR" "$@"
}

mkdir -p "$STAGING"
chmod 700 "$STAGING"

# Custom format is compressed and lets pg_restore pick single tables.
# Dump to a temp file so a failed dump never replaces the last good one.
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$STAGING/db.dump.tmp"
mv "$STAGING/db.dump.tmp" "$STAGING/db.dump"

restic backup --tag easyrisparmio \
  "$STAGING/db.dump" "$APP_DIR/uploads" "$APP_DIR/.env"

restic forget --tag easyrisparmio \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
