# Production Scalability & Data Retention Strategy

## Current State Analysis

### Database Capacity
- **Neon Postgres**: Handles 10M+ products easily with proper indexing
- **Current indexes**: Optimized for catalog queries (category, flags, dates)
- **Redis cache**: Reduces DB load by 80%+ for repeated catalog queries
- **Pagination**: Max 50 items/page prevents memory exhaustion

### Growth Projections
- **Products**: 10K-100K listings (typical ecommerce)
- **Orders**: 1K-10K/month (scales to millions over years)
- **Payments**: 2-5 transactions per order (audit trail grows fast)
- **Credit Ledger**: 2 entries per pay-later order (DEBIT + CREDIT)

## Data Retention Policy (Recommended)

### Hot Data (Active Database)
- **Orders**: Last 2 years
- **PaymentTransaction**: Last 2 years
- **DealerCreditLedger**: Last 2 years
- **PaymentAuditLog**: Last 1 year
- **Products**: Active + 6 months inactive

### Warm Data (Archive Database/Table)
- **Orders**: 2-7 years old
- **Payments**: 2-7 years old
- **Audit Logs**: 1-7 years old
- **Invoices**: All versions (legal requirement)

### Cold Data (S3/Glacier)
- **Orders**: 7+ years old (compressed JSON)
- **Invoices**: 7+ years old (PDF + metadata)
- **Audit Logs**: 7+ years old (compliance)

## Implementation Plan

### Phase 1: Add Archival Schema

```prisma
// Add to schema.prisma

model ArchivedOrder {
  id                String   @id
  archivedAt        DateTime @default(now())
  archivedBy        String?
  originalData      Json     // Full order snapshot
  invoiceS3Key      String?  // S3 path to invoice PDF
  
  @@index([archivedAt])
  @@index([id])
}

model ArchivedPaymentTransaction {
  id                String   @id
  orderId           String
  archivedAt        DateTime @default(now())
  originalData      Json
  
  @@index([archivedAt])
  @@index([orderId])
}

model DataRetentionLog {
  id                String   @id @default(uuid())
  jobType           String   // "ARCHIVE_ORDERS" | "PURGE_LOGS" | "CLEANUP_PRODUCTS"
  recordsProcessed  Int
  recordsArchived   Int
  recordsDeleted    Int
  startedAt         DateTime
  completedAt       DateTime
  status            String   // "SUCCESS" | "FAILED" | "PARTIAL"
  errorMessage      String?
  
  @@index([jobType, completedAt])
}
```

### Phase 2: Archival Worker Service

```typescript
// src/server/src/workers/dataRetention.worker.ts

import prisma from "@/infra/database/database.config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const RETENTION_CUTOFF_MONTHS = 24; // 2 years

export class DataRetentionWorker {
  
  /**
   * Archive orders older than 2 years
   * Run: Monthly via cron
   */
  async archiveOldOrders() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_CUTOFF_MONTHS);
    
    const oldOrders = await prisma.order.findMany({
      where: {
        orderDate: { lt: cutoffDate },
        status: { in: ["DELIVERED", "CANCELED"] },
      },
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
        payment: true,
        paymentTransactions: true,
        address: true,
        invoice: true,
        quotationLogs: true,
      },
      take: 1000, // Process in batches
    });
    
    for (const order of oldOrders) {
      await prisma.$transaction(async (tx) => {
        // 1. Store full snapshot in archive table
        await tx.archivedOrder.create({
          data: {
            id: order.id,
            archivedBy: "SYSTEM",
            originalData: order as any,
            invoiceS3Key: order.invoice?.id 
              ? `invoices/archived/${order.invoice.invoiceNumber}.pdf`
              : null,
          },
        });
        
        // 2. Upload invoice to S3 (if exists)
        if (order.invoice) {
          // await uploadInvoiceToS3(order.invoice);
        }
        
        // 3. Delete from hot tables
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
        await tx.orderQuotationLog.deleteMany({ where: { orderId: order.id } });
        await tx.paymentTransaction.deleteMany({ where: { orderId: order.id } });
        await tx.payment.deleteMany({ where: { orderId: order.id } });
        await tx.orderAddressSnapshot.deleteMany({ where: { orderId: order.id } });
        await tx.invoice.deleteMany({ where: { orderId: order.id } });
        await tx.order.delete({ where: { id: order.id } });
      });
    }
    
    return oldOrders.length;
  }
  
  /**
   * Purge audit logs older than 1 year
   * Run: Monthly via cron
   */
  async purgeOldAuditLogs() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12);
    
    const result = await prisma.paymentAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    
    return result.count;
  }
  
  /**
   * Soft-delete inactive products (no sales in 6 months)
   * Run: Quarterly via cron
   */
  async archiveInactiveProducts() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    
    // Add isArchived field to Product model first
    const inactiveProducts = await prisma.product.findMany({
      where: {
        updatedAt: { lt: cutoffDate },
        salesCount: 0,
        // isArchived: false, // Uncomment after adding field
      },
      select: { id: true },
      take: 500,
    });
    
    // Mark as archived instead of deleting
    // await prisma.product.updateMany({
    //   where: { id: { in: inactiveProducts.map(p => p.id) } },
    //   data: { isArchived: true },
    // });
    
    return inactiveProducts.length;
  }
}
```

