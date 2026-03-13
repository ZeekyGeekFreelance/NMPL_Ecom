# Payments Dashboard Page Fix

## Issue
The `/dashboard/payments` page was broken because it was importing from a non-existent PaymentApi.

## Root Cause
The payments dashboard page (`src/client/app/(private)/dashboard/payments/page.tsx`) was using:
- `useGetOutstandingPaymentsQuery`
- `useRecordPaymentMutation`

These hooks didn't exist because there was no PaymentApi file.

## Solution
Created a new `PaymentApi.ts` file with all necessary endpoints and hooks.

### File Created
**`src/client/app/store/apis/PaymentApi.ts`**

This file provides:

#### Queries:
1. **`getDealerCreditLedger`** - Get dealer's credit ledger history
   - Endpoint: `GET /payments/credit-ledger/:dealerId`
   - Hook: `useGetDealerCreditLedgerQuery`

2. **`getOutstandingPaymentOrders`** - Get outstanding payment orders
   - Endpoint: `GET /payments/outstanding`
   - Hook: `useGetOutstandingPaymentOrdersQuery`

3. **`getOutstandingPayments`** - Alias for backward compatibility
   - Endpoint: `GET /payments/outstanding`
   - Hook: `useGetOutstandingPaymentsQuery` ✅ (Used by payments page)

4. **`getOrderAuditTrail`** - Get payment audit trail for an order
   - Endpoint: `GET /payments/audit-trail/:orderId`
   - Hook: `useGetOrderAuditTrailQuery`

#### Mutations:
1. **`recordAdminPayment`** - Admin records offline payment
   - Endpoint: `POST /payments/record`
   - Hook: `useRecordAdminPaymentMutation`

2. **`recordPayment`** - Alias for backward compatibility
   - Endpoint: `POST /payments/record`
   - Hook: `useRecordPaymentMutation` ✅ (Used by payments page)

### TypeScript Interfaces
The file includes complete type definitions for:
- `PaymentTransaction`
- `CreditLedgerEntry`
- `DealerCreditLedger`
- `OutstandingOrder` (with transaction and orderItems support)
- `AuditLogEntry`

### Backward Compatibility
Added alias endpoints to ensure existing code continues to work:
- `getOutstandingPayments` → same as `getOutstandingPaymentOrders`
- `recordPayment` → same as `recordAdminPayment`

## Pages That Use This API

1. **`/dashboard/payments`** - Main payments dashboard
   - Lists all outstanding payment orders
   - Allows recording offline payments
   - Shows credit ledger and audit trails

2. **`/dashboard/dealers`** - Dealers management (NEW)
   - "Payment History" button for LEGACY dealers
   - Shows credit ledger and outstanding orders in modal

## Testing
1. Navigate to `http://localhost:3000/dashboard/payments`
2. Page should load without errors
3. Should display outstanding payment orders
4. "Record Payment" button should open payment form
5. "Credit History" button should show dealer's credit ledger
6. "Audit Trail" button should show payment audit logs

## Related Components
The payments page also uses these components (already exist):
- `PaymentRecordingForm.tsx` - Form to record offline payments
- `CreditLedgerModal.tsx` - Modal to display credit ledger
- `PaymentAuditModal.tsx` - Modal to display audit trail

All these components should now work correctly with the new PaymentApi.
