# Security Checklist

## Runtime security

- [ ] production runs only on Railway and Vercel
- [ ] HTTPS is platform-managed and enforced
- [ ] CORS does not use wildcard origins
- [ ] CSRF protection is enabled for state-changing browser requests
- [ ] auth uses JWT cookies only
- [ ] `sessionId` is not treated as an auth credential
- [ ] secure cookie settings are correct for production domains
- [ ] rate limits are enabled
- [ ] health and readiness endpoints do not leak secrets

## Secret management

- [ ] secrets are injected via platform env vars only
- [ ] no placeholder secrets remain
- [ ] `.env.production` is not committed
- [ ] access, refresh, and cookie secrets are rotated with a rollback plan
- [ ] payment and email credentials are production-only

## Supply-chain security

- [ ] exact dependency versions are enforced
- [ ] `package-lock.json` is the only lockfile format in the repo
- [ ] `npm run audit:all` passes with no `high` or `critical` findings
- [ ] `npm run licenses:check` passes
- [ ] no deprecated production dependencies remain
- [ ] no unapproved production install scripts remain

## Application hardening

- [ ] GraphQL query depth limits are enabled
- [ ] request size limits are configured
- [ ] security headers are enabled in production
- [ ] error responses avoid sensitive internals
- [ ] file upload paths are restricted and validated
- [ ] admin import/export flows allow only supported formats

## Deployment controls

- [ ] CI passes before deploy
- [ ] production migrations are backwards-compatible
- [ ] client and API deploys can roll back independently
- [ ] deploy script blocks on audits and license checks

## Manual validation

- [ ] anonymous catalog access works without bypass headers
- [ ] sign-in and refresh flows work with CSRF enabled
- [ ] logout uses `POST`
- [ ] payment mocks are disabled in production
- [ ] admin-only routes still require admin privileges
