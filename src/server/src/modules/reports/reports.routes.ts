import { Router } from "express";
import { makeReportsController } from "./reports.factory";
import protect from "@/shared/middlewares/protect";
import authorizeRole from "@/shared/middlewares/authorizeRole";

const router = Router();
const controller = makeReportsController();
const allowDashboardRoles = authorizeRole("ADMIN", "SUPERADMIN");

/**
 * @swagger
 * /reports/generate:
 *   get:
 *     summary: Generate a report
 *     description: Generates a report for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report generated successfully.
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 */
router.get("/generate", protect, allowDashboardRoles, controller.generateReport);

export default router;
