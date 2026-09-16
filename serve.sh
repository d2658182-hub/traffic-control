#!/usr/bin/env bash
# Serve the game locally (games need HTTP; file:// won't work).
# Usage: ./serve.sh [port]
PORT="${1:-8000}"
python3 -m http.server "$PORT" --bind 0.0.0.0
