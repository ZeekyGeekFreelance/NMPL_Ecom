# Environment Source Of Truth

This document is the authoritative environment contract for NMPL production.

Use these files as the only supported templates:

- Server production template: `src/server/.env.production.example`
- Client template: `src/client/.env.example`
- Docker dev helper only: `src/.env.example`
- Local dev server template: `src/server/.env.example`

What is no longer part of the supported env surface:

- OAuth callback and provider keys
- `SESSION_SECRET`
- automatic reservation-expiry settings

These were stale or no longer used by the runtime. Do not reintroduce them unless the codebase adds real runtime support again.

## Production Fields Requiring Real Values

Server runtime values that must be filled with real production data:

- `PUBLIC_API_BASE_URL`
- `CLIENT_URL_PROD`
- `ALLOWED_ORIGINS`
- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `COOKIE_SECRET`
- `SUPERADMIN_RESET_SECRET`
- `COOKIE_DOMAIN`
- `BILLING_NOTIFICATION_EMAILS`
- `PICKUP_STORE_PHONE`
- `PICKUP_STORE_LINE1`
- `PICKUP_STORE_LANDMARK`
- `PICKUP_STORE_CITY`
- `PICKUP_STORE_STATE`
- `PICKUP_STORE_COUNTRY`
- `PICKUP_STORE_PINCODE`
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` if SMS is enabled
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` if Razorpay is used
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` if Stripe is used
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` if media uploads are enabled

Server values already decided:

- `PLATFORM_NAME=NMPL`
- `SUPPORT_EMAIL=support@nmpl.online`
- `ENABLE_MOCK_PAYMENT=false`
- `RAZORPAY_MOCK_MODE=false`

Client values that must be filled with real production data:

- `NEXT_PUBLIC_API_URL`
- `INTERNAL_API_URL` when an internal SSR-only service URL is available

Production rules:

- `DATABASE_URL` must be the pooled/runtime connection string
- `DIRECT_URL` must be the direct maintenance connection string used by Prisma migrations
- `INTERNAL_API_URL` is recommended in production so SSR can bypass the public edge host
- if `INTERNAL_API_URL` is omitted, SSR falls back to `NEXT_PUBLIC_API_URL`

Client values already decided:

- `NEXT_PUBLIC_PLATFORM_NAME=NMPL`
- `NEXT_PUBLIC_SUPPORT_EMAIL=support@nmpl.online`
- `NEXT_PUBLIC_ENABLE_NATIVE_CONFIRM=false`

## Script-only Variables

These are not read by the runtime server boot, but they are intentionally kept for guarded operational scripts:

- `DB_ENV`

Use:

- `DB_ENV=development` for local dev seed/import scripts
- `DB_ENV=production` only for deliberate production maintenance scripts

Do not set `DB_ENV=production` casually on a development machine.

## SuperAdmin Lockout Remedy

`SUPERADMIN_RESET_SECRET` is the emergency break-glass control for a locked-out SuperAdmin.

Operational rules:

- store it only in Railway, never in client env or public docs
- keep it at least 32 characters, generated randomly
- use it only with `POST /api/v1/auth/superadmin/reset-password`
- rotate it immediately after any use
- treat it like a deployment secret, not a user password

## Order Follow-up Policy

The production system no longer uses automatic quotation expiry as an active policy.

Current rule:

- stock can still be held internally for approved quotations
- customer-facing expiry deadlines are disabled
- operational follow-up is manual
- if the customer does not respond, the order should be cancelled manually by admin staff

Historical `QUOTATION_EXPIRED` records may still exist in data, but the active production UI should not offer that path for new orders.
