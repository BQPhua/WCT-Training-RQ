#!/usr/bin/env bash
# Sample data for trying the system out (users @demo.wct.my + ~30 requests in
# every status). No emails are sent. Demo people cannot sign in; view the data
# as a System Admin / L&D / HR Head. REMOVE IT BEFORE GO-LIVE: demo L&D, HR Head
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
    psql "$DATABASE_URL" -f scripts/demo-data-remove.sql
    ;;
  *) echo "Usage: $0 load|remove" >&2; exit 2 ;;
esac
