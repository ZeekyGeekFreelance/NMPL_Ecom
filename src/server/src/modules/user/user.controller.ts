import { Request, Response } from "express";
import { UserService } from "./user.service";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { makeLogsService } from "../logs/logs.factory";
import AppError from "@/shared/errors/AppError";
import { config } from "@/config";

const isDevelopment = config.isDevelopment;
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export class UserController {
  private logsService = makeLogsService();
  constructor(private userService: UserService) {}

  getAllUsers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const users = await this.userService.getAllUsers({ page, limit });
      sendResponse(res, 200, {
        data: { users },
        message: "Users fetched successfully",
      });
    }
  );

  getUserById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      sendResponse(res, 200, {
        data: { user },
        message: "User fetched successfully",
      });
    }
  );

  getUserByEmail = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = req.params;
      const user = await this.userService.getUserByEmail(email);
      sendResponse(res, 200, {
        data: { user },
        message: "User fetched successfully",
      });
    }
  );

  getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.user?.id;
    debugLog("id: ", id);
    const user = await this.userService.getMe(id);
    debugLog("user: ", user);
    sendResponse(res, 200, {
      data: { user },
      message: "User fetched successfully",
    });
  });

  updateCurrentUserProfile = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const { name, phone } = req.body as { name?: string; phone?: string };
      const user = await this.userService.updateCurrentUserProfile(currentUserId, {
        name,
        phone,
      });

      sendResponse(res, 200, {
        data: { user },
        message: "Profile updated successfully",
      });

      this.logsService.info("Self profile updated", {
        userId: req.user?.id,
        sessionId: req.session.id,
      });
    }
  );

  updateMe = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updatedData = req.body;
      const start = Date.now();
      const user = await this.userService.updateMe(id, updatedData);
      sendResponse(res, 200, {
        data: { user },
        message: "User updated successfully",
      });

      this.logsService.info("User updated", {
        userId: req.user?.id,
        sessionId: req.session.id,
      });
    }
  );

  deleteUser = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const start = Date.now();
      await this.userService.deleteUser(id, currentUserId);
      sendResponse(res, 204, { message: "User deleted successfully" });

      this.logsService.info("User deleted", {
        userId: req.user?.id,
        sessionId: req.session.id,
        timePeriod: Date.now() - start,
      });
    }
  );

  createAdmin = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { name, email, phone, password, assignBillingSupervisor } = req.body;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const newAdmin = await this.userService.createAdmin(
        { name, email, phone, password, assignBillingSupervisor },
        currentUserId
      );

      sendResponse(res, 201, {
        data: { user: newAdmin },
        message: assignBillingSupervisor
          ? "Admin created and assigned to billing successfully"
          : "Admin created successfully",
      });

      this.logsService.info("Admin created", {
        userId: req.user?.id,
        sessionId: req.session.id,
      });
    }
  );

  updateBillingSupervisor = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const { id } = req.params;
      const { isBillingSupervisor } = req.body as {
        isBillingSupervisor: boolean;
      };

      const user = await this.userService.updateBillingSupervisor(
        id,
        isBillingSupervisor,
        currentUserId
      );

      sendResponse(res, 200, {
        data: { user },
        message: isBillingSupervisor
          ? "Billing supervisor assigned successfully"
          : "Billing supervisor removed successfully",
      });
    }
  );

  updateAdminPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const { id } = req.params;
      const { newPassword } = req.body as { newPassword: string };

      const user = await this.userService.updateAdminPassword(
        id,
        newPassword,
        currentUserId
      );

      sendResponse(res, 200, {
        data: { user },
        message: "Admin password updated successfully",
      });
    }
  );

  getDealers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const rawStatus =
        typeof req.query.status === "string"
          ? req.query.status.toUpperCase()
          : undefined;
      const allowedStatuses = new Set(["PENDING", "APPROVED", "LEGACY", "REJECTED", "SUSPENDED"]);
      const status = rawStatus && allowedStatuses.has(rawStatus)
        ? (rawStatus as "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED")
        : undefined;

      const dealers = await this.userService.getDealers(status);

      sendResponse(res, 200, {
        data: { dealers },
        message: "Dealers fetched successfully",
      });
    }
  );

  createDealer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const { name, email, password, businessName, contactPhone } = req.body;
      const dealer = await this.userService.createDealer(
        {
          name,
          email,
          password,
          businessName,
          contactPhone,
        },
        currentUserId
      );

      sendResponse(res, 201, {
        data: { dealer },
        message: "Dealer created successfully",
      });
    }
  );

  updateDealerStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const dealerId = req.params.id;
      const { status } = req.body;

      const dealer = await this.userService.updateDealerStatus(
        dealerId,
        status,
        currentUserId
      );

      sendResponse(res, 200, {
        data: { dealer },
        message: "Dealer status updated successfully",
      });
    }
  );

  deleteDealer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const dealerId = req.params.id;
      await this.userService.deleteDealer(dealerId, currentUserId);

      sendResponse(res, 200, {
        message: "Dealer deleted successfully",
      });
    }
  );

  setDealerPrices = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const dealerId = req.params.id;
      const { prices = [] } = req.body;

      const mappings = await this.userService.setDealerPrices(
        dealerId,
        prices,
        currentUserId
      );

      sendResponse(res, 200, {
        data: { prices: mappings },
        message: "Dealer prices updated successfully",
      });
    }
  );

  getDealerPrices = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw new AppError(401, "User not authenticated");
      }

      const dealerId = req.params.id;
      const prices = await this.userService.getDealerPrices(
        dealerId,
        currentUserId
      );

      sendResponse(res, 200, {
        data: { prices },
        message: "Dealer prices fetched successfully",
      });
    }
  );
}


