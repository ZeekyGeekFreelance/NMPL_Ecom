import Stripe from "stripe";

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

const stripe = isStripeConfigured
  ? new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: "2025-03-31.basil",
    })
  : null;

export default stripe;
