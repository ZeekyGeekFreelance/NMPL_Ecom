import { CART_STATUS, Prisma } from "@prisma/client";
import prisma, { type TransactionClient } from "@/infra/database/database.config";
import { config } from "@/config";

const isDevelopment = config.isDevelopment;
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export class CartRepository {
  async getCartByUserId(userId: string) {
    debugLog("[CART REPOSITORY] getCartByUserId called", { userId });

    const cart = await prisma.cart.findFirst({
      where: { userId, status: CART_STATUS.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        cartItems: { include: { variant: { include: { product: true } } } },
      },
    });

    debugLog("[CART REPOSITORY] Cart found by userId", {
      cartId: cart?.id,
      itemCount: cart?.cartItems?.length || 0,
    });

    return cart;
  }

  async getCartBySessionId(sessionId: string) {
    debugLog("[CART REPOSITORY] getCartBySessionId called", { sessionId });

    const cart = await prisma.cart.findFirst({
      where: { sessionId, status: CART_STATUS.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        cartItems: { include: { variant: { include: { product: true } } } },
      },
    });

    debugLog("[CART REPOSITORY] Cart found by sessionId", {
      cartId: cart?.id,
      itemCount: cart?.cartItems?.length || 0,
    });

    return cart;
  }

  async createCart(data: { userId?: string; sessionId?: string }) {
    debugLog("[CART REPOSITORY] createCart called", { data });

    const cart = await prisma.cart.create({
      data,
      include: {
        cartItems: { include: { variant: { include: { product: true } } } },
      },
    });

    debugLog("[CART REPOSITORY] Cart created", { cartId: cart.id });
    return cart;
  }

  async findCartItem(cartId: string, variantId: string) {
    debugLog("[CART REPOSITORY] findCartItem called", { cartId, variantId });

    const item = await prisma.cartItem.findFirst({
      where: { cartId, variantId },
    });

    debugLog("[CART REPOSITORY] Cart item found", { itemId: item?.id || null });
    return item;
  }

  async findCartItemById(itemId: string) {
    return prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: {
          select: {
            id: true,
            userId: true,
            sessionId: true,
          },
        },
      },
    });
  }

  async addItemToCart(data: {
    cartId: string;
    variantId: string;
    quantity: number;
  }) {
    debugLog("[CART REPOSITORY] addItemToCart called", { data });

    try {
      const variant = await prisma.productVariant.findUnique({
        where: { id: data.variantId },
        select: { id: true },
      });

      if (!variant) {
        debugLog("[CART REPOSITORY] ERROR: Variant not found", {
          variantId: data.variantId,
        });
        throw new Error("Variant not found");
      }

      const item = await prisma.cartItem.create({ data });
      debugLog("[CART REPOSITORY] Cart item created", { itemId: item.id });

      return item;
    } catch (error) {
      debugLog("[CART REPOSITORY] Error in addItemToCart", { error });
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Item already exists in cart");
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new Error("Variant not found");
      }

      throw error;
    }
  }

  async updateCartItemQuantity(itemId: string, quantity: number) {
    debugLog("[CART REPOSITORY] updateCartItemQuantity called", {
      itemId,
      quantity,
    });

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });

    if (!cartItem) {
      debugLog("[CART REPOSITORY] ERROR: Cart item not found", { itemId });
      throw new Error("Cart item not found");
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
    debugLog("[CART REPOSITORY] Cart item updated", { itemId: updatedItem.id });

    return updatedItem;
  }

  async removeCartItem(itemId: string) {
    debugLog("[CART REPOSITORY] removeCartItem called", { itemId });

    const result = await prisma.cartItem.delete({ where: { id: itemId } });
    debugLog("[CART REPOSITORY] Cart item removed", { itemId: result.id });

    return result;
  }

  async mergeCarts(sessionCartId: string, userCartId: string) {
    debugLog("[CART REPOSITORY] mergeCarts called", {
      sessionCartId,
      userCartId,
    });

    const sessionItems = await prisma.cartItem.findMany({
      where: { cartId: sessionCartId },
    });

    for (const item of sessionItems) {
      const existingItem = await prisma.cartItem.findFirst({
        where: { cartId: userCartId, variantId: item.variantId },
      });

      if (existingItem) {
        const newQuantity = existingItem.quantity + item.quantity;
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: userCartId,
            variantId: item.variantId,
            quantity: item.quantity,
          },
        });
      }
    }

    await prisma.cart.delete({ where: { id: sessionCartId } });
    debugLog("[CART REPOSITORY] Session cart deleted", { sessionCartId });
  }

  async deleteCart(id: string) {
    debugLog("[CART REPOSITORY] deleteCart called", { cartId: id });

    const result = await prisma.cart.delete({ where: { id } });
    debugLog("[CART REPOSITORY] Cart deleted", { cartId: result.id });

    return result;
  }

  async clearCart(userId: string, tx?: TransactionClient) {
    debugLog("[CART REPOSITORY] clearCart called", { userId });

    const client = tx || prisma;
    const activeCarts = await client.cart.findMany({
      where: { userId, status: CART_STATUS.ACTIVE },
      select: { id: true },
    });

    const activeCartIds = activeCarts.map((cart) => cart.id);
    if (!activeCartIds.length) {
      debugLog("[CART REPOSITORY] No active cart found to clear", { userId });
      return;
    }

    const result = await client.cartItem.deleteMany({
      where: { cartId: { in: activeCartIds } },
    });
    debugLog("[CART REPOSITORY] Active cart items cleared", {
      deletedCount: result.count,
    });

    return result;
  }
}
