#!/usr/bin/env bash
# Forced command for the GitHub Actions deploy key (see docs/DEPLOYMENT.md §8).
# The key can do exactly one thing: deploy a specific commit SHA. Any other
# command text sent over SSH is ignored apart from the 40-hex SHA it contains.
# Wrapped in a block so bash parses the whole file before `git checkout`
# can replace it on disk.
{
set -euo pipefail
CMD="${SSH_ORIGINAL_COMMAND:-$*}"
SHA="$(grep -oE '\b[0-9a-f]{40}\b' <<<"$CMD" | head -n1 || true)"
if [ -z "$SHA" ]; then
  echo "deploy gate: a full 40-character commit SHA is required" >&2
  exit 2
fi
REPO="${APP_ROOT:-/opt/wct-training-rq}/repo"
git -C "$REPO" fetch --prune --quiet origin
git -C "$REPO" cat-file -e "$SHA^{commit}" || { echo "deploy gate: unknown commit $SHA" >&2; exit 2; }
git -C "$REPO" checkout --force --quiet "$SHA"
"$REPO/scripts/deploy.sh" "$SHA"
exit $?
}
