import prisma from "@/lib/db";
import { AppError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";
import { config } from "@/lib/config";
import { sendEmail } from "@/lib/email/sender";

export async function getCheckoutSummary(
  userId: string,
  addressId?: string,
  deliveryMode: "PICKUP" | "DELIVERY" = "DELIVERY"
) {
  const cart = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      cartItems: {
        include: {
          variant: {
            include: {
              product: {
                include: { gst: true },
              },
              dealerPriceMappings: { where: { dealerId: userId } },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.cartItems.length === 0) throw new AppError(400, "Cart is empty");

  let address: Awaited<ReturnType<typeof prisma.address.findFirst>> | null = null;
  let deliveryCharge = 0;
  let deliveryLabel = "Free Delivery";

  if (deliveryMode === "DELIVERY") {
    if (!addressId) throw new AppError(400, "Address required for delivery");
    address = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new AppError(404, "Address not found");

    // Look up delivery rate by pincode
    const rate = await prisma.deliveryRate.findUnique({ where: { pincode: address.pincode } });
    if (rate) {
      deliveryCharge = rate.charge;
      deliveryLabel = `Delivery to ${address.city}`;
    } else {
      // Fallback: state-level rate
      const stateRate = await prisma.deliveryStateRate.findUnique({
        where: { state: address.state.toUpperCase() },
      });
      deliveryCharge = stateRate?.charge ?? config.delivery.bangaloreCharge;
      deliveryLabel = `Delivery to ${address.state}`;
    }
  } else {
    deliveryLabel = `Pickup at ${config.delivery.pickupStoreName}`;
  }

  const lineItems = cart.cartItems.map((item) => {
    const dealerPrice = item.variant.dealerPriceMappings[0]?.customPrice;
    const unitPrice = dealerPrice ?? item.variant.price;
    const gstRate = item.variant.product.gst?.rate ?? 0;
    const taxAmount = unitPrice * item.quantity * (gstRate / 100);
    const lineTotal = unitPrice * item.quantity + taxAmount;
    return {
      variantId: item.variantId,
      sku: item.variant.sku,
      productName: item.variant.product.name,
      quantity: item.quantity,
      unitPrice,
      gstRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
    };
  });

  const subtotal = lineItems.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const totalTax = lineItems.reduce((sum, l) => sum + l.taxAmount, 0);
  const total = subtotal + totalTax + deliveryCharge;

  return {
    cartId: cart.id,
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    deliveryCharge,
    deliveryLabel,
    total: Math.round(total * 100) / 100,
    address,
    deliveryMode,
  };
}

export async function placeOrder(
  userId: string,
  data: {
    cartId: string;
    addressId?: string;
    deliveryMode: "PICKUP" | "DELIVERY";
    expectedTotal?: number;
  }
) {
  const summary = await getCheckoutSummary(userId, data.addressId, data.deliveryMode);

  if (data.expectedTotal !== undefined) {
    const diff = Math.abs(summary.total - data.expectedTotal);
    if (diff > 0.01) throw new AppError(409, `Price changed. Expected ${data.expectedTotal}, got ${summary.total}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { dealerProfile: true },
  });
  if (!user) throw new AppError(404, "User not found");

  const orderId = uuidv4();

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        id: orderId,
        userId,
        amount: summary.total,
        subtotalAmount: summary.subtotal,
        deliveryCharge: summary.deliveryCharge,
        deliveryMode: data.deliveryMode,
        customerRoleSnapshot: user.role === "DEALER" ? "DEALER" : "USER",
        status: "PENDING_VERIFICATION",
        orderItems: {
          create: summary.lineItems.map((item) => ({
            id: uuidv4(),
            productId: (item as any).productId ?? item.variantId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.unitPrice,
            gstRateAtPurchase: item.gstRate,
            taxAmount: item.taxAmount,
            total: item.lineTotal,
          })),
        },
      },
      include: { orderItems: { include: { variant: { include: { product: true } } } } },
    });

    // Snapshot address
    if (data.deliveryMode === "DELIVERY" && summary.address) {
      const addr = summary.address;
      await tx.orderAddressSnapshot.create({
        data: {
          id: uuidv4(),
          orderId,
          sourceAddressId: addr.id,
          addressType: addr.type,
          fullName: addr.fullName,
          phoneNumber: addr.phoneNumber,
          line1: addr.line1,
          line2: addr.line2 ?? null,
          landmark: addr.landmark ?? null,
          city: addr.city,
          state: addr.state,
          country: addr.country,
          pincode: addr.pincode,
          deliveryMode: "DELIVERY",
          deliveryCharge: summary.deliveryCharge,
          deliveryLabel: summary.deliveryLabel,
        },
      });
    } else {
      await tx.orderAddressSnapshot.create({
        data: {
          id: uuidv4(),
          orderId,
          addressType: "WAREHOUSE",
          fullName: config.delivery.pickupStoreName,
          phoneNumber: config.delivery.pickupStorePhone,
          line1: config.delivery.pickupStoreName,
          city: "Bangalore",
          state: "Karnataka",
          country: "India",
          pincode: "560001",
          deliveryMode: "PICKUP",
          deliveryCharge: 0,
          deliveryLabel: summary.deliveryLabel,
        },
      });
    }

    // Create quotation log
    await tx.orderQuotationLog.create({
      data: {
        id: uuidv4(),
        orderId,
        event: "ORIGINAL_ORDER",
        updatedTotal: summary.total,
        actorUserId: userId,
        actorRole: user.role,
        lineItems: summary.lineItems as any,
      },
    });

    // Create transaction record
    await tx.transaction.create({
      data: { id: uuidv4(), orderId, status: "PENDING_VERIFICATION" },
    });

    // Mark cart as converted
    await tx.cart.update({
      where: { id: data.cartId },
      data: { status: "CONVERTED" },
    });

    return newOrder;
  });

  // Send confirmation email (non-blocking)
  sendEmail({
    to: user.email,
    subject: `Order placed — ${config.platformName}`,
    html: `<p>Hi ${user.name}, your order has been placed and is pending verification. Order ID: ${orderId.slice(0, 8).toUpperCase()}</p>`,
  }).catch(console.error);

  return order;
}

export async function getUserOrders(userId: string, page = 1, limit = 10) {
  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        orderItems: { include: { variant: { include: { product: { select: { name: true, slug: true } } } } } },
        address: true,
        transaction: true,
      },
    }),
  ]);
  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getOrderById(orderId: string, userId?: string) {
  const where: any = { id: orderId };
  if (userId) where.userId = userId;

  const order = await prisma.order.findFirst({
    where,
    include: {
      orderItems: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, slug: true } },
              attributes: { include: { attribute: { select: { name: true } }, value: { select: { value: true } } } },
            },
          },
        },
      },
      address: true,
      transaction: true,
      quotationLogs: { orderBy: { createdAt: "asc" } },
      payment: true,
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
    },
  });

  if (!order) throw new AppError(404, "Order not found");
  return order;
}
