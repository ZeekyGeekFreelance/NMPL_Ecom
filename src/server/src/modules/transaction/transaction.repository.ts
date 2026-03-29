import prisma, { type TransactionClient } from "@/infra/database/database.config";
import AppError from "@/shared/errors/AppError";
import { toTransactionReference } from "@/shared/utils/accountReference";
import {
  ORDER_LIFECYCLE_STATUS,
  type OrderLifecycleStatus,
} from "@/shared/utils/orderLifecycle";
import {
  ORDER_QUOTATION_LOG_EVENT,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
  TRANSACTION_STATUS,
  type Prisma,
} from "@prisma/client";

const statusToPrismaEnum: Record<OrderLifecycleStatus, TRANSACTION_STATUS> = {
  PENDING_VERIFICATION: TRANSACTION_STATUS.PENDING_VERIFICATION,
  WAITLISTED: TRANSACTION_STATUS.WAITLISTED,
  AWAITING_PAYMENT: TRANSACTION_STATUS.AWAITING_PAYMENT,
  QUOTATION_REJECTED: TRANSACTION_STATUS.QUOTATION_REJECTED,
  QUOTATION_EXPIRED: TRANSACTION_STATUS.QUOTATION_EXPIRED,
  CONFIRMED: TRANSACTION_STATUS.CONFIRMED,
  DELIVERED: TRANSACTION_STATUS.DELIVERED,
};

const createManualFollowUpReservationExpiry = (): Date =>
  new Date("2099-12-31T23:59:59.000Z");

type OrderItemSnapshot = {
  id: string;
  variantId: string;
  quantity: number;
  price: number;
  gstRateAtPurchase: number;
  taxAmount: number;
  total: number;
  variant: {
    productId: string;
    sku: string;
    stock: number;
    reservedStock: number;
    product: {
      name: string;
    };
  };
};

export type TransactionQuotationItemUpdate = {
  orderItemId: string;
  quantity: number;
  price: number;
};

type OrderSnapshot = {
  id: string;
  userId: string;
  subtotalAmount: number;
  deliveryCharge: number;
  amount: number;
  orderDate: Date;
  verificationQueuedAt: Date | null;
  status: string;
  reservationExpiresAt: Date | null;
  /** True when the order belongs to a legacy pay-later dealer. Set at order creation. */
  isPayLater: boolean;
  orderItems: OrderItemSnapshot[];
  reservation: {
    id: string;
    status: RESERVATION_STATUS;
    expiresAt: Date;
  } | null;
  payment: {
    id: string;
    status: PAYMENT_STATUS;
  } | null;
};

export type UpdateTransactionResult = {
  transaction: any;
  previousStatus: OrderLifecycleStatus;
  effectiveStatus: OrderLifecycleStatus;
  promotedOrderIds: string[];
};

export type TransactionSummary = {
  pendingVerificationCount: number;
  awaitingPaymentCount: number;
  waitlistedCount: number;
  paymentFollowupCount: number;
};

export class TransactionRepository {
  private static readonly UPDATE_TRANSACTION_TIMEOUT_MS = 20_000;
  private static readonly UPDATE_TRANSACTION_MAX_WAIT_MS = 5_000;
  private static readonly DEFAULT_LIST_TAKE = 25;
  private static readonly MAX_LIST_TAKE = 100;

  constructor() {}

  private extractReferenceChecksum(reference: string): string | null {
    const normalizedReference = (reference || "").trim().toUpperCase();
    const [, token = ""] = normalizedReference.split("-");
    const cleanToken = token.replace(/[^A-Z0-9]/g, "");

    if (cleanToken.length < 2) {
      return null;
    }

    return cleanToken.slice(-2).toLowerCase();
  }

  normalizeStatusValue(status: string): OrderLifecycleStatus {
    const normalized = String(status || "").trim().toUpperCase();

    const legacyToCurrent: Record<string, OrderLifecycleStatus> = {
      PENDING_VERIFICATION: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      WAITLISTED: ORDER_LIFECYCLE_STATUS.WAITLISTED,
      AWAITING_PAYMENT: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
      QUOTATION_REJECTED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      QUOTATION_EXPIRED: ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED,
      CONFIRMED: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      DELIVERED: ORDER_LIFECYCLE_STATUS.DELIVERED,
      PLACED: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      PENDING: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
      REJECTED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      CANCELED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      CANCELLED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      RETURNED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      REFUNDED: ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED,
      PROCESSING: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      SHIPPED: ORDER_LIFECYCLE_STATUS.CONFIRMED,
      IN_TRANSIT: ORDER_LIFECYCLE_STATUS.CONFIRMED,
    };

    return (
      legacyToCurrent[normalized] || ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION
    );
  }

