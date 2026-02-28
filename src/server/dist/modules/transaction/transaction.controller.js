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
exports.TransactionController = void 0;
const asyncHandler_1 = __importDefault(require("@/shared/utils/asyncHandler"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const sendResponse_1 = __importDefault(require("@/shared/utils/sendResponse"));
class TransactionController {
    constructor(transactionService) {
        this.transactionService = transactionService;
        this.getAllTransactions = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { transactions, totalResults, totalPages, currentPage, resultsPerPage, } = yield this.transactionService.getAllTransactions(req.query);
            (0, sendResponse_1.default)(res, 200, {
                data: {
                    transactions,
                    totalResults,
                    totalPages,
                    currentPage,
                    resultsPerPage,
                },
                message: "Fetched transactions successfully",
            });
        }));
        this.getTransactionById = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const transaction = yield this.transactionService.getTransactionById(id);
            (0, sendResponse_1.default)(res, 200, {
                data: { transaction },
                message: "Fetched transaction successfully",
            });
        }));
        this.updateTransactionStatus = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const { id } = req.params;
            const rawStatus = (_a = req.body) === null || _a === void 0 ? void 0 : _a.status;
            const forceConfirmedRejection = ((_b = req.body) === null || _b === void 0 ? void 0 : _b.forceConfirmedRejection) === true;
            const confirmationToken = typeof ((_c = req.body) === null || _c === void 0 ? void 0 : _c.confirmationToken) === "string"
                ? req.body.confirmationToken.trim()
                : undefined;
            if (typeof rawStatus !== "string" || !rawStatus.trim()) {
                throw new AppError_1.default(400, "Status is required");
            }
            const updatedTransaction = yield this.transactionService.updateTransactionStatus(id, {
                status: rawStatus.trim().toUpperCase(),
                forceConfirmedRejection,
                confirmationToken,
                actorUserId: (_d = req.user) === null || _d === void 0 ? void 0 : _d.id,
                actorRole: ((_e = req.user) === null || _e === void 0 ? void 0 : _e.effectiveRole) || ((_f = req.user) === null || _f === void 0 ? void 0 : _f.role),
            });
            (0, sendResponse_1.default)(res, 200, {
                data: { updatedTransaction },
                message: "Updated transaction successfully",
            });
        }));
        this.updateTransactionQuotation = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { id } = req.params;
            const rawQuotationItems = (_a = req.body) === null || _a === void 0 ? void 0 : _a.quotationItems;
            if (!Array.isArray(rawQuotationItems) || rawQuotationItems.length === 0) {
                throw new AppError_1.default(400, "quotationItems is required and must be a non-empty array.");
            }
            const quotationItems = rawQuotationItems.map((item) => {
                const orderItemId = String((item === null || item === void 0 ? void 0 : item.orderItemId) || "").trim();
                const quantity = Number(item === null || item === void 0 ? void 0 : item.quantity);
                const price = Number(item === null || item === void 0 ? void 0 : item.price);
                if (!orderItemId) {
                    throw new AppError_1.default(400, "Each quotation item must include orderItemId.");
                }
                if (!Number.isInteger(quantity) || quantity <= 0) {
                    throw new AppError_1.default(400, `Invalid quotation quantity for order item ${orderItemId}.`);
                }
                if (!Number.isFinite(price) || price < 0) {
                    throw new AppError_1.default(400, `Invalid quotation price for order item ${orderItemId}.`);
                }
                return {
                    orderItemId,
                    quantity,
                    price: Number(price.toFixed(2)),
                };
            });
            const updatedTransaction = yield this.transactionService.issueQuotation(id, quotationItems, {
                actorUserId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                actorRole: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.effectiveRole) || ((_d = req.user) === null || _d === void 0 ? void 0 : _d.role),
            });
            (0, sendResponse_1.default)(res, 200, {
                data: { updatedTransaction },
                message: "Quotation updated and issued successfully",
            });
        }));
        this.deleteTransaction = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            yield this.transactionService.deleteTransaction(id);
            (0, sendResponse_1.default)(res, 204, { message: "Deleted transaction successfully" });
        }));
    }
}
exports.TransactionController = TransactionController;
