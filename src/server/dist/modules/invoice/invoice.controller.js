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
exports.InvoiceController = void 0;
const asyncHandler_1 = __importDefault(require("@/shared/utils/asyncHandler"));
const sendResponse_1 = __importDefault(require("@/shared/utils/sendResponse"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
class InvoiceController {
    constructor(invoiceService) {
        this.invoiceService = invoiceService;
        this.getAllInvoices = (0, asyncHandler_1.default)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            const invoices = yield this.invoiceService.getAllInvoices();
            (0, sendResponse_1.default)(res, 200, {
                data: { invoices },
                message: "Invoices retrieved successfully",
            });
        }));
        this.getUserInvoices = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new AppError_1.default(401, "Unauthorized");
            }
            const invoices = yield this.invoiceService.getUserInvoices(userId);
            (0, sendResponse_1.default)(res, 200, {
                data: { invoices },
                message: "User invoices retrieved successfully",
            });
        }));
        this.getInvoiceByOrder = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const orderId = req.params.orderId;
            const requester = req.user;
            const invoice = yield this.invoiceService.getInvoiceByOrder(orderId, {
                id: (requester === null || requester === void 0 ? void 0 : requester.id) || "",
                role: (requester === null || requester === void 0 ? void 0 : requester.role) || "",
            });
            (0, sendResponse_1.default)(res, 200, {
                data: { invoice },
                message: "Invoice retrieved successfully",
            });
        }));
        this.downloadInvoiceByOrder = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const orderId = req.params.orderId;
            const requester = req.user;
            const invoiceFile = yield this.invoiceService.downloadInvoiceByOrder(orderId, {
                id: (requester === null || requester === void 0 ? void 0 : requester.id) || "",
                role: (requester === null || requester === void 0 ? void 0 : requester.role) || "",
            });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${invoiceFile.filename}"`);
            res.send(invoiceFile.content);
        }));
        this.downloadInvoiceById = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const invoiceId = req.params.invoiceId;
            const requester = req.user;
            const invoiceFile = yield this.invoiceService.downloadInvoiceById(invoiceId, {
                id: (requester === null || requester === void 0 ? void 0 : requester.id) || "",
                role: (requester === null || requester === void 0 ? void 0 : requester.role) || "",
            });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${invoiceFile.filename}"`);
            res.send(invoiceFile.content);
        }));
    }
}
exports.InvoiceController = InvoiceController;
