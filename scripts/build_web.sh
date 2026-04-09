#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/web_build"
APP_NAME="$(basename "$BUILD_DIR")"

cleanup() {
  rm -rf "$BUILD_DIR"
  rm -f "$ROOT_DIR/$APP_NAME.pyxapp" "$ROOT_DIR/$APP_NAME.html"
}

trap cleanup EXIT

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

if [ -x "$ROOT_DIR/.venv/bin/pyxel" ]; then
  PYXEL_BIN="$ROOT_DIR/.venv/bin/pyxel"
else
  PYXEL_BIN="$(command -v pyxel)"
fi

cp "$ROOT_DIR/number_puzzle.py" "$BUILD_DIR/number_puzzle.py"

cd "$ROOT_DIR"
"$PYXEL_BIN" package "$BUILD_DIR" "$BUILD_DIR/number_puzzle.py"
"$PYXEL_BIN" app2html "$APP_NAME.pyxapp"

perl -0pi -e 's/gamepad: "enabled"/gamepad: "disabled"/g' "$APP_NAME.html"

mv "$APP_NAME.html" "$ROOT_DIR/index.html"
