import express from "express";
import { makeVariantController } from "./variant.factory";
import protect from "@/shared/middlewares/protect";
import authorizeRole from "@/shared/middlewares/authorizeRole";
import csrfProtection from "@/shared/middlewares/csrfProtection";

const router = express.Router();
const controller = makeVariantController();

router.get("/", controller.getAllVariants);
router.get("/sku/:sku", controller.getVariantBySku);
router.get("/:id/restock-history", controller.getRestockHistory);
router.get("/:id", controller.getVariantById);
router.post("/", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.createVariant);
router.put("/:id", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.updateVariant);
router.patch("/:id", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.updateVariant);
router.post("/:id/restock", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.restockVariant);
router.delete("/:id", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.deleteVariant);

export default router;
