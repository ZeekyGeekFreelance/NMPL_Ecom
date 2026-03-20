# Nginx SSL Setup

Nginx terminates SSL for both `nmpl.online` (frontend) and `api.nmpl.online` (backend API).

## Option A — Let's Encrypt (recommended for VPS)

```bash
# Install certbot on your VPS
sudo apt install certbot

# Stop nginx if running
docker compose -f docker-compose.yml -f docker-compose.prod.yml down nginx

# Issue certificates (standalone mode)
sudo certbot certonly --standalone \
  -d nmpl.online -d www.nmpl.online -d api.nmpl.online \
  --email support@nmpl.online --agree-tos --no-eff-email

# Copy to the certs directory
sudo cp /etc/letsencrypt/live/nmpl.online/fullchain.pem ./certs/nmpl.online.crt
sudo cp /etc/letsencrypt/live/nmpl.online/privkey.pem   ./certs/nmpl.online.key
sudo chmod 644 ./certs/nmpl.online.crt
sudo chmod 600 ./certs/nmpl.online.key
```

Auto-renewal (add to crontab):
```
0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/nmpl.online/fullchain.pem /path/to/certs/nmpl.online.crt && \
  cp /etc/letsencrypt/live/nmpl.online/privkey.pem   /path/to/certs/nmpl.online.key && \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Option B — Railway / Vercel (no nginx needed)

If you deploy the backend on **Railway** and frontend on **Vercel**, SSL is
handled automatically by those platforms. In that case:

- Delete the `nginx` service from `docker-compose.prod.yml`
- Set `ALLOWED_ORIGINS=https://nmpl.online,https://www.nmpl.online` in Railway's environment variables
- Set `NEXT_PUBLIC_API_URL=https://api.nmpl.online/api/v1` in Vercel's environment

This is the **recommended path for a solo launch** — no VPS management needed.

## DNS records required

| Type  | Name        | Value                  |
|-------|-------------|------------------------|
| A     | @           | YOUR_VPS_IP            |
| A     | www         | YOUR_VPS_IP            |
| A     | api         | YOUR_VPS_IP            |
| CNAME | www         | nmpl.online (alternative) |
