import AppError from "@/shared/errors/AppError";
import { OrderRepository } from "./order.repository";
import prisma from "@/infra/database/database.config";
import { CART_STATUS } from "@prisma/client";
import { Prisma } from "@prisma/client";
import sendEmail from "@/shared/utils/sendEmail";
import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";
import { toAccountReference } from "@/shared/utils/accountReference";
import { makeLogsService } from "../logs/logs.factory";

export class OrderService {
  private logsService = makeLogsService();

  constructor(private orderRepository: OrderRepository) {}

  private isDealerTableMissing(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes('relation "DealerProfile" does not exist') ||
      error.message.includes('relation "DealerPriceMapping" does not exist')
    );
  }

  private async getDealerPriceMap(
    userId: string,
    variantIds: string[]
  ): Promise<Map<string, number>> {
    if (!variantIds.length) {
      return new Map();
    }

    try {
      const dealerProfileRows = await prisma.$queryRaw<
        Array<{ status: string }>
      >(
        Prisma.sql`
          SELECT "status"
          FROM "DealerProfile"
          WHERE "userId" = ${userId}
          LIMIT 1
        `
      );

      if (!dealerProfileRows.length || dealerProfileRows[0].status !== "APPROVED") {
        return new Map();
      }

      const priceRows = await prisma.$queryRaw<
        Array<{ variantId: string; customPrice: number }>
      >(
        Prisma.sql`
          SELECT "variantId", "customPrice"
          FROM "DealerPriceMapping"
          WHERE "dealerId" = ${userId}
            AND "variantId" IN (${Prisma.join(variantIds)})
        `
      );

      return new Map(priceRows.map((row) => [row.variantId, row.customPrice]));
    } catch (error) {
      if (this.isDealerTableMissing(error)) {
        return new Map();
      }
      throw error;
    }
  }

  async getAllOrders() {
    return this.orderRepository.findAllOrders();
  }

  async getUserOrders(userId: string) {
    return this.orderRepository.findOrdersByUserId(userId);
  }

  async getOrderDetails(orderId: string, userId: string) {
    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) {
      throw new AppError(404, "Order not found");
    }
    if (order.userId !== userId) {
      throw new AppError(403, "You are not authorized to view this order");
    }
    return order;
  }

  async createOrderFromCart(userId: string, cartId: string) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { cartItems: { include: { variant: { include: { product: true } } } } },
    });
    if (!cart || cart.cartItems.length === 0) {
      throw new AppError(400, "Cart is empty or not found");
    }
    if (cart.status !== CART_STATUS.ACTIVE) {
      throw new AppError(400, "Cart is not active");
    }
    if (cart.userId !== userId) {
      throw new AppError(403, "You are not authorized to access this cart");
    }

    const dealerPriceMap = await this.getDealerPriceMap(
      userId,
      cart.cartItems.map((item) => item.variantId)
    );

    const amount = cart.cartItems.reduce(
      (sum, item) =>
        sum +
        item.quantity *
          (dealerPriceMap.get(item.variantId) ?? item.variant.price),
      0
    );

    const orderItems = cart.cartItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      price: dealerPriceMap.get(item.variantId) ?? item.variant.price,
    }));

    const order = await this.orderRepository.createOrder({
      userId,
      amount,
      cartId,
      orderItems,
    });

    await this.sendOrderPlacedNotification(userId, order.id).catch(
      async (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown notification error";

        await this.logsService.warn("Order placed email notification failed", {
          userId,
          orderId: order.id,
          error: errorMessage,
        });
      }
    );

    return order;
  }

  private async sendOrderPlacedNotification(
    userId: string,
    orderId: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user?.email) {
      return;
    }

    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const accountReference = toAccountReference(user.id);

    const isSent = await sendEmail({
      to: user.email,
      subject: `${platformName} | Order Placed`,
      text: [
        `Hello ${user.name},`,
        "",
        `Your order has been placed on ${platformName}.`,
        `Order ID: ${orderId}`,
        `Account Reference: ${accountReference}`,
        `Current status: Order Placed`,
        "",
        `We will confirm your order after stock verification.`,
        `Need help? Contact ${supportEmail}.`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your order has been placed on <strong>${platformName}</strong>.</p>
          <p>
            <strong>Order ID:</strong> ${orderId}<br />
            <strong>Account Reference:</strong> ${accountReference}<br />
            <strong>Current status:</strong> Order Placed
          </p>
          <p>We will confirm your order after stock verification.</p>
          <p>
            Need help? Contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
          </p>
        </div>
      `,
    });

    if (!isSent) {
      throw new Error("Failed to send order placed notification email.");
    }
  }
}
