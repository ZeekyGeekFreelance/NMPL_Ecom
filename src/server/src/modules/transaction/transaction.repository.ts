import prisma from "@/infra/database/database.config";
import { TRANSACTION_STATUS } from "@prisma/client";

const orderStatusByTransactionStatus: Record<TRANSACTION_STATUS, string> = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELED: "CANCELED",
  RETURNED: "RETURNED",
  REFUNDED: "REFUNDED",
};

export class TransactionRepository {
  constructor() { }
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

  async updateTransaction(id: string, data: { status: TRANSACTION_STATUS }) {
    return prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data,
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
