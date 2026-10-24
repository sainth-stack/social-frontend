#!/usr/bin/env bash
# Seed platform admin (idempotent). Usage: ./scripts/seed_superadmin.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
elif [[ -f "$ROOT/venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/venv/bin/activate"
else
  echo "Missing venv — run: python3 -m venv venv && pip install -r requirements.txt" >&2
  exit 1
fi
export ADMIN_EMAIL="${ADMIN_EMAIL:-superadmin@gmail.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"
python -m app.core.seed_admin
echo ""
echo "Sign in at the app login page — you should land on /admin (platform console)."
echo "If you were already logged in, sign out once so the session picks up is_platform_admin."
