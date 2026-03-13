# Session Troubleshooting Quick Guide

## Quick Checks

### 1. Verify Cookies Are Being Set
Open browser DevTools → Application/Storage → Cookies → `http://localhost:3000`

You should see:
- `accessToken` - JWT token (httpOnly)
- `refreshToken` - JWT token (httpOnly)
- `sessionId` - Express session ID (httpOnly)

### 2. Check Cookie Attributes
Each cookie should have:
- ✅ HttpOnly: true
- ✅ Secure: false (dev) / true (prod)
- ✅ SameSite: Lax
- ✅ Path: /
- ✅ Max-Age: 604800 (7 days)
- ✅ Domain: (empty for localhost)

### 3. Verify API Requests Include Cookies
In DevTools → Network → Select any API request → Headers

Request Headers should include:
```
Cookie: accessToken=...; refreshToken=...; sessionId=...
```

## Common Problems

### Problem: "Unauthorized" immediately after login
**Cause:** Cookies not being sent with requests

**Fix:**
1. Check CORS configuration in `.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:3000
   ```
2. Verify client API base URL matches server:
   ```typescript
   // src/client/app/lib/constants/config.ts
   export const API_BASE_URL = "http://localhost:5000/api/v1";
   ```

### Problem: Session lost on page refresh
**Cause:** Cookies not persisting or AuthProvider not revalidating

**Fix:**
1. Check cookies have `maxAge` set (should be 604800 seconds)
2. Verify AuthProvider is mounted in layout:
   ```typescript
   // src/client/app/layout.tsx
   <AuthProvider>{children}</AuthProvider>
   ```

### Problem: Session lost after browser close
**Cause:** Cookies were session-only (no maxAge)

**Fix:** Already fixed - cookies now have 7-day maxAge

### Problem: Token refresh fails
**Cause:** Old cookies not being cleared before setting new ones

**Fix:** Already fixed - refresh endpoint now clears old cookies first

## Debug Commands

### Check if server is receiving cookies:
```bash
# Login and save cookies
curl -X POST http://localhost:5000/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt -v

# Check cookies file
cat cookies.txt

# Test protected endpoint
curl http://localhost:5000/api/v1/users/me \
  -b cookies.txt -v
```

### Check Redis connection (if enabled):
```bash
# Connect to Redis
redis-cli

# Check session keys
KEYS *session*

# Check token blacklist
KEYS *blacklist*
```

### Check server logs:
```bash
# In server directory
cd src/server
npm run dev

# Look for:
# - "Connected to Redis" (if Redis enabled)
# - "SERVER READY — accepting API traffic"
# - Any authentication errors
```

## Environment Checklist

### Development (.env)
```env
NODE_ENV=development
PORT=5000
CLIENT_URL_DEV=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
COOKIE_DOMAIN=
COOKIE_SAMESITE=lax
REDIS_ENABLED=false
SESSION_SECRET=dev_session_secret_change_me
COOKIE_SECRET=dev_cookie_secret_change_me
ACCESS_TOKEN_SECRET=dev_access_token_secret_change_me
REFRESH_TOKEN_SECRET=dev_refresh_token_secret_change_me
```

### Production (.env)
```env
NODE_ENV=production
PORT=5000
CLIENT_URL_PROD=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
COOKIE_SAMESITE=strict
REDIS_ENABLED=true
REDIS_URL=redis://your-redis-url
SESSION_SECRET=<strong-unique-secret>
COOKIE_SECRET=<strong-unique-secret>
ACCESS_TOKEN_SECRET=<strong-unique-secret>
REFRESH_TOKEN_SECRET=<strong-unique-secret>
```

## Testing Checklist

- [ ] Login works and sets cookies
- [ ] Cookies persist after page refresh
- [ ] Cookies persist after browser close/reopen
- [ ] Protected routes work with valid session
- [ ] Token refresh works when access token expires
- [ ] Logout clears all cookies
- [ ] Multiple tabs stay in sync (same session)
- [ ] Session expires after 7 days of inactivity

## Need More Help?

1. Check server logs for authentication errors
2. Check browser console for API errors
3. Verify network requests include cookies
4. Test with curl to isolate client vs server issues
5. Review `LOGIN_SESSION_FIX.md` for detailed explanation
