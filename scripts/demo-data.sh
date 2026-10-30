#!/usr/bin/env bash
# Sample data for trying the system out (users @demo.wct.my + 10–20 requests in
# 5 random months, every status). No emails are sent. Demo people cannot sign in;
# a System Admin uses "View as demo user" to see each role. REMOVE IT BEFORE GO-LIVE: demo L&D, HR Head
# and BU Admin accounts would otherwise be included in real notifications.
#
# Usage (as trq):  demo-data.sh load | remove | golive [--yes]
#   golive: remove all demo data, set DEMO_LOGIN=false in shared/.env (backup kept) and reload the app.
set -euo pipefail
APP_ROOT="${APP_ROOT:-/opt/wct-training-rq}"
cd "$APP_ROOT/current"
set -a; . "$APP_ROOT/shared/.env"; set +a
unset NODE_ENV

# Deletes demo users, their requests, uploaded files and demo departments (real data is never touched).
remove_demo() {
  # Uploaded files of demo requests (e.g. the demo name list) go first, while the rows still exist.
  psql "$DATABASE_URL" -Atc "select a.stored_name from attachments a join training_requests r on r.id = a.request_id join users u on u.id = r.requester_id where u.email like '%@demo.wct.my'" |
    while read -r f; do [ -n "$f" ] && rm -f -- "${UPLOAD_DIR:?}/$f"; done
  psql "$DATABASE_URL" -q -f scripts/demo-data-remove.sql
}

# Reload the app from a clean environment. `pm2 reload --update-env` copies the caller's variables
# into the app, and Next.js lets those win over shared/.env, so this script's copy of the old
# .env (loaded above, before any edit) must never reach PM2.
reload_app() {
  env -i HOME="${HOME:-}" PATH="$PATH" USER="${USER:-}" LANG="${LANG:-C.UTF-8}" ${PM2_HOME:+PM2_HOME="$PM2_HOME"} \
    "${PM2_BIN:-pm2}" reload wct-training-rq --update-env
}

demo_counts() {
  psql "$DATABASE_URL" -Atc "select (select count(*) from users where email like '%@demo.wct.my') || ' demo accounts, ' || (select count(*) from training_requests r join users u on u.id = r.requester_id where u.email like '%@demo.wct.my') || ' demo requests'"
}

case "${1:-}" in
  load)
    SEED_DEMO=true npx tsx scripts/seed.ts
    NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-demo-requests.ts
    ;;
  remove)
    remove_demo
    ;;
  golive)
    demo_users=$(psql "$DATABASE_URL" -Atc "select count(*) from users where email like '%@demo.wct.my'")
    demo_requests=$(psql "$DATABASE_URL" -Atc "select count(*) from training_requests r join users u on u.id = r.requester_id where u.email like '%@demo.wct.my'")
    echo "Go live: this removes ${demo_users} demo accounts and ${demo_requests} demo requests (with their files),"
    echo "turns off the demo sign-in list (DEMO_LOGIN=false) and reloads the app. Real staff and requests are not touched."
    if [ "${2:-}" != "--yes" ]; then
      read -r -p "Type GO-LIVE to continue: " answer || answer=""
      if [ "$answer" != "GO-LIVE" ]; then echo "Cancelled. Nothing was changed." >&2; exit 1; fi
    fi
    remove_demo
    env_file="$APP_ROOT/shared/.env"
    cp -p "$env_file" "$env_file.bak-$(date +%Y%m%d%H%M%S)"
    if grep -q '^DEMO_LOGIN=' "$env_file"; then
      sed -i 's/^DEMO_LOGIN=.*/DEMO_LOGIN=false/' "$env_file"
    else
      printf '\nDEMO_LOGIN=false\n' >> "$env_file"
    fi
    reload_app
    echo "Left: $(demo_counts)"
    # Confirm the live app has demo sign-in off (the endpoint answers 404 then).
    code=""
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${PORT:-3110}/WCT-Training-RQ/api/auth/demo-login" 2>/dev/null || true)
      [ "$code" = "404" ] && break
      sleep 2
    done
    if [ "$code" = "404" ]; then echo "Checked: the app has demo sign-in off."; else echo "Could not confirm demo sign-in is off (got '${code:-no answer}'). Open the sign-in page and check 'Try a demo account' is gone." >&2; fi
    echo "Done: demo sign-in is off and the app was reloaded."
    echo "Next: check Admin settings → Roles and Business units, and assign the real L&D Team, HR Head, HODs and BU Admins."
    ;;
  *) echo "Usage: $0 load|remove|golive [--yes]" >&2; exit 2 ;;
esac
