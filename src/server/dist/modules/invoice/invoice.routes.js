"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const protect_1 = __importDefault(require("@/shared/middlewares/protect"));
const authorizeRole_1 = __importDefault(require("@/shared/middlewares/authorizeRole"));
const invoice_factory_1 = require("./invoice.factory");
const router = express_1.default.Router();
const invoiceController = (0, invoice_factory_1.makeInvoiceController)();
router.get("/", protect_1.default, (0, authorizeRole_1.default)("ADMIN", "SUPERADMIN"), invoiceController.getAllInvoices);
router.get("/user", protect_1.default, (0, authorizeRole_1.default)("USER"), invoiceController.getUserInvoices);
router.get("/order/:orderId", protect_1.default, invoiceController.getInvoiceByOrder);
router.get("/order/:orderId/download", protect_1.default, invoiceController.downloadInvoiceByOrder);
router.get("/:invoiceId/download", protect_1.default, invoiceController.downloadInvoiceById);
exports.default = router;
