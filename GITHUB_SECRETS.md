# GitHub Actions Secrets Reference

Go to: **GitHub → Your Repo → Settings → Secrets and variables → Actions → New repository secret**

## Required Secrets

| Secret Name                    | Value                                               |
|-------------------------------|-----------------------------------------------------|
| `PRODUCTION_DATABASE_URL`      | Neon pooled URL (same as `.env.production` value)   |
| `PRODUCTION_DIRECT_URL`        | Neon direct URL                                     |
| `PRODUCTION_REDIS_URL`         | Upstash Redis URL                                   |
| `ACCESS_TOKEN_SECRET`          | From `.env.production`                              |
| `REFRESH_TOKEN_SECRET`         | From `.env.production`                              |
| `SESSION_SECRET`               | From `.env.production`                              |
| `COOKIE_SECRET`                | From `.env.production`                              |
| `COOKIE_DOMAIN`                | `.nmpl.in`                                          |
| `PRODUCTION_API_URL`           | `https://api.nmpl.in`                               |
| `PRODUCTION_FRONTEND_URL`      | `https://nmpl.in`                                   |
| `STAGING_API_URL`              | `https://staging-api.nmpl.in` (or Railway preview)  |
| `STAGING_FRONTEND_URL`         | `https://staging.nmpl.in` (or Vercel preview)       |
| `SUPPORT_EMAIL`                | `support@nmpl.in`                                   |
| `BILLING_NOTIFICATION_EMAILS`  | `billing@nmpl.in`                                   |
| `EMAIL_FROM`                   | `noreply@nmpl.in`                                   |
| `SMTP_PASS`                    | SendGrid API key or Gmail app password              |

## Railway Secrets (for CI/CD deployment)

| Secret Name                       | Where to find                                   |
|----------------------------------|-------------------------------------------------|
| `RAILWAY_TOKEN`                   | Railway → Account Settings → Tokens            |
| `RAILWAY_PRODUCTION_PROJECT_ID`   | Railway → Project → Settings → Project ID      |
| `RAILWAY_STAGING_PROJECT_ID`      | Railway → Staging Project → Settings           |

## Vercel Secrets (for client deployment)

| Secret Name         | Where to find                                          |
|--------------------|--------------------------------------------------------|
| `VERCEL_TOKEN`      | Vercel → Account Settings → Tokens                    |
| `VERCEL_ORG_ID`     | Vercel → Team Settings → General → Team ID            |
| `VERCEL_PROJECT_ID` | Vercel → Project → Settings → General → Project ID    |

## Optional Secrets

| Secret Name      | Value                                        |
|-----------------|----------------------------------------------|
| `SLACK_WEBHOOK`  | Slack incoming webhook URL for notifications |

## GitHub Environment Protection Rules (recommended)

1. Go to Settings → Environments → `production`
2. Enable **Required reviewers** and add yourself
3. This forces a manual approval before any production deploy

This means: push to `main` → staging deploys automatically → you review → click "Approve" → production deploys.
