import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { CheckoutService } from "./checkout.service";
import AppError from "@/shared/errors/AppError";
import { CartService } from "../cart/cart.service";
import { makeLogsService } from "../logs/logs.factory";
import { toOrderReference } from "@/shared/utils/accountReference";

export class CheckoutController {
  private logsService = makeLogsService();

  constructor(
    private checkoutService: CheckoutService,
    private cartService: CartService
  ) {}

  getCheckoutSummary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.effectiveRole || req.user?.role;

    if (!userId) {
      throw new AppError(400, "User not found");
    }

    if (userRole !== "USER" && userRole !== "DEALER") {
      throw new AppError(403, "Only customer/dealer accounts can checkout");
    }

    const summary = await this.checkoutService.getCheckoutSummary(userId, {
      addressId: req.body?.addressId,
      deliveryMode: req.body?.deliveryMode,
    });

    sendResponse(res, 200, {
      data: summary,
      message: "Checkout summary calculated successfully",
    });
  });

  initiateCheckout = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.effectiveRole || req.user?.role;

    if (!userId) {
      throw new AppError(400, "User not found");
    }

    if (userRole !== "USER" && userRole !== "DEALER") {
      throw new AppError(403, "Only customer/dealer accounts can place orders");
    }

    const cart = await this.cartService.getOrCreateCart(userId);
    if (!cart.cartItems || cart.cartItems.length === 0) {
      throw new AppError(400, "Cart is empty");
    }

    await this.cartService.logCartEvent(cart.id, "CHECKOUT_STARTED", userId);
    const order = await this.checkoutService.placeOrder(userId, cart.id, {
      addressId: req.body?.addressId,
      deliveryMode: req.body?.deliveryMode,
    });
    await this.cartService.logCartEvent(cart.id, "CHECKOUT_COMPLETED", userId);

    sendResponse(res, 201, {
      data: {
        orderId: order.id,
        orderReference: toOrderReference(order.id),
        status: order.status,
        subtotalAmount: order.subtotalAmount,
        deliveryCharge: order.deliveryCharge,
        deliveryMode: order.deliveryMode,
        finalTotal: order.amount,
        nextStep:
          "Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.",
      },
      message:
        "Stock will be verified. You will receive a quotation. Complete payment after approval to confirm your order.",
    });

    this.logsService.info("Order placed from checkout", {
      userId,
      orderId: order.id,
      timePeriod: 0,
    });
  });
}
