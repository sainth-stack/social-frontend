#!/usr/bin/env bash
# EC2: start API + worker + beat + app frontend + marketing landing with PM2
# Usage (from backend/):  ./scripts/pm2-start.sh
#
# Requires production builds:
#   cd ../social-frontend && npm ci && npm run build
#   cd ../social-landing && npm ci && npm run build

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env — copy from .env.example and fill in values" >&2
  exit 1
fi

mkdir -p "$ROOT/.run"

for dir in "$REPO_ROOT/social-frontend" "$REPO_ROOT/social-landing"; do
  if [[ ! -d "$dir/.next" ]]; then
    name="$(basename "$dir")"
    echo "Missing Next.js build: $dir/.next" >&2
    echo "  cd $dir && npm ci && npm run build" >&2
    exit 1
  fi
done

if [[ -f "$ROOT/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
elif [[ -f "$ROOT/venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/venv/bin/activate"
fi

echo "Ensuring MongoDB indexes..."
"$ROOT/scripts/migrate.sh"

pm2 start "$ROOT/scripts/pm2.ecosystem.config.cjs"
pm2 save
pm2 status

API_PORT="${PORT:-5000}"
APP_PORT="${FRONTEND_PORT:-5001}"
LANDING_PORT="${LANDING_PORT:-5002}"

echo ""
echo "Production running (PM2):"
echo "  API       http://127.0.0.1:${API_PORT}"
echo "  App       http://127.0.0.1:${APP_PORT}   (social-frontend)"
echo "  Landing   http://127.0.0.1:${LANDING_PORT}   (social-landing)"
echo "  Logs      $ROOT/.run/"
echo "  Stop      ./scripts/pm2-stop.sh"
