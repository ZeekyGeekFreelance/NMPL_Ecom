import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { CartService } from "./cart.service";
import { makeLogsService } from "../logs/logs.factory";

export class CartController {
  private logsService = makeLogsService();

  constructor(private cartService: CartService) {}

  private async logAction(message: string, req: Request, start: number) {
    await this.logsService.info(message, {
      userId: req.user?.id,
      sessionId: req.session.id,
      timePeriod: Date.now() - start,
    });
  }

  getCart = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = req.user?.id;
    const sessionId = req.session.id;
    const cart = await this.cartService.getOrCreateCart(userId, sessionId);

    sendResponse(res, 200, {
      data: { cart },
      message: "Cart fetched successfully",
    });

    await this.logAction("Cart fetched", req, startedAt);
  });

  getCartCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const sessionId = req.session.id;
    const cartCount = await this.cartService.getCartCount(userId, sessionId);

    sendResponse(res, 200, {
      data: { cartCount },
      message: "Cart count fetched successfully",
    });
  });

  addToCart = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = req.user?.id;
    const sessionId = req.session.id;
    const { variantId, quantity } = req.body;

    const item = await this.cartService.addToCart(
      variantId,
      quantity,
      userId,
      sessionId
    );

    sendResponse(res, 200, {
      data: { item },
      message: "Item added to cart successfully",
    });

    await this.logAction("Item added to cart", req, startedAt);
  });

  updateCartItem = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const { itemId } = req.params;
    const { quantity } = req.body;

    const updatedItem = await this.cartService.updateCartItemQuantity(
      itemId,
      quantity
    );

    sendResponse(res, 200, {
      data: { item: updatedItem },
      message: "Item quantity updated successfully",
    });

    await this.logAction("Item quantity updated", req, startedAt);
  });

  removeFromCart = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const { itemId } = req.params;
    await this.cartService.removeFromCart(itemId);

    sendResponse(res, 200, {
      message: "Item removed from cart successfully",
    });

    await this.logAction("Item removed from cart", req, startedAt);
  });

  mergeCarts = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const sessionId = req.session.id;
    const userId = req.user?.id;

    await this.cartService.mergeCartsOnLogin(sessionId, userId);

    sendResponse(res, 200, { message: "Carts merged successfully" });

    await this.logAction("Carts merged", req, startedAt);
  });
}
