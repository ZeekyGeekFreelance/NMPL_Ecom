import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { GstService } from "./gst.service";

export class GstController {
  constructor(private gstService: GstService) {}

  getAllGsts = asyncHandler(async (_req: Request, res: Response) => {
    const gsts = await this.gstService.getAllGsts();

    sendResponse(res, 200, {
      data: { gsts },
      message: "GST masters fetched successfully",
    });
  });

  createGst = asyncHandler(async (req: Request, res: Response) => {
    const gst = await this.gstService.createGst(req.body);

    sendResponse(res, 201, {
      data: { gst },
      message: "GST master created successfully",
    });
  });

  updateGst = asyncHandler(async (req: Request, res: Response) => {
    const gst = await this.gstService.updateGst(String(req.params.id || ""), req.body);

    sendResponse(res, 200, {
      data: { gst },
      message: "GST master updated successfully",
    });
  });

  setActivation = asyncHandler(async (req: Request, res: Response) => {
    const gst = await this.gstService.setActivation(
      String(req.params.id || ""),
      Boolean(req.body?.isActive)
    );

    sendResponse(res, 200, {
      data: { gst },
      message: "GST activation updated successfully",
    });
  });
}
