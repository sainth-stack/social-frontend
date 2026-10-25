#!/usr/bin/env bash
# Copy EarnedVoice nginx vhosts to /etc/nginx/sites-available and enable them.
# Run on the EC2 host as root (or sudo).
#
#   sudo ./deploy/nginx/install-nginx.sh
#   sudo ./deploy/nginx/install-nginx.sh --landing-only
#   sudo ./deploy/nginx/install-nginx.sh --landing-http   # before first certbot run
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AVAILABLE="/etc/nginx/sites-available"
ENABLED="/etc/nginx/sites-enabled"

landing_only=false
landing_http=false
for arg in "$@"; do
  case "$arg" in
    --landing-only) landing_only=true ;;
    --landing-http) landing_http=true ;;
  esac
done

install_site() {
  local name="$1"
  local src="$2"
  cp "$src" "$AVAILABLE/$name"
  ln -sf "$AVAILABLE/$name" "$ENABLED/$name"
  echo "Installed $name"
}

if [[ "$landing_only" == true ]]; then
  if [[ "$landing_http" == true ]]; then
    install_site "earnedvoice.opsbrainai.com" "$SCRIPT_DIR/earnedvoice.opsbrainai.com.http-only"
  else
    install_site "earnedvoice.opsbrainai.com" "$SCRIPT_DIR/earnedvoice.opsbrainai.com"
  fi
else
  install_site "peers.opsbrainai.com" "$SCRIPT_DIR/peers.opsbrainai.com"
  if [[ "$landing_http" == true ]]; then
    install_site "earnedvoice.opsbrainai.com" "$SCRIPT_DIR/earnedvoice.opsbrainai.com.http-only"
  else
    install_site "earnedvoice.opsbrainai.com" "$SCRIPT_DIR/earnedvoice.opsbrainai.com"
  fi
fi

nginx -t
systemctl reload nginx
echo ""
echo "Done. Verify:"
echo "  curl -sI https://peers.opsbrainai.com/health"
echo "  curl -sI https://earnedvoice.opsbrainai.com/"
