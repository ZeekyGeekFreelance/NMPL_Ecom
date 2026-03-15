import express from "express";
import { makeVariantController } from "./variant.factory";
import protect from "@/shared/middlewares/protect";
import csrfProtection from "@/shared/middlewares/csrfProtection";

const router = express.Router();
const controller = makeVariantController();

router.get("/", controller.getAllVariants);
router.get("/sku/:sku", controller.getVariantBySku);
router.get("/:id/restock-history", controller.getRestockHistory);
router.get("/:id", controller.getVariantById);
router.post("/", csrfProtection, controller.createVariant);
router.put("/:id", csrfProtection, controller.updateVariant);
router.patch("/:id", csrfProtection, controller.updateVariant);
router.post("/:id/restock", protect, csrfProtection, controller.restockVariant);
router.delete("/:id", csrfProtection, controller.deleteVariant);

export default router;
