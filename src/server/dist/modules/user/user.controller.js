"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const asyncHandler_1 = __importDefault(require("@/shared/utils/asyncHandler"));
const sendResponse_1 = __importDefault(require("@/shared/utils/sendResponse"));
const logs_factory_1 = require("../logs/logs.factory");
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
    if (isDevelopment) {
        console.log(...args);
    }
};
class UserController {
    constructor(userService) {
        this.userService = userService;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.getAllUsers = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const users = yield this.userService.getAllUsers();
            (0, sendResponse_1.default)(res, 200, {
                data: { users },
                message: "Users fetched successfully",
            });
        }));
        this.getUserById = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const user = yield this.userService.getUserById(id);
            (0, sendResponse_1.default)(res, 200, {
                data: { user },
                message: "User fetched successfully",
            });
        }));
        this.getUserByEmail = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { email } = req.params;
            const user = yield this.userService.getUserByEmail(email);
            (0, sendResponse_1.default)(res, 200, {
                data: { user },
                message: "User fetched successfully",
            });
        }));
        this.getMe = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            debugLog("id: ", id);
            const user = yield this.userService.getMe(id);
            debugLog("user: ", user);
            (0, sendResponse_1.default)(res, 200, {
                data: { user },
                message: "User fetched successfully",
            });
        }));
        this.updateCurrentUserProfile = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            const { name } = req.body;
            const user = yield this.userService.updateCurrentUserProfile(currentUserId, {
                name,
            });
            (0, sendResponse_1.default)(res, 200, {
                data: { user },
                message: "Profile updated successfully",
            });
            this.logsService.info("Self profile updated", {
                userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                sessionId: req.session.id,
            });
        }));
        this.updateMe = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const updatedData = req.body;
            const user = yield this.userService.updateMe(id, updatedData);
            (0, sendResponse_1.default)(res, 200, {
                data: { user },
                message: "User updated successfully",
            });
            const start = Date.now();
            const end = Date.now();
            this.logsService.info("User updated", {
                userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                sessionId: req.session.id,
                timePeriod: end - start,
            });
        }));
        this.deleteUser = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { id } = req.params;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            yield this.userService.deleteUser(id, currentUserId);
            (0, sendResponse_1.default)(res, 204, { message: "User deleted successfully" });
            const start = Date.now();
            const end = Date.now();
            this.logsService.info("User deleted", {
                userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                sessionId: req.session.id,
                timePeriod: end - start,
            });
        }));
        this.createAdmin = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { name, email, password } = req.body;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            const newAdmin = yield this.userService.createAdmin({ name, email, password }, currentUserId);
            (0, sendResponse_1.default)(res, 201, {
                data: { user: newAdmin },
                message: "Admin created successfully",
            });
            const start = Date.now();
            const end = Date.now();
            this.logsService.info("Admin created", {
                userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                sessionId: req.session.id,
                timePeriod: end - start,
            });
        }));
        this.getDealers = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const rawStatus = typeof req.query.status === "string"
                ? req.query.status.toUpperCase()
                : undefined;
            const allowedStatuses = new Set(["PENDING", "APPROVED", "REJECTED"]);
            const status = rawStatus && allowedStatuses.has(rawStatus)
                ? rawStatus
                : undefined;
            const dealers = yield this.userService.getDealers(status);
            (0, sendResponse_1.default)(res, 200, {
                data: { dealers },
                message: "Dealers fetched successfully",
            });
        }));
        this.createDealer = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            const { name, email, password, businessName, contactPhone } = req.body;
            const dealer = yield this.userService.createDealer({
                name,
                email,
                password,
                businessName,
                contactPhone,
            }, currentUserId);
            (0, sendResponse_1.default)(res, 201, {
                data: { dealer },
                message: "Dealer created successfully",
            });
        }));
        this.updateDealerStatus = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            const dealerId = req.params.id;
            const { status } = req.body;
            const dealer = yield this.userService.updateDealerStatus(dealerId, status, currentUserId);
            (0, sendResponse_1.default)(res, 200, {
                data: { dealer },
                message: "Dealer status updated successfully",
            });
        }));
        this.deleteDealer = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            const dealerId = req.params.id;
            yield this.userService.deleteDealer(dealerId, currentUserId);
            (0, sendResponse_1.default)(res, 200, {
                message: "Dealer deleted successfully",
            });
        }));
        this.setDealerPrices = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            const dealerId = req.params.id;
            const { prices = [] } = req.body;
            const mappings = yield this.userService.setDealerPrices(dealerId, prices, currentUserId);
            (0, sendResponse_1.default)(res, 200, {
                data: { prices: mappings },
                message: "Dealer prices updated successfully",
            });
        }));
        this.getDealerPrices = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!currentUserId) {
                throw new AppError_1.default(401, "User not authenticated");
            }
            const dealerId = req.params.id;
            const prices = yield this.userService.getDealerPrices(dealerId, currentUserId);
            (0, sendResponse_1.default)(res, 200, {
                data: { prices },
                message: "Dealer prices fetched successfully",
            });
        }));
    }
}
exports.UserController = UserController;
