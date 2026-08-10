#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PORT="${KARAOKE_PORT:-8000}"
HOST="${KARAOKE_HOST:-127.0.0.1}"
APP_URL="${KARAOKE_APP_URL:-http://${HOST}:${PORT}}"

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "Build artifacts not found in $DIST_DIR."
  echo "Run: npm run build"
  exit 1
fi

if command -v chromium-browser >/dev/null 2>&1; then
  BROWSER_BIN="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
  BROWSER_BIN="chromium"
elif command -v google-chrome >/dev/null 2>&1; then
  BROWSER_BIN="google-chrome"
else
  echo "No Chromium-based browser found (chromium-browser/chromium/google-chrome)."
  exit 1
fi

python3 -m http.server "$PORT" --bind "$HOST" --directory "$DIST_DIR" &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

sleep 1
if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
  echo "Failed to start local webserver on ${HOST}:${PORT}."
  exit 1
fi

"$BROWSER_BIN" \
  --no-first-run \
  --start-maximized \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-component-update \
  "$APP_URL"
