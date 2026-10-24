#!/usr/bin/env bash
# Stop PM2 apps, local ./scripts/start.sh processes, and free common app ports.
# Usage (from social-backend/):  ./scripts/kill-all.sh
#
# Ports: 8000 (local API), 5000–5002 (production PM2), 3001/3002 (next dev)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORTS="${KILL_PORTS:-8000 5000 5001 5002 3001 3002}"

if command -v pm2 >/dev/null 2>&1; then
  "$ROOT/scripts/pm2-stop.sh" 2>/dev/null || true
  pm2 kill 2>/dev/null || true
fi

if [[ -x "$ROOT/scripts/stop.sh" ]]; then
  PORT="${PORT:-8000}" "$ROOT/scripts/stop.sh" 2>/dev/null || true
fi

pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "celery -A workers.celery_app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

for port in $PORTS; do
  pids=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Killing listener(s) on port $port: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
done

echo ""
echo "Ports cleared. Verify:"
for port in $PORTS; do
  if lsof -ti :"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  :$port still in use"
  else
    echo "  :$port free"
  fi
done
