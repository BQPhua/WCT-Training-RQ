#!/usr/bin/env bash
# Switch back to the previous release (or a named one) and reload PM2.
# Usage: rollback.sh [releases/<dir>]
set -euo pipefail
APP_ROOT="${APP_ROOT:-/opt/wct-training-rq}"
CUR="$(readlink -f "$APP_ROOT/current")"
TARGET="${1:-$(ls -1dt "$APP_ROOT"/releases/*/ | sed 's:/$::' | grep -vx "$CUR" | head -n1)}"
[ -d "$TARGET" ] || { echo "No release to roll back to"; exit 1; }
ln -sfn "$(readlink -f "$TARGET")" "$APP_ROOT/current.tmp" && mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"
pm2 reload wct-training-rq --update-env
echo "Now running $(basename "$(readlink -f "$APP_ROOT/current")")"
