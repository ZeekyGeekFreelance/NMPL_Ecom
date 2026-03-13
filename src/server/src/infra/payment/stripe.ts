import Stripe from "stripe";
import { config } from "@/config";

export const isStripeConfigured = Boolean(config.payment.stripeSecretKey);

const stripe = isStripeConfigured
  ? new Stripe(config.payment.stripeSecretKey as string, {
      apiVersion: "2025-03-31.basil",
    })
  : null;

export default stripe;
