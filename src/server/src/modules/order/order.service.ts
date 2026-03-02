import AppError from "@/shared/errors/AppError";
import { OrderRepository } from "./order.repository";
import prisma from "@/infra/database/database.config";
import {
  CART_STATUS,
  ORDER_QUOTATION_LOG_EVENT,
  PAYMENT_STATUS,
  DELIVERY_MODE,
  ROLE,
  type Prisma,
} from "@prisma/client";
import sendEmail from "@/shared/utils/sendEmail";
import {
  getPlatformName,
  getSupportEmail,
} from "@/shared/utils/branding";
import {
  toAccountReference,
  toOrderReference,
} from "@/shared/utils/accountReference";
import { formatDateTimeInIST } from "@/shared/utils/dateTime";
import { makeLogsService } from "../logs/logs.factory";
import { getDealerPriceMap } from "@/shared/utils/dealerAccess";
import { resolveCustomerTypeFromUser } from "@/shared/utils/userRole";
import { ORDER_LIFECYCLE_STATUS } from "@/shared/utils/orderLifecycle";
import stripe, { isStripeConfigured } from "@/infra/payment/stripe";
import { TransactionService } from "../transaction/transaction.service";
import { TransactionRepository } from "../transaction/transaction.repository";
import {
  buildCheckoutPricing,
  getAddressForCheckout,
  getPickupLocationSnapshot,
  resolveDeliveryQuote,
} from "@/shared/utils/pricing/checkoutPricing";
import { config } from "@/config";

export class OrderService {
  private logsService = makeLogsService();
  private transactionService = new TransactionService(
    new TransactionRepository()
  );

  constructor(private orderRepository: OrderRepository) {}

  private resolvePortalUrl(): string {
    const configuredUrl = config.isProduction
      ? config.urls.clientProd
      : config.urls.clientDev;
    return configuredUrl.replace(/\/+$/, "");
  }

  private isMockPaymentEnabled(): boolean {
    return config.payment.enableMockPayment && !config.isProduction;
  }

  private buildMockCheckoutUrl(orderReference: string): string {
    const params = new URLSearchParams({
      orderId: orderReference,
      mockPayment: "1",
    });
    return `${this.resolvePortalUrl()}/payment-success?${params.toString()}`;
  }

