"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeInvoiceService = exports.makeInvoiceController = void 0;
const invoice_controller_1 = require("./invoice.controller");
const invoice_repository_1 = require("./invoice.repository");
const invoice_service_1 = require("./invoice.service");
const makeInvoiceController = () => {
    const repository = new invoice_repository_1.InvoiceRepository();
    const service = new invoice_service_1.InvoiceService(repository);
    return new invoice_controller_1.InvoiceController(service);
};
exports.makeInvoiceController = makeInvoiceController;
const makeInvoiceService = () => {
    const repository = new invoice_repository_1.InvoiceRepository();
    return new invoice_service_1.InvoiceService(repository);
};
exports.makeInvoiceService = makeInvoiceService;
