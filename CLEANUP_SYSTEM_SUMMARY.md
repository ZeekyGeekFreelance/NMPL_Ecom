# Data Cleanup System - Summary

## How It Works

### Cleanup Schedule
- **Runs**: January 1st every year at 3 AM
- **Keeps**: Last 12 months of data
- **Deletes**: Data older than 1 year

### What Gets Deleted

#### Orders (older than 1 year)
- Only DELIVERED or CANCELED orders
- Active/pending orders are NEVER deleted
- All related data deleted:
  - Order items
  - Payment transactions
  - Invoices
  - Audit logs
  - Credit ledger entries
  - Address snapshots

#### Products (no sales in 1 year)
- Soft-deleted (not hard-deleted)
- Still in database but hidden from queries
- Can be restored if needed

### Example Timeline

```
Today: January 15, 2025

Cleanup runs: January 1, 2026 at 3 AM

Will delete:
✅ Orders from December 31, 2024 and older
✅ Payments from December 31, 2024 and older
✅ Audit logs from December 31, 2024 and older

Will keep:
✅ All orders from January 1, 2025 onwards (last 12 months)
✅ All active/pending orders (regardless of date)
```

## Safety Features

1. **Only completed orders** - Active orders never deleted
2. **Batch processing** - 500 orders at a time (prevents timeout)
3. **Transaction safety** - All-or-nothing deletion (no partial deletes)
4. **Error logging** - Failed deletions logged but don't stop the job
5. **Dry run available** - Test before actual deletion

## Manual Control

### Dry Run (See What Would Be Deleted)
```typescript
import { DataCleanupWorker } from "@/workers/dataCleanup.worker";

const worker = new DataCleanupWorker();
await worker.dryRunCleanup();
```

### Run Cleanup Manually
```typescript
import { DataCleanupWorker } from "@/workers/dataCleanup.worker";

const worker = new DataCleanupWorker();
await worker.runFullCleanup();
```

### Individual Cleanup Tasks
```typescript
const worker = new DataCleanupWorker();

// Delete only old orders
await worker.deleteOldOrders();

// Delete only audit logs
await worker.deleteOldAuditLogs();

// Delete only credit ledger
await worker.deleteOldCreditLedger();

// Soft-delete inactive products
await worker.softDeleteInactiveProducts();
```

## Cron Schedule Format

Current: `"0 3 1 1 *"` = January 1st at 3 AM every year

```
┌───────────── minute (0)
│ ┌─────────── hour (3 = 3 AM)
│ │ ┌───────── day of month (1 = 1st)
│ │ │ ┌─────── month (1 = January)
│ │ │ │ ┌───── day of week (*)
│ │ │ │ │
0 3 1 1 *
```

### Change Schedule (If Needed)

```typescript
// Every 6 months (Jan 1 and July 1)
cron.schedule("0 3 1 1,7 *", async () => { ... });

// Every quarter (Jan 1, Apr 1, Jul 1, Oct 1)
cron.schedule("0 3 1 1,4,7,10 *", async () => { ... });

// Every month (1st at 3 AM)
cron.schedule("0 3 1 * *", async () => { ... });
```

## Database Impact

### Before Cleanup (After 3 Years)
- Orders: 100,000 rows
- PaymentTransaction: 200,000 rows
- PaymentAuditLog: 500,000 rows
- Database size: ~5 GB

### After Cleanup (Keeps 1 Year)
- Orders: 33,000 rows (last 12 months)
- PaymentTransaction: 66,000 rows
- PaymentAuditLog: 166,000 rows
- Database size: ~1.7 GB

### Savings
- 67% reduction in rows
- 66% reduction in storage
- 3x faster queries

## Monitoring

### Check Logs
```bash
# Server logs will show:
[CRON] Data cleanup job scheduled: January 1st every year at 3 AM (keeps last 12 months)
[CRON] Starting yearly data cleanup...
[CLEANUP] Deleting orders older than 2024-01-01T00:00:00.000Z
[CLEANUP] Deleted 45000 orders
[CLEANUP] Deleted 120000 audit logs
[CLEANUP] Deleted 90000 credit ledger entries
[CLEANUP] Soft-deleted 150 inactive products
[CRON] Cleanup completed successfully: { ordersDeleted: 45000, ... }
```

### Failed Deletions
```bash
[CLEANUP] Failed to delete order abc-123: Error message
# Job continues with next order
```

## Files Modified

1. **schema.prisma** - Added `isDeleted`, `deletedAt` to Product
2. **workers/dataCleanup.worker.ts** - Cleanup logic
3. **workers/cron.ts** - Yearly schedule
4. **server.ts** - Registered cron job
5. **product.repository.ts** - Exclude deleted products
6. **product/graphql/resolver.ts** - Exclude deleted products

## Next Steps

1. Run migration: `npx prisma migrate dev --name add_product_soft_delete`
2. Restart server: `npm run dev`
3. Check logs for: `[CRON] Data cleanup job scheduled`
4. (Optional) Run dry run to test
5. Wait for January 1st or run manually

## Important Notes

- **No data loss for last 12 months** - Always keeps current year
- **Active orders never deleted** - Only DELIVERED/CANCELED
- **Products soft-deleted** - Can be restored
- **Runs automatically** - No manual intervention needed
- **Safe to run multiple times** - Idempotent operation
