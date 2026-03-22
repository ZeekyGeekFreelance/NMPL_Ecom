import prisma from "@/infra/database/database.config";
import {
  ADDRESS_TYPE,
  CART_STATUS,
  DELIVERY_MODE,
  ORDER_QUOTATION_LOG_EVENT,
  ORDER_CUSTOMER_ROLE,
  PAYMENT_STATUS,
  TRANSACTION_STATUS,
  type Prisma,
} from "@prisma/client";
import AppError from "@/shared/errors/AppError";
import { toOrderReference } from "@/shared/utils/accountReference";
import { ORDER_LIFECYCLE_STATUS } from "@/shared/utils/orderLifecycle";

export class OrderRepository {
  private static readonly ORDER_CREATE_TRANSACTION_TIMEOUT_MS = 20_000;
  private static readonly ORDER_CREATE_TRANSACTION_MAX_WAIT_MS = 5_000;

  private extractReferenceChecksum(reference: string): string | null {
    const normalizedReference = (reference || "").trim().toUpperCase();
    const [, token = ""] = normalizedReference.split("-");
    const cleanToken = token.replace(/[^A-Z0-9]/g, "");

    if (cleanToken.length < 2) {
      return null;
    }

    return cleanToken.slice(-2).toLowerCase();
  }

  async findAllOrders(options?: { skip?: number; take?: number }) {
    const skip = options?.skip ?? 0;
    const take = Math.min(options?.take ?? 50, 200);
    return prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      skip,
      take,
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
        quotationLogs: {
          orderBy: {
            createdAt: "desc",
          },
        },
        reservation: true,
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

  async findOrdersByUserId(userId: string, options?: { skip?: number; take?: number }) {
    const skip = options?.skip ?? 0;
    const take = Math.min(options?.take ?? 20, 100);
    return prisma.order.findMany({
      where: { userId },
      orderBy: { orderDate: "desc" },
      skip,
      take,
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
        payment: true,
        paymentTransactions: {
          where: { status: "CONFIRMED" },
          select: {
            id: true,
            status: true,
            amount: true,
            paymentReceivedAt: true,
          },
        },
        quotationLogs: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
  }

  async findOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: { include: { variant: { include: { product: true } } } },
        payment: true,
        paymentTransactions: {
          orderBy: { paymentReceivedAt: "desc" },
          select: {
            id: true,
            status: true,
            amount: true,
            paymentMethod: true,
            paymentSource: true,
            paymentReceivedAt: true,
            utrNumber: true,
            chequeNumber: true,
            bankName: true,
            gatewayPaymentId: true,
            notes: true,
          },
        },
        address: true,
        transaction: true,
        reservation: true,
        quotationLogs: {
          orderBy: {
            createdAt: "desc",
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
    customerRoleSnapshot: ORDER_CUSTOMER_ROLE;
    cartId?: string;
    orderItems: { variantId: string; quantity: number; price: number }[];
    pricing: {
      subtotalAmount: number;
      deliveryCharge: number;
      deliveryMode: DELIVERY_MODE;
      deliveryLabel: string;
      serviceArea?: string | null;
    };
    addressSnapshot: {
      sourceAddressId?: string;
      addressType: ADDRESS_TYPE;
      fullName: string;
      phoneNumber: string;
      line1: string;
      line2?: string | null;
      landmark?: string | null;
      city: string;
      state: string;
      country: string;
      pincode: string;
    };
    /**
     * True when the ordering user is a LEGACY pay-later dealer.
     * Set at order placement time so the flag is immutable for the order's lifetime.
     */
    isPayLater?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const computedSubtotal = data.orderItems.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );
      const normalizedSubtotal = Number(computedSubtotal.toFixed(2));
      const subtotalFromPricing = Number(data.pricing.subtotalAmount.toFixed(2));
      if (Math.abs(normalizedSubtotal - subtotalFromPricing) > 0.01) {
        throw new AppError(
          409,
          "Pricing mismatch detected. Please refresh checkout summary and retry."
        );
      }

      const deliveryCharge = Number(data.pricing.deliveryCharge.toFixed(2));
      const computedAmount = Number((normalizedSubtotal + deliveryCharge).toFixed(2));
      const uniqueVariantIds = [...new Set(data.orderItems.map((item) => item.variantId))];

      // Validate quantities and variant existence, but do not deduct stock at
      // placement time. Use one batched lookup instead of N round-trips.
      for (const item of data.orderItems) {
        if (item.quantity <= 0) {
          throw new AppError(400, "Order item quantity must be greater than 0");
        }
      }

      const variants = await tx.productVariant.findMany({
        where: {
          id: {
            in: uniqueVariantIds,
          },
        },
        select: {
          id: true,
          sku: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      const variantById = new Map(variants.map((variant) => [variant.id, variant]));
      const missingVariantIds = uniqueVariantIds.filter(
        (variantId) => !variantById.has(variantId)
      );

      if (missingVariantIds.length > 0) {
        throw new AppError(404, `Variant not found: ${missingVariantIds[0]}`);
      }

      // Create order in verification queue. Stock is reserved only after admin verification.
      const order = await tx.order.create({
        data: {
          userId: data.userId,
          customerRoleSnapshot: data.customerRoleSnapshot,
          subtotalAmount: normalizedSubtotal,
          deliveryCharge,
          deliveryMode: data.pricing.deliveryMode,
          amount: computedAmount,
          status: ORDER_LIFECYCLE_STATUS.PENDING_VERIFICATION,
          isPayLater: data.isPayLater ?? false,
          address: {
            create: {
              sourceAddressId: data.addressSnapshot.sourceAddressId,
              addressType: data.addressSnapshot.addressType,
              fullName: data.addressSnapshot.fullName,
              phoneNumber: data.addressSnapshot.phoneNumber,
              line1: data.addressSnapshot.line1,
              line2: data.addressSnapshot.line2,
              landmark: data.addressSnapshot.landmark,
              city: data.addressSnapshot.city,
              state: data.addressSnapshot.state,
              country: data.addressSnapshot.country,
              pincode: data.addressSnapshot.pincode,
              deliveryMode: data.pricing.deliveryMode,
              deliveryCharge,
              deliveryLabel: data.pricing.deliveryLabel,
              serviceArea: data.pricing.serviceArea ?? null,
            },
          },
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
              method: "QUOTATION_PENDING",
              amount: computedAmount,
              status: PAYMENT_STATUS.PENDING,
            },
          },
          transaction: {
            create: {
              status: TRANSACTION_STATUS.PENDING_VERIFICATION,
            },
          },
        },
        select: {
          id: true,
          status: true,
          subtotalAmount: true,
          deliveryCharge: true,
          deliveryMode: true,
          amount: true,
        },
      });

      const initialLineItems = data.orderItems.map((item) => {
        const variant = variantById.get(item.variantId);

        return {
          orderItemId: null,
          variantId: item.variantId,
          sku: variant?.sku || null,
          productName: variant?.product?.name || "Product",
          quantity: item.quantity,
          unitPrice: Number(item.price),
          lineTotal: Number((item.quantity * item.price).toFixed(2)),
        };
      });

      await tx.orderQuotationLog.create({
        data: {
          orderId: order.id,
          event: ORDER_QUOTATION_LOG_EVENT.ORIGINAL_ORDER,
          previousTotal: Number(computedAmount.toFixed(2)),
          updatedTotal: Number(computedAmount.toFixed(2)),
          currency: "INR",
          actorUserId: data.userId,
          actorRole: data.customerRoleSnapshot,
          message: "Initial order amount submitted for verification.",
          lineItems: initialLineItems as Prisma.InputJsonValue,
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
    }, {
      maxWait: OrderRepository.ORDER_CREATE_TRANSACTION_MAX_WAIT_MS,
      timeout: OrderRepository.ORDER_CREATE_TRANSACTION_TIMEOUT_MS,
    });
  }
}
