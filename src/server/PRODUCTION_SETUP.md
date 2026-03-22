# Archived Note

This file previously documented a session-based production setup that no longer
matches the current platform.

Use the root-level production docs instead:

- `QUICK_START_PRODUCTION.md`
- `PRODUCTION_DEPLOYMENT.md`

Current production rules:

- Railway hosts the API
- Vercel hosts the client
- auth uses JWT cookies
- `sessionId` is not an auth credential
- Docker Compose is development-only
