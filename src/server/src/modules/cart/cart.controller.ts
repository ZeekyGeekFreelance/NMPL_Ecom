import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { CartService } from "./cart.service";
import { makeLogsService } from "../logs/logs.factory";
import AppError from "@/shared/errors/AppError";

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

  private getRequiredUserId(req: Request) {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required for cart access");
    }

    return userId;
  }

  getCart = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = this.getRequiredUserId(req);
    const cart = await this.cartService.getOrCreateCart(userId);

    sendResponse(res, 200, {
      data: { cart },
      message: "Cart fetched successfully",
    });

    await this.logAction("Cart fetched", req, startedAt);
  });

  getCartCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = this.getRequiredUserId(req);
    const cartCount = await this.cartService.getCartCount(userId);

    sendResponse(res, 200, {
      data: { cartCount },
      message: "Cart count fetched successfully",
    });
  });

  addToCart = asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = this.getRequiredUserId(req);
    const { variantId, quantity } = req.body;

    const item = await this.cartService.addToCart(variantId, quantity, userId);

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
    const userId = this.getRequiredUserId(req);

    const updatedItem = await this.cartService.updateCartItemQuantity(
      itemId,
      quantity,
      userId
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
    const userId = this.getRequiredUserId(req);
    await this.cartService.removeFromCart(itemId, userId);

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
