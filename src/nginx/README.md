# Nginx SSL Setup

Nginx terminates SSL for both `nmpl.in` (frontend) and `api.nmpl.in` (backend API).

## Option A — Let's Encrypt (recommended for VPS)

```bash
# Install certbot on your VPS
sudo apt install certbot

# Stop nginx if running
docker compose -f docker-compose.yml -f docker-compose.prod.yml down nginx

# Issue certificates (standalone mode)
sudo certbot certonly --standalone \
  -d nmpl.in -d www.nmpl.in -d api.nmpl.in \
  --email support@nmpl.in --agree-tos --no-eff-email

# Copy to the certs directory
sudo cp /etc/letsencrypt/live/nmpl.in/fullchain.pem ./certs/nmpl.in.crt
sudo cp /etc/letsencrypt/live/nmpl.in/privkey.pem   ./certs/nmpl.in.key
sudo chmod 644 ./certs/nmpl.in.crt
sudo chmod 600 ./certs/nmpl.in.key
```

Auto-renewal (add to crontab):
```
0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/nmpl.in/fullchain.pem /path/to/certs/nmpl.in.crt && \
  cp /etc/letsencrypt/live/nmpl.in/privkey.pem   /path/to/certs/nmpl.in.key && \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Option B — Railway / Vercel (no nginx needed)

If you deploy the backend on **Railway** and frontend on **Vercel**, SSL is
handled automatically by those platforms. In that case:

- Delete the `nginx` service from `docker-compose.prod.yml`
- Set `ALLOWED_ORIGINS=https://nmpl.in` in Railway's environment variables
- Set `NEXT_PUBLIC_API_URL=https://api.nmpl.in/api/v1` in Vercel's environment

This is the **recommended path for a solo launch** — no VPS management needed.

## DNS records required

| Type  | Name        | Value                  |
|-------|-------------|------------------------|
| A     | @           | YOUR_VPS_IP            |
| A     | www         | YOUR_VPS_IP            |
| A     | api         | YOUR_VPS_IP            |
| CNAME | www         | nmpl.in (alternative)  |
