#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID_FILE="$ROOT_DIR/.local/backend.pid"

if [ -f "$BACKEND_PID_FILE" ]; then
    BACKEND_PID="$(cat "$BACKEND_PID_FILE")"
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "Stopping backend PID $BACKEND_PID..."
        kill "$BACKEND_PID" || true
    fi
    rm -f "$BACKEND_PID_FILE"
fi

echo "Stopping local PostgreSQL..."
cd "$ROOT_DIR/backend"
./scripts/stop-postgres.sh || true

echo "Local services stopped."
