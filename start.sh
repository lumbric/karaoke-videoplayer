#!/bin/bash

# Starte locale web server - necessary for video streaming
cd "$(dirname "$0")"
python3 -m http.server 8000 &

sleep 2

# Start browser in kiosk mode
if command -v firefox >/dev/null; then
  firefox --kiosk http://localhost:8000
elif command -v chromium >/dev/null; then
  chromium --kiosk http://localhost:8000
else
  echo "Neither firefox nor chromium found!"
  exit 1
fi
