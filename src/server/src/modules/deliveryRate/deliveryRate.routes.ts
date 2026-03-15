import { Router } from "express";
import protect from "@/shared/middlewares/protect";
import authorizeRole from "@/shared/middlewares/authorizeRole";
import csrfProtection from "@/shared/middlewares/csrfProtection";
import { validateDto } from "@/shared/middlewares/validateDto";
import { makeDeliveryRateController } from "./deliveryRate.factory";
import { UpsertStateDeliveryRateDto } from "./deliveryRate.dto";

const router = Router();
const controller = makeDeliveryRateController();
const allowDashboardRoles = authorizeRole("ADMIN", "SUPERADMIN");

router.get("/states", protect, allowDashboardRoles, controller.getStateRates);

router.put(
  "/states/:state",
  protect,
  allowDashboardRoles,
  csrfProtection,
  validateDto(UpsertStateDeliveryRateDto),
  controller.upsertStateRate
);

router.delete(
  "/states/:state",
  protect,
  allowDashboardRoles,
  csrfProtection,
  controller.deleteStateRate
);

export default router;
