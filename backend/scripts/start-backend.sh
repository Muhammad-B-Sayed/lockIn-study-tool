#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/start-postgres.sh"

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-${LOCKIN_DB_PORT:-55432}}"
export DB_NAME="${DB_NAME:-${LOCKIN_DB_NAME:-lockin}}"
export DB_USERNAME="${DB_USERNAME:-${LOCKIN_DB_USER:-lockin}}"
export DB_PASSWORD="${DB_PASSWORD:-${LOCKIN_DB_PASSWORD:-lockin}}"

cd "$ROOT_DIR"
mvn spring-boot:run