  async findMany(params?: { skip?: number; take?: number }) {
    const skip = params?.skip ?? 0;
    const take = Math.min(
      Math.max(1, params?.take ?? TransactionRepository.DEFAULT_LIST_TAKE),
      TransactionRepository.MAX_LIST_TAKE
    );

    return prisma.transaction.findMany({
      skip,
      take,
      include: {
        order: {
          select: {
            id: true,
            isPayLater: true,
            paymentDueDate: true,
            payment: {
              select: {
                status: true,
              },
            },
            paymentTransactions: {
              select: {
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });
  }

  async countTransactions() {
    return prisma.transaction.count();
  }

  async findById(id: string) {
      return prisma.transaction.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              payment: true,
              paymentTransactions: {
                orderBy: {
                  paymentReceivedAt: "desc",
                },
                include: {
                  recordedBy: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
              reservation: true,
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
            address: true,
            invoice: true,
            quotationLogs: {
              orderBy: {
                createdAt: "desc",
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
          },
        },
      },
    });
  }

  async findIdByReference(reference: string): Promise<string | null> {
    const normalizedReference = (reference || "").trim().toUpperCase();
    if (!normalizedReference) {
      return null;
    }

    const checksum = this.extractReferenceChecksum(normalizedReference);
    const candidates = await prisma.transaction.findMany({
      where: checksum ? { id: { endsWith: checksum } } : undefined,
      select: { id: true },
      orderBy: { transactionDate: "desc" },
    });

    const matches = candidates.filter(
      (candidate) => toTransactionReference(candidate.id) === normalizedReference
    );

    if (matches.length > 1) {
      throw new AppError(409, "Multiple transactions matched this reference");
    }

    return matches[0]?.id ?? null;
  }

  async createTransaction(data: any) {
    return prisma.transaction.create({
      data,
    });
  }

  async findExpiredAwaitingPaymentTransactionIds(_now: Date): Promise<string[]> {
    return [];
  }

  private sanitizeQuotationItemUpdate(
    rawItem: TransactionQuotationItemUpdate
  ): TransactionQuotationItemUpdate {
    const orderItemId = String(rawItem?.orderItemId || "").trim();
    if (!orderItemId) {
      throw new AppError(400, "Each quotation row must include orderItemId.");
    }

    const quantity = Number(rawItem?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(
        400,
        `Invalid quotation quantity for order item ${orderItemId}.`
      );
    }

    const price = Number(rawItem?.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(
        400,
        `Invalid quotation price for order item ${orderItemId}.`
      );
    }

    return {
      orderItemId,
      quantity,
      price: Number(price.toFixed(2)),
    };
  }

  private async getOriginalOrderQuantityCaps(
    tx: TransactionClient,
    order: OrderSnapshot
  ): Promise<Map<string, number>> {
    const fallbackCaps = new Map<string, number>();
    for (const item of order.orderItems) {
      fallbackCaps.set(item.id, Number(item.quantity) || 0);
    }

    const originalLog = await tx.orderQuotationLog.findFirst({
      where: {
        orderId: order.id,
        event: ORDER_QUOTATION_LOG_EVENT.ORIGINAL_ORDER,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        lineItems: true,
      },
    });

    if (!originalLog || !Array.isArray(originalLog.lineItems)) {
      return fallbackCaps;
    }

    const parsedCaps = new Map<string, number>();
    for (const entry of originalLog.lineItems) {
      const row =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : null;
      if (!row) {
        continue;
      }

      const orderItemId = String(row.orderItemId || "").trim();
      const quantity = Number(row.quantity);
      if (!orderItemId || !Number.isInteger(quantity) || quantity <= 0) {
        continue;
      }

      parsedCaps.set(orderItemId, quantity);
    }

    if (parsedCaps.size === 0) {
      return fallbackCaps;
    }

    for (const [orderItemId, fallbackQty] of fallbackCaps.entries()) {
      if (!parsedCaps.has(orderItemId)) {
        parsedCaps.set(orderItemId, fallbackQty);
      }
    }

    return parsedCaps;
  }

  private async getOrderSnapshot(
    tx: TransactionClient,
    orderId: string
  ): Promise<OrderSnapshot> {
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        userId: true,
        subtotalAmount: true,
        deliveryCharge: true,
        amount: true,
        orderDate: true,
        verificationQueuedAt: true,
        status: true,
        reservationExpiresAt: true,
        isPayLater: true,
        reservation: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
          },
        },
        orderItems: {
          select: {
            id: true,
            variantId: true,
            quantity: true,
            price: true,
            gstRateAtPurchase: true,
            taxAmount: true,
            total: true,
            variant: {
              select: {
                productId: true,
                sku: true,
                stock: true,
                reservedStock: true,
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, "Order not found");
    }

    return order as OrderSnapshot;
  }

  private async applyQuotationAdjustments(params: {
    tx: TransactionClient;
    order: OrderSnapshot;
    quotationItems: TransactionQuotationItemUpdate[];
  }): Promise<OrderSnapshot> {
    const { tx, order, quotationItems } = params;

    if (!quotationItems.length) {
      throw new AppError(
        400,
        "Quotation update requires at least one line item."
      );
    }

    if (!order.orderItems.length) {
      throw new AppError(400, "Cannot issue quotation for an empty order.");
    }

    const orderItemById = new Map(order.orderItems.map((item) => [item.id, item]));
    const originalOrderQuantityCaps = await this.getOriginalOrderQuantityCaps(
      tx,
      order
    );
    const sanitizedUpdates = new Map<string, TransactionQuotationItemUpdate>();

    for (const rawItem of quotationItems) {
      const sanitized = this.sanitizeQuotationItemUpdate(rawItem);

      if (!orderItemById.has(sanitized.orderItemId)) {
        throw new AppError(
          400,
          `Quotation row ${sanitized.orderItemId} does not belong to this order.`
        );
      }

      if (sanitizedUpdates.has(sanitized.orderItemId)) {
        throw new AppError(
          400,
          `Duplicate quotation row submitted for order item ${sanitized.orderItemId}.`
        );
      }

      const existingItem = orderItemById.get(sanitized.orderItemId)!;
      const originalQuantityCap =
        originalOrderQuantityCaps.get(sanitized.orderItemId) ||
        Number(existingItem.quantity) ||
        0;
      if (sanitized.quantity > originalQuantityCap) {
        throw new AppError(
          400,
          `Quoted quantity for variant ${existingItem.variantId} cannot exceed original ordered quantity (${originalQuantityCap}).`
        );
      }

      const availableStock = Math.max(
        0,
        (Number(existingItem.variant.stock) || 0) -
          (Number(existingItem.variant.reservedStock) || 0)
      );
      if (sanitized.quantity > availableStock) {
        throw new AppError(
          409,
          `Quoted quantity for variant ${existingItem.variantId} exceeds available stock (${availableStock}).`
        );
      }

      sanitizedUpdates.set(sanitized.orderItemId, sanitized);
    }

    if (sanitizedUpdates.size !== order.orderItems.length) {
      throw new AppError(
        400,
        "Quotation update must include every order item exactly once."
      );
    }

    const updatedOrderItems: OrderItemSnapshot[] = [];
    let quotedSubtotal = 0;
    let quotedTaxAmount = 0;

    for (const item of order.orderItems) {
      const update = sanitizedUpdates.get(item.id)!;
      quotedSubtotal += update.quantity * update.price;
      const recalculatedTaxAmount = Number(
        ((update.quantity * update.price * Number(item.gstRateAtPurchase || 0)) / 100).toFixed(2)
      );
      const recalculatedTotal = Number(
        (update.quantity * update.price + recalculatedTaxAmount).toFixed(2)
      );
      quotedTaxAmount += recalculatedTaxAmount;

      await tx.orderItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity: update.quantity,
          price: update.price,
          taxAmount: recalculatedTaxAmount,
          total: recalculatedTotal,
        },
      });

      updatedOrderItems.push({
        ...item,
        quantity: update.quantity,
        price: update.price,
        taxAmount: recalculatedTaxAmount,
        total: recalculatedTotal,
      });
    }

    const normalizedSubtotal = Number(quotedSubtotal.toFixed(2));
    const normalizedTaxAmount = Number(quotedTaxAmount.toFixed(2));
    const normalizedDeliveryCharge = Number(order.deliveryCharge || 0);
    const finalAmount = Number(
      (normalizedSubtotal + normalizedTaxAmount + normalizedDeliveryCharge).toFixed(2)
    );

    await tx.order.update({
      where: {
        id: order.id,
      },
      data: {
        subtotalAmount: normalizedSubtotal,
        amount: finalAmount,
      },
    });

    if (order.payment) {
      await tx.payment.update({
        where: {
          id: order.payment.id,
        },
        data: {
          amount: finalAmount,
          status: PAYMENT_STATUS.PENDING,
        },
      });
    }

    return {
      ...order,
      subtotalAmount: normalizedSubtotal,
      amount: finalAmount,
      orderItems: updatedOrderItems,
      payment: order.payment
        ? {
            ...order.payment,
            status: PAYMENT_STATUS.PENDING,
          }
        : null,
    };
  }

  private buildQuotationLineItems(orderItems: OrderItemSnapshot[]) {
    return orderItems.map((item) => ({
      orderItemId: item.id,
      variantId: item.variantId,
      sku: item.variant?.sku || null,
      productName: item.variant?.product?.name || "Product",
      quantity: item.quantity,
      unitPrice: Number(item.price),
      lineTotal: Number((item.quantity * item.price).toFixed(2)),
    }));
  }

  private async appendQuotationLog(params: {
    tx: TransactionClient;
    orderId: string;
    event: ORDER_QUOTATION_LOG_EVENT;
    previousTotal?: number | null;
    updatedTotal: number;
    actorUserId?: string | null;
    actorRole?: string | null;
    message?: string | null;
    lineItems: ReturnType<TransactionRepository["buildQuotationLineItems"]>;
  }) {
    await params.tx.orderQuotationLog.create({
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

  private async reserveStockForOrder(
    tx: TransactionClient,
    orderItems: Array<Pick<OrderItemSnapshot, "variantId" | "quantity">>
  ): Promise<boolean> {
    const reservedItems: Array<{ variantId: string; quantity: number }> = [];

    for (const item of orderItems) {
      const reservedRowCount = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" + ${item.quantity},
            "updatedAt" = NOW()
        WHERE "id" = ${item.variantId}
          AND ("stock" - "reservedStock") >= ${item.quantity}
      `;

      if (reservedRowCount === 0) {
        for (const reserved of reservedItems) {
          await tx.$executeRaw`
            UPDATE "ProductVariant"
            SET "reservedStock" = GREATEST(0, "reservedStock" - ${reserved.quantity}),
                "updatedAt" = NOW()
            WHERE "id" = ${reserved.variantId}
          `;
        }
        return false;
      }

      reservedItems.push({
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    return true;
  }

  private async upsertActiveReservation(params: {
    tx: TransactionClient;
    orderId: string;
    expiresAt: Date;
  }) {
    await params.tx.orderReservation.upsert({
      where: {
        orderId: params.orderId,
      },
      update: {
        status: RESERVATION_STATUS.ACTIVE,
        expiresAt: params.expiresAt,
        releasedAt: null,
        consumedAt: null,
        reason: null,
      },
      create: {
        orderId: params.orderId,
        status: RESERVATION_STATUS.ACTIVE,
        expiresAt: params.expiresAt,
      },
    });
  }

  async getTransactionSummary(): Promise<TransactionSummary> {
    const statuses = [
      TRANSACTION_STATUS.PENDING_VERIFICATION,
      TRANSACTION_STATUS.AWAITING_PAYMENT,
      TRANSACTION_STATUS.WAITLISTED,
    ] as const;

    const grouped = await prisma.transaction.groupBy({
      by: ["status"],
      where: {
        status: {
          in: [...statuses],
        },
      },
      _count: {
        _all: true,
      },
    });

    const counts = new Map<string, number>();
    grouped.forEach((row) => {
      counts.set(String(row.status), row._count._all);
    });

    const pendingVerificationCount =
      counts.get(TRANSACTION_STATUS.PENDING_VERIFICATION) ?? 0;
    const awaitingPaymentCount =
      counts.get(TRANSACTION_STATUS.AWAITING_PAYMENT) ?? 0;
    const waitlistedCount = counts.get(TRANSACTION_STATUS.WAITLISTED) ?? 0;

    return {
      pendingVerificationCount,
      awaitingPaymentCount,
      waitlistedCount,
      paymentFollowupCount: awaitingPaymentCount + waitlistedCount,
    };
  }

  private async releaseReservationStock(params: {
    tx: TransactionClient;
    order: OrderSnapshot;
    nextReservationStatus: "EXPIRED" | "RELEASED";
    reason: string;
  }): Promise<string[]> {
    const affectedVariantIds = params.order.orderItems.map((item) => item.variantId);
    const shouldReleaseStock =
      params.order.reservation?.status === RESERVATION_STATUS.ACTIVE;

    if (shouldReleaseStock) {
      for (const item of params.order.orderItems) {
        await params.tx.$executeRaw`
          UPDATE "ProductVariant"
          SET "reservedStock" = GREATEST(0, "reservedStock" - ${item.quantity}),
              "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}
        `;
      }
    }

    if (params.order.reservation) {
      await params.tx.orderReservation.update({
        where: {
          id: params.order.reservation.id,
        },
        data: {
          status: params.nextReservationStatus,
          releasedAt: new Date(),
          reason: params.reason,
        },
      });
    }

    return affectedVariantIds;
  }

  private async finalizePaidOrder(params: {
    tx: TransactionClient;
    order: OrderSnapshot;
  }) {
    if (params.order.reservation?.status !== RESERVATION_STATUS.ACTIVE) {
      throw new AppError(
        409,
        "Order cannot be confirmed without an active reservation."
      );
    }

    for (const item of params.order.orderItems) {
      const deductedCount = await params.tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "stock" = "stock" - ${item.quantity},
            "reservedStock" = GREATEST(0, "reservedStock" - ${item.quantity}),
            "updatedAt" = NOW()
        WHERE "id" = ${item.variantId}
          AND "stock" >= ${item.quantity}
          AND "reservedStock" >= ${item.quantity}
      `;

      if (deductedCount === 0) {
        throw new AppError(
          409,
          `Unable to confirm order. Reserved stock is inconsistent for variant ${item.variantId}.`
        );
      }

      await params.tx.product.update({
        where: {
          id: item.variant.productId,
        },
        data: {
          salesCount: {
            increment: item.quantity,
          },
        },
      });
    }

    await params.tx.orderReservation.update({
      where: {
        id: params.order.reservation.id,
      },
      data: {
        status: RESERVATION_STATUS.CONSUMED,
        consumedAt: new Date(),
        reason: "PAYMENT_CONFIRMED",
      },
    });
  }

  private async finalizePayLaterOrder(params: {
    tx: TransactionClient;
    order: OrderSnapshot;
    reason: string;
  }) {
    if (params.order.reservation?.status !== RESERVATION_STATUS.ACTIVE) {
      throw new AppError(
        409,
        "Order cannot be confirmed without an active reservation."
      );
    }

    for (const item of params.order.orderItems) {
      const deductedCount = await params.tx.$executeRaw`
          UPDATE "ProductVariant"
          SET "stock" = "stock" - ${item.quantity},
              "reservedStock" = GREATEST(0, "reservedStock" - ${item.quantity}),
              "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}
            AND "stock" >= ${item.quantity}
            AND "reservedStock" >= ${item.quantity}
        `;

      if (deductedCount === 0) {
        throw new AppError(
          409,
          `Unable to confirm order. Reserved stock is inconsistent for variant ${item.variantId}.`
        );
      }

      await params.tx.product.update({
        where: {
          id: item.variant.productId,
        },
        data: {
          salesCount: {
            increment: item.quantity,
          },
        },
      });
    }

    await params.tx.orderReservation.update({
      where: {
        id: params.order.reservation.id,
      },
      data: {
        status: RESERVATION_STATUS.CONSUMED,
        consumedAt: new Date(),
        reason: params.reason,
      },
    });
  }

  private async ensurePaymentRecord(params: {
    tx: TransactionClient;
    order: {
      id: string;
      userId: string;
      amount: number;
      payment: {
        id: string;
        status: PAYMENT_STATUS;
      } | null;
    };
    status: PAYMENT_STATUS;
  }) {
    if (!params.order.payment) {
      await params.tx.payment.create({
        data: {
          orderId: params.order.id,
          userId: params.order.userId,
          method: "MANUAL_REVIEW",
          amount: params.order.amount,
          status: params.status,
        },
      });
      return;
    }

    await params.tx.payment.update({
      where: {
        id: params.order.payment.id,
      },
      data: {
        status: params.status,
      },
    });
  }

  private async promoteWaitlistedOrders(params: {
    tx: TransactionClient;
    variantIds: string[];
  }): Promise<string[]> {
    if (!params.variantIds.length) {
      return [];
    }

    const waitlistedOrders = await params.tx.order.findMany({
      where: {
        status: ORDER_LIFECYCLE_STATUS.WAITLISTED,
        orderItems: {
          some: {
            variantId: {
              in: params.variantIds,
            },
          },
        },
      },
      include: {
        transaction: true,
        payment: {
          select: {
            id: true,
            status: true,
          },
        },
        reservation: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
          },
        },
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
      orderBy: [
        {
          verificationQueuedAt: "asc",
        },
        {
          orderDate: "asc",
        },
      ],
    });

    const promotedOrderIds: string[] = [];

    for (const waitlisted of waitlistedOrders) {
      if (!waitlisted.transaction) {
        continue;
      }

      const reserved = await this.reserveStockForOrder(
        params.tx,
        waitlisted.orderItems
      );
      if (!reserved) {
        continue;
      }

      const now = new Date();
      const expiresAt = createManualFollowUpReservationExpiry();

      await this.upsertActiveReservation({
        tx: params.tx,
        orderId: waitlisted.id,
        expiresAt,
      });

      await this.ensurePaymentRecord({
        tx: params.tx,
        order: {
          id: waitlisted.id,
          userId: waitlisted.userId,
          amount: waitlisted.amount,
          payment: waitlisted.payment,
        },
        status: PAYMENT_STATUS.PENDING,
      });

      await params.tx.order.update({
        where: {
          id: waitlisted.id,
        },
        data: {
          status: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
          quotationSentAt: now,
          paymentRequestedAt: now,
          reservationExpiresAt: null,
        },
      });

      await params.tx.transaction.update({
        where: {
          id: waitlisted.transaction.id,
        },
        data: {
          status: TRANSACTION_STATUS.AWAITING_PAYMENT,
        },
      });

      promotedOrderIds.push(waitlisted.id);
    }

    return promotedOrderIds;
  }

  async updateTransaction(
    id: string,
    data: {
      status: OrderLifecycleStatus;
      quotationItems?: TransactionQuotationItemUpdate[];
      actorUserId?: string;
      actorRole?: string;
    }
  ): Promise<UpdateTransactionResult> {
    const committedUpdate = await prisma.$transaction(async (tx) => {
      const existingTransaction = await tx.transaction.findUnique({
        where: { id },
        select: {
          id: true,
          orderId: true,
          status: true,
        },
      });

      if (!existingTransaction) {
        throw new AppError(404, "Transaction not found");
      }

      if (
        data.quotationItems !== undefined &&
        Array.isArray(data.quotationItems) &&
        data.quotationItems.length === 0
      ) {
        throw new AppError(
          400,
          "Quotation update payload cannot be an empty list."
        );
      }

      const previousStatus = this.normalizeStatusValue(
        String(existingTransaction.status)
      );
      let order = await this.getOrderSnapshot(tx, existingTransaction.orderId);
      const previousOrderAmount = Number(order.amount);

      if (data.quotationItems?.length) {
        order = await this.applyQuotationAdjustments({
          tx,
          order,
          quotationItems: data.quotationItems,
        });
      }

      let effectiveStatus = data.status;
      let promotedOrderIds: string[] = [];
      const now = new Date();

      if (effectiveStatus === ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
        const reserved = await this.reserveStockForOrder(tx, order.orderItems);

        if (reserved) {
          const expiresAt = createManualFollowUpReservationExpiry();
          await this.upsertActiveReservation({
            tx,
            orderId: order.id,
            expiresAt,
          });
          await this.ensurePaymentRecord({
            tx,
            order: {
              id: order.id,
              userId: order.userId,
              amount: order.amount,
              payment: order.payment,
            },
            status: PAYMENT_STATUS.PENDING,
          });
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT,
              verificationQueuedAt: order.verificationQueuedAt || now,
              quotationSentAt: now,
              paymentRequestedAt: now,
              reservationExpiresAt: null,
            },
          });

          if (data.quotationItems?.length) {
            await this.appendQuotationLog({
              tx,
              orderId: order.id,
              event: ORDER_QUOTATION_LOG_EVENT.ADMIN_QUOTATION,
              previousTotal: previousOrderAmount,
              updatedTotal: Number(order.amount),
              actorUserId: data.actorUserId,
              actorRole: data.actorRole,
              message:
                "Admin revised quotation and marked the order ready for payment with manual follow-up.",
              lineItems: this.buildQuotationLineItems(order.orderItems),
            });
          }
        } else {
          effectiveStatus = ORDER_LIFECYCLE_STATUS.WAITLISTED;
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: ORDER_LIFECYCLE_STATUS.WAITLISTED,
              verificationQueuedAt: order.verificationQueuedAt || now,
              reservationExpiresAt: null,
            },
          });

          if (data.quotationItems?.length) {
            await this.appendQuotationLog({
              tx,
              orderId: order.id,
              event: ORDER_QUOTATION_LOG_EVENT.ADMIN_QUOTATION,
              previousTotal: previousOrderAmount,
              updatedTotal: Number(order.amount),
              actorUserId: data.actorUserId,
              actorRole: data.actorRole,
              message:
                "Admin revised quotation, but stock is currently unavailable. Order moved to waitlist.",
              lineItems: this.buildQuotationLineItems(order.orderItems),
            });
          }
        }
      } else if (effectiveStatus === ORDER_LIFECYCLE_STATUS.WAITLISTED) {
        if (order.reservation?.status === RESERVATION_STATUS.ACTIVE) {
          await this.releaseReservationStock({
            tx,
            order,
            nextReservationStatus: RESERVATION_STATUS.RELEASED,
            reason: "WAITLISTED",
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: ORDER_LIFECYCLE_STATUS.WAITLISTED,
            verificationQueuedAt: order.verificationQueuedAt || now,
            reservationExpiresAt: null,
          },
        });
      } else if (
        effectiveStatus === ORDER_LIFECYCLE_STATUS.QUOTATION_REJECTED ||
        effectiveStatus === ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
      ) {
        const affectedVariantIds = await this.releaseReservationStock({
          tx,
          order,
          nextReservationStatus:
            effectiveStatus === ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
              ? RESERVATION_STATUS.EXPIRED
              : RESERVATION_STATUS.RELEASED,
          reason:
            effectiveStatus === ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
              ? "QUOTATION_EXPIRED"
              : "QUOTATION_REJECTED",
        });
        await this.ensurePaymentRecord({
          tx,
          order: {
            id: order.id,
            userId: order.userId,
            amount: order.amount,
            payment: order.payment,
          },
          status: PAYMENT_STATUS.CANCELED,
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: effectiveStatus,
            reservationExpiresAt: null,
          },
        });

