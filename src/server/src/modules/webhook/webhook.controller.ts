import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { WebhookService } from "./webhook.service";
import { makeLogsService } from "../logs/logs.factory";
import stripe from "@/infra/payment/stripe";
import AppError from "@/shared/errors/AppError";
import { config } from "@/config";

export class WebhookController {
  private logsService = makeLogsService();
  constructor(private webhookService: WebhookService) {}

  handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) throw new AppError(400, "No Stripe signature");
    if (!stripe) {
      throw new AppError(
        503,
        "Stripe is not configured. Set STRIPE_SECRET_KEY to receive webhooks."
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.payment.stripeWebhookSecret!
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(400, `Webhook signature verification failed: ${message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await this.webhookService.handleCheckoutCompletion(session);
    }

    sendResponse(res, 200, { message: "Webhook received successfully" });
  });
}
