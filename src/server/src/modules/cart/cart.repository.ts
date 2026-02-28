import { CART_STATUS, Prisma } from "@prisma/client";
import prisma from "@/infra/database/database.config";

const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export class CartRepository {
  async getCartByUserId(userId: string) {
    debugLog("🔍 [CART REPOSITORY] getCartByUserId called");
    debugLog("🔍 [CART REPOSITORY] userId:", userId);

    const cart = await prisma.cart.findFirst({
      where: { userId, status: CART_STATUS.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        cartItems: { include: { variant: { include: { product: true } } } },
      },
    });

    debugLog("🔍 [CART REPOSITORY] Cart found by userId:", cart);
    debugLog("🔍 [CART REPOSITORY] Cart ID:", cart?.id);
    debugLog(
      "🔍 [CART REPOSITORY] Cart items count:",
      cart?.cartItems?.length
    );

    return cart;
  }

  async getCartBySessionId(sessionId: string) {
    debugLog("🔍 [CART REPOSITORY] getCartBySessionId called");
    debugLog("🔍 [CART REPOSITORY] sessionId:", sessionId);

    const cart = await prisma.cart.findFirst({
      where: { sessionId, status: CART_STATUS.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        cartItems: { include: { variant: { include: { product: true } } } },
      },
    });

    debugLog("🔍 [CART REPOSITORY] Cart found by sessionId:", cart);
    debugLog("🔍 [CART REPOSITORY] Cart ID:", cart?.id);
    debugLog(
      "🔍 [CART REPOSITORY] Cart items count:",
      cart?.cartItems?.length
    );

    return cart;
  }

  async createCart(data: { userId?: string; sessionId?: string }) {
    debugLog("🔍 [CART REPOSITORY] createCart called");
    debugLog("🔍 [CART REPOSITORY] data:", data);

    const cart = await prisma.cart.create({
      data,
      include: {
        cartItems: { include: { variant: { include: { product: true } } } },
      },
    });

    debugLog("🔍 [CART REPOSITORY] Cart created:", cart);
    debugLog("🔍 [CART REPOSITORY] Cart ID:", cart.id);

    return cart;
  }

  async findCartItem(cartId: string, variantId: string) {
    debugLog("🔍 [CART REPOSITORY] findCartItem called");
    debugLog("🔍 [CART REPOSITORY] cartId:", cartId);
    debugLog("🔍 [CART REPOSITORY] variantId:", variantId);

    const item = await prisma.cartItem.findFirst({
      where: { cartId, variantId },
    });

    debugLog("🔍 [CART REPOSITORY] Cart item found:", item);

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
    debugLog("🔍 [CART REPOSITORY] addItemToCart called");
    debugLog("🔍 [CART REPOSITORY] data:", data);

    try {
      // Validate stock
      const variant = await prisma.productVariant.findUnique({
        where: { id: data.variantId },
        select: { stock: true, reservedStock: true },
      });
      debugLog(
        "🔍 [CART REPOSITORY] Variant found for stock check:",
        variant
      );

      if (!variant) {
        debugLog("🔍 [CART REPOSITORY] ERROR: Variant not found");
        throw new Error("Variant not found");
      }
      const availableStock = variant.stock - (variant.reservedStock || 0);
      if (availableStock < data.quantity) {
        debugLog("🔍 [CART REPOSITORY] ERROR: Insufficient stock");
        throw new Error(
          `Insufficient stock: only ${Math.max(availableStock, 0)} available`
        );
      }

      const item = await prisma.cartItem.create({ data });
      debugLog("🔍 [CART REPOSITORY] Cart item created:", item);

      return item;
    } catch (error) {
      debugLog("🔍 [CART REPOSITORY] Error in addItemToCart:", error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        debugLog("🔍 [CART REPOSITORY] ERROR: Item already exists in cart");
        throw new Error("Item already exists in cart");
      }
      throw error;
    }
  }

  async updateCartItemQuantity(itemId: string, quantity: number) {
    debugLog("🔍 [CART REPOSITORY] updateCartItemQuantity called");
    debugLog("🔍 [CART REPOSITORY] itemId:", itemId);
    debugLog("🔍 [CART REPOSITORY] quantity:", quantity);

    // Validate stock
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { variant: true },
    });
    debugLog("🔍 [CART REPOSITORY] Cart item found for update:", cartItem);

    if (!cartItem) {
      debugLog("🔍 [CART REPOSITORY] ERROR: Cart item not found");
      throw new Error("Cart item not found");
    }
    const availableStock =
      cartItem.variant.stock - (cartItem.variant.reservedStock || 0);
    if (availableStock < quantity) {
      debugLog("🔍 [CART REPOSITORY] ERROR: Insufficient stock for update");
      throw new Error(
        `Insufficient stock: only ${Math.max(availableStock, 0)} available`
      );
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
    debugLog("🔍 [CART REPOSITORY] Cart item updated:", updatedItem);

    return updatedItem;
  }

  async removeCartItem(itemId: string) {
    debugLog("🔍 [CART REPOSITORY] removeCartItem called");
    debugLog("🔍 [CART REPOSITORY] itemId:", itemId);

    const result = await prisma.cartItem.delete({ where: { id: itemId } });
    debugLog("🔍 [CART REPOSITORY] Cart item removed:", result);

    return result;
  }

  async mergeCarts(sessionCartId: string, userCartId: string) {
    debugLog("🔍 [CART REPOSITORY] mergeCarts called");
    debugLog("🔍 [CART REPOSITORY] sessionCartId:", sessionCartId);
    debugLog("🔍 [CART REPOSITORY] userCartId:", userCartId);

    const sessionItems = await prisma.cartItem.findMany({
      where: { cartId: sessionCartId },
      include: { variant: true },
    });
    debugLog("🔍 [CART REPOSITORY] Session items found:", sessionItems);

    for (const item of sessionItems) {
      const existingItem = await prisma.cartItem.findFirst({
        where: { cartId: userCartId, variantId: item.variantId },
      });
      debugLog(
        "🔍 [CART REPOSITORY] Existing item in user cart:",
        existingItem
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + item.quantity;
        debugLog("🔍 [CART REPOSITORY] Merging quantities:", newQuantity);

        const availableStock =
          item.variant.stock - (item.variant.reservedStock || 0);
        if (availableStock < newQuantity) {
          debugLog(
            "🔍 [CART REPOSITORY] ERROR: Insufficient stock after merge"
          );
          throw new Error(
            `Insufficient stock for variant ${item.variantId}: only ${Math.max(
              availableStock,
              0
            )} available`
          );
        }
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        });
        debugLog("🔍 [CART REPOSITORY] Item quantity updated in user cart");
      } else {
        debugLog("🔍 [CART REPOSITORY] Adding new item to user cart");
        const availableStock =
          item.variant.stock - (item.variant.reservedStock || 0);
        if (availableStock < item.quantity) {
          debugLog(
            "🔍 [CART REPOSITORY] ERROR: Insufficient stock for new item"
          );
          throw new Error(
            `Insufficient stock for variant ${item.variantId}: only ${Math.max(
              availableStock,
              0
            )} available`
          );
        }
        await prisma.cartItem.create({
          data: {
            cartId: userCartId,
            variantId: item.variantId,
            quantity: item.quantity,
          },
        });
        debugLog("🔍 [CART REPOSITORY] New item added to user cart");
      }
    }
    await prisma.cart.delete({ where: { id: sessionCartId } });
    debugLog("🔍 [CART REPOSITORY] Session cart deleted");
  }

  async deleteCart(id: string) {
    debugLog("🔍 [CART REPOSITORY] deleteCart called");
    debugLog("🔍 [CART REPOSITORY] cartId:", id);

    const result = await prisma.cart.delete({ where: { id } });
    debugLog("🔍 [CART REPOSITORY] Cart deleted:", result);

    return result;
  }

  async clearCart(userId: string, tx?: Prisma.TransactionClient) {
    debugLog("[CART REPOSITORY] clearCart called");
    debugLog("[CART REPOSITORY] userId:", userId);

    const client = tx || prisma;
    const activeCarts = await client.cart.findMany({
      where: { userId, status: CART_STATUS.ACTIVE },
      select: { id: true },
    });

    const activeCartIds = activeCarts.map((cart) => cart.id);
    debugLog("[CART REPOSITORY] Active cart IDs to clear:", activeCartIds);

    if (!activeCartIds.length) {
      debugLog("[CART REPOSITORY] No active cart found to clear");
      return;
    }

    const result = await client.cartItem.deleteMany({
      where: { cartId: { in: activeCartIds } },
    });
    debugLog("[CART REPOSITORY] Active cart items cleared:", result);

    return result;
  }
}





