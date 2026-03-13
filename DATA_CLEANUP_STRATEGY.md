# Simple Data Cleanup Strategy (Hard Delete)

## Policy: Delete data older than 1 year

No archival, no S3 storage - just clean deletion to keep DB lean.

## What Gets Deleted

### After 1 Year
- ✅ Orders (DELIVERED/CANCELED only)
- ✅ PaymentTransaction records
- ✅ DealerCreditLedger entries
- ✅ PaymentAuditLog entries
- ✅ Invoices (all versions)
- ✅ OrderQuotationLog entries
- ✅ OrderAddressSnapshot records

### Never Delete
- ❌ Users (keep forever)
- ❌ Products (soft-delete instead)
- ❌ DealerProfile (keep forever)
- ❌ Active/pending orders

## Implementation

### Step 1: Add Soft Delete to Products

```prisma
// Add to Product model in schema.prisma

model Product {
  id            String           @id @default(uuid())
  name          String           @unique
  description   String?
  slug          String           @unique
  salesCount    Int              @default(0)
  isNew         Boolean          @default(false)
  isFeatured    Boolean          @default(false)
  isTrending    Boolean          @default(false)
  isBestSeller  Boolean          @default(false)
  
  // NEW: Soft delete flag
  isDeleted     Boolean          @default(false)
  deletedAt     DateTime?
  
  category      Category?        @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  categoryId    String?
  variants      ProductVariant[]
  interactions  Interaction[]
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([name, slug])
  @@index([categoryId])
  @@index([categoryId, createdAt])
  @@index([createdAt])
  @@index([isNew, createdAt])
  @@index([isFeatured, createdAt])
  @@index([isTrending, createdAt])
  @@index([isBestSeller, createdAt])
  @@index([isDeleted]) // NEW
}
```

### Step 2: Create Cleanup Worker

```typescript
// src/server/src/workers/dataCleanup.worker.ts

import prisma from "@/infra/database/database.config";
import { ORDER_LIFECYCLE_STATUS } from "@/shared/utils/orderLifecycle";

export class DataCleanupWorker {
  
  /**
   * Delete orders older than 1 year (completed only)
   * Run: Monthly via cron
   */
  async deleteOldOrders() {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    
    console.log(`[CLEANUP] Deleting orders older than ${cutoffDate.toISOString()}`);
    
    const oldOrders = await prisma.order.findMany({
      where: {
        orderDate: { lt: cutoffDate },
        status: { 
          in: [
            ORDER_LIFECYCLE_STATUS.DELIVERED,
            ORDER_LIFECYCLE_STATUS.CANCELED,
          ] 
        },
      },
      select: { id: true },
      take: 500, // Process in batches to avoid timeout
    });
    
    let deletedCount = 0;
    
    for (const order of oldOrders) {
      try {
        await prisma.$transaction(async (tx) => {
          // Delete in correct order (child → parent)
          await tx.orderItem.deleteMany({ where: { orderId: order.id } });
          await tx.orderQuotationLog.deleteMany({ where: { orderId: order.id } });
          await tx.paymentTransaction.deleteMany({ where: { orderId: order.id } });
          await tx.dealerCreditLedger.deleteMany({ where: { orderId: order.id } });
          await tx.paymentAuditLog.deleteMany({ where: { orderId: order.id } });
          await tx.payment.deleteMany({ where: { orderId: order.id } });
          await tx.orderAddressSnapshot.deleteMany({ where: { orderId: order.id } });
          await tx.orderReservation.deleteMany({ where: { orderId: order.id } });
          await tx.transaction.deleteMany({ where: { orderId: order.id } });
          await tx.invoice.deleteMany({ where: { orderId: order.id } });
          await tx.order.delete({ where: { id: order.id } });
        });
        
        deletedCount++;
      } catch (error) {
        console.error(`[CLEANUP] Failed to delete order ${order.id}:`, error);
      }
    }
    
    console.log(`[CLEANUP] Deleted ${deletedCount} orders`);
    return deletedCount;
  }
  
  /**
   * Delete orphaned payment audit logs older than 1 year
   * Run: Monthly via cron
   */
  async deleteOldAuditLogs() {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    
    const result = await prisma.paymentAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    
    console.log(`[CLEANUP] Deleted ${result.count} audit logs`);
    return result.count;
  }
  
  /**
   * Delete orphaned credit ledger entries older than 1 year
   * Run: Monthly via cron
   */
  async deleteOldCreditLedger() {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    
    const result = await prisma.dealerCreditLedger.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    
    console.log(`[CLEANUP] Deleted ${result.count} credit ledger entries`);
    return result.count;
  }
  
  /**
   * Soft-delete products with no sales in 1 year
   * Run: Quarterly via cron
   */
  async softDeleteInactiveProducts() {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    
    const result = await prisma.product.updateMany({
      where: {
        updatedAt: { lt: cutoffDate },
        salesCount: 0,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
    
    console.log(`[CLEANUP] Soft-deleted ${result.count} inactive products`);
    return result.count;
  }
  
  /**
   * Run all cleanup tasks
   */
  async runFullCleanup() {
    console.log("[CLEANUP] Starting full cleanup job...");
    
    const results = {
      ordersDeleted: await this.deleteOldOrders(),
      auditLogsDeleted: await this.deleteOldAuditLogs(),
      creditLedgerDeleted: await this.deleteOldCreditLedger(),
      productsArchived: await this.softDeleteInactiveProducts(),
    };
    
    console.log("[CLEANUP] Full cleanup completed:", results);
    return results;
  }
}
```

