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
exports.AddressController = void 0;
const asyncHandler_1 = __importDefault(require("@/shared/utils/asyncHandler"));
const sendResponse_1 = __importDefault(require("@/shared/utils/sendResponse"));
const NotFoundError_1 = __importDefault(require("@/shared/errors/NotFoundError"));
const logs_factory_1 = require("../logs/logs.factory");
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
class AddressController {
    constructor(addressService) {
        this.addressService = addressService;
        this.logsService = (0, logs_factory_1.makeLogsService)();
        this.getUserAddresses = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new NotFoundError_1.default("User");
            }
            const addresses = yield this.addressService.getUserAddresses(userId);
            (0, sendResponse_1.default)(res, 200, {
                data: { addresses },
                message: "Addresses retrieved successfully",
            });
        }));
        this.createAddress = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new AppError_1.default(401, "User not found");
            }
            const address = yield this.addressService.createAddress(userId, req.body || {});
            (0, sendResponse_1.default)(res, 201, {
                data: { address },
                message: "Address added successfully",
            });
        }));
        this.getAddressDetails = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { addressId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new NotFoundError_1.default("User");
            }
            const address = yield this.addressService.getAddressDetails(addressId, userId);
            (0, sendResponse_1.default)(res, 200, {
                data: { address },
                message: "Address details retrieved successfully",
            });
        }));
        this.updateAddress = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { addressId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new NotFoundError_1.default("User");
            }
            const address = yield this.addressService.updateAddress(addressId, userId, req.body || {});
            (0, sendResponse_1.default)(res, 200, {
                data: { address },
                message: "Address updated successfully",
            });
        }));
        this.setDefaultAddress = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { addressId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new NotFoundError_1.default("User");
            }
            const address = yield this.addressService.setDefaultAddress(addressId, userId);
            (0, sendResponse_1.default)(res, 200, {
                data: { address },
                message: "Default address updated successfully",
            });
        }));
        this.deleteAddress = (0, asyncHandler_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { addressId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new NotFoundError_1.default("User");
            }
            yield this.addressService.deleteAddress(addressId, userId);
            (0, sendResponse_1.default)(res, 200, { message: "Address deleted successfully" });
            const start = Date.now();
            const end = Date.now();
            this.logsService.info("Address deleted", {
                userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                sessionId: req.session.id,
                timePeriod: end - start,
            });
        }));
    }
}
exports.AddressController = AddressController;
