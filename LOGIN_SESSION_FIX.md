# Login Session Fix - Summary

## Issues Identified and Fixed

### 1. Cookie Configuration Issues

**Problem:** Cookies were not persisting properly across requests, causing session loss.

**Fixes Applied:**

#### a) Added `maxAge` to Cookie Options
- **File:** `src/server/src/shared/constants/index.ts`
- **Change:** Added `maxAge: 1000 * 60 * 60 * 24 * 7` (7 days) to ensure cookies persist
- **Why:** Without maxAge, cookies were session-only and would be cleared when the browser closed

#### b) Enhanced Session Configuration
- **File:** `src/server/src/app.ts`
- **Changes:**
  - Added `name: "sessionId"` for explicit session cookie naming
  - Added `rolling: true` to refresh session expiry on each request
  - Added explicit `path: "/"` to ensure cookies work across all routes
- **Why:** These settings ensure sessions are properly maintained and refreshed

#### c) Improved Token Refresh Flow
- **File:** `src/server/src/modules/auth/auth.controller.ts`
- **Change:** Clear old cookies before setting new ones in the refresh token endpoint
- **Why:** Prevents stale cookie issues and ensures clean token rotation

### 2. Environment Configuration

**Verified:** The `.env` file already has correct settings:
- `COOKIE_DOMAIN=` (empty) - Correct for localhost development
- `COOKIE_SAMESITE=lax` - Appropriate for development
- `REDIS_ENABLED=false` - Using in-memory session store for development

## How the Session System Works Now

### Login Flow
1. User submits credentials to `/api/v1/auth/sign-in`
2. Server validates credentials and generates:
   - Access token (JWT, 15 min expiry)
   - Refresh token (JWT, 24 hour expiry)
3. Both tokens are set as httpOnly cookies with 7-day maxAge
4. Express session is created and stored (in-memory or Redis)

### Session Persistence
- Cookies now have explicit `maxAge` so they persist across browser sessions
- Session cookie is named `sessionId` for clarity
- `rolling: true` means session expiry refreshes on each request
- Access and refresh tokens are stored as separate cookies

### Token Refresh Flow
1. When access token expires, client calls `/api/v1/auth/refresh-token`
2. Server validates refresh token from cookie
3. Old cookies are cleared first (prevents conflicts)
4. New access and refresh tokens are generated and set as cookies
5. Client receives updated user data

### Session Validation
- The `protect` middleware checks access token on protected routes
- Uses Redis cache (or in-memory) to avoid DB hits on every request
- Cache expires after 60s as a safety backstop
- Token version checking prevents use of invalidated tokens

## Testing the Fix

### 1. Test Login Persistence
```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt

# Verify session persists
curl http://localhost:5000/api/v1/users/me \
  -b cookies.txt
```

### 2. Test Token Refresh
```bash
# Wait for access token to expire (15 min) or manually test
curl -X POST http://localhost:5000/api/v1/auth/refresh-token \
  -b cookies.txt \
  -c cookies.txt

# Verify new tokens work
curl http://localhost:5000/api/v1/users/me \
  -b cookies.txt
```

### 3. Test Browser Session
1. Login via the web interface
2. Close browser completely
3. Reopen browser and navigate to the app
4. Session should persist (user still logged in)

## Common Issues and Solutions

### Issue: Session lost on browser close
**Solution:** Cookies now have `maxAge` set, so they persist

### Issue: Session lost on page refresh
**Solution:** 
- Session cookie has `rolling: true` to refresh on each request
- Client-side AuthProvider revalidates auth on mount

### Issue: "Unauthorized" after some time
**Solution:**
- Token refresh flow now properly clears old cookies
- Refresh token has 24-hour absolute expiry
- Access token refreshes automatically via RTK Query

### Issue: Cookies not being sent
**Solution:**
- API client uses `credentials: "include"`
- CORS configured to allow credentials
- Cookie domain is empty for localhost (correct)

## Production Considerations

When deploying to production, ensure:

1. **Environment Variables:**
   ```env
   NODE_ENV=production
   COOKIE_DOMAIN=.yourdomain.com
   COOKIE_SAMESITE=strict
   REDIS_ENABLED=true
   REDIS_URL=redis://your-redis-url
   ```

2. **HTTPS Required:**
   - Cookies with `secure: true` only work over HTTPS
   - Set `TRUST_PROXY=true` if behind a reverse proxy

3. **Session Store:**
   - Use Redis for session storage (required in production)
   - Configure Redis URL and connection settings

4. **Security:**
   - Change all secret keys from dev defaults
   - Use strong, unique values for:
     - SESSION_SECRET
     - COOKIE_SECRET
     - ACCESS_TOKEN_SECRET
     - REFRESH_TOKEN_SECRET

## Files Modified

1. `src/server/src/shared/constants/index.ts` - Added maxAge to cookies
2. `src/server/src/app.ts` - Enhanced session configuration
3. `src/server/src/modules/auth/auth.controller.ts` - Improved token refresh

## No Changes Needed

These files were already correctly configured:
- `src/server/.env` - Cookie domain already empty for localhost
- `src/client/app/store/slices/ApiSlice.ts` - Already using credentials: "include"
- `src/server/src/shared/middlewares/protect.ts` - Token validation working correctly
