import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import AppError from "@/shared/errors/AppError";
import { TransactionService } from "./transaction.service";
import sendResponse from "@/shared/utils/sendResponse";

export class TransactionController {
  constructor(private transactionService: TransactionService) {}

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
        }
      );

      sendResponse(res, 200, {
        data: { updatedTransaction },
        message: "Updated transaction successfully",
      });
    }
  );

  deleteTransaction = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.transactionService.deleteTransaction(id);
    sendResponse(res, 204, { message: "Deleted transaction successfully" });
  });
}
