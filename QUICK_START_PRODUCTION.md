# Production Quick Start Guide

## 🚀 Fast Track to Production (30 Minutes)

### Prerequisites
- [ ] Domain name purchased
- [ ] Hosting platform account (Railway/Render/AWS)
- [ ] Credit card for third-party services

---

## Step 1: Generate Secrets (2 minutes)

```bash
cd src/server

# Generate all 4 secrets at once
node -e "
const crypto = require('crypto');
console.log('Copy these to your .env.production file:\n');
console.log('ACCESS_TOKEN_SECRET=' + crypto.randomBytes(64).toString('hex'));
console.log('REFRESH_TOKEN_SECRET=' + crypto.randomBytes(64).toString('hex'));
console.log('SESSION_SECRET=' + crypto.randomBytes(64).toString('hex'));
console.log('COOKIE_SECRET=' + crypto.randomBytes(64).toString('hex'));
"
```

---

## Step 2: Set Up Third-Party Services (15 minutes)

### A. Redis (Required) - 3 minutes
**Upstash (Free tier):**
1. Go to https://upstash.com
2. Sign up → Create Database
3. Copy Redis URL
4. Add to `.env.production`: `REDIS_URL=redis://...`

### B. Email Service - 5 minutes
**SendGrid (Free tier: 100 emails/day):**
1. Go to https://sendgrid.com
2. Sign up → Create API Key
3. Verify sender email
4. Add to `.env.production`:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=<your_api_key>
   EMAIL_FROM=noreply@yourdomain.com
   ```

### C. Payment Gateway - 5 minutes
**Razorpay (India):**
1. Go to https://razorpay.com
2. Sign up → Get API Keys
3. Add to `.env.production`:
   ```env
   RAZORPAY_KEY_ID=<your_key_id>
   RAZORPAY_KEY_SECRET=<your_key_secret>
   RAZORPAY_MOCK_MODE=false
   ENABLE_MOCK_PAYMENT=false
   ```

### D. SMS Service (Optional) - 2 minutes
**Twilio:**
1. Go to https://twilio.com
2. Sign up → Get credentials
3. Add to `.env.production`:
   ```env
   SMS_PROVIDER=TWILIO
   TWILIO_ACCOUNT_SID=<your_sid>
   TWILIO_AUTH_TOKEN=<your_token>
   TWILIO_FROM_NUMBER=<your_number>
   ```

---

## Step 3: Deploy Backend (5 minutes)

### Option A: Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
cd src/server
railway init

# Set environment variables (paste all from .env.production)
railway variables set NODE_ENV=production
railway variables set DATABASE_URL="<your_neon_url>"
railway variables set REDIS_URL="<your_upstash_url>"
# ... set all other variables

# Deploy
railway up

# Run migrations
railway run npx prisma migrate deploy

# Seed database
railway run npm run seed

# Get your backend URL
railway domain
```

### Option B: Render

1. Go to https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Build Command: `cd src/server && npm install && npx prisma generate`
5. Start Command: `cd src/server && npm start`
6. Add all environment variables from `.env.production`
7. Deploy

---

## Step 4: Deploy Frontend (5 minutes)

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd src/client
vercel --prod

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_API_URL=<your_railway_backend_url>/api/v1
# NEXT_PUBLIC_PLATFORM_NAME=NMPL
# NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
```

---

## Step 5: Configure Domain (3 minutes)

### DNS Settings
Add these records to your domain registrar:

```
Type    Name    Value
A       @       <your_server_ip>
A       api     <your_server_ip>
CNAME   www     yourdomain.com
```

### SSL Certificate
- **Railway/Render/Vercel**: Automatic SSL ✅
- **Custom server**: Use Let's Encrypt
  ```bash
  sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
  ```

---

## Step 6: Verify Deployment (2 minutes)

```bash
# 1. Health check
curl https://api.yourdomain.com/health

# Expected: {"healthy":true,...}