### Step 3: Add Cron Job

```typescript
// src/server/src/workers/cron.ts

import cron from "node-cron";
import { DataCleanupWorker } from "./dataCleanup.worker";

const cleanupWorker = new DataCleanupWorker();

// Run cleanup on 1st of every month at 3 AM
cron.schedule("0 3 1 * *", async () => {
  console.log("[CRON] Starting monthly data cleanup...");
  
  try {
    const results = await cleanupWorker.runFullCleanup();
    console.log("[CRON] Cleanup completed successfully:", results);
  } catch (error) {
    console.error("[CRON] Cleanup failed:", error);
  }
});

export { cleanupWorker };
```

### Step 4: Register Cron in Server

```typescript
// src/server/src/server.ts

import "./workers/cron"; // Add this import

// Rest of your server code...
```

### Step 5: Add Manual Cleanup Endpoint (Admin Only)

```typescript
// src/server/src/modules/settings/cleanup.routes.ts

import { Router } from "express";
import { protect } from "@/shared/middlewares/protect";
import { authorizeRole } from "@/shared/middlewares/authorizeRole";
import { DataCleanupWorker } from "@/workers/dataCleanup.worker";

const router = Router();
const cleanupWorker = new DataCleanupWorker();

// POST /api/v1/settings/cleanup/orders
router.post(
  "/orders",
  protect,
  authorizeRole("SUPERADMIN"),
  async (req, res) => {
    const count = await cleanupWorker.deleteOldOrders();
    res.json({ success: true, deletedCount: count });
  }
);

// POST /api/v1/settings/cleanup/full
router.post(
  "/full",
  protect,
  authorizeRole("SUPERADMIN"),
  async (req, res) => {
    const results = await cleanupWorker.runFullCleanup();
    res.json({ success: true, results });
  }
);

export default router;
```

### Step 6: Update Product Queries (Exclude Deleted)

```typescript
// src/server/src/modules/product/product.repository.ts

// Add to all findMany queries:
where: {
  isDeleted: false, // Exclude soft-deleted products
  // ... other filters
}
```

## Migration Steps

### 1. Run Migration

```bash
cd src/server
npx prisma migrate dev --name add_product_soft_delete
```

### 2. Install Cron Package