        await this.appendQuotationLog({
          tx,
          orderId: order.id,
          event:
            effectiveStatus === ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
              ? ORDER_QUOTATION_LOG_EVENT.QUOTATION_EXPIRED
              : ORDER_QUOTATION_LOG_EVENT.CUSTOMER_REJECTED,
          previousTotal: Number(order.amount),
          updatedTotal: Number(order.amount),
          actorUserId: data.actorUserId,
          actorRole: data.actorRole,
          message:
            effectiveStatus === ORDER_LIFECYCLE_STATUS.QUOTATION_EXPIRED
              ? "Quotation was closed under the legacy automatic-expiry policy. Stock hold released."
              : data.actorRole
              ? `Quotation rejected by ${data.actorRole}. Stock hold released.`
              : "Quotation rejected. Stock hold released.",
          lineItems: this.buildQuotationLineItems(order.orderItems),
        });

        promotedOrderIds = await this.promoteWaitlistedOrders({
          tx,
          variantIds: affectedVariantIds,
        });
        } else if (effectiveStatus === ORDER_LIFECYCLE_STATUS.CONFIRMED) {
          const isPayLaterBypass = order.isPayLater;

          if (isPayLaterBypass) {
            await this.finalizePayLaterOrder({
              tx,
              order,
              reason: "PAY_LATER_CONFIRMED",
            });

            const paymentStatus =
              order.payment?.status === PAYMENT_STATUS.PAID
                ? PAYMENT_STATUS.PAID
                : PAYMENT_STATUS.PENDING;

            await this.ensurePaymentRecord({
              tx,
              order: {
                id: order.id,
                userId: order.userId,
                amount: order.amount,
                payment: order.payment,
              },
              status: paymentStatus,
            });

            await tx.order.update({
              where: { id: order.id },
              data: {
                status: ORDER_LIFECYCLE_STATUS.CONFIRMED,
                reservationExpiresAt: null,
              },
            });

            if (String(data.actorRole || "").trim().toUpperCase() !== "PAY_LATER_BYPASS") {
              await this.appendQuotationLog({
                tx,
                orderId: order.id,
                event: ORDER_QUOTATION_LOG_EVENT.CUSTOMER_ACCEPTED,
                previousTotal: Number(order.amount),
                updatedTotal: Number(order.amount),
                actorUserId: data.actorUserId,
                actorRole: data.actorRole || "SYSTEM",
                message: "Pay-later order confirmed without upfront payment.",
                lineItems: this.buildQuotationLineItems(order.orderItems),
              });
            }
          } else {
            await this.finalizePaidOrder({
              tx,
              order,
            });
            await this.ensurePaymentRecord({
              tx,
              order: {
                id: order.id,
                userId: order.userId,
                amount: order.amount,
                payment: order.payment,
              },
              status: PAYMENT_STATUS.PAID,
            });
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: ORDER_LIFECYCLE_STATUS.CONFIRMED,
                reservationExpiresAt: null,
              },
            });

            await this.appendQuotationLog({
              tx,
              orderId: order.id,
              event: ORDER_QUOTATION_LOG_EVENT.PAYMENT_CONFIRMED,
              previousTotal: Number(order.amount),
              updatedTotal: Number(order.amount),
              actorUserId: data.actorUserId,
              actorRole: data.actorRole || "SYSTEM",
              message: "Payment confirmed at accepted quotation price.",
              lineItems: this.buildQuotationLineItems(order.orderItems),
            });
          }
        } else {
          // Generic order status update (covers DELIVERED and any future statuses).
          const statusUpdateData: Record<string, unknown> = { status: effectiveStatus };

          // Pay-later DELIVERED: stamp the 30-day payment due date onto the order.
          // creditTermDays defaults to 30 for all LEGACY dealers (set at account creation).
          if (
            effectiveStatus === ORDER_LIFECYCLE_STATUS.DELIVERED &&
            order.isPayLater
          ) {
            if (order.reservation?.status === RESERVATION_STATUS.ACTIVE) {
              await this.finalizePayLaterOrder({
                tx,
                order,
                reason: "DELIVERED",
              });
            } else if (
              this.normalizeStatusValue(String(order.status)) ===
              ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT
            ) {
              throw new AppError(
                409,
                "Pay-later orders must have an active reservation before delivery."
              );
            }

            const CREDIT_TERM_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
            statusUpdateData.paymentDueDate = new Date(now.getTime() + CREDIT_TERM_MS);
          }

          await tx.order.update({
            where: { id: order.id },
            data: statusUpdateData as any,
          });
        }

        const updatedTransaction = await tx.transaction.update({
          where: { id },
          data: {
            status: statusToPrismaEnum[effectiveStatus],
          },
          select: {
            id: true,
          },
        });

      return {
        transactionId: updatedTransaction.id,
        previousStatus,
        effectiveStatus,
        promotedOrderIds,
      };
    }, {
      maxWait: TransactionRepository.UPDATE_TRANSACTION_MAX_WAIT_MS,
      timeout: TransactionRepository.UPDATE_TRANSACTION_TIMEOUT_MS,
    });

    const transaction = await this.findById(committedUpdate.transactionId);
    if (!transaction) {
      throw new AppError(404, "Transaction not found after update");
    }

    return {
      transaction,
      previousStatus: committedUpdate.previousStatus,
      effectiveStatus: committedUpdate.effectiveStatus,
      promotedOrderIds: committedUpdate.promotedOrderIds,
    };
  }

  async deleteTransaction(id: string) {
    return prisma.transaction.delete({
      where: { id },
    });
  }
}
