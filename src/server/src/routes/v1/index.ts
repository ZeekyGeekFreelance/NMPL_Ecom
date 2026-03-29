import { Router } from "express";
import usersRoutes from "@/modules/user/user.routes";
import authRoutes from "@/modules/auth/auth.routes";
import productRoutes from "@/modules/product/product.routes";
import categoryRoutes from "@/modules/category/category.routes";
import orderRoutes from "@/modules/order/order.routes";
import checkoutRoutes from "@/modules/checkout/checkout.routes";
import cartRoutes from "@/modules/cart/cart.routes";
import reportRoutes from "@/modules/reports/reports.routes";
import analyticsRoutes from "@/modules/analytics/analytics.routes";
import paymentRoutes from "@/modules/payment/payment.routes";
import addressRoutes from "@/modules/address/address.routes";
import transactionRoutes from "@/modules/transaction/transaction.routes";
import logRoutes from "@/modules/logs/logs.routes";
import sectionRoutes from "@/modules/section/section.routes";
import attributesRoutes from "@/modules/attribute/attribute.routes";
import variantsRoutes from '@/modules/variant/variant.routes'
import invoiceRoutes from "@/modules/invoice/invoice.routes";
import deliveryRateRoutes from "@/modules/deliveryRate/deliveryRate.routes";
import gstRoutes from "@/modules/gst/gst.routes";
import idempotencyGuard from "@/shared/middlewares/idempotencyGuard";
import mutationAuditLogger from "@/shared/middlewares/mutationAuditLogger";
import { productsRateLimiter } from "@/shared/middlewares/rateLimiter";

export const configureV1Routes = () => {
  const router = Router();
  router.use(idempotencyGuard);
  router.use(mutationAuditLogger);

  // Lightweight CSRF bootstrap endpoint for clients to prefetch a token.
  router.get("/csrf", (_req, res) => {
    res.status(204).end();
  });

  router.use("/users", usersRoutes);
  router.use("/auth", authRoutes);
  router.use("/products", productsRateLimiter, productRoutes);
  router.use("/transactions", transactionRoutes);
  router.use("/categories", categoryRoutes);
  router.use("/cart", cartRoutes);
  router.use("/checkout", checkoutRoutes);
  router.use("/reports", reportRoutes);
  router.use("/analytics", analyticsRoutes);
  router.use("/logs", logRoutes);
  router.use("/orders", orderRoutes);
  router.use("/payments", paymentRoutes);
  router.use("/addresses", addressRoutes);
  router.use("/sections", sectionRoutes);
  router.use("/attributes", attributesRoutes);
  router.use('/variants', variantsRoutes)
  router.use("/invoices", invoiceRoutes);
  router.use("/delivery-rates", deliveryRateRoutes);
  router.use("/gst", gstRoutes);

  return router;
};
