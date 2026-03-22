# Production Launch Checklist

## Platform readiness

- [ ] Railway project exists for `src/server`
- [ ] Vercel project exists for `src/client`
- [ ] Production domains are mapped in Railway and Vercel
- [ ] Managed PostgreSQL is reachable from Railway
- [ ] Managed Redis is reachable from Railway

## Secrets and env

- [ ] `ACCESS_TOKEN_SECRET` is unique and strong
- [ ] `REFRESH_TOKEN_SECRET` is unique and strong
- [ ] `COOKIE_SECRET` is unique and strong
- [ ] `DATABASE_URL` points to production
- [ ] `REDIS_URL` points to production
- [ ] `ALLOWED_ORIGINS` only contains production client origins
- [ ] `COOKIE_DOMAIN` matches the production domain model
- [ ] mock payment flags are disabled
- [ ] production email credentials are configured
- [ ] payment gateway credentials are configured

## Security and supply chain

- [ ] `npm run audit:all` passes
- [ ] `npm run licenses:check` passes
- [ ] no deprecated production dependencies remain
- [ ] CI workflow is green on the release commit
- [ ] `.env.production` files are not committed

## Build and deploy

- [ ] server build passes
- [ ] client production build passes
- [ ] Railway deployment succeeds
- [ ] Prisma migrations apply cleanly
- [ ] Vercel deployment succeeds
- [ ] health endpoint reports healthy

## Functional validation

- [ ] homepage loads
- [ ] catalog query succeeds anonymously
- [ ] product detail loads
- [ ] sign-up flow works
- [ ] sign-in flow works
- [ ] logout flow works
- [ ] password reset flow works
- [ ] cart add and merge work
- [ ] checkout starts successfully
- [ ] payment creation works
- [ ] admin dashboard loads
- [ ] analytics export works in CSV/PDF only
- [ ] reports export works in CSV/PDF only
- [ ] product bulk import accepts CSV only

## Observability

- [ ] uptime monitor checks frontend
- [ ] uptime monitor checks API health
- [ ] Railway logs are accessible
- [ ] Vercel logs are accessible
- [ ] alert contacts are current

## Rollback readiness

- [ ] last known-good Railway deployment identified
- [ ] last known-good Vercel deployment identified
- [ ] rollback owner assigned
- [ ] migration rollback risk reviewed
