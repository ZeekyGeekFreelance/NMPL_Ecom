# Production Deployment Guide

## 🚨 Pre-Deployment Checklist

### 1. Security Secrets (CRITICAL)

Generate all secrets using:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Required secrets:
- [ ] `ACCESS_TOKEN_SECRET`
- [ ] `REFRESH_TOKEN_SECRET`
- [ ] `SESSION_SECRET`
- [ ] `COOKIE_SECRET`

### 2. Third-Party Services Setup

#### Database (Neon)
- [ ] Create production database in Neon
- [ ] Get pooled connection URL (DATABASE_URL)
- [ ] Get direct connection URL (DIRECT_URL)
- [ ] Enable automated backups
- [ ] Set up connection pooling (pgbouncer)

#### Redis (Required)
- [ ] Set up managed Redis instance
  - **Upstash**: https://upstash.com (Free tier available)
  - **Redis Cloud**: https://redis.com/try-free
  - **AWS ElastiCache**: For AWS deployments
- [ ] Get connection URL
- [ ] Test connectivity

#### Email Service
- [ ] **SendGrid** (Recommended): https://sendgrid.com
  - Create account
  - Verify sender domain
  - Generate API key
- [ ] **AWS SES**: For AWS deployments
- [ ] **Mailgun**: Alternative option

#### SMS Service (Twilio)
- [ ] Create Twilio account: https://www.twilio.com
- [ ] Get Account SID
- [ ] Get Auth Token
- [ ] Purchase phone number
- [ ] Test SMS delivery

#### Payment Gateway
- [ ] **Razorpay** (Primary for India):
  - Create account: https://razorpay.com
  - Get API Key ID
  - Get API Key Secret
  - Set up webhooks
- [ ] **Stripe** (Alternative):
  - Create account: https://stripe.com
  - Get Secret Key
  - Get Webhook Secret
  - Configure webhook endpoints

#### Image Storage (Cloudinary)
- [ ] Create production Cloudinary account
- [ ] Get Cloud Name
- [ ] Get API Key
- [ ] Get API Secret
- [ ] Set up upload presets

### 3. Domain & SSL
- [ ] Purchase domain name
- [ ] Configure DNS records:
  - `A` record: `yourdomain.com` → Server IP
  - `A` record: `api.yourdomain.com` → Server IP
  - `CNAME` record: `www.yourdomain.com` → `yourdomain.com`