# 2. GraphQL test
curl -X POST https://api.yourdomain.com/api/v1/graphql \
  -H "Content-Type: application/json" \
  -H "x-public-catalog: 1" \
  -d '{"query":"query { products { totalCount } }"}'

# Expected: {"data":{"products":{"totalCount":10}}}

# 3. Frontend test
curl https://yourdomain.com

# Expected: HTML response
```

---

## ✅ Production Checklist

### Security
- [ ] All 4 secrets generated and set
- [ ] Database credentials secured
- [ ] Redis enabled and configured
- [ ] HTTPS enabled
- [ ] CORS configured with production domain only

### Services
- [ ] Redis connected
- [ ] Email service working
- [ ] Payment gateway in live mode
- [ ] SMS service configured (optional)

### Deployment
- [ ] Backend deployed and healthy
- [ ] Frontend deployed and accessible
- [ ] Database migrations applied
- [ ] Initial data seeded
- [ ] Domain configured
- [ ] SSL certificate active

### Testing
- [ ] Can access homepage
- [ ] Can view products
- [ ] Can sign up
- [ ] Can sign in
- [ ] Can add to cart
- [ ] Can checkout
- [ ] Can make payment

---

## 🚨 Common Issues & Fixes

### Issue: "Cannot connect to database"
```bash
# Check DATABASE_URL format
# Should be: postgresql://user:pass@host/db?sslmode=require

# Verify in Railway/Render dashboard
railway variables get DATABASE_URL
```

### Issue: "Redis connection failed"
```bash
# Check REDIS_ENABLED=true
# Check REDIS_URL format
# Should be: redis://default:password@host:port

railway variables get REDIS_URL
```

### Issue: "CORS error"
```bash
# Check ALLOWED_ORIGINS includes your frontend domain
railway variables set ALLOWED_ORIGINS="https://yourdomain.com"
```

### Issue: "Payment not working"
```bash
# Verify payment gateway is in live mode
railway variables get RAZORPAY_MOCK_MODE
# Should be: false

railway variables get ENABLE_MOCK_PAYMENT
# Should be: false
```

---

## 📊 Monitoring Setup (Optional, 10 minutes)

### Uptime Monitoring
1. Go to https://uptimerobot.com
2. Add monitors:
   - `https://yourdomain.com` (every 5 min)
   - `https://api.yourdomain.com/health` (every 5 min)

### Error Tracking
```bash
# Install Sentry
cd src/server
npm install @sentry/node

# Add to src/server/src/server.ts
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN });

# Set SENTRY_DSN in Railway
railway variables set SENTRY_DSN="<your_sentry_dsn>"
```

---

## 🔄 Update Procedure

```bash
# 1. Pull latest code
git pull origin main

# 2. Deploy backend
cd src/server
railway up

# 3. Run migrations (if any)
railway run npx prisma migrate deploy

# 4. Deploy frontend
cd ../client
vercel --prod

# 5. Verify
curl https://api.yourdomain.com/health
```

---

## 📞 Support

**Issues?** Check:
1. Railway/Render logs
2. Browser console (F12)
3. Network tab (F12)
4. `/health` endpoint response

**Still stuck?**
- Review `PRODUCTION_DEPLOYMENT.md` for detailed guide
- Check `SECURITY_CHECKLIST.md` for security issues
- Review server logs: `railway logs`

---

## 🎉 You're Live!

Your ecommerce platform is now in production!

**Next steps:**
1. Test all critical user flows
2. Set up monitoring alerts
3. Configure automated backups
4. Review security checklist
5. Train your team
6. Announce launch! 🚀

**Important URLs:**
- Frontend: https://yourdomain.com
- Backend: https://api.yourdomain.com
- Health: https://api.yourdomain.com/health
- GraphQL: https://api.yourdomain.com/api/v1/graphql

**Default Admin Login:**
- Email: `admin@example.com`
- Password: `password123`
- **⚠️ CHANGE THIS IMMEDIATELY!**
