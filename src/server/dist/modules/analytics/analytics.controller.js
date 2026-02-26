"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const asyncHandler_1 = __importDefault(require("@/shared/utils/asyncHandler"));
const sendResponse_1 = __importDefault(require("@/shared/utils/sendResponse"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const logs_factory_1 = require("../logs/logs.factory");
const generateCsv_1 = __importDefault(require("@/shared/utils/export/generateCsv"));
const generatePdf_1 = __importDefault(require("@/shared/utils/export/generatePdf"));
const generateXlsx_1 = __importDefault(require("@/shared/utils/export/generateXlsx"));
class AnalyticsController {
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.createInteraction = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { productId, type } = req.body;
            const user = req.user;
            const sessionId = req.session.id;
            const validTypes = ["view", "click", "other"];
            if (!type || !validTypes.includes(type)) {
                throw new AppError_1.default(400, "Invalid interaction type. Use: view, click, or other.");
            }
            const interaction = yield this.analyticsService.createInteraction({
                userId: user === null || user === void 0 ? void 0 : user.id,
                sessionId, // Always include sessionId
                productId,
                type,
                performedBy: user === null || user === void 0 ? void 0 : user.id,
            });
            this.logsService.info("Interaction recorded", {
                userId: user === null || user === void 0 ? void 0 : user.id,
                sessionId,
                interactionType: type,
                productId,
            });
            (0, sendResponse_1.default)(res, 200, {
                data: { interaction },
                message: "Interaction recorded successfully",
            });
        }));
        this.getYearRange = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const yearRange = yield this.analyticsService.getYearRange();
            (0, sendResponse_1.default)(res, 200, {
                data: yearRange,
                message: "Year range retrieved successfully",
            });
        }));
        this.exportAnalytics = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { type, format, timePeriod, year, startDate, endDate } = req.query;
            const now = new Date();
            const currentYear = now.getFullYear();
            const validFormats = ["csv", "pdf", "xlsx"];
            if (!format || !validFormats.includes(format)) {
                throw new AppError_1.default(400, "Invalid format. Use: csv, pdf, or xlsx");
            }
            const validTypes = ["overview", "products", "users", "all"];
            if (!type || !validTypes.includes(type)) {
                throw new AppError_1.default(400, "Invalid type. Use: overview, products, users, or all");
            }
            const validPeriods = [
                "last7days",
                "lastMonth",
                "lastYear",
                "allTime",
                "custom",
            ];
            if (!timePeriod || !validPeriods.includes(timePeriod)) {
                throw new AppError_1.default(400, "Invalid or missing timePeriod. Use: last7days, lastMonth, lastYear, allTime, or custom");
            }
            let selectedYear;
            if (year) {
                selectedYear = parseInt(year, 10);
                if (isNaN(selectedYear) ||
                    selectedYear < 1900 ||
                    selectedYear > currentYear) {
                    throw new AppError_1.default(400, "Invalid year format.");
                }
            }
            else if (timePeriod === "allTime" && !startDate && !endDate) {
                selectedYear = currentYear;
            }
            let customStartDate;
            let customEndDate;
            if (timePeriod === "custom" && (!startDate || !endDate)) {
                throw new AppError_1.default(400, "Both startDate and endDate must be provided for a custom range.");
            }
            if (startDate && endDate) {
                customStartDate = new Date(startDate);
                customEndDate = new Date(endDate);
                if (isNaN(customStartDate.getTime()) || isNaN(customEndDate.getTime())) {
                    throw new AppError_1.default(400, "Invalid startDate or endDate format. Use YYYY-MM-DD.");
                }
                if (customStartDate > customEndDate) {
                    throw new AppError_1.default(400, "startDate must be before endDate.");
                }
                if (customStartDate > now || customEndDate > now) {
                    throw new AppError_1.default(400, "Future dates are not allowed.");
                }
            }
            else if (startDate || endDate) {
                throw new AppError_1.default(400, "Both startDate and endDate must be provided for a custom range.");
            }
            const query = {
                timePeriod: timePeriod,
                year: selectedYear,
                startDate: customStartDate,
                endDate: customEndDate,
            };
            let data;
            let filename;
            switch (type) {
                case "overview":
                    data = yield this.analyticsService.getAnalyticsOverview(query);
                    filename = this.buildExportFilename("analytics-overview", format);
                    break;
                case "products":
                    data = yield this.analyticsService.getProductPerformance(query);
                    filename = this.buildExportFilename("product-performance", format);
                    break;
                case "users":
                    data = yield this.analyticsService.getUserAnalytics(query);
                    filename = this.buildExportFilename("user-analytics", format);
                    break;
                case "all":
                    data = {
                        overview: yield this.analyticsService.getAnalyticsOverview(query),
                        products: yield this.analyticsService.getProductPerformance(query),
                        users: yield this.analyticsService.getUserAnalytics(query),
                    };
                    filename = this.buildExportFilename("all-analytics", format);
                    break;
                default:
                    throw new AppError_1.default(400, "Invalid analytics type");
            }
            let result;
            let contentType;
            switch (format) {
                case "csv":
                    result = (0, generateCsv_1.default)(data);
                    contentType = "text/csv; charset=utf-8";
                    break;
                case "pdf":
                    result = yield (0, generatePdf_1.default)(data);
                    contentType = "application/pdf";
                    break;
                case "xlsx":
                    result = yield (0, generateXlsx_1.default)(data);
                    contentType =
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                    break;
                default:
                    throw new AppError_1.default(400, "Invalid format");
            }
            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.send(result);
            yield this.logsService.info("Exported analytics", {
                userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                type,
                format,
                timePeriod,
            });
        }));
    }
    resolveFileExtension(extension) {
        if (typeof extension === "string" && extension.trim()) {
            return extension.trim();
        }
        if (Array.isArray(extension)) {
            const match = extension.find((item) => typeof item === "string" && item.trim());
            if (match) {
                return match.trim();
            }
        }
        return "csv";
    }
    buildExportFilename(prefix, extension) {
        const normalizedExtension = this.resolveFileExtension(extension);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        return `${prefix}-${timestamp}.${normalizedExtension}`;
    }
}
exports.AnalyticsController = AnalyticsController;
