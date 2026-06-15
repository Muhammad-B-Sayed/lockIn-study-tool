#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.local/logs"
BACKEND_PID_FILE="$ROOT_DIR/.local/backend.pid"

mkdir -p "$LOG_DIR"

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo "Frontend dependencies are missing. Run ./scripts/bootstrap.sh first."
    exit 1
fi

if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    echo "Backend already running with PID $(cat "$BACKEND_PID_FILE")."
else
    echo "Starting backend and local PostgreSQL..."
    (
        cd "$ROOT_DIR/backend"
        nohup ./scripts/start-backend.sh >"$LOG_DIR/backend.log" 2>&1 &
        echo $! > "$BACKEND_PID_FILE"
    )
fi

for _ in {1..60}; do
    if curl -fsS "http://localhost:8080/actuator/health" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! curl -fsS "http://localhost:8080/actuator/health" >/dev/null 2>&1; then
    echo "Backend did not become ready. Recent logs:"
    tail -n 40 "$LOG_DIR/backend.log" || true
    exit 1
fi

echo "Backend ready at http://localhost:8080"
echo "Starting frontend at http://127.0.0.1:5173"

cd "$ROOT_DIR/frontend"
exec npm run dev -- --host 127.0.0.1
