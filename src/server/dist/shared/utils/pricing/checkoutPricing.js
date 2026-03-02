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
exports.buildCheckoutPricing = exports.resolveDeliveryQuote = exports.getPickupLocationSnapshot = exports.getAddressForCheckout = exports.calculateItemsSubtotal = void 0;
const database_config_1 = __importDefault(require("@/infra/database/database.config"));
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const branding_1 = require("@/shared/utils/branding");
const client_1 = require("@prisma/client");
const config_1 = require("@/config");
const normalizeText = (value) => String(value !== null && value !== void 0 ? value : "")
    .trim()
    .toUpperCase();
const getBangaloreAliases = () => {
    return config_1.config.delivery.bangaloreCityAliases
        .split(",")
        .map((value) => normalizeText(value))
        .filter(Boolean);
};
const getBangaloreDeliveryCharge = () => config_1.config.delivery.bangaloreCharge;
const normalizeDeliveryMode = (mode) => {
    const normalizedMode = normalizeText(mode);
    if (normalizedMode === client_1.DELIVERY_MODE.PICKUP) {
        return client_1.DELIVERY_MODE.PICKUP;
    }
    return client_1.DELIVERY_MODE.DELIVERY;
};
const calculateItemsSubtotal = (items) => {
    const subtotal = items.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const price = Number(item.price);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new AppError_1.default(400, "Invalid item quantity in checkout payload.");
        }
        if (!Number.isFinite(price) || price < 0) {
            throw new AppError_1.default(400, "Invalid item price in checkout payload.");
        }
        return sum + quantity * price;
    }, 0);
    return Number(subtotal.toFixed(2));
};
exports.calculateItemsSubtotal = calculateItemsSubtotal;
const getAddressForCheckout = (userId, addressId) => __awaiter(void 0, void 0, void 0, function* () {
    const normalizedAddressId = String(addressId || "").trim();
    if (!normalizedAddressId) {
        throw new AppError_1.default(400, "Address selection is required.");
    }
    const address = yield database_config_1.default.address.findUnique({
        where: {
            id: normalizedAddressId,
        },
    });
    if (!address || address.userId !== userId) {
        throw new AppError_1.default(404, "Selected address was not found for this account.");
    }
    return {
        id: address.id,
        sourceAddressId: address.id,
        type: address.type,
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        line1: address.line1,
        line2: address.line2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.pincode,
    };
});
exports.getAddressForCheckout = getAddressForCheckout;
const getPickupLocationSnapshot = () => {
    const platformName = (0, branding_1.getPlatformName)();
    return {
        id: "PICKUP_LOCATION",
        sourceAddressId: null,
        type: client_1.ADDRESS_TYPE.OTHER,
        fullName: config_1.config.delivery.pickupStoreName || `${platformName} Pickup Desk`,
        phoneNumber: config_1.config.delivery.pickupStorePhone,
        line1: config_1.config.delivery.pickupStoreLine1,
        line2: config_1.config.delivery.pickupStoreLine2 || null,
        landmark: config_1.config.delivery.pickupStoreLandmark || null,
        city: config_1.config.delivery.pickupStoreCity,
        state: config_1.config.delivery.pickupStoreState,
        country: config_1.config.delivery.pickupStoreCountry,
        pincode: config_1.config.delivery.pickupStorePincode,
    };
};
exports.getPickupLocationSnapshot = getPickupLocationSnapshot;
const resolveDeliveryQuote = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const mode = normalizeDeliveryMode(params.deliveryMode);
    const city = String(((_a = params.address) === null || _a === void 0 ? void 0 : _a.city) || "").trim();
    const normalizedCity = normalizeText(city);
    const normalizedPincode = String(((_b = params.address) === null || _b === void 0 ? void 0 : _b.pincode) || "").trim();
    if (mode === client_1.DELIVERY_MODE.PICKUP) {
        return {
            deliveryMode: client_1.DELIVERY_MODE.PICKUP,
            deliveryCharge: 0,
            deliveryLabel: "In-Store Pickup",
            serviceArea: city || null,
        };
    }
    if (!params.address) {
        throw new AppError_1.default(400, "Address selection is required for delivery.");
    }
    if (!normalizedPincode) {
        throw new AppError_1.default(400, "Selected address has no valid pincode for delivery calculation.");
    }
    const bangaloreAliases = getBangaloreAliases();
    if (bangaloreAliases.includes(normalizedCity)) {
        return {
            deliveryMode: client_1.DELIVERY_MODE.DELIVERY,
            deliveryCharge: Number(getBangaloreDeliveryCharge().toFixed(2)),
            deliveryLabel: "Bangalore Delivery",
            serviceArea: city || "Bangalore",
        };
    }
    const deliveryRate = yield database_config_1.default.deliveryRate.findUnique({
        where: {
            pincode: normalizedPincode,
        },
        select: {
            pincode: true,
            city: true,
            state: true,
            charge: true,
            isServiceable: true,
        },
    });
    if (!deliveryRate || !deliveryRate.isServiceable) {
        throw new AppError_1.default(400, "Delivery is unavailable for this pincode. Choose pickup or another address.");
    }
    return {
        deliveryMode: client_1.DELIVERY_MODE.DELIVERY,
        deliveryCharge: Number(Number(deliveryRate.charge || 0).toFixed(2)),
        deliveryLabel: `Delivery (${deliveryRate.pincode})`,
        serviceArea: [deliveryRate.city, deliveryRate.state].filter(Boolean).join(", ") ||
            deliveryRate.pincode,
    };
});
exports.resolveDeliveryQuote = resolveDeliveryQuote;
const buildCheckoutPricing = (params) => {
    const subtotalAmount = (0, exports.calculateItemsSubtotal)(params.items);
    const deliveryCharge = Number(params.deliveryQuote.deliveryCharge.toFixed(2));
    const finalTotal = Number((subtotalAmount + deliveryCharge).toFixed(2));
    return {
        subtotalAmount,
        deliveryCharge,
        finalTotal,
        deliveryMode: params.deliveryQuote.deliveryMode,
        deliveryLabel: params.deliveryQuote.deliveryLabel,
        serviceArea: params.deliveryQuote.serviceArea,
    };
};
exports.buildCheckoutPricing = buildCheckoutPricing;
