#!/usr/bin/env bash
# Release-based deploy for WCT Training RQ.
#
# Layout on the server (APP_ROOT=/opt/wct-training-rq):
#   repo/                 git clone of this repository (source only)
#   shared/.env           secrets & config (chmod 600) — never in git
#   releases/<stamp>-<sha>/  one immutable build per deploy (own node_modules + .next)
#   current -> releases/…    symlink PM2 runs from
#
# Usage: repo/scripts/deploy.sh [<git sha>]     (defaults to origin/main)
# Nothing live changes until a release has installed, migrated and built
# successfully; then `current` is switched atomically and PM2 reloaded.
# If the health check fails, `current` is switched back to the previous release.
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/wct-training-rq}"
REPO="$APP_ROOT/repo"
KEEP="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3010/WCT-Training-RQ/api/health}"
log() { printf '\n[deploy %s] %s\n' "$(date '+%F %T')" "$*"; }

[ -f "$APP_ROOT/shared/.env" ] || { echo "Missing $APP_ROOT/shared/.env (copy .env.example and fill it in)"; exit 1; }

git -C "$REPO" fetch --prune --quiet origin
SHA="$(git -C "$REPO" rev-parse "${1:-origin/main}^{commit}")"
REL="$APP_ROOT/releases/$(date +%Y%m%d%H%M%S)-${SHA:0:7}"
PREV="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
SWITCHED=0

cleanup_failed() {
  if [ "$SWITCHED" = 0 ]; then
    log "Deploy failed before going live — removing $REL; the running release is untouched"
    rm -rf "$REL"
  fi
}
trap cleanup_failed ERR

log "Preparing release ${SHA:0:7} in $REL"
mkdir -p "$REL"
git -C "$REPO" archive "$SHA" | tar -x -C "$REL"
ln -s "$APP_ROOT/shared/.env" "$REL/.env"
cd "$REL"

log "Installing dependencies"
npm ci --no-audit --no-fund

log "Applying database migrations (forward-only, additive)"
npm run db:migrate

log "Building"
npm run build

log "Switching current -> $(basename "$REL")"
ln -sfn "$REL" "$APP_ROOT/current.tmp"
mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"
SWITCHED=1

if pm2 describe wct-training-rq >/dev/null 2>&1; then
  pm2 reload wct-training-rq --update-env
else
  pm2 start "$APP_ROOT/current/ecosystem.config.cjs"
fi
pm2 save >/dev/null

log "Health check"
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    log "Healthy ✔  ($(basename "$REL"))"
    # Keep the newest $KEEP releases
    ls -1dt "$APP_ROOT"/releases/*/ | tail -n +"$((KEEP + 1))" | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done

log "Health check FAILED"
if [ -n "$PREV" ] && [ -d "$PREV" ]; then
  log "Rolling back to $(basename "$PREV")"
  ln -sfn "$PREV" "$APP_ROOT/current.tmp" && mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"
  pm2 reload wct-training-rq --update-env
fi
exit 1