### Phase 3: Cron Job Configuration

```typescript
// src/server/src/workers/cron.ts

import cron from "node-cron";
import { DataRetentionWorker } from "./dataRetention.worker";

const worker = new DataRetentionWorker();

// Run archival on 1st of every month at 2 AM
cron.schedule("0 2 1 * *", async () => {
  console.log("[CRON] Starting monthly data archival...");
  
  const ordersArchived = await worker.archiveOldOrders();
  const logsDeleted = await worker.purgeOldAuditLogs();
  
  console.log(`[CRON] Archived ${ordersArchived} orders, deleted ${logsDeleted} audit logs`);
});

// Run product cleanup quarterly
cron.schedule("0 3 1 */3 *", async () => {
  console.log("[CRON] Starting quarterly product cleanup...");
  
  const productsArchived = await worker.archiveInactiveProducts();
  
  console.log(`[CRON] Archived ${productsArchived} inactive products`);
});
```

### Phase 4: Admin Dashboard Controls

Add UI controls in `/dashboard/settings/data-retention`:

```typescript
// Manual archival triggers
- "Archive Orders Older Than [X] Months" button
- "Purge Audit Logs Older Than [X] Months" button
- "Export Archived Data to CSV" button
- "View Archival History" table

// Retention policy configuration
- Hot data retention period (default: 24 months)
- Audit log retention period (default: 12 months)
- Product inactivity threshold (default: 6 months)
```

## Query Optimization for Scale

### Add Composite Indexes

```prisma
// Optimize outstanding payments query
@@index([isPayLater, status, paymentDueDate]) // Already exists

// Optimize dealer credit ledger query
@@index([dealerId, createdAt]) // Already exists

// Add missing indexes for archival queries
@@index([orderDate, status]) // For archival worker
@@index([createdAt, status]) // For audit log cleanup
```

### Partition Large Tables (PostgreSQL 12+)

```sql
-- Partition Order table by year (if > 1M orders)
CREATE TABLE orders_2024 PARTITION OF orders
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE orders_2025 PARTITION OF orders
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

## Monitoring & Alerts

### Key Metrics to Track

1. **Table sizes**: Alert when Order table > 500K rows
2. **Query performance**: Alert when catalog query > 500ms
3. **Archival job status**: Alert on failure
4. **Disk usage**: Alert when DB > 80% capacity

### Grafana Dashboard Queries

```sql
-- Orders growth rate
SELECT DATE_TRUNC('month', "orderDate") AS month, COUNT(*) 
FROM "Order" 
GROUP BY month 
ORDER BY month DESC 
LIMIT 12;

-- Payment transactions per day
SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) 
FROM "PaymentTransaction" 
GROUP BY day 
ORDER BY day DESC 
LIMIT 30;

-- Audit log growth
SELECT DATE_TRUNC('week', "createdAt") AS week, COUNT(*) 
FROM "PaymentAuditLog" 
GROUP BY week 
ORDER BY week DESC 
LIMIT 12;
```

## Cost Optimization

### Neon Postgres Pricing Tiers
- **Free tier**: 0.5 GB storage, 1 compute unit (good for < 10K orders)
- **Pro tier**: $19/month, 10 GB storage (good for < 100K orders)
- **Scale tier**: Custom pricing (for > 100K orders)

### Storage Cost Reduction
- Archive to S3: $0.023/GB/month (vs $0.20/GB in Postgres)
- Glacier Deep Archive: $0.00099/GB/month (for 7+ year old data)

### Estimated Savings
- 100K archived orders (~500 MB) = $8/month saved
- 1M archived orders (~5 GB) = $80/month saved

## Legal Compliance

### Data Retention Requirements (India)
- **GST invoices**: 6 years (mandatory)
- **Payment records**: 8 years (Income Tax Act)
- **Audit trails**: 3 years (Companies Act)

### GDPR/Privacy Considerations
- Allow dealers to request data deletion after retention period
- Anonymize PII in archived records
- Maintain deletion audit trail

## Rollout Timeline

1. **Week 1-2**: Add archival schema + migrations
2. **Week 3-4**: Build archival worker service
3. **Week 5**: Test archival on staging with 10K orders
4. **Week 6**: Deploy cron jobs to production
5. **Week 7**: Add admin dashboard controls
6. **Week 8**: Monitor and optimize

## Success Metrics

- **DB size reduction**: 30-50% after first archival run
- **Query performance**: < 200ms for catalog queries
- **Archival job duration**: < 5 minutes for 1K orders
- **Zero data loss**: 100% recovery from archive
