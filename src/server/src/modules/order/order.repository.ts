import prisma from "@/infra/database/database.config";
import {
  CART_STATUS,
  ORDER_CUSTOMER_ROLE,
  PAYMENT_STATUS,
  TRANSACTION_STATUS,
} from "@prisma/client";
import AppError from "@/shared/errors/AppError";
import { toOrderReference } from "@/shared/utils/accountReference";

export class OrderRepository {
  private extractReferenceChecksum(reference: string): string | null {
    const normalizedReference = (reference || "").trim().toUpperCase();
    const [, token = ""] = normalizedReference.split("-");
    const cleanToken = token.replace(/[^A-Z0-9]/g, "");

    if (cleanToken.length < 2) {
      return null;
    }

    return cleanToken.slice(-2).toLowerCase();
  }

  async findAllOrders() {
    return prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            dealerProfile: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async findOrdersByUserId(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { orderDate: "desc" },
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
      },
    });
  }

  async findOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
        payment: true,
        address: true,
        shipment: true,
        transaction: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            dealerProfile: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async findOrderIdByReferenceForUser(
    orderReference: string,
    userId: string
  ): Promise<string | null> {
    const normalizedReference = (orderReference || "").trim().toUpperCase();
    if (!normalizedReference) {
      return null;
    }

    const checksum = this.extractReferenceChecksum(normalizedReference);
    const candidates = await prisma.order.findMany({
      where: {
        userId,
        ...(checksum ? { id: { endsWith: checksum } } : {}),
      },
      select: { id: true },
      orderBy: { orderDate: "desc" },
    });

    const matches = candidates.filter(
      (candidate) => toOrderReference(candidate.id) === normalizedReference
    );

    if (matches.length > 1) {
      throw new AppError(409, "Multiple orders matched this reference");
    }

    return matches[0]?.id ?? null;
  }

  async createOrder(data: {
    userId: string;
    amount: number;
    customerRoleSnapshot: ORDER_CUSTOMER_ROLE;
    cartId?: string;
    orderItems: { variantId: string; quantity: number; price: number }[];
  }) {
    return prisma.$transaction(async (tx) => {
      const computedAmount = data.orderItems.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );

      // Atomic stock-safe deduction. If any item cannot be decremented, transaction rolls back.
      for (const item of data.orderItems) {
        if (item.quantity <= 0) {
          throw new AppError(400, "Order item quantity must be greater than 0");
        }

        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true, productId: true },
        });

        if (!variant) {
          throw new AppError(404, `Variant not found: ${item.variantId}`);
        }

        const decrementResult = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (decrementResult.count === 0) {
          throw new AppError(
            400,
            `Insufficient stock for variant ${item.variantId}: only ${variant.stock} available`
          );
        }

        await tx.product.update({
          where: { id: variant.productId },
          data: {
            salesCount: { increment: item.quantity },
          },
        });
      }

      // Create order with pending offline payment and transaction records.
      const order = await tx.order.create({
        data: {
          userId: data.userId,
          customerRoleSnapshot: data.customerRoleSnapshot,
          amount: computedAmount,
          status: "PLACED",
          orderItems: {
            create: data.orderItems.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          payment: {
            create: {
              userId: data.userId,
              method: "OFFLINE_CONFIRMATION",
              amount: computedAmount,
              status: PAYMENT_STATUS.PENDING,
            },
          },
          transaction: {
            create: {
              status: TRANSACTION_STATUS.PLACED,
            },
          },
        },
        include: {
          orderItems: true,
          payment: true,
          transaction: true,
        },
      });

      if (data.cartId) {
        await tx.cartItem.deleteMany({
          where: { cartId: data.cartId },
        });

        await tx.cart.update({
          where: { id: data.cartId },
          data: { status: CART_STATUS.CONVERTED },
        });
      }

      return order;
    });
  }
}
