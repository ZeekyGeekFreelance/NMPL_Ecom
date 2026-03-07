import express from "express";
import protect from "@/shared/middlewares/protect";
import authorizeRole from "@/shared/middlewares/authorizeRole";
import { makeInvoiceController } from "./invoice.factory";

const router = express.Router();
const invoiceController = makeInvoiceController();

router.get(
  "/",
  protect,
  authorizeRole("ADMIN", "SUPERADMIN"),
  invoiceController.getAllInvoices
);

router.get(
  "/user",
  protect,
  authorizeRole("USER", "DEALER"),
  invoiceController.getUserInvoices
);

router.get("/order/:orderId", protect, invoiceController.getInvoiceByOrder);
router.get(
  "/order/:orderId/download",
  protect,
  invoiceController.downloadInvoiceByOrder
);
router.get("/:invoiceId/download", protect, invoiceController.downloadInvoiceById);

export default router;
