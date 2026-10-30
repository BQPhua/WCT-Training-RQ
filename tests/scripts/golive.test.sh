#!/usr/bin/env bash
# Script test for `demo-data.sh golive` against the test database (.env.test).
# Builds a throwaway APP_ROOT (shared/.env + current -> this repo) and stubs pm2.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; . "$REPO/.env.test"; set +a
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/shared" "$TMP/uploads" "$TMP/bin"
ln -s "$REPO" "$TMP/current"
cat > "$TMP/shared/.env" <<ENV
DATABASE_URL=$DATABASE_URL
UPLOAD_DIR=$TMP/uploads
SESSION_SECRET=test-secret-0123456789abcdef0123456789
DEMO_LOGIN=true
ENV
# The stub records its arguments and the environment it was given: --update-env copies that
# environment into the app, so it must not carry the old shared/.env values.
printf '#!/bin/sh\necho "$@ DEMO_LOGIN=${DEMO_LOGIN:-unset} DATABASE_URL=${DATABASE_URL:-unset}" >> "%s/pm2.calls"\n' "$TMP" > "$TMP/bin/pm2"; chmod +x "$TMP/bin/pm2"
export APP_ROOT="$TMP" PM2_BIN="$TMP/bin/pm2"
S="$REPO/scripts/demo-data.sh"
count() { psql "$DATABASE_URL" -Atc "select count(*) from users where email like '%@demo.wct.my'"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

psql "$DATABASE_URL" -qc "truncate users, business_units, departments restart identity cascade" >/dev/null
DEMO_REQUEST_COUNT=10 "$S" load >/dev/null 2>&1
[ "$(count)" -gt 0 ] || fail "demo data did not load"

# 1. Without --yes, anything but GO-LIVE aborts and changes nothing.
if echo "no" | "$S" golive >/dev/null 2>&1; then fail "golive continued without confirmation"; fi
[ "$(count)" -gt 0 ] || fail "demo users removed without confirmation"
grep -qx 'DEMO_LOGIN=true' "$TMP/shared/.env" || fail "env changed without confirmation"

# 2. Typing GO-LIVE removes demo data, turns off demo sign-in (with a backup) and reloads the app.
OUT=$(echo "GO-LIVE" | "$S" golive)
[ "$(count)" -eq 0 ] || fail "demo users left: $(count)"
[ "$(grep -c '^DEMO_LOGIN=' "$TMP/shared/.env")" -eq 1 ] || fail "DEMO_LOGIN line count"
grep -qx 'DEMO_LOGIN=false' "$TMP/shared/.env" || fail "DEMO_LOGIN not false"
ls "$TMP/shared"/.env.bak-* >/dev/null 2>&1 || fail "no env backup"
grep -q 'reload wct-training-rq --update-env' "$TMP/pm2.calls" || fail "app not reloaded"
grep -q 'DEMO_LOGIN=unset DATABASE_URL=unset' "$TMP/pm2.calls" || fail "pm2 reload inherited the old .env values: $(cat "$TMP/pm2.calls")"
echo "$OUT" | grep -q "Left: 0 demo accounts, 0 demo requests" || fail "no remaining-count report: $OUT"

# 3. Running it again (--yes) is harmless.
"$S" golive --yes >/dev/null
[ "$(count)" -eq 0 ] || fail "second run"
[ "$(grep -c '^DEMO_LOGIN=' "$TMP/shared/.env")" -eq 1 ] || fail "DEMO_LOGIN duplicated"

# 4. An env file without a DEMO_LOGIN line gets one.
sed -i '/^DEMO_LOGIN=/d' "$TMP/shared/.env"
"$S" golive --yes >/dev/null
grep -qx 'DEMO_LOGIN=false' "$TMP/shared/.env" || fail "DEMO_LOGIN not added"

echo "golive: all checks passed"
