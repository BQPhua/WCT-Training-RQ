#!/usr/bin/env bash
# Zero-surprise deploy for WCT Training RQ on the Ubuntu server.
# Called by GitHub Actions over SSH (or manually): /opt/wct-training-rq/scripts/deploy.sh
# - Builds into .next-build and only swaps it in when the build succeeds,
#   so a failed build leaves the running version untouched.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wct-training-rq}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3010/WCT-Training-RQ/api/health}"
cd "$APP_DIR"

log() { printf '\n[deploy %s] %s\n' "$(date '+%F %T')" "$*"; }

[ -f .env ] || { echo "Missing $APP_DIR/.env (copy .env.example and fill it in)"; exit 1; }

log "Fetching $BRANCH"
git fetch --prune origin "$BRANCH"
PREV_COMMIT=$(git rev-parse HEAD)
git reset --hard "origin/$BRANCH"
log "Deploying $(git rev-parse --short HEAD) (previous $(git rev-parse --short "$PREV_COMMIT"))"

log "Installing dependencies"
npm ci --no-audit --no-fund

log "Applying database migrations"
npm run db:migrate

log "Building"
rm -rf .next-build
NEXT_DIST_DIR=.next-build npm run build

log "Swapping build"
rm -rf .next-prev
[ -d .next ] && mv .next .next-prev
mv .next-build .next

log "Reloading PM2"
if pm2 describe wct-training-rq >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save >/dev/null

log "Health check"
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    log "Healthy ✔"
    exit 0
  fi
  sleep 2
done

log "Health check FAILED — rolling back to previous build"
if [ -d .next-prev ]; then
  rm -rf .next-failed && mv .next .next-failed && mv .next-prev .next
  git reset --hard "$PREV_COMMIT"
  pm2 reload ecosystem.config.cjs --update-env
fi
exit 1
