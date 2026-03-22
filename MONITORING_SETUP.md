# Monitoring Setup

Supported production monitoring targets:

- Railway service health and logs for the API
- Vercel deployment status and runtime logs for the client
- external uptime checks for public endpoints

## Required monitors

Create uptime checks for:

- `https://api.yourdomain.com/health`
- `https://yourdomain.com/`
- optionally `https://api.yourdomain.com/api/v1/graphql` with a simple catalog query

Alert on:

- repeated HTTP `5xx`
- health endpoint returning unhealthy
- sustained latency increase

## Recommended services

- UptimeRobot or Better Stack for uptime checks
- Railway logs for API incidents
- Vercel logs for frontend incidents
- optional Sentry for app-level exceptions if you adopt it explicitly

## Minimum API signals

The API should expose and keep stable:

- `GET /health`
- readiness behavior during cold start
- trace IDs on responses
- structured error envelopes

## Operational checks after each release

- API health returns `200`
- homepage returns `200`
- anonymous catalog query returns data
- auth cookie flows still work across frontend and API domains

## Logs to review during incidents

### Railway

- deployment logs
- runtime stderr/stdout
- failed migration output
- cold-start failures

### Vercel

- build failures
- SSR request failures
- runtime edge or node errors

## Metrics to track

- API error rate
- API p95 latency
- frontend response time
- Railway restart frequency
- Prisma query latency
- Redis connectivity failures

## Release-day checklist

- watch Railway logs during deploy
- confirm the API becomes healthy before promoting the frontend
- confirm Vercel deploys against the intended API URL
- verify cart, auth, and checkout flows manually
