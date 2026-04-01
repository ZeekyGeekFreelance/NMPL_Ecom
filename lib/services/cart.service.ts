import prisma from "@/lib/db";
import { AppError } from "@/lib/api";

const CART_INCLUDE = {
  cartItems: {
    include: {
      variant: {
        include: {
          product: {
            select: { id: true, name: true, slug: true },
          },
          attributes: {
            include: {
              attribute: { select: { name: true } },
              value: { select: { value: true } },
            },
          },
        },
      },
    },
  },
} as const;

async function applyDealerPricing(cart: any, userId: string) {
  if (!cart?.cartItems?.length) return cart;
  const variantIds = cart.cartItems.map((i: any) => i.variantId);
  const dealerPrices = await prisma.dealerPriceMapping.findMany({
    where: { dealerId: userId, variantId: { in: variantIds } },
  });
  const priceMap = new Map(dealerPrices.map((dp) => [dp.variantId, dp.customPrice]));
  cart.cartItems = cart.cartItems.map((item: any) => ({
    ...item,
    variant: {
      ...item.variant,
      price: priceMap.get(item.variantId) ?? item.variant.price,
    },
  }));
  return cart;
}

export async function getOrCreateCart(userId: string) {
  let cart = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: CART_INCLUDE,
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId, status: "ACTIVE" },
      include: CART_INCLUDE,
    });
  }
  return applyDealerPricing(cart, userId);
}

export async function getCartCount(userId: string): Promise<number> {
  const result = await prisma.cartItem.aggregate({
    where: { cart: { userId, status: "ACTIVE" } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function addToCart(userId: string, variantId: string, quantity = 1) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, stock: true, reservedStock: true },
  });
  if (!variant) throw new AppError(404, "Variant not found");

  const available = variant.stock - variant.reservedStock;
  if (available < quantity) throw new AppError(400, "Not enough stock");

  const cart = await getOrCreateCart(userId);

  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, variantId },
  });

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > available) throw new AppError(400, "Not enough stock");
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId, quantity },
    });
  }

  return getOrCreateCart(userId);
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    include: { variant: true },
  });
  if (!item) throw new AppError(404, "Cart item not found");

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    const available = item.variant.stock - item.variant.reservedStock;
    if (quantity > available) throw new AppError(400, "Not enough stock");
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }

  return getOrCreateCart(userId);
}

export async function removeCartItem(userId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
  });
  if (!item) throw new AppError(404, "Cart item not found");
  await prisma.cartItem.delete({ where: { id: itemId } });
  return getOrCreateCart(userId);
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}
