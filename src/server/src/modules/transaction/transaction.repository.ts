import prisma from "@/infra/database/database.config";
import { PAYMENT_STATUS } from "@prisma/client";
import AppError from "@/shared/errors/AppError";

type TransactionLifecycleStatus =
  | "PLACED"
  | "CONFIRMED"
  | "REJECTED"
  | "DELIVERED";

const orderStatusByTransactionStatus: Record<TransactionLifecycleStatus, string> = {
  PLACED: "PLACED",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  DELIVERED: "DELIVERED",
};

export class TransactionRepository {
  constructor() {}

  private normalizeStatusValue(status: string): TransactionLifecycleStatus {
    const normalized = status.toUpperCase();
    const legacyToCurrent: Record<string, TransactionLifecycleStatus> = {
      PENDING: "PLACED",
      PROCESSING: "CONFIRMED",
      SHIPPED: "CONFIRMED",
      IN_TRANSIT: "CONFIRMED",
      CANCELED: "REJECTED",
      RETURNED: "REJECTED",
      REFUNDED: "REJECTED",
      CONFIRMED: "CONFIRMED",
      REJECTED: "REJECTED",
      PLACED: "PLACED",
      DELIVERED: "DELIVERED",
    };

    if (legacyToCurrent[normalized]) {
      return legacyToCurrent[normalized];
    }

    return "PLACED";
  }

  private mapCurrentToLegacyStatus(
    status: TransactionLifecycleStatus
  ): "PENDING" | "PROCESSING" | "CANCELED" | "DELIVERED" {
    const currentToLegacy: Record<
      TransactionLifecycleStatus,
      "PENDING" | "PROCESSING" | "CANCELED" | "DELIVERED"
    > = {
      PLACED: "PENDING",
      CONFIRMED: "PROCESSING",
      REJECTED: "CANCELED",
      DELIVERED: "DELIVERED",
    };

    return currentToLegacy[status];
  }

  private isLegacyEnumWriteError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message || "";
    return (
      message.includes('invalid input value for enum "TRANSACTION_STATUS"') ||
      message.includes("Inconsistent column data") ||
      message.includes("Invalid value for argument `status`") ||
      message.includes("Provided value") ||
      message.includes("Argument `status`")
    );
  }

  async findMany() {
    return prisma.transaction.findMany();
  }

  async findById(id: string) {
    return prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            payment: true,
            shipment: true,
            user: true,
            address: true,
            invoice: true,
            orderItems: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async createTransaction(data: any) {
    return prisma.transaction.create({
      data,
    });
  }

  async updateTransaction(id: string, data: { status: TransactionLifecycleStatus }) {
    return prisma.$transaction(async (tx) => {
      const existingTransaction = await tx.transaction.findUnique({
        where: { id },
        select: {
          status: true,
          orderId: true,
          order: {
            select: {
              orderItems: {
                select: {
                  variantId: true,
                  quantity: true,
                  variant: {
                    select: {
                      productId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!existingTransaction) {
        throw new AppError(404, "Transaction not found");
      }

      if (
        data.status === "REJECTED" &&
        this.normalizeStatusValue(String(existingTransaction.status)) !==
          "REJECTED"
      ) {
        // Restore stock when a placed order is rejected by admin.
        for (const item of existingTransaction.order.orderItems) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: item.quantity },
            },
          });

          await tx.product.update({
            where: { id: item.variant.productId },
            data: {
              salesCount: { decrement: item.quantity },
            },
          });
        }

        await tx.payment.updateMany({
          where: {
            orderId: existingTransaction.orderId,
            status: PAYMENT_STATUS.PENDING,
          },
          data: {
            status: PAYMENT_STATUS.CANCELED,
          },
        });
      }

      let updatedTransaction: any = null;
      try {
        updatedTransaction = await tx.transaction.update({
          where: { id },
          data: {
            status: data.status as any,
          },
          include: {
            order: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });
      } catch (error) {
        if (!this.isLegacyEnumWriteError(error)) {
          throw error;
        }

        const legacyStatus = this.mapCurrentToLegacyStatus(data.status);
        await tx.$executeRaw`
          UPDATE "Transaction"
          SET "status" = ${legacyStatus}::"TRANSACTION_STATUS",
              "updatedAt" = NOW()
          WHERE "id" = ${id}
        `;

        updatedTransaction = await tx.transaction.findUnique({
          where: { id },
          include: {
            order: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });
      }

      if (!updatedTransaction) {
        throw new AppError(404, "Transaction not found");
      }

      await tx.order.update({
        where: { id: updatedTransaction.orderId },
        data: { status: orderStatusByTransactionStatus[data.status] },
      });

      return updatedTransaction;
    });
  }

  async deleteTransaction(id: string) {
    return prisma.transaction.delete({
      where: { id },
    });
  }
}
