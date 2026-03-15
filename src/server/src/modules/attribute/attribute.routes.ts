import express from "express";
import { makeAttributeController } from "./attribute.factory";
import csrfProtection from "@/shared/middlewares/csrfProtection";

const router = express.Router();
const controller = makeAttributeController();

router.get("/", controller.getAllAttributes);
router.get("/:id", controller.getAttribute);
router.post("/", csrfProtection, controller.createAttribute);
router.post("/value", csrfProtection, controller.createAttributeValue);
router.post("/assign-category", csrfProtection, controller.assignAttributeToCategory);
// router.post("/assign-product", csrfProtection, controller.assignAttributeToProduct);
router.delete("/:id", csrfProtection, controller.deleteAttribute);
router.delete("/value/:id", csrfProtection, controller.deleteAttributeValue);

export default router;
