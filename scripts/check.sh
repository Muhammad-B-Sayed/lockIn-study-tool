#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Running backend tests..."
cd "$ROOT_DIR/backend"
mvn test

echo "Running frontend lint..."
cd "$ROOT_DIR/frontend"
npm run lint

echo "Running frontend tests..."
npm test

echo "Running frontend build..."
npm run build

echo "All checks passed."
