import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import AppError from "@/shared/errors/AppError";
import { InvoiceService } from "./invoice.service";

export class InvoiceController {
  constructor(private invoiceService: InvoiceService) {}

  getAllInvoices = asyncHandler(async (_req: Request, res: Response) => {
    const invoices = await this.invoiceService.getAllInvoices();
    sendResponse(res, 200, {
      data: { invoices },
      message: "Invoices retrieved successfully",
    });
  });

  getUserInvoices = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const invoices = await this.invoiceService.getUserInvoices(userId);
    sendResponse(res, 200, {
      data: { invoices },
      message: "User invoices retrieved successfully",
    });
  });

  getInvoiceByOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId;
    const requester = req.user;

    const invoice = await this.invoiceService.getInvoiceByOrder(orderId, {
      id: requester?.id || "",
      role: requester?.effectiveRole || requester?.role || "",
    });

    sendResponse(res, 200, {
      data: { invoice },
      message: "Invoice retrieved successfully",
    });
  });

  downloadInvoiceByOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId;
    const requester = req.user;

    const invoiceFile = await this.invoiceService.downloadInvoiceByOrder(
      orderId,
      {
        id: requester?.id || "",
        role: requester?.effectiveRole || requester?.role || "",
      }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoiceFile.filename}"`
    );
    res.send(invoiceFile.content);
  });

  downloadInvoiceById = asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.invoiceId;
    const requester = req.user;

    const invoiceFile = await this.invoiceService.downloadInvoiceById(
      invoiceId,
      {
        id: requester?.id || "",
        role: requester?.effectiveRole || requester?.role || "",
      }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoiceFile.filename}"`
    );
    res.send(invoiceFile.content);
  });
}
