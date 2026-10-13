#!/usr/bin/env bash
# Nightly backup: database dump + attachments, kept for 30 days.
# Schedule from the deploy user's crontab (see deploy/crontab.txt).
set -euo pipefail
ENV_FILE="${ENV_FILE:-/opt/wct-training-rq/shared/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wct-training-rq}"
KEEP_DAYS="${KEEP_DAYS:-30}"
set -a; . "$ENV_FILE"; set +a
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
pg_dump --format=custom --no-owner "$DATABASE_URL" > "$BACKUP_DIR/db-$STAMP.dump"
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup complete: $BACKUP_DIR/*-$STAMP.*"
