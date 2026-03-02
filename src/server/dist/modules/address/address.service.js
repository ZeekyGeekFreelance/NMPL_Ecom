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
exports.AddressService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const client_1 = require("@prisma/client");
class AddressService {
    constructor(addressRepository) {
        this.addressRepository = addressRepository;
    }
    normalizeAddressInput(payload) {
        const normalizeString = (value) => String(value !== null && value !== void 0 ? value : "").trim();
        const normalizeNullableString = (value) => {
            const normalized = normalizeString(value);
            return normalized ? normalized : null;
        };
        const normalizedPincode = normalizeString(payload.pincode);
        if (normalizedPincode && !/^[A-Za-z0-9-]{3,12}$/.test(normalizedPincode)) {
            throw new AppError_1.default(400, "Pincode must be between 3 and 12 characters.");
        }
        return {
            type: payload.type || client_1.ADDRESS_TYPE.HOME,
            fullName: normalizeString(payload.fullName),
            phoneNumber: normalizeString(payload.phoneNumber),
            line1: normalizeString(payload.line1),
            line2: normalizeNullableString(payload.line2),
            landmark: normalizeNullableString(payload.landmark),
            city: normalizeString(payload.city),
            state: normalizeString(payload.state),
            country: normalizeString(payload.country),
            pincode: normalizedPincode,
            isDefault: Boolean(payload.isDefault),
        };
    }
    getUserAddresses(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.addressRepository.findAddressesByUserId(userId);
        });
    }
    getAddressDetails(addressId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const address = yield this.addressRepository.findAddressById(addressId);
            if (!address) {
                throw new AppError_1.default(404, "Address not found");
            }
            if (address.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to view this address");
            }
            return address;
        });
    }
    createAddress(userId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = this.normalizeAddressInput(payload);
            if (!normalized.fullName ||
                !normalized.phoneNumber ||
                !normalized.line1 ||
                !normalized.city ||
                !normalized.state ||
                !normalized.country ||
                !normalized.pincode) {
                throw new AppError_1.default(400, "Address fields are incomplete.");
            }
            return database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const existingCount = yield this.addressRepository.countUserAddresses(userId);
                const shouldMakeDefault = normalized.isDefault || existingCount === 0;
                if (shouldMakeDefault) {
                    yield this.addressRepository.unsetDefaultAddresses(userId, tx);
                }
                return this.addressRepository.createAddress({
                    userId,
                    type: normalized.type,
                    fullName: normalized.fullName,
                    phoneNumber: normalized.phoneNumber,
                    line1: normalized.line1,
                    line2: normalized.line2,
                    landmark: normalized.landmark,
                    city: normalized.city,
                    state: normalized.state,
                    country: normalized.country,
                    pincode: normalized.pincode,
                    isDefault: shouldMakeDefault,
                }, tx);
            }));
        });
    }
    updateAddress(addressId, userId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingAddress = yield this.addressRepository.findAddressById(addressId);
            if (!existingAddress || existingAddress.userId !== userId) {
                throw new AppError_1.default(404, "Address not found");
            }
            const normalized = this.normalizeAddressInput(payload);
            const updateData = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (payload.type ? { type: normalized.type } : {})), (payload.fullName !== undefined ? { fullName: normalized.fullName } : {})), (payload.phoneNumber !== undefined
                ? { phoneNumber: normalized.phoneNumber }
                : {})), (payload.line1 !== undefined ? { line1: normalized.line1 } : {})), (payload.line2 !== undefined ? { line2: normalized.line2 } : {})), (payload.landmark !== undefined ? { landmark: normalized.landmark } : {})), (payload.city !== undefined ? { city: normalized.city } : {})), (payload.state !== undefined ? { state: normalized.state } : {})), (payload.country !== undefined ? { country: normalized.country } : {})), (payload.pincode !== undefined ? { pincode: normalized.pincode } : {})), (payload.isDefault !== undefined ? { isDefault: normalized.isDefault } : {}));
            return database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                if (payload.isDefault === true) {
                    yield this.addressRepository.unsetDefaultAddresses(userId, tx);
                }
                return this.addressRepository.updateAddress(addressId, updateData, tx);
            }));
        });
    }
    setDefaultAddress(addressId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingAddress = yield this.addressRepository.findAddressById(addressId);
            if (!existingAddress || existingAddress.userId !== userId) {
                throw new AppError_1.default(404, "Address not found");
            }
            yield database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield this.addressRepository.unsetDefaultAddresses(userId, tx);
                yield this.addressRepository.updateAddress(addressId, { isDefault: true }, tx);
            }));
            const updatedAddress = yield this.addressRepository.findAddressById(addressId);
            if (!updatedAddress) {
                throw new AppError_1.default(500, "Default address was updated but could not be loaded");
            }
            return updatedAddress;
        });
    }
    deleteAddress(addressId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const address = yield this.addressRepository.findAddressById(addressId);
            if (!address) {
                throw new AppError_1.default(404, "Address not found");
            }
            if (address.userId !== userId) {
                throw new AppError_1.default(403, "You are not authorized to delete this address");
            }
            yield database_config_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield this.addressRepository.deleteAddress(addressId, tx);
                if (address.isDefault) {
                    const nextDefault = yield this.addressRepository.findNextAddressForDefault(userId, addressId, tx);
                    if (nextDefault) {
                        yield this.addressRepository.updateAddress(nextDefault.id, { isDefault: true }, tx);
                    }
                }
            }));
        });
    }
}
exports.AddressService = AddressService;
