import prisma from "@/infra/database/database.config";
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

type OrderItemSnapshot = {
  id: string;
  variantId: string;
  quantity: number;
  price: number;
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

export class TransactionRepository {
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
    if (!params) {
      return prisma.transaction.findMany({
        orderBy: {
          transactionDate: "desc",
        },
      });
    }

    const { skip = 0, take = 16 } = params;

    return prisma.transaction.findMany({
      skip,
      take,
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
            reservation: true,
            shipment: true,
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

  async findExpiredAwaitingPaymentTransactionIds(now: Date): Promise<string[]> {
    const rows = await prisma.transaction.findMany({
      where: {
        status: TRANSACTION_STATUS.AWAITING_PAYMENT,
        order: {
          reservation: {
            is: {
              status: RESERVATION_STATUS.ACTIVE,
              expiresAt: {
                lte: now,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        transactionDate: "asc",
      },
    });

    return rows.map((row) => row.id);
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
    tx: Prisma.TransactionClient,
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
    tx: Prisma.TransactionClient,
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
    tx: Prisma.TransactionClient;
    order: OrderSnapshot;
    quotationItems: TransactionQuotationItemUpdate[];
  }): Promise<void> {
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

    let quotedSubtotal = 0;

    for (const item of order.orderItems) {
      const update = sanitizedUpdates.get(item.id)!;
      quotedSubtotal += update.quantity * update.price;

      await tx.orderItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity: update.quantity,
          price: update.price,
        },
      });
    }

    const normalizedSubtotal = Number(quotedSubtotal.toFixed(2));
    const normalizedDeliveryCharge = Number(order.deliveryCharge || 0);
    const finalAmount = Number(
      (normalizedSubtotal + normalizedDeliveryCharge).toFixed(2)
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
    tx: Prisma.TransactionClient;
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
    tx: Prisma.TransactionClient,
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
    tx: Prisma.TransactionClient;
    orderId: string;
    expiresAt: Date;
  }) {
    const existing = await params.tx.orderReservation.findUnique({
      where: {
        orderId: params.orderId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await params.tx.orderReservation.update({
        where: {
          id: existing.id,
        },
        data: {
          status: RESERVATION_STATUS.ACTIVE,
          expiresAt: params.expiresAt,
          releasedAt: null,
          consumedAt: null,
          reason: null,
        },
      });
      return;
    }

    await params.tx.orderReservation.create({
      data: {
        orderId: params.orderId,
        status: RESERVATION_STATUS.ACTIVE,
        expiresAt: params.expiresAt,
      },
    });
  }

  private async releaseReservationStock(params: {
    tx: Prisma.TransactionClient;
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
    tx: Prisma.TransactionClient;
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

  private async ensurePaymentRecord(params: {
    tx: Prisma.TransactionClient;
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
    tx: Prisma.TransactionClient;
    variantIds: string[];
    reservationExpiryHours: number;
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
      const expiresAt = new Date(
        now.getTime() + params.reservationExpiryHours * 60 * 60 * 1000
      );

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
          reservationExpiresAt: expiresAt,
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
      reservationExpiryHours: number;
      quotationItems?: TransactionQuotationItemUpdate[];
      actorUserId?: string;
      actorRole?: string;
    }
  ): Promise<UpdateTransactionResult> {
    return prisma.$transaction(async (tx) => {
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
        await this.applyQuotationAdjustments({
          tx,
          order,
          quotationItems: data.quotationItems,
        });
        order = await this.getOrderSnapshot(tx, order.id);
      }

      let effectiveStatus = data.status;
      let promotedOrderIds: string[] = [];
      const now = new Date();

      if (effectiveStatus === ORDER_LIFECYCLE_STATUS.AWAITING_PAYMENT) {
        const reserved = await this.reserveStockForOrder(tx, order.orderItems);

        if (reserved) {
          const expiresAt = new Date(
            now.getTime() + data.reservationExpiryHours * 60 * 60 * 1000
          );
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
              reservationExpiresAt: expiresAt,
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
                "Admin revised quotation and reserved stock. Awaiting customer payment.",
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
              ? "Quotation expired before payment. Reservation released."
              : data.actorRole
              ? `Quotation rejected by ${data.actorRole}. Reservation released.`
              : "Quotation rejected. Reservation released.",
          lineItems: this.buildQuotationLineItems(order.orderItems),
        });

        promotedOrderIds = await this.promoteWaitlistedOrders({
          tx,
          variantIds: affectedVariantIds,
          reservationExpiryHours: data.reservationExpiryHours,
        });
      } else if (effectiveStatus === ORDER_LIFECYCLE_STATUS.CONFIRMED) {
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
      } else {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: effectiveStatus,
          },
        });
      }

      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: {
          status: statusToPrismaEnum[effectiveStatus],
        },
        include: {
          order: {
            include: {
              payment: true,
              reservation: true,
              address: true,
              quotationLogs: {
                orderBy: {
                  createdAt: "desc",
                },
              },
              orderItems: {
                include: {
                  variant: {
                    include: {
                      product: {
                        select: {
                          id: true,
                          name: true,
                          slug: true,
                        },
                      },
                    },
                  },
                },
              },
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
          },
        },
      });

      return {
        transaction: updatedTransaction,
        previousStatus,
        effectiveStatus,
        promotedOrderIds,
      };
    });
  }

  async deleteTransaction(id: string) {
    return prisma.transaction.delete({
      where: { id },
    });
  }
}