  private buildQuotationLogLineItems(orderItems: any[] = []) {
    return orderItems.map((item) => ({
      orderItemId: item.id,
      variantId: item.variantId,
      sku: item.variant?.sku || null,
      productName: item.variant?.product?.name || "Product",
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.price) || 0,
      lineTotal: Number(
        ((Number(item.quantity) || 0) * (Number(item.price) || 0)).toFixed(2)
      ),
    }));
  }

  private async createQuotationLog(params: {
    orderId: string;
    event: ORDER_QUOTATION_LOG_EVENT;
    previousTotal?: number | null;
    updatedTotal: number;
    actorUserId?: string | null;
    actorRole?: string | null;
    message?: string | null;
    lineItems: ReturnType<OrderService["buildQuotationLogLineItems"]>;
  }) {
    await prisma.orderQuotationLog.create({
      data: {
        orderId: params.orderId,
        event: params.event,
        previousTotal:
          params.previousTotal === undefined ? null : params.previousTotal,
        updatedTotal: Number(params.updatedTotal.toFixed(2)),
        currency: "INR",
        actorUserId: params.actorUserId || null,
        actorRole: params.actorRole || null,
        message: params.message || null,
        lineItems: params.lineItems as Prisma.InputJsonValue,
      },
    });
  }

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

  async acceptQuotationForOrder(orderId: string, userId: string) {
    const resolvedOrderId = await this.resolveOrderIdForUser(orderId, userId);
    const order = await this.orderRepository.findOrderById(resolvedOrderId);
    if (!order) {
      throw new AppError(404, "Order not found");
    }

    if (order.userId !== userId) {
      throw new AppError(403, "You are not authorized to update this order");
    }

    if (!order.transaction) {
      throw new AppError(
        409,
        "Quotation workflow is not initialized for this order."
      );
    }

    const normalizedStatus = String(
      order.transaction.status || order.status
    ).toUpperCase();

    if (normalizedStatus !== ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
      throw new AppError(
        409,
        `Payment can start only for AWAITING_PAYMENT orders. Current status: ${normalizedStatus}`
      );
    }

    const reservationExpiry =
      order.reservation?.expiresAt || order.reservationExpiresAt || null;
    if (reservationExpiry && new Date(reservationExpiry).getTime() <= Date.now()) {
      await this.transactionService
        .updateTransactionStatus(order.transaction.id, {
          status: ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
        })
        .catch(() => null);

      throw new AppError(
        409,
        "Quotation has expired. Please contact support for next steps."
      );
    }

    if (!Array.isArray(order.orderItems) || order.orderItems.length === 0) {
      throw new AppError(409, "Order has no line items to bill.");
    }

    if (!Number.isFinite(order.amount) || Number(order.amount) <= 0) {
      throw new AppError(
        409,
        "Quoted amount is invalid for online payment processing."
      );
    }

    const mockPaymentEnabled = this.isMockPaymentEnabled();
    if (mockPaymentEnabled) {
      const orderReference = toOrderReference(order.id);
      const mockCheckoutSessionId = `mock_${Date.now()}_${order.id.slice(0, 8)}`;

      if (order.payment?.id) {
        await prisma.payment.update({
          where: {
            id: order.payment.id,
          },
          data: {
            method: "MOCK_GATEWAY",
            amount: Number(order.amount),
            status: PAYMENT_STATUS.PENDING,
          },
        });
      } else {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            method: "MOCK_GATEWAY",
            amount: Number(order.amount),
            status: PAYMENT_STATUS.PENDING,
          },
        });
      }

      await this.createQuotationLog({
        orderId: order.id,
        event: ORDER_QUOTATION_LOG_EVENT.CUSTOMER_ACCEPTED,
        previousTotal: Number(order.amount),
        updatedTotal: Number(order.amount),
        actorUserId: userId,
        actorRole: order.customerRoleSnapshot,
        message:
          "Customer accepted quotation and initiated mock payment for testing.",
        lineItems: this.buildQuotationLogLineItems(order.orderItems),
      });

      await this.transactionService.updateTransactionStatus(order.transaction.id, {
        status: ORDER_LIFECYCLE_STATUS.CONFIRMED,
        actorUserId: userId,
        actorRole: "SYSTEM",
      });

      await this.logsService.info("Mock payment flow confirmed order", {
        orderId: order.id,
        orderReference,
        userId,
        checkoutSessionId: mockCheckoutSessionId,
      });

      return {
        orderId: order.id,
        orderReference,
        checkoutUrl: this.buildMockCheckoutUrl(orderReference),
        checkoutSessionId: mockCheckoutSessionId,
        reservationExpiresAt: reservationExpiry,
        isMockPayment: true,
      };
    }

    if (!isStripeConfigured || !stripe) {
      throw new AppError(
        503,
        "Payment gateway is not configured. Please contact support."
      );
    }

    const currency = config.payment.stripeCurrency.toLowerCase();
    const lineItems = order.orderItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency,
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.variant?.product?.name || item.variant?.sku || "Product",
          metadata: {
            orderId: order.id,
            orderItemId: item.id,
            variantId: item.variantId,
          },
        },
      },
    }));

    const hasInvalidLineItem = lineItems.some(
      (line) =>
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.price_data.unit_amount) ||
        line.price_data.unit_amount <= 0
    );

    if (hasInvalidLineItem) {
      throw new AppError(
        409,
        "Quoted line items contain invalid quantity or price."
      );
    }

    const portalUrl = this.resolvePortalUrl();
    const orderReference = toOrderReference(order.id);
    const now = Date.now();
    const reservationExpiryTimestamp = reservationExpiry
      ? new Date(reservationExpiry).getTime()
      : null;
    const maxStripeCheckoutExpiry = now + 23 * 60 * 60 * 1000;
    const checkoutSessionExpiry =
      reservationExpiryTimestamp && reservationExpiryTimestamp > now + 5 * 60 * 1000
        ? Math.floor(
            Math.min(reservationExpiryTimestamp, maxStripeCheckoutExpiry) / 1000
          )
        : undefined;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.user?.email || undefined,
      line_items: lineItems,
      metadata: {
        orderId: order.id,
        orderReference,
        userId,
      },
      success_url: `${portalUrl}/payment-success?orderId=${orderReference}`,
      cancel_url: `${portalUrl}/cancel?orderId=${orderReference}`,
      ...(checkoutSessionExpiry ? { expires_at: checkoutSessionExpiry } : {}),
    });

    if (!checkoutSession.url) {
      throw new AppError(
        500,
        "Unable to initialize payment session. Please try again."
      );
    }

    if (order.payment?.id) {
      await prisma.payment.update({
        where: {
          id: order.payment.id,
        },
        data: {
          method: "STRIPE_CHECKOUT",
          amount: Number(order.amount),
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          method: "STRIPE_CHECKOUT",
          amount: Number(order.amount),
          status: PAYMENT_STATUS.PENDING,
        },
      });
    }

    await this.createQuotationLog({
      orderId: order.id,
      event: ORDER_QUOTATION_LOG_EVENT.CUSTOMER_ACCEPTED,
      previousTotal: Number(order.amount),
      updatedTotal: Number(order.amount),
      actorUserId: userId,
      actorRole: order.customerRoleSnapshot,
      message: "Customer accepted quotation and initiated payment.",
      lineItems: this.buildQuotationLogLineItems(order.orderItems),
    });

    return {
      orderId: order.id,
      orderReference,
      checkoutUrl: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
      reservationExpiresAt: reservationExpiry,
    };
  }

  async rejectQuotationForOrder(orderId: string, userId: string) {
    const resolvedOrderId = await this.resolveOrderIdForUser(orderId, userId);
    const order = await this.orderRepository.findOrderById(resolvedOrderId);
    if (!order) {
      throw new AppError(404, "Order not found");
    }

    if (order.userId !== userId) {
      throw new AppError(403, "You are not authorized to update this order");
    }

    if (!order.transaction) {
      throw new AppError(
        409,
        "Quotation workflow is not initialized for this order."
      );
    }

    const normalizedStatus = String(
      order.transaction.status || order.status
    ).toUpperCase();

    if (normalizedStatus !== ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
      throw new AppError(
        409,
        `Only AWAITING_PAYMENT quotations can be rejected. Current status: ${normalizedStatus}`
      );
    }

    return this.transactionService.updateTransactionStatus(order.transaction.id, {
      status: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      actorUserId: userId,
      actorRole: order.customerRoleSnapshot,
    });
  }

  private async buildCheckoutOrderDraft(params: {
    userId: string;
    cartId?: string;
    addressId?: string;
    deliveryMode: "PICKUP" | "DELIVERY";
  }) {
    const orderingUser = await prisma.user.findUnique({
      where: { id: params.userId },
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

    const cart = params.cartId
      ? await prisma.cart.findUnique({
          where: { id: params.cartId },
          include: {
            cartItems: { include: { variant: { include: { product: true } } } },
          },
        })
      : await prisma.cart.findFirst({
          where: {
            userId: params.userId,
            status: CART_STATUS.ACTIVE,
          },
          include: {
            cartItems: { include: { variant: { include: { product: true } } } },
          },
          orderBy: {
            updatedAt: "desc",
          },
        });

    if (!cart || cart.cartItems.length === 0) {
      throw new AppError(400, "Cart is empty or not found");
    }
    if (cart.status !== CART_STATUS.ACTIVE) {
      throw new AppError(400, "Cart is not active");
    }
    if (cart.userId !== params.userId) {
      throw new AppError(403, "You are not authorized to access this cart");
    }

    const dealerPriceMap = await getDealerPriceMap(
      prisma,
      params.userId,
      cart.cartItems.map((item) => item.variantId)
    );
    const customerRoleSnapshot = resolveCustomerTypeFromUser(orderingUser);
    const orderItems = cart.cartItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      price: dealerPriceMap.get(item.variantId) ?? item.variant.price,
    }));

    const normalizedDeliveryMode =
      String(params.deliveryMode || "").toUpperCase() === DELIVERY_MODE.PICKUP
        ? DELIVERY_MODE.PICKUP
        : DELIVERY_MODE.DELIVERY;

    const selectedAddress =
      normalizedDeliveryMode === DELIVERY_MODE.PICKUP
        ? getPickupLocationSnapshot()
        : await getAddressForCheckout(params.userId, params.addressId || "");

    const deliveryQuote = await resolveDeliveryQuote({
      deliveryMode: normalizedDeliveryMode,
      address: selectedAddress,
    });
    const pricing = buildCheckoutPricing({
      items: orderItems.map((item) => ({
        quantity: item.quantity,
        price: item.price,
      })),
      deliveryQuote,
    });

    return {
      cart,
      customerRoleSnapshot,
      orderItems,
      selectedAddress,
      pricing,
    };
  }

  async buildCheckoutSummaryFromUserCart(
    userId: string,
    addressId: string | undefined,
    deliveryMode: "PICKUP" | "DELIVERY"
  ) {
    const draft = await this.buildCheckoutOrderDraft({
      userId,
      addressId,
      deliveryMode,
    });

    return {
      cartId: draft.cart.id,
      subtotalAmount: draft.pricing.subtotalAmount,
      deliveryMode: draft.pricing.deliveryMode,
      deliveryLabel: draft.pricing.deliveryLabel,
      deliveryCharge: draft.pricing.deliveryCharge,
      finalTotal: draft.pricing.finalTotal,
      serviceArea: draft.pricing.serviceArea,
      selectedAddress: {
        id: draft.selectedAddress.id,
        type: draft.selectedAddress.type,
        fullName: draft.selectedAddress.fullName,
        phoneNumber: draft.selectedAddress.phoneNumber,
        line1: draft.selectedAddress.line1,
        line2: draft.selectedAddress.line2,
        landmark: draft.selectedAddress.landmark,
        city: draft.selectedAddress.city,
        state: draft.selectedAddress.state,
        country: draft.selectedAddress.country,
        pincode: draft.selectedAddress.pincode,
      },
    };
  }

  async createOrderFromCart(
    userId: string,
    cartId: string,
    addressId: string | undefined,
    deliveryMode: "PICKUP" | "DELIVERY"
  ) {
    const draft = await this.buildCheckoutOrderDraft({
      userId,
      cartId,
      addressId,
      deliveryMode,
    });

    const order = await this.orderRepository.createOrder({
      userId,
      customerRoleSnapshot: draft.customerRoleSnapshot,
      cartId: draft.cart.id,
      orderItems: draft.orderItems,
      pricing: {
        subtotalAmount: draft.pricing.subtotalAmount,
        deliveryCharge: draft.pricing.deliveryCharge,
        deliveryMode: draft.pricing.deliveryMode as DELIVERY_MODE,
        deliveryLabel: draft.pricing.deliveryLabel,
        serviceArea: draft.pricing.serviceArea,
      },
      addressSnapshot: {
        sourceAddressId: draft.selectedAddress.sourceAddressId || undefined,
        addressType: draft.selectedAddress.type,
        fullName: draft.selectedAddress.fullName,
        phoneNumber: draft.selectedAddress.phoneNumber,
        line1: draft.selectedAddress.line1,
        line2: draft.selectedAddress.line2,
        landmark: draft.selectedAddress.landmark,
        city: draft.selectedAddress.city,
        state: draft.selectedAddress.state,
        country: draft.selectedAddress.country,
        pincode: draft.selectedAddress.pincode,
      },
    });

    await this.sendOrderPlacedNotifications(
      userId,
      order.id,
      draft.customerRoleSnapshot
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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        subtotalAmount: true,
        deliveryCharge: true,
        deliveryMode: true,
        amount: true,
        address: {
          select: {
            deliveryLabel: true,
          },
        },
      },
    });
    if (!order) {
      return;
    }

    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const accountReference = toAccountReference(user.id);
    const orderReference = toOrderReference(orderId);
    const actionTime = formatDateTimeInIST(new Date());
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(Number(value || 0));
    const notificationPromises: Promise<boolean>[] = [];

    if (user.email) {
      notificationPromises.push(
        sendEmail({
          to: user.email,
          subject: `${platformName} | Order Received - Verification Pending`,
          text: [
            `Hello ${user.name},`,
            "",
            `Your order has been received on ${platformName}.`,
            `Order ID: ${orderReference}`,
            `Account Reference: ${accountReference}`,
            `Current status: ${ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}`,
            `Action Time (IST): ${actionTime}`,
            `Subtotal: ${formatCurrency(order.subtotalAmount)}`,
            `Delivery (${order.address?.deliveryLabel || order.deliveryMode}): ${formatCurrency(
              order.deliveryCharge
            )}`,
            `Final Total: ${formatCurrency(order.amount)}`,
            "",
            "Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.",
            `Need help? Contact ${supportEmail}.`,
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>Your order has been received on <strong>${platformName}</strong>.</p>
              <p>
                <strong>Order ID:</strong> ${orderReference}<br />
                <strong>Account Reference:</strong> ${accountReference}<br />
                <strong>Current status:</strong> ${ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}<br />
                <strong>Action Time (IST):</strong> ${actionTime}<br />
                <strong>Subtotal:</strong> ${formatCurrency(order.subtotalAmount)}<br />
                <strong>Delivery (${order.address?.deliveryLabel || order.deliveryMode}):</strong> ${formatCurrency(
                  order.deliveryCharge
                )}<br />
                <strong>Final Total:</strong> ${formatCurrency(order.amount)}
              </p>
              <p>Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.</p>
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
          subject: `${platformName} | New Order Awaiting Verification`,
          text: [
            "New order received.",
            "",
            `Order ID: ${orderReference}`,
            `Customer Name: ${user.name}`,
            `Customer Email: ${user.email || "Not available"}`,
            `Customer Type: ${customerType}`,
            `Account Reference: ${accountReference}`,
            `Current status: ${ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}`,
            `Action Time (IST): ${actionTime}`,
            `Subtotal: ${formatCurrency(order.subtotalAmount)}`,
            `Delivery (${order.address?.deliveryLabel || order.deliveryMode}): ${formatCurrency(
              order.deliveryCharge
            )}`,
            `Final Total: ${formatCurrency(order.amount)}`,
            "",
            `Please verify stock and send quotation from the admin panel.`,
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
                <strong>Current status:</strong> ${ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION}<br />
                <strong>Action Time (IST):</strong> ${actionTime}<br />
                <strong>Subtotal:</strong> ${formatCurrency(order.subtotalAmount)}<br />
                <strong>Delivery (${order.address?.deliveryLabel || order.deliveryMode}):</strong> ${formatCurrency(
                  order.deliveryCharge
                )}<br />
                <strong>Final Total:</strong> ${formatCurrency(order.amount)}
              </p>
              <p>Please verify stock and send quotation from the admin panel.</p>
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
