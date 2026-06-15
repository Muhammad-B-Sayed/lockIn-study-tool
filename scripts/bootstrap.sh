#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
npm install

echo "Resolving backend dependencies..."
cd "$ROOT_DIR/backend"
mvn -q -DskipTests compile

echo "Bootstrap complete."
