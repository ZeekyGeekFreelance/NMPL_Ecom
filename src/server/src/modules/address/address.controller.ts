import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { AddressService } from "@/modules/address/address.service";
import NotFoundError from "@/shared/errors/NotFoundError";
import { makeLogsService } from "../logs/logs.factory";
import AppError from "@/shared/errors/AppError";

export class AddressController {
  private logsService = makeLogsService();
  constructor(private addressService: AddressService) {}

  getUserAddresses = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError("User");
    }
    const addresses = await this.addressService.getUserAddresses(userId);
    sendResponse(res, 200, {
      data: { addresses },
      message: "Addresses retrieved successfully",
    });
  });

  createAddress = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "User not found");
    }

    const address = await this.addressService.createAddress(userId, req.body || {});
    sendResponse(res, 201, {
      data: { address },
      message: "Address added successfully",
    });
  });

  getAddressDetails = asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError("User");
    }
    const address = await this.addressService.getAddressDetails(
      addressId,
      userId
    );
    sendResponse(res, 200, {
      data: { address },
      message: "Address details retrieved successfully",
    });
  });

  updateAddress = asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError("User");
    }

    const address = await this.addressService.updateAddress(
      addressId,
      userId,
      req.body || {}
    );
    sendResponse(res, 200, {
      data: { address },
      message: "Address updated successfully",
    });
  });

  setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError("User");
    }

    const address = await this.addressService.setDefaultAddress(addressId, userId);
    sendResponse(res, 200, {
      data: { address },
      message: "Default address updated successfully",
    });
  });

  deleteAddress = asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError("User");
    }

    await this.addressService.deleteAddress(addressId, userId);
    sendResponse(res, 200, { message: "Address deleted successfully" });
    const start = Date.now();
    const end = Date.now();

    this.logsService.info("Address deleted", {
      userId: req.user?.id,
      sessionId: req.session.id,
      timePeriod: end - start,
    });
  });
}
