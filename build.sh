#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="zotero-autonote"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$ROOT_DIR/$PLUGIN_NAME"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version)' "$SRC_DIR/manifest.json")"
OUT="$DIST_DIR/$PLUGIN_NAME-$VERSION.xpi"

mkdir -p "$DIST_DIR"
rm -f "$OUT"

cd "$SRC_DIR"
zip -X -r "$OUT" . -x "*.DS_Store"

echo "$OUT"
