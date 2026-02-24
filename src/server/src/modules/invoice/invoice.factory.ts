import { InvoiceController } from "./invoice.controller";
import { InvoiceRepository } from "./invoice.repository";
import { InvoiceService } from "./invoice.service";

export const makeInvoiceController = () => {
  const repository = new InvoiceRepository();
  const service = new InvoiceService(repository);
  return new InvoiceController(service);
};

export const makeInvoiceService = () => {
  const repository = new InvoiceRepository();
  return new InvoiceService(repository);
};
