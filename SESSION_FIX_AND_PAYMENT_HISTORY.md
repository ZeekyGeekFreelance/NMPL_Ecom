# Session Persistence Fix & Dealer Payment History Implementation

## Issues Fixed

### 1. Session Persistence Issue (All Roles: USER, DEALER, ADMIN, SUPERADMIN)

**Problem**: After signin, the session was not persistent across all roles. Cookies were being set but not properly maintained.

**Root Causes**:
1. Cookie domain configuration was explicitly set to empty string, which browsers reject for localhost
2. Missing passport serialization/deserialization for session management

**Solutions Implemented**:

#### A. Cookie Configuration Fix
**File**: `src/server/src/shared/constants/index.ts`

Changed from:
```typescript
export const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
  path: "/",
  domain: config.security.cookieDomain,  // ❌ This was the problem
};
```

To:
```typescript
export const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
  path: "/",
  // Only set domain if explicitly configured (production)
  // Leave undefined for localhost to work correctly
  ...(config.security.cookieDomain ? { domain: config.security.cookieDomain } : {}),
};
```

**Why this works**: When `COOKIE_DOMAIN` is empty in `.env`, the domain property is now omitted entirely from the cookie options. Browsers automatically use the current domain when no domain is specified, which is the correct behavior for localhost development.

#### B. Passport Session Serialization
**File**: `src/server/src/infra/passport/passport.ts`

Added missing serialization/deserialization:
```typescript
export default function configurePassport() {
  // Serialize user ID into session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          phone: true,
          tokenVersion: true,
        },
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
  
  // ... rest of OAuth strategies
}
```

**Why this is critical**: Passport requires explicit serialization/deserialization to store and retrieve user data from sessions. Without this, sessions cannot persist user authentication state.

---

### 2. Dealer Payment History Feature (NEW IMPLEMENTATION)

**Problem**: Backend had comprehensive dealer payment tracking (credit ledger, outstanding orders, audit trail) but NO frontend UI to view this data.

**Solution**: Implemented complete dealer payment history viewing feature.

#### A. Payment API Slice
**File**: `src/client/app/store/apis/PaymentApi.ts` (NEW FILE)

Created RTK Query endpoints for:
- `getDealerCreditLedger` - Fetch dealer's complete transaction ledger
- `getOutstandingPaymentOrders` - Get unpaid orders for a dealer
- `getOrderAuditTrail` - Get payment audit trail for specific orders
- `recordAdminPayment` - Admin can record offline payments

```typescript
export const paymentApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDealerCreditLedger: builder.query<DealerCreditLedger, string>({
      query: (dealerId) => ({
        url: `/payments/credit-ledger/${dealerId}`,
        method: "GET",
      }),
      providesTags: ["Order"],
    }),
    // ... other endpoints
  }),
});
```

#### B. Dealers Dashboard Enhancement
**File**: `src/client/app/(private)/dashboard/dealers/page.tsx`

**Changes Made**:

1. **Added Payment History Button** (LEGACY dealers only):
```typescript
{dealer.dealerProfile?.status === "LEGACY" && (
  <button
    onClick={() => openPaymentHistoryModal(dealer.id)}
    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
  >
    <Receipt size={14} />
    Payment History
  </button>
)}
```

2. **Payment History Modal** with three sections:

   **a. Summary Cards**:
   - Current Outstanding Balance (blue gradient)
   - Pending Orders count (amber gradient)
   - Total Transactions count (green gradient)

   **b. Outstanding Orders List**:
   - Shows all unpaid orders
   - Displays order ID, placed date, due date, amount, status
   - Highlighted in amber to indicate pending payment

   **c. Transaction Ledger Table**:
   - Complete credit ledger history
   - Columns: Date, Event Type, Order ID, Debit, Credit, Balance, Notes
   - Color-coded event types:
     - ORDER_DELIVERED (red) - Dealer owes money
     - PAYMENT_RECEIVED (green) - Payment reduces balance
     - Other events (gray)
   - Running balance after each transaction

**Features**:
- Real-time data fetching when modal opens
- Formatted dates using `date-fns`
- Formatted currency using `useFormatPrice` hook
- Responsive design with scroll handling
- Loading states with spinner
- Empty states for no data

---

## Backend Endpoints Already Available

The following endpoints were already implemented and are now connected to the frontend:

1. **GET** `/api/v1/payments/credit-ledger/:dealerId`
   - Returns dealer's complete credit ledger
   - Includes current balance and transaction history

2. **GET** `/api/v1/payments/outstanding`
   - Returns outstanding payment orders
   - Supports filtering by dealer ID, overdue status
   - Includes pagination

3. **GET** `/api/v1/payments/audit-trail/:orderId`
   - Returns complete audit trail for an order
   - Shows all payment-related actions

4. **POST** `/api/v1/payments/record`
   - Admin records offline payment (CASH, BANK_TRANSFER, CHEQUE)
   - Creates full audit trail
   - Updates credit ledger

---

## Testing Instructions

### Session Persistence Test:
1. Start the server: `cd src/server && npm run dev`
2. Start the client: `cd src/client && npm run dev`
3. Sign in as any role:
   - USER: `user@example.com` / `password123`
   - DEALER: `dealer@example.com` / `password123` (if exists)
   - ADMIN: `admin@example.com` / `password123`
   - SUPERADMIN: `superadmin@example.com` / `password123`
4. Refresh the page - session should persist
5. Navigate to different pages - user should remain logged in
6. Check browser DevTools > Application > Cookies - should see `accessToken` and `refreshToken`

### Dealer Payment History Test:
1. Sign in as ADMIN or SUPERADMIN
2. Navigate to `/dashboard/dealers`
3. Find a LEGACY dealer (blue badge)
4. Click "Payment History" button
5. Modal should show:
   - Current outstanding balance
   - Pending orders (if any)
   - Complete transaction ledger

---

## Files Modified

1. `src/server/src/shared/constants/index.ts` - Cookie domain fix
2. `src/server/src/infra/passport/passport.ts` - Added serialization
3. `src/client/app/store/apis/PaymentApi.ts` - NEW FILE (Payment API)
4. `src/client/app/(private)/dashboard/dealers/page.tsx` - Added payment history UI

---

## Environment Configuration

Ensure `.env` files have correct settings:

**Server** (`src/server/.env`):
```env
COOKIE_DOMAIN=
# Leave empty for localhost development
# Set to your domain in production (e.g., .example.com)
```

**Client** (`src/client/.env`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

---

## Additional Notes

- Session persistence now works for ALL roles (USER, DEALER, ADMIN, SUPERADMIN)
- Payment history is only visible for LEGACY dealers (pay-later enabled)
- Regular APPROVED dealers don't have payment history (they pay upfront)
- Credit ledger tracks double-entry accounting: debits (orders) and credits (payments)
- Outstanding balance = SUM(debits) - SUM(credits)
