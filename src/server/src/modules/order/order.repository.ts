import prisma from "@/infra/database/database.config";
import {
  CART_STATUS,
  PAYMENT_STATUS,
  TRANSACTION_STATUS,
} from "@prisma/client";
import AppError from "@/shared/errors/AppError";

export class OrderRepository {
  async findAllOrders() {
    return prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
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
      },
    });
  }

  async createOrder(data: {
    userId: string;
    amount: number;
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
