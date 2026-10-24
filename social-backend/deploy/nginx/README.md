# Nginx (production)

| Host | PM2 port | Service |
|------|----------|---------|
| `peers.opsbrainai.com` | 5000 | FastAPI (`/api/`, `/health`, `/docs`) |
| `peers.opsbrainai.com` | 5001 | Product app (`social-frontend`) |
| `earnedvoice.opsbrainai.com` | 5002 | Marketing landing (`social-landing`) |

## DNS

Add an **A record** (or CNAME) for `earnedvoice.opsbrainai.com` → your EC2 public IP (same as `peers` if co-hosted).

## First-time TLS for landing

```bash
# 1) HTTP-only vhost so certbot can reach the host
sudo bash deploy/nginx/install-nginx.sh --landing-only --landing-http

# 2) Issue certificate (adjust email)
sudo certbot --nginx -d earnedvoice.opsbrainai.com

# 3) Install full SSL vhost from repo
sudo bash deploy/nginx/install-nginx.sh --landing-only
```

If certbot already manages `peers.opsbrainai.com`, you can instead:

```bash
sudo certbot certonly --nginx -d earnedvoice.opsbrainai.com
sudo bash deploy/nginx/install-nginx.sh --landing-only
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
