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
    const cartEvents = await prisma.cartEvent.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        cart: {
          include: { cartItems: { include: { variant: true } } },
        },
        user: true,
      },
    });

    const cartEventsByCartId = cartEvents.reduce((acc: any, event) => {
      if (!acc[event.cartId]) acc[event.cartId] = [];
      acc[event.cartId].push(event);
      return acc;
    }, {});

    let totalCarts = 0;
    let totalAbandonedCarts = 0;
    let potentialRevenueLost = 0;

    for (const cartId in cartEventsByCartId) {
      const events = cartEventsByCartId[cartId];
      const hasAddToCart = events.some((e: any) => e.eventType === "ADD");
      const hasCheckoutCompleted = events.some(
        (e: any) => e.eventType === "CHECKOUT_COMPLETED"
      );

      const cart = events[0].cart;
      if (!cart || !cart.cartItems || cart.cartItems.length === 0) continue;

      totalCarts++;

      if (hasAddToCart && !hasCheckoutCompleted) {
        const addToCartEvent = events.find((e: any) => e.eventType === "ADD");
        const oneHourLater = new Date(
          addToCartEvent.timestamp.getTime() + 60 * 60 * 1000
        );
        const now = new Date();

        if (now > oneHourLater) {
          totalAbandonedCarts++;
          potentialRevenueLost += cart.cartItems.reduce(
            (sum: number, item: any) =>
              sum + item.quantity * item.variant.price,
            0
          );
        }
      }
    }

    const abandonmentRate =
      totalCarts > 0 ? (totalAbandonedCarts / totalCarts) * 100 : 0;

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

    // Cart now uses authenticated user ownership as the single source of truth.
    await this.getOrCreateCart(userId);
  }

  async clearCartOnSignOut(userId?: string) {
    if (!userId) {
      return;
    }

    await this.cartRepository.clearCart(userId);
  }
}
