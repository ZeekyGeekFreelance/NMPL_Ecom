import AppError from "@/shared/errors/AppError";
import { CartRepository } from "./cart.repository";
import prisma from "@/infra/database/database.config";
import { CART_EVENT } from "@prisma/client";
import { getDealerPriceMap } from "@/shared/utils/dealerAccess";
import { config } from "@/config";

const isDevelopment = config.isDevelopment;
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export class CartService {
  constructor(private cartRepository: CartRepository) {}

  private async applyDealerPricingToCart(cart: any, userId?: string) {
    if (!userId || !cart?.cartItems?.length) {
      return cart;
    }

    const variantIds = cart.cartItems.map((item: any) => item.variantId);
    const dealerPriceMap = await getDealerPriceMap(prisma, userId, variantIds);

    if (!dealerPriceMap.size) {
      return cart;
    }

    cart.cartItems = cart.cartItems.map((item: any) => ({
      ...item,
      variant: {
        ...item.variant,
        price: dealerPriceMap.get(item.variantId) ?? item.variant.price,
      },
    }));

    return cart;
  }

  async getOrCreateCart(userId?: string) {
    debugLog("[CART SERVICE] getOrCreateCart called", { userId });

    if (!userId) {
      throw new AppError(401, "Authentication required for cart access");
    }

    let cart = await this.cartRepository.getCartByUserId(userId);
    if (!cart) {
      cart = await this.cartRepository.createCart({ userId });
    }

    return this.applyDealerPricingToCart(cart, userId);
  }

  async logCartEvent(
    cartId: string,
    eventType: CART_EVENT,
    userId?: string
  ): Promise<void> {
    await prisma.cartEvent.create({
      data: {
        userId,
        cartId,
        eventType,
      },
    });
  }

  async getAbandonedCartMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAbandonedCarts: number;
    abandonmentRate: number;
    potentialRevenueLost: number;
  }> {
    // Step 1: distinct cart IDs that had an ADD event in the window (lightweight).
    const cartsWithAdd = await prisma.cartEvent.findMany({
      where: { eventType: "ADD", timestamp: { gte: startDate, lte: endDate } },
      select: { cartId: true },
      distinct: ["cartId"],
    });

    const totalCarts = cartsWithAdd.length;
    if (totalCarts === 0) {
      return { totalAbandonedCarts: 0, abandonmentRate: 0, potentialRevenueLost: 0 };
    }

    const addedCartIds = cartsWithAdd.map((e) => e.cartId);

    // Step 2: which of those also completed checkout? (no includes needed)
    const cartsWithCheckout = await prisma.cartEvent.findMany({
      where: {
        cartId: { in: addedCartIds },
        eventType: "CHECKOUT_COMPLETED",
      },
      select: { cartId: true },
      distinct: ["cartId"],
    });
    const checkoutSet = new Set(cartsWithCheckout.map((e) => e.cartId));

    // Carts that added items but never checked out — abandoned.
    const abandonedCartIds = addedCartIds.filter((id) => !checkoutSet.has(id));
    const totalAbandonedCarts = abandonedCartIds.length;

    // Step 3: estimate revenue lost using a targeted aggregation on abandoned carts only.
    // Prisma can't SUM(quantity * price) natively, so we use a raw aggregate:
    // sum each item's (quantity × variant.price) across all abandoned cart items.
    let potentialRevenueLost = 0;
    if (abandonedCartIds.length > 0) {
      const items = await prisma.cartItem.findMany({
        where: { cartId: { in: abandonedCartIds } },
        select: { quantity: true, variant: { select: { price: true } } },
      });
      potentialRevenueLost = items.reduce(
        (sum, item) => sum + item.quantity * Number(item.variant.price),
        0
      );
    }

    const abandonmentRate = (totalAbandonedCarts / totalCarts) * 100;

    return {
      totalAbandonedCarts,
      abandonmentRate,
      potentialRevenueLost,
    };
  }

  async getCartCount(userId?: string) {
    const cart = await this.getOrCreateCart(userId);
    return cart.cartItems.length;
  }

  async addToCart(
    variantId: string,
    quantity: number,
    userId?: string
  ) {
    if (quantity <= 0) {
      throw new AppError(400, "Quantity must be greater than 0");
    }

    const cart = await this.getOrCreateCart(userId);

    const existingItem = await this.cartRepository.findCartItem(
      cart.id,
      variantId
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      const updatedItem = await this.cartRepository.updateCartItemQuantity(
        existingItem.id,
        newQuantity
      );

      await this.logCartEvent(cart.id, "ADD", userId);
      return updatedItem;
    }

    const item = await this.cartRepository.addItemToCart({
      cartId: cart.id,
      variantId,
      quantity,
    });

    await this.logCartEvent(cart.id, "ADD", userId);
    return item;
  }

  private async assertCartItemOwnership(
    itemId: string,
    userId?: string
  ) {
    if (!userId) {
      throw new AppError(401, "Authentication required for cart access");
    }

    const cartItem = await this.cartRepository.findCartItemById(itemId);
    if (!cartItem) {
      throw new AppError(404, "Cart item not found");
    }

    if (cartItem.cart.userId !== userId) {
      throw new AppError(403, "You are not authorized to access this cart");
    }
  }

  async updateCartItemQuantity(
    itemId: string,
    quantity: number,
    userId?: string
  ) {
    if (quantity <= 0) {
      throw new AppError(400, "Quantity must be greater than 0");
    }

    await this.assertCartItemOwnership(itemId, userId);
    return this.cartRepository.updateCartItemQuantity(itemId, quantity);
  }

  async removeFromCart(itemId: string, userId?: string) {
    await this.assertCartItemOwnership(itemId, userId);
    return this.cartRepository.removeCartItem(itemId);
  }

  async mergeCartsOnLogin(sessionId: string, userId: string | undefined) {
    if (!userId || !sessionId) {
      return;
    }

    // #12: Look up the guest session cart. Nothing to merge if it doesn't exist or is empty.
    const sessionCart = await this.cartRepository.getCartBySessionId(sessionId);
    if (!sessionCart || !sessionCart.cartItems.length) {
      return;
    }

    // Ensure the user has an active cart to merge into.
    const userCart = await this.getOrCreateCart(userId);

    // Guard against merging a cart into itself (shouldn't happen, but be safe).
    if (sessionCart.id === userCart.id) {
      return;
    }

    // Merge session cart items into the user cart, then delete the session cart.
    // mergeCarts handles quantity accumulation per item.
    await this.cartRepository.mergeCarts(sessionCart.id, userCart.id);
  }

  async clearCartOnSignOut(userId?: string) {
    if (!userId) {
      return;
    }

    await this.cartRepository.clearCart(userId);
  }
}
