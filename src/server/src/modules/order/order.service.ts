import AppError from "@/shared/errors/AppError";
import { OrderRepository } from "./order.repository";
import prisma from "@/infra/database/database.config";
import { CART_STATUS, ROLE } from "@prisma/client";
import sendEmail from "@/shared/utils/sendEmail";
import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";
import {
  toAccountReference,
  toOrderReference,
} from "@/shared/utils/accountReference";
import { formatDateTimeInIST } from "@/shared/utils/dateTime";
import { makeLogsService } from "../logs/logs.factory";
import { getDealerPriceMap } from "@/shared/utils/dealerAccess";
import { resolveCustomerTypeFromUser } from "@/shared/utils/userRole";

export class OrderService {
  private logsService = makeLogsService();

  constructor(private orderRepository: OrderRepository) {}

  async getAllOrders() {
    return this.orderRepository.findAllOrders();
  }

  async getUserOrders(userId: string) {
    return this.orderRepository.findOrdersByUserId(userId);
  }

  private async resolveOrderIdForUser(
    orderIdentifier: string,
    userId: string
  ): Promise<string> {
    const normalized = String(orderIdentifier || "").trim();
    if (!normalized) {
      throw new AppError(400, "Order ID is required");
    }

    if (!normalized.toUpperCase().startsWith("ORD-")) {
      return normalized;
    }

    const orderId = await this.orderRepository.findOrderIdByReferenceForUser(
      normalized,
      userId
    );

    if (!orderId) {
      throw new AppError(404, "Order not found");
    }

    return orderId;
  }

  async getOrderDetails(orderId: string, userId: string) {
    const resolvedOrderId = await this.resolveOrderIdForUser(orderId, userId);
    const order = await this.orderRepository.findOrderById(resolvedOrderId);
    if (!order) {
      throw new AppError(404, "Order not found");
    }
    if (order.userId !== userId) {
      throw new AppError(403, "You are not authorized to view this order");
    }
    return order;
  }

  async createOrderFromCart(userId: string, cartId: string) {
    const orderingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        dealerProfile: {
          select: {
            status: true,
          },
        },
      },
    });
    if (!orderingUser) {
      throw new AppError(404, "User not found");
    }

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

    const dealerPriceMap = await getDealerPriceMap(
      prisma,
      userId,
      cart.cartItems.map((item) => item.variantId)
    );
    const customerRoleSnapshot = resolveCustomerTypeFromUser(orderingUser);

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
      customerRoleSnapshot,
      cartId,
      orderItems,
    });

    await this.sendOrderPlacedNotifications(
      userId,
      order.id,
      customerRoleSnapshot
    ).catch(
      async (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown notification error";

        await this.logsService.warn("Order placed notifications failed", {
          userId,
          orderId: order.id,
          error: errorMessage,
        });
      }
    );

    return order;
  }

  private async getAdminNotificationRecipients(
    excludeEmail?: string
  ): Promise<string[]> {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: [ROLE.ADMIN, ROLE.SUPERADMIN],
        },
      },
      select: {
        email: true,
      },
    });

    const normalizedExclude = excludeEmail?.trim().toLowerCase();
    const emails = admins
      .map((admin) => admin.email?.trim())
      .filter((email): email is string => !!email)
      .filter((email) => email.toLowerCase() !== normalizedExclude);

    return Array.from(new Set(emails));
  }

  private async sendOrderPlacedNotifications(
    userId: string,
    orderId: string,
    customerType: "USER" | "DEALER"
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return;
    }

    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const accountReference = toAccountReference(user.id);
    const orderReference = toOrderReference(orderId);
    const actionTime = formatDateTimeInIST(new Date());
    const notificationPromises: Promise<boolean>[] = [];

    if (user.email) {
      notificationPromises.push(
        sendEmail({
          to: user.email,
          subject: `${platformName} | Your Order Has Been Placed`,
          text: [
            `Hello ${user.name},`,
            "",
            `Your order has been placed on ${platformName}.`,
            `Order ID: ${orderReference}`,
            `Account Reference: ${accountReference}`,
            `Current status: PLACED`,
            `Action Time (IST): ${actionTime}`,
            "",
            "We will confirm your order after stock verification.",
            `Need help? Contact ${supportEmail}.`,
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>Your order has been placed on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Account Reference:</strong> ${accountReference}<br />
                <strong>Current status:</strong> PLACED<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              <p>We will confirm your order after stock verification.</p>
              <p>
                Need help? Contact
                <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
              </p>
            </div>
          `,
        })
      );
    }

    const adminRecipients = await this.getAdminNotificationRecipients(user.email);
    for (const adminEmail of adminRecipients) {
      notificationPromises.push(
        sendEmail({
          to: adminEmail,
          subject: `${platformName} | New Order Arrived`,
          text: [
            "New order received.",
            "",
            `Order ID: ${orderReference}`,
            `Customer Name: ${user.name}`,
            `Customer Email: ${user.email || "Not available"}`,
            `Customer Type: ${customerType}`,
            `Account Reference: ${accountReference}`,
            "Current status: PLACED",
            `Action Time (IST): ${actionTime}`,
            "",
            `Please review and update status from the admin panel.`,
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p><strong>New order received.</strong></p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Customer Name:</strong> ${user.name}<br />
                <strong>Customer Email:</strong> ${
                  user.email || "Not available"
                }<br />
                <strong>Customer Type:</strong> ${customerType}<br />
                <strong>Account Reference:</strong> ${accountReference}<br />
                <strong>Current status:</strong> PLACED<br />
                <strong>Action Time (IST):</strong> ${actionTime}
              </p>
              <p>Please review and update status from the admin panel.</p>
            </div>
          `,
        })
      );
    }

    if (!notificationPromises.length) {
      return;
    }

    const results = await Promise.allSettled(notificationPromises);
    const hasFailure = results.some(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" && result.value === false)
    );

    if (hasFailure) {
      throw new Error("One or more order placement notifications failed.");
    }
  }
}
