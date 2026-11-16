#!/usr/bin/env bash
# Refresh the Search Algorithms Demos build served at /demos/search-algorithms/.
# It has no build step, so the static files are copied straight into public/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/demos/search-algorithms"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --quiet --depth 1 https://github.com/hunterbrewer04/Search-Algorithms-Demos.git "$TMP/src"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$TMP/src/index.html" "$TMP/src/css" "$TMP/src/js" "$TMP/src/LICENSE" "$DEST/"
echo "Vendored from github.com/hunterbrewer04/Search-Algorithms-Demos @ $(git -C "$TMP/src" rev-parse --short HEAD). Refresh with scripts/sync-search-demo.sh; don't edit here." > "$DEST/SOURCE.txt"
echo "Synced to $(git -C "$TMP/src" rev-parse --short HEAD)"
