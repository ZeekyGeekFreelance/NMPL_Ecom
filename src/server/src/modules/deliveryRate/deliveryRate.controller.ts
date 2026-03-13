import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { DeliveryRateService } from "./deliveryRate.service";

export class DeliveryRateController {
  constructor(private deliveryRateService: DeliveryRateService) {}

  getStateRates = asyncHandler(async (_req: Request, res: Response) => {
    const rates = await this.deliveryRateService.getAllStateRates();

    sendResponse(res, 200, {
      data: { rates },
      message: "State delivery fees fetched successfully",
    });
  });

  upsertStateRate = asyncHandler(async (req: Request, res: Response) => {
    const state = String(req.params.state || "");
    const rate = await this.deliveryRateService.upsertStateRate(state, req.body);

    sendResponse(res, 200, {
      data: { rate },
      message: "State delivery fee saved successfully",
    });
  });

  deleteStateRate = asyncHandler(async (req: Request, res: Response) => {
    const state = String(req.params.state || "");
    await this.deliveryRateService.deleteStateRate(state);

    sendResponse(res, 200, {
      message: "State delivery fee mapping removed successfully",
    });
  });
}
