#!/usr/bin/env bash
# Sample data for trying the system out (users @demo.wct.my + 10–20 requests in
# 5 random months, every status). No emails are sent. Demo people cannot sign in;
# a System Admin uses "View as demo user" to see each role. REMOVE IT BEFORE GO-LIVE: demo L&D, HR Head
# and BU Admin accounts would otherwise be included in real notifications.
#
# Usage (as trq):  demo-data.sh load | remove
set -euo pipefail
APP_ROOT="${APP_ROOT:-/opt/wct-training-rq}"
cd "$APP_ROOT/current"
set -a; . "$APP_ROOT/shared/.env"; set +a
unset NODE_ENV

case "${1:-}" in
  load)
    SEED_DEMO=true npx tsx scripts/seed.ts
    NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-demo-requests.ts
    ;;
  remove)
    # Uploaded files of demo requests (e.g. the demo name list) go first, while the rows still exist.
    psql "$DATABASE_URL" -Atc "select a.stored_name from attachments a join training_requests r on r.id = a.request_id join users u on u.id = r.requester_id where u.email like '%@demo.wct.my'" |
      while read -r f; do [ -n "$f" ] && rm -f -- "${UPLOAD_DIR:?}/$f"; done
    psql "$DATABASE_URL" -f scripts/demo-data-remove.sql
    ;;
  *) echo "Usage: $0 load|remove" >&2; exit 2 ;;
esac
