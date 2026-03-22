# GitHub Secrets Reference

This repository no longer uses GitHub Actions to deploy production.

Current GitHub Actions scope:

- install verification
- env validation
- build verification
- dependency audit
- dependency license and install-script policy checks

## Repository secrets

No GitHub repository secrets are required for the default `ci.yml` workflow.

The workflow uses:

- `src/server/.env.example` for server validation in CI
- inline production-safe client env values for client build verification

## Local deployment credentials

Production deployment is executed locally with `npm run deploy`, using:

- Railway CLI authentication
- Vercel CLI authentication
- platform-managed environment variables

Do not store production deploy tokens in GitHub unless you intentionally add a
separate reviewed deployment workflow.
