import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import AppError from "@/shared/errors/AppError";
import { OrderService } from "./order.service";

export class OrderController {
  constructor(private orderService: OrderService) {}

  getAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await this.orderService.getAllOrders();
    sendResponse(res, 200, {
      data: { orders },
      message: "Orders retrieved successfully",
    });
  });

  getUserOrders = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    const orders = await this.orderService.getUserOrders(userId);
    sendResponse(res, 200, {
      data: { orders },
      message: "Orders retrieved successfully",
    });
  });

  getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    const order = await this.orderService.getOrderDetails(orderId, userId);
    sendResponse(res, 200, {
      data: { order },
      message: "Order details retrieved successfully",
    });
  });

  acceptQuotation = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { orderId } = req.params;
    if (!userId) {
      throw new AppError(400, "User not found");
    }

    const paymentSession = await this.orderService.acceptQuotationForOrder(
      orderId,
      userId
    );

    sendResponse(res, 200, {
      data: paymentSession,
      message: "Quotation accepted. Redirect to payment gateway.",
    });
  });

  rejectQuotation = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { orderId } = req.params;
    if (!userId) {
      throw new AppError(400, "User not found");
    }

    const updatedTransaction = await this.orderService.rejectQuotationForOrder(
      orderId,
      userId
    );

    sendResponse(res, 200, {
      data: { updatedTransaction },
      message: "Quotation rejected successfully",
    });
  });

  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { cartId, addressId, deliveryMode } = req.body || {};
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    if (!cartId) {
      throw new AppError(400, "Cart ID is required");
    }
    if (!addressId) {
      throw new AppError(400, "Address selection is required");
    }
    if (deliveryMode !== "PICKUP" && deliveryMode !== "DELIVERY") {
      throw new AppError(400, "Delivery mode must be PICKUP or DELIVERY");
    }
    const order = await this.orderService.createOrderFromCart(
      userId,
      cartId,
      addressId,
      deliveryMode
    );
    sendResponse(res, 201, {
      data: { order },
      message: "Order created successfully",
    });
  });
}
