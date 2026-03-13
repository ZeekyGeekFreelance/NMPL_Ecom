import prisma from "@/infra/database/database.config";

export class DataCleanupWorker {
  
  /**
   * Delete orders older than 1 year (completed only)
   * Run: Yearly via cron
   */
  async deleteOldOrders() {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    
    console.log(`[CLEANUP] Deleting orders older than ${cutoffDate.toISOString()}`);
    
    const oldOrders = await prisma.order.findMany({
      where: {
        orderDate: { lt: cutoffDate },
        status: { 
          in: ["DELIVERED", "CANCELED"] 
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
   * Run: Yearly via cron
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
   * Run: Yearly via cron
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
  
  /**
   * Dry run - shows what would be deleted without actually deleting
   */
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
    
    const creditLedgerCount = await prisma.dealerCreditLedger.count({
      where: { createdAt: { lt: cutoffDate } },
    });
    
    const productsCount = await prisma.product.count({
      where: {
        updatedAt: { lt: cutoffDate },
        salesCount: 0,
        isDeleted: false,
      },
    });
    
    console.log(`[DRY RUN] Would delete:`);
    console.log(`  - ${ordersCount} orders`);
    console.log(`  - ${auditLogsCount} audit logs`);
    console.log(`  - ${creditLedgerCount} credit ledger entries`);
    console.log(`  - ${productsCount} inactive products (soft-delete)`);
    
    return { ordersCount, auditLogsCount, creditLedgerCount, productsCount };
  }
}