```bash
npm install node-cron
npm install -D @types/node-cron
```

### 3. Test Cleanup (Dry Run)

```typescript
// Add to cleanup.worker.ts for testing

async dryRunCleanup() {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
  
  const ordersCount = await prisma.order.count({
    where: {
      orderDate: { lt: cutoffDate },
      status: { in: ["DELIVERED", "CANCELED"] },
    },
  });
  
  const auditLogsCount = await prisma.paymentAuditLog.count({
    where: { createdAt: { lt: cutoffDate } },
  });
  
  console.log(`[DRY RUN] Would delete:`);
  console.log(`  - ${ordersCount} orders`);
  console.log(`  - ${auditLogsCount} audit logs`);
  
  return { ordersCount, auditLogsCount };
}
```

### 4. Deploy to Production

```bash
# Docker mode
docker compose exec server npm run migrate:deploy

# Node mode
cd src/server
npx prisma migrate deploy
npm run dev
```

## Monitoring

### Add Cleanup Logs Table (Optional)

```prisma
model CleanupLog {
  id                String   @id @default(uuid())
  jobType           String   // "DELETE_ORDERS" | "DELETE_AUDIT_LOGS"
  recordsDeleted    Int
  startedAt         DateTime
  completedAt       DateTime
  status            String   // "SUCCESS" | "FAILED"
  errorMessage      String?
  
  @@index([jobType, completedAt])
}
```

### Track Cleanup in Worker

```typescript
await prisma.cleanupLog.create({
  data: {
    jobType: "DELETE_ORDERS",
    recordsDeleted: deletedCount,
    startedAt: startTime,
    completedAt: new Date(),
    status: "SUCCESS",
  },
});
```

## Admin Dashboard UI

Add to `/dashboard/settings/cleanup`:

```typescript
// Simple UI with buttons

<Card>
  <CardHeader>
    <CardTitle>Data Cleanup</CardTitle>
    <CardDescription>
      Delete orders and payments older than 1 year
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <Button 
        onClick={() => runCleanup("orders")}
        variant="destructive"
      >
        Delete Old Orders (1+ year)
      </Button>
      
      <Button 
        onClick={() => runCleanup("full")}
        variant="destructive"
      >
        Run Full Cleanup
      </Button>
      
      <div className="text-sm text-muted-foreground">
        Last cleanup: {lastCleanupDate}
      </div>
    </div>
  </CardContent>
</Card>
```

## Expected Results

### Database Size Reduction
- **Before**: 5 GB (100K orders over 3 years)
- **After**: 2 GB (only last year's data)
- **Savings**: 60% reduction

### Query Performance
- **Before**: 500ms (scanning 100K orders)
- **After**: 150ms (scanning 30K orders)
- **Improvement**: 3x faster

### Cost Savings
- **Neon Pro**: $19/month for 10 GB → $19/month for 3 GB
- **Potential downgrade**: Free tier (0.5 GB) if < 10K orders/year

## Rollout Timeline

1. **Day 1**: Add Product.isDeleted field + migration
2. **Day 2**: Create cleanup worker + cron job
3. **Day 3**: Test dry run on staging
4. **Day 4**: Deploy to production (cron disabled)
5. **Day 5**: Run manual cleanup via admin endpoint
6. **Day 6**: Enable cron job
7. **Day 7**: Monitor and verify

## Safety Checklist

- ✅ Only delete DELIVERED/CANCELED orders
- ✅ Never delete active/pending orders
- ✅ Process in batches (500 at a time)
- ✅ Use transactions (all-or-nothing)
- ✅ Log all deletions
- ✅ Test on staging first
- ✅ Backup database before first run

## Backup Strategy (Just in Case)

```bash
# Before first cleanup, take a backup
pg_dump $DATABASE_URL > backup_before_cleanup_$(date +%Y%m%d).sql

# Or use Neon's built-in backups (Pro tier)
# Neon keeps 7-day point-in-time recovery
```
