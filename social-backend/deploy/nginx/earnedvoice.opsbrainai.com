# Marketing landing — earnedvoice.opsbrainai.com
# PM2: social-landing :5002
# Sign-in / register links should point at peers.opsbrainai.com (NEXT_PUBLIC_APP_URL).

server {
    server_name earnedvoice.opsbrainai.com;

    client_max_body_size 51M;

    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Do not use ipv6only=on here — only one vhost on the host may set it (peers keeps it).
    listen 443 ssl;
    listen [::]:443 ssl;
    ssl_certificate /etc/letsencrypt/live/earnedvoice.opsbrainai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/earnedvoice.opsbrainai.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = earnedvoice.opsbrainai.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name earnedvoice.opsbrainai.com;
    return 404;
}
