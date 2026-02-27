import { Router } from "express";
import { makeAnalyticsController } from "./analytics.factory";
import protect from "@/shared/middlewares/protect";
import authorizeRole from "@/shared/middlewares/authorizeRole";

const router = Router();
const controller = makeAnalyticsController();
const allowDashboardRoles = authorizeRole("ADMIN", "SUPERADMIN");

/**
 * @swagger
 * /analytics/interactions:
 *   post:
 *     summary: Create interaction record
 *     description: Logs a new user interaction for analytics purposes.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               interactionType:
 *                 type: string
 *               interactionDetails:
 *                 type: string
 *     responses:
 *       201:
 *         description: Interaction successfully created.
 *       400:
 *         description: Invalid input data.
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 */
router.post("/interactions", protect, controller.createInteraction);

/**
 * @swagger
 * /analytics/year-range:
 *   get:
 *     summary: Get analytics for a year range
 *     description: Retrieves analytics data for a specified year range.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data for the specified year range.
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 */
router.get("/year-range", protect, allowDashboardRoles, controller.getYearRange);

/**
 * @swagger
 * /analytics/export:
 *   get:
 *     summary: Export analytics data
 *     description: Exports the analytics data, typically for reporting or data analysis.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data successfully exported.
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 */
router.get("/export", protect, allowDashboardRoles, controller.exportAnalytics);

export default router;
