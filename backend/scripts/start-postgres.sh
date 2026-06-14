#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.local/postgres"
DATA_DIR="$RUNTIME_DIR/data"
LOG_FILE="$RUNTIME_DIR/postgres.log"
PORT="${LOCKIN_DB_PORT:-55432}"
DB_NAME="${LOCKIN_DB_NAME:-lockin}"
DB_USER="${LOCKIN_DB_USER:-lockin}"
DB_PASSWORD="${LOCKIN_DB_PASSWORD:-lockin}"

export LANG=C
export LC_ALL=C

mkdir -p "$RUNTIME_DIR"

if [ ! -d "$DATA_DIR/base" ]; then
    initdb -D "$DATA_DIR" --username=postgres --auth-local=trust --auth-host=scram-sha-256 >/dev/null
fi

if ! pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1; then
    pg_ctl -D "$DATA_DIR" -l "$LOG_FILE" -o "-p $PORT" start >/dev/null
fi

until pg_isready -h localhost -p "$PORT" -U postgres >/dev/null 2>&1; do
    sleep 1
done

psql -p "$PORT" -U postgres -v ON_ERROR_STOP=1 >/dev/null <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASSWORD}');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASSWORD}');
    END IF;
END
\$\$;
SQL

if ! psql -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
    createdb -p "$PORT" -U postgres -O "$DB_USER" "$DB_NAME"
fi

echo "PostgreSQL is ready on localhost:${PORT} (database: ${DB_NAME}, user: ${DB_USER})."