- [ ] Set up SSL certificates (Let's Encrypt or CloudFlare)

### 4. Hosting Platform
Choose one:
- [ ] **Railway** (Recommended for beginners)
- [ ] **Render**
- [ ] **AWS** (EC2 + RDS + ElastiCache)
- [ ] **DigitalOcean** (Droplet + Managed Database)
- [ ] **Vercel** (Frontend) + **Railway** (Backend)

---

## 📦 Deployment Steps

### Option 1: Docker Deployment (Recommended)

#### A. Prepare Environment

1. **Create production .env file:**
```bash
cd src/server
cp .env.production.example .env.production
```

2. **Fill in all values in `.env.production`:**
   - Use the generated secrets from Step 1
   - Add all third-party service credentials
   - Set production URLs

3. **Update client .env:**
```bash
cd ../client
cp .env.example .env.production
```

Edit `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
INTERNAL_API_URL=http://server:5000/api/v1
NEXT_PUBLIC_PLATFORM_NAME=NMPL
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM=false
```

#### B. Build and Deploy

```bash
# 1. Navigate to src directory
cd src

# 2. Build production images
docker compose -f docker-compose.yml build

# 3. Start services
docker compose up -d

# 4. Run database migrations
docker compose exec server npx prisma migrate deploy

# 5. Seed production data (OPTIONAL - only for initial setup)
docker compose exec server npm run seed

# 6. Verify deployment
docker compose ps
docker compose logs server
docker compose logs client
```

#### C. Health Checks

```bash
# Check server health
curl https://api.yourdomain.com/health

# Check GraphQL
curl -X POST https://api.yourdomain.com/api/v1/graphql \
  -H "Content-Type: application/json" \
  -H "x-public-catalog: 1" \
  -d '{"query":"query { products { totalCount } }"}'

# Check frontend
curl https://yourdomain.com
```

---

### Option 2: Platform Deployment (Railway/Render)

#### A. Backend Deployment (Railway)

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
railway login
```

2. **Create new project:**
```bash
cd src/server
railway init
```

3. **Add environment variables:**
```bash
# Add all variables from .env.production.example
railway variables set NODE_ENV=production
railway variables set DATABASE_URL="postgresql://..."
railway variables set REDIS_URL="redis://..."
# ... add all other variables
```

4. **Deploy:**
```bash
railway up
```

5. **Run migrations:**
```bash
railway run npx prisma migrate deploy
railway run npm run seed
```

#### B. Frontend Deployment (Vercel)

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Deploy:**
```bash
cd src/client
vercel --prod
```

3. **Set environment variables in Vercel dashboard:**
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL
   - Other public variables

---

### Option 3: AWS Deployment

#### A. Infrastructure Setup

1. **Create EC2 instance:**
   - Ubuntu 22.04 LTS
   - t3.medium or larger
   - Security groups: 80, 443, 22

2. **Set up RDS PostgreSQL:**
   - PostgreSQL 15
   - db.t3.micro or larger
   - Enable automated backups

3. **Set up ElastiCache Redis:**
   - Redis 7.x
   - cache.t3.micro or larger

4. **Set up Application Load Balancer:**
   - Configure SSL certificate
   - Route traffic to EC2

#### B. Server Setup

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install dependencies
sudo apt update
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx

# Clone repository
git clone https://github.com/yourusername/NMPL_Ecom.git
cd NMPL_Ecom

# Set up environment
cd src/server
nano .env.production
# Paste all production values

# Deploy
cd ..
docker compose up -d

# Set up Nginx reverse proxy
sudo nano /etc/nginx/sites-available/nmpl
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/nmpl /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Set up SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

---

## 🔍 Post-Deployment Verification

### 1. Functional Tests

```bash
# Test authentication
curl -X POST https://api.yourdomain.com/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $(curl -s https://api.yourdomain.com/api/v1/csrf -c - | grep csrf-token | awk '{print $7}')" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Test product listing
curl -X POST https://api.yourdomain.com/api/v1/graphql \
  -H "Content-Type: application/json" \
  -H "x-public-catalog: 1" \
  -d '{"query":"query { products { totalCount } }"}'

# Test order creation (requires authentication)
# ... add more tests
```

### 2. Performance Tests

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Load test
ab -n 1000 -c 10 https://yourdomain.com/
ab -n 1000 -c 10 https://api.yourdomain.com/health
```

### 3. Security Audit

```bash
# Check SSL configuration
curl -I https://yourdomain.com

# Check security headers
curl -I https://api.yourdomain.com/health | grep -i "x-frame-options\|x-content-type-options\|strict-transport-security"

# Test CORS
curl -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS https://api.yourdomain.com/api/v1/graphql
```

---

## 📊 Monitoring Setup

### 1. Application Monitoring (Sentry)

```bash
cd src/server
npm install @sentry/node @sentry/tracing
```

Add to `src/server/src/server.ts`:
```typescript
import * as Sentry from "@sentry/node";

if (config.isProduction) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "production",
    tracesSampleRate: 0.1,
  });
}
```

### 2. Uptime Monitoring

Set up monitors in:
- **UptimeRobot** (Free): https://uptimerobot.com
- **Pingdom**: https://www.pingdom.com
- **StatusCake**: https://www.statuscake.com

Monitor these endpoints:
- `https://yourdomain.com` (every 5 minutes)
- `https://api.yourdomain.com/health` (every 5 minutes)

### 3. Log Aggregation

**Option A: CloudWatch (AWS)**
```bash
# Install CloudWatch agent on EC2
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

**Option B: Papertrail**
```bash
# Add to docker-compose.yml
logging:
  driver: syslog
  options:
    syslog-address: "udp://logs.papertrailapp.com:PORT"
```

---

## 🔄 CI/CD Setup

### GitHub Actions

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install server dependencies
        run: cd src/server && npm ci
      
      - name: Install client dependencies
        run: cd src/client && npm ci
      
      - name: Run server tests
        run: cd src/server && npm test
        env:
          NODE_ENV: test
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      
      - name: Run client tests
        run: cd src/client && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway link ${{ secrets.RAILWAY_PROJECT_ID }}
          railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      
      - name: Run migrations
        run: railway run npx prisma migrate deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

---

## 🛡️ Security Hardening

### 1. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2Ban Setup

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Database Security

```sql
-- Create read-only user for analytics
CREATE USER readonly_user WITH PASSWORD 'strong_random_password';
GRANT CONNECT ON DATABASE neondb TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;
```

### 4. Regular Security Updates

```bash
# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 🔧 Maintenance

### Database Backups

```bash
# Manual backup
docker compose exec db pg_dump -U postgres neondb > backup_$(date +%Y%m%d).sql

# Automated daily backups (crontab)
0 2 * * * docker compose exec db pg_dump -U postgres neondb > /backups/backup_$(date +\%Y\%m\%d).sql
```

### Log Rotation

```bash
# Configure Docker log rotation
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### Update Procedure

```bash
# 1. Pull latest code
git pull origin main

# 2. Backup database
docker compose exec db pg_dump -U postgres neondb > backup_pre_update.sql

# 3. Rebuild and restart
docker compose down
docker compose up -d --build

# 4. Run migrations
docker compose exec server npx prisma migrate deploy

# 5. Verify
curl https://api.yourdomain.com/health
```

---

## 🚨 Rollback Procedure

```bash
# 1. Stop current deployment
docker compose down

# 2. Checkout previous version
git checkout <previous-commit-hash>

# 3. Restore database (if needed)
docker compose exec db psql -U postgres neondb < backup_pre_update.sql

# 4. Restart services
docker compose up -d

# 5. Verify
curl https://api.yourdomain.com/health
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue: Server won't start**
```bash
# Check logs
docker compose logs server

# Check environment variables
docker compose exec server env | grep -i database

# Verify database connection
docker compose exec server npx prisma db pull
```

**Issue: High memory usage**
```bash
# Check container stats
docker stats

# Increase memory limit in docker-compose.yml
services:
  server:
    deploy:
      resources:
        limits:
          memory: 2G
```

**Issue: Slow queries**
```bash
# Enable Prisma query logging
# Add to .env.production
DEBUG=prisma:query

# Check slow queries in PostgreSQL
docker compose exec db psql -U postgres -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

---

## ✅ Production Launch Checklist

- [ ] All secrets generated and set
- [ ] All third-party services configured
- [ ] Domain and SSL configured
- [ ] Database migrations applied
- [ ] Production data seeded (if applicable)
- [ ] Health checks passing
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] CI/CD pipeline working
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Team trained on deployment process
- [ ] Rollback procedure tested
- [ ] Support contacts documented

---

## 📚 Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [Railway Documentation](https://docs.railway.app)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
