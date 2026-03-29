import express from "express";
import { makeAttributeController } from "./attribute.factory";
import csrfProtection from "@/shared/middlewares/csrfProtection";
import protect from "@/shared/middlewares/protect";
import authorizeRole from "@/shared/middlewares/authorizeRole";

const router = express.Router();
const controller = makeAttributeController();

router.get("/", controller.getAllAttributes);
router.get("/:id", controller.getAttribute);
router.post("/", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.createAttribute);
router.post("/value", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.createAttributeValue);
router.post("/assign-category", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.assignAttributeToCategory);
// router.post("/assign-product", csrfProtection, controller.assignAttributeToProduct);
router.delete("/:id", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.deleteAttribute);
router.delete("/value/:id", protect, authorizeRole("ADMIN", "SUPERADMIN"), csrfProtection, controller.deleteAttributeValue);

export default router;
