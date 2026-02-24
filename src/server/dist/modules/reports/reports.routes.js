"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_factory_1 = require("./reports.factory");
const protect_1 = __importDefault(require("@/shared/middlewares/protect"));
const authorizeRole_1 = __importDefault(require("@/shared/middlewares/authorizeRole"));
const router = (0, express_1.Router)();
const controller = (0, reports_factory_1.makeReportsController)();
const allowDashboardRoles = (0, authorizeRole_1.default)("ADMIN", "SUPERADMIN");
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
router.get("/generate", protect_1.default, allowDashboardRoles, controller.generateReport);
exports.default = router;
