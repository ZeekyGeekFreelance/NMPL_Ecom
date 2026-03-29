import { Router } from "express";
import protect from "@/shared/middlewares/protect";
import authorizeRole from "@/shared/middlewares/authorizeRole";
import csrfProtection from "@/shared/middlewares/csrfProtection";
import { validateDto } from "@/shared/middlewares/validateDto";
import { makeGstController } from "./gst.factory";
import {
  CreateGstDto,
  ToggleGstActivationDto,
  UpdateGstDto,
} from "./gst.dto";

const router = Router();
const controller = makeGstController();
const allowDashboardRoles = authorizeRole("ADMIN", "SUPERADMIN");

router.use(protect, allowDashboardRoles);

router.get("/", controller.getAllGsts);
router.post("/", csrfProtection, validateDto(CreateGstDto), controller.createGst);
router.put("/:id", csrfProtection, validateDto(UpdateGstDto), controller.updateGst);
router.patch(
  "/:id/activate",
  csrfProtection,
  validateDto(ToggleGstActivationDto),
  controller.setActivation
);

export default router;
