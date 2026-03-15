import prisma from "@/infra/database/database.config";

/**
 * DataCleanupWorker — NMPL production data lifecycle management.
 *
 * COMPLIANCE NOTE (GST / Indian Accounting):
 *   Financial records (invoices, payment transactions, audit logs,
 *   credit ledger entries) must be retained for a MINIMUM of 7 years
 *   under the CGST Act, 2017 (Section 35) and Indian accounting standards.
 *   This worker intentionally preserves all financial records and only
 *   archives stale operational/catalog data.
 *
 * WHAT THIS WORKER DOES:
 *   - Archives (soft-delete) products with zero sales in 2+ years
 *   - Cleans up abandoned/incomplete orders older than 7 years
 *     (non-financial: CANCELED orders with no invoice or payment)
 *
 * WHAT THIS WORKER NEVER TOUCHES:
 *   - Invoice records
 *   - PaymentTransaction records
 *   - PaymentAuditLog records
 *   - DealerCreditLedger records
 *   - Any order with an associated invoice or payment
 */
export class DataCleanupWorker {

  /**
   * Delete CANCELED orders older than 7 years that have NO associated
   * financial records (no invoice, no payment transaction).
   *
   * These are safely disposable: they represent abandoned quotation
   * flows that never converted to a financial obligation.
   *
   * DELIVERED orders and any order with a payment record are NEVER deleted.
   */
  async deleteOldCanceledOrders() {
    // 7-year retention: GST Act minimum for B2B records in India
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 7);

    console.log(`[CLEANUP] Looking for CANCELED-only orders older than ${cutoffDate.toISOString()} with no financial records`);

    const purgeable = await prisma.order.findMany({
      where: {
        orderDate: { lt: cutoffDate },
        // Only truly canceled (rejected/expired) orders — never DELIVERED
        status: {
          in: [
            "QUOTATION_REJECTED",
            "QUOTATION_EXPIRED",
          ],
        },
        // No invoice attached
        invoice: { is: null },
        // No payment transaction at all
        paymentTransactions: { none: {} },
        // No legacy payment record
        payment: { is: null },
      },
      select: { id: true },
      take: 200,
    });

    let deletedCount = 0;

    for (const order of purgeable) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.orderItem.deleteMany({ where: { orderId: order.id } });
          await tx.orderQuotationLog.deleteMany({ where: { orderId: order.id } });
          await tx.orderAddressSnapshot.deleteMany({ where: { orderId: order.id } });
          await tx.orderReservation.deleteMany({ where: { orderId: order.id } });
          await tx.transaction.deleteMany({ where: { orderId: order.id } });
          await tx.order.delete({ where: { id: order.id } });
        });
        deletedCount++;
      } catch (error) {
        console.error(`[CLEANUP] Failed to delete canceled order ${order.id}:`, error);
      }
    }

    console.log(`[CLEANUP] Deleted ${deletedCount} old canceled-only orders (no financial records)`);
    return deletedCount;
  }

  /**
   * Soft-archive products with zero lifetime sales that have not been
   * updated in 2 years. Sets isDeleted=true so they disappear from the
   * catalog without losing the record.
   *
   * Products with ANY sales history are never archived.
   */
  async softArchiveUnsoldProducts() {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

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

    console.log(`[CLEANUP] Soft-archived ${result.count} unsold products (>2 years inactive)`);
    return result.count;
  }

  /**
   * Run all cleanup tasks.
   */
  async runFullCleanup() {
    console.log("[CLEANUP] Starting scheduled cleanup...");

    const results = {
      canceledOrdersDeleted: await this.deleteOldCanceledOrders(),
      unsoldProductsArchived: await this.softArchiveUnsoldProducts(),
    };

    console.log("[CLEANUP] Cleanup completed:", results);
    return results;
  }

  /**
   * Dry run — logs what would be affected without modifying any data.
   * Run this manually to audit before enabling the cron.
   */
  async dryRunCleanup() {
    const sevenYearCutoff = new Date();
    sevenYearCutoff.setFullYear(sevenYearCutoff.getFullYear() - 7);

    const twoYearCutoff = new Date();
    twoYearCutoff.setFullYear(twoYearCutoff.getFullYear() - 2);

    const canceledCount = await prisma.order.count({
      where: {
        orderDate: { lt: sevenYearCutoff },
        status: { in: ["QUOTATION_REJECTED", "QUOTATION_EXPIRED"] },
        invoice: { is: null },
        paymentTransactions: { none: {} },
        payment: { is: null },
      },
    });

    const unsoldProductsCount = await prisma.product.count({
      where: {
        updatedAt: { lt: twoYearCutoff },
        salesCount: 0,
        isDeleted: false,
      },
    });

    // Explicitly report what we are PROTECTING
    const protectedInvoices = await prisma.invoice.count();
    const protectedPaymentTxns = await prisma.paymentTransaction.count();
    const protectedAuditLogs = await prisma.paymentAuditLog.count();
    const protectedLedgerEntries = await prisma.dealerCreditLedger.count();

    console.log("[DRY RUN] Would affect:");
    console.log(`  DELETE: ${canceledCount} canceled orders (>7 years, no financial records)`);
    console.log(`  ARCHIVE: ${unsoldProductsCount} unsold products (>2 years inactive)`);
    console.log("[DRY RUN] PROTECTED (never touched):");
    console.log(`  ${protectedInvoices} invoices`);
    console.log(`  ${protectedPaymentTxns} payment transactions`);
    console.log(`  ${protectedAuditLogs} payment audit logs`);
    console.log(`  ${protectedLedgerEntries} dealer credit ledger entries`);

    return {
      wouldDelete: { canceledCount },
      wouldArchive: { unsoldProductsCount },
      protected: {
        protectedInvoices,
        protectedPaymentTxns,
        protectedAuditLogs,
        protectedLedgerEntries,
      },
    };
  }
}
