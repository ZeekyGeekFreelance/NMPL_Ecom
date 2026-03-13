import prisma from "@/infra/database/database.config";
import { PAYMENT_STATUS } from "@prisma/client";

export class PaymentRepository {
  async createPayment(data: {
    orderId: string;
    userId: string;
    method: string;
    amount: number;
    status: PAYMENT_STATUS;
    metadata?: any;
  }) {
    return prisma.payment.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        method: data.method,
        amount: data.amount,
        status: data.status,
      },
    });
  }

  async updatePayment(paymentId: string, data: {
    method?: string;
    amount?: number;
    status?: PAYMENT_STATUS;
    metadata?: any;
  }) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        method: data.method,
        amount: data.amount,
        status: data.status,
      },
    });
  }

  async findPaymentsByUserId(userId: string) {
    return prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPaymentById(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
    });
  }

  async findPaymentByOrderId(orderId: string) {
    return prisma.payment.findFirst({
      where: { orderId },
    });
  }

  async deletePayment(paymentId: string) {
    return prisma.payment.delete({
      where: { id: paymentId },
    });
  }

  async findOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
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
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  async findOutstandingOrders(filters?: {
    dealerId?: string;
    isOverdue?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {
      isPayLater: true,
      payment: {
        OR: [
          { status: { not: 'PAID' } },
          { status: null },
        ],
      },
    };

    if (filters?.dealerId) {
      where.userId = filters.dealerId;
    }

    if (filters?.isOverdue) {
      where.paymentDueDate = {
        lt: new Date(),
      };
    }

    return prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            dealerProfile: {
              select: {
                businessName: true,
                status: true,
              },
            },
          },
        },
        orderItems: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        payment: true,
      },
      orderBy: {
        paymentDueDate: 'asc',
      },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });
  }
}