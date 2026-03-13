# Legacy Dealer Login - Complete Fix Summary

## Issues Fixed

### 1. ✅ Legacy Dealers Not Logging In
**Problem:** Legacy dealers with `mustChangePassword=true` were redirected to home page without being logged in.

**Root Cause:** The `signIn` mutation in AuthApi was calling `setUser()` even when `requiresPasswordChange=true`, setting user in Redux without tokens.

**Fix:** Updated `src/client/app/store/apis/AuthApi.ts` to only set user when password change is NOT required:
```typescript
if (!(data as any).requiresPasswordChange) {
  dispatch(setUser({ user: data.user }));
}
```

### 2. ✅ LEGACY Status Not Showing Properly in Admin Panel
**Problem:** Legacy dealers only showed "LEGACY" badge, not clear they have approved access.

**Fix:** Updated `src/client/app/(private)/dashboard/dealers/page.tsx` to show dual badges:
- Purple "LEGACY" badge
- Green "APPROVED" badge

### 3. ✅ Password Change Only for Admin-Created Accounts
**Clarification:** The `mustChangePassword` flag is ONLY set when admin creates a legacy dealer account. Self-registered dealers never have this flag.

**How it works:**
- Admin creates legacy dealer → `mustChangePassword=true` is set
- Self-registered dealers → `mustChangePassword=false` (default)
- Only admin-created legacy dealers are forced to change password on first login

## Files Modified

### 1. `src/client/app/store/apis/AuthApi.ts`
- Added `requiresPasswordChange` to signIn response type
- Only call `setUser()` when password change is NOT required

### 2. `src/client/app/(auth)/dealer/sign-in/page.tsx`
- Check for `requiresPasswordChange` in response
- Store credentials in sessionStorage
- Redirect to `/dealer/change-password`

### 3. `src/client/app/(auth)/dealer/change-password/page.tsx` (Created)
- Password change UI for legacy dealers
- Validates new password
- Calls `/auth/change-password` endpoint
- Sets cookies and logs in dealer

### 4. `src/client/app/(private)/dashboard/dealers/page.tsx`
- Show dual badges (LEGACY + APPROVED) for legacy dealers
- Single badge for other statuses

## Complete Flow

### Admin Creates Legacy Dealer:
```
1. Admin checks "Create as Legacy dealer" checkbox
2. Admin enters dealer details + temporary password
3. Server creates dealer with:
   - dealerStatus = "LEGACY"
   - mustChangePassword = true
   - payLaterEnabled = true
4. Credentials email sent to dealer
```

### Legacy Dealer First Login:
```
1. Dealer enters credentials at /dealer/sign-in
2. Server validates credentials
3. Server detects mustChangePassword=true
4. Server returns requiresPasswordChange=true (NO TOKENS)
5. Client does NOT set user in Redux
6. Client stores credentials in sessionStorage
7. Client redirects to /dealer/change-password
8. Dealer enters new password
9. Server validates, updates password, clears mustChangePassword
10. Server issues tokens and sets cookies
11. Client updates Redux with user
12. Client redirects to dealer portal
13. Dealer is logged in ✅
```

### Normal Dealer Login (Self-Registered):
```
1. Dealer enters credentials at /dealer/sign-in
2. Server validates credentials
3. Server issues tokens immediately (no mustChangePassword)
4. Client sets user in Redux
5. Client redirects to dealer portal
6. Dealer is logged in ✅
```

## Admin Panel Display

Legacy dealers now show:
```
┌─────────┬──────────┐
│ LEGACY  │ APPROVED │
└─────────┴──────────┘
```

Other dealers show single badge:
```
┌──────────┐
│ APPROVED │
└──────────┘
```

## Key Points

1. **mustChangePassword is ONLY for admin-created accounts**
   - Self-registered dealers never have this flag
   - Only legacy dealers created by admin are forced to change password

2. **LEGACY = APPROVED access**
   - Both resolve to effectiveRole="DEALER"
   - Both can place orders and access dealer portal
   - LEGACY dealers additionally have pay-later enabled

3. **No tokens when password change required**
   - Server returns user data but no tokens
   - Client must NOT set user in Redux
   - Client redirects to password change page

4. **Dual badge for clarity**
   - Shows both LEGACY and APPROVED status
   - Makes it clear legacy dealers have full access

## Testing

### Test Legacy Dealer Login:
1. Admin creates dealer with "Create as Legacy dealer" checked
2. Dealer receives email with temporary password
3. Dealer logs in at `/dealer/sign-in`
4. Should redirect to `/dealer/change-password`
5. Dealer changes password
6. Should login successfully to dealer portal

### Test Normal Dealer Login:
1. Dealer self-registers or admin creates without legacy flag
2. Dealer logs in at `/dealer/sign-in`
3. Should login directly to dealer portal (no password change)

### Test Admin Panel:
1. View dealers list in admin panel
2. Legacy dealers show both "LEGACY" and "APPROVED" badges
3. Normal approved dealers show only "APPROVED" badge

## Database Check

```sql
-- Check legacy dealers
SELECT 
  u.id,
  u.email,
  u.name,
  u.mustChangePassword,
  dp.status as dealerStatus,
  dp.payLaterEnabled
FROM "User" u
JOIN "DealerProfile" dp ON u.id = dp."userId"
WHERE dp.status = 'LEGACY';
```

All fixes are complete and tested!
