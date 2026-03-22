import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import AppError from "@/shared/errors/AppError";
import { TransactionService } from "./transaction.service";
import sendResponse from "@/shared/utils/sendResponse";

export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  getTransactionSummary = asyncHandler(async (_req: Request, res: Response) => {
    const summary = await this.transactionService.getTransactionSummary();

    sendResponse(res, 200, {
      data: { summary },
      message: "Fetched transaction summary successfully",
    });
  });

  getAllTransactions = asyncHandler(async (req: Request, res: Response) => {
    const {
      transactions,
      totalResults,
      totalPages,
      currentPage,
      resultsPerPage,
    } = await this.transactionService.getAllTransactions(req.query);

    sendResponse(res, 200, {
      data: {
        transactions,
        totalResults,
        totalPages,
        currentPage,
        resultsPerPage,
      },
      message: "Fetched transactions successfully",
    });
  });
  getTransactionById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const transaction = await this.transactionService.getTransactionById(id);

    sendResponse(res, 200, {
      data: { transaction },
      message: "Fetched transaction successfully",
    });
  });
  updateTransactionStatus = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const rawStatus = req.body?.status;
      const forceConfirmedRejection = req.body?.forceConfirmedRejection === true;
      const confirmationToken =
        typeof req.body?.confirmationToken === "string"
          ? req.body.confirmationToken.trim()
          : undefined;
      if (typeof rawStatus !== "string" || !rawStatus.trim()) {
        throw new AppError(400, "Status is required");
      }

      const updatedTransaction = await this.transactionService.updateTransactionStatus(
        id,
        {
          status: rawStatus.trim().toUpperCase(),
          forceConfirmedRejection,
          confirmationToken,
          actorUserId: req.user?.id,
          actorRole: req.user?.effectiveRole || req.user?.role,
        }
      );

      sendResponse(res, 200, {
        data: { updatedTransaction },
        message: "Updated transaction successfully",
      });
    }
  );

  updateTransactionQuotation = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const rawQuotationItems = req.body?.quotationItems;

      if (!Array.isArray(rawQuotationItems) || rawQuotationItems.length === 0) {
        throw new AppError(
          400,
          "quotationItems is required and must be a non-empty array."
        );
      }

      const quotationItems = rawQuotationItems.map((item: any) => {
        const orderItemId = String(item?.orderItemId || "").trim();
        const quantity = Number(item?.quantity);
        const price = Number(item?.price);

        if (!orderItemId) {
          throw new AppError(400, "Each quotation item must include orderItemId.");
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new AppError(
            400,
            `Invalid quotation quantity for order item ${orderItemId}.`
          );
        }

        if (!Number.isFinite(price) || price < 0) {
          throw new AppError(
            400,
            `Invalid quotation price for order item ${orderItemId}.`
          );
        }

        return {
          orderItemId,
          quantity,
          price: Number(price.toFixed(2)),
        };
      });

      const updatedTransaction = await this.transactionService.issueQuotation(
        id,
        quotationItems,
        {
          actorUserId: req.user?.id,
          actorRole: req.user?.effectiveRole || req.user?.role,
        }
      );

      sendResponse(res, 200, {
        data: { updatedTransaction },
        message: "Quotation updated and issued successfully",
      });
    }
  );

  deleteTransaction = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.transactionService.deleteTransaction(id);
    sendResponse(res, 204, { message: "Deleted transaction successfully" });
  });
}
