# Session Management Updates

## What Changed

The login session system has been enhanced to ensure reliable authentication persistence across browser sessions and page refreshes.

## Key Improvements

### 1. Cookie Persistence
- Cookies now have explicit 7-day `maxAge` instead of being session-only
- Sessions persist even after closing and reopening the browser
- Automatic session refresh on each request via `rolling: true`

### 2. Token Management
- Improved token refresh flow with proper cookie cleanup
- Better handling of expired tokens
- Automatic retry with refreshed tokens on 401 errors

### 3. Session Configuration
- Named session cookie (`sessionId`) for clarity
- Explicit path configuration for all cookies
- Proper domain handling for localhost vs production

## For Developers

### Testing Your Session
1. Login to the application
2. Close your browser completely
3. Reopen and navigate to the app
4. You should still be logged in ✅

### Debug Tools
- See `SESSION_TROUBLESHOOTING.md` for quick debugging steps
- See `LOGIN_SESSION_FIX.md` for detailed technical explanation

### Environment Setup
No changes needed to your `.env` file if you're already running the app. The fixes work with existing configuration.

## Technical Details

### Modified Files
1. `src/server/src/shared/constants/index.ts`
   - Added `maxAge: 1000 * 60 * 60 * 24 * 7` to cookie options

2. `src/server/src/app.ts`
   - Added `name: "sessionId"` to session config
   - Added `rolling: true` for automatic session refresh
   - Added explicit `path: "/"` to session cookie

3. `src/server/src/modules/auth/auth.controller.ts`
   - Enhanced `refreshToken` endpoint to clear old cookies before setting new ones

### How It Works
```
Login → Set Cookies (7-day expiry) → Session Created
  ↓
User Activity → Session Refreshed (rolling) → Cookies Updated
  ↓
Access Token Expires → Auto Refresh → New Tokens Set
  ↓
Browser Close → Cookies Persist → Session Maintained
  ↓
Browser Reopen → Cookies Sent → User Still Authenticated ✅
```

## Backward Compatibility

These changes are fully backward compatible. Existing sessions will continue to work, and new sessions will benefit from the improved persistence.

## Production Deployment

When deploying to production, ensure:
1. `REDIS_ENABLED=true` (required for production)
2. `COOKIE_DOMAIN` is set to your domain (e.g., `.yourdomain.com`)
3. `COOKIE_SAMESITE=strict` for enhanced security
4. All secret keys are changed from dev defaults

See `LOGIN_SESSION_FIX.md` for complete production checklist.
