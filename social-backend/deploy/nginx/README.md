# Nginx (production)

| Host | PM2 port | Service |
|------|----------|---------|
| `peers.opsbrainai.com` | 5000 | FastAPI (`/api/`, `/health`, `/docs`) |
| `peers.opsbrainai.com` | 5001 | Product app (`social-frontend`) |
| `earnedvoice.opsbrainai.com` | 5002 | Marketing landing (`social-landing`) |

## DNS

Add an **A record** (or CNAME) for `earnedvoice.opsbrainai.com` → your EC2 public IP (same as `peers` if co-hosted).

## Nginx error: `duplicate listen options for [::]:443`

Only **one** site file may use `listen [::]:443 ssl ipv6only=on`. Additional HTTPS vhosts must use `listen [::]:443 ssl;` only (see `earnedvoice.opsbrainai.com` in this folder).

On the server, fix `earnedvoice` and reload:

```bash
sudo sed -i 's/listen \[::\]:443 ssl ipv6only=on;/listen [::]:443 ssl;/' /etc/nginx/sites-available/earnedvoice.opsbrainai.com
sudo nginx -t && sudo systemctl reload nginx
```

## First-time TLS for landing

```bash
# 1) HTTP-only vhost so certbot can reach the host
sudo bash deploy/nginx/install-nginx.sh --landing-only --landing-http

# 2) Issue certificate (adjust email)
sudo certbot --nginx -d earnedvoice.opsbrainai.com

# 3) Install full SSL vhost from repo
sudo bash deploy/nginx/install-nginx.sh --landing-only
```

If the certificate is already issued but certbot could not install it (no `server_name` yet):

```bash
# Install vhost first (HTTP or SSL template from this repo), fix ipv6 listen as above, then:
sudo certbot install --cert-name earnedvoice.opsbrainai.com
# or rely on ssl_certificate paths already in earnedvoice.opsbrainai.com and reload nginx
```

## Update both vhosts from git

From `social-backend` on the server:

```bash
sudo bash deploy/nginx/install-nginx.sh
```

## Build-time env (landing)

In `social-landing` before `npm run build`:

```env
NEXT_PUBLIC_SITE_URL=https://earnedvoice.opsbrainai.com
NEXT_PUBLIC_APP_URL=https://peers.opsbrainai.com
```

## Backend / app `.env`

Ensure CORS and OAuth redirect URLs include both hosts, e.g.:

- `CORS_ORIGINS=https://peers.opsbrainai.com,https://earnedvoice.opsbrainai.com`
- Meta/LinkedIn redirect URIs on `https://peers.opsbrainai.com/...`

Frontend app:

```env
NEXT_PUBLIC_MARKETING_URL=https://earnedvoice.opsbrainai.com
```
