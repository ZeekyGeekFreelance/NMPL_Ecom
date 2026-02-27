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
exports.UserService = void 0;
const AppError_1 = __importDefault(require("@/shared/errors/AppError"));
const accountReference_1 = require("@/shared/utils/accountReference");
class UserService {
    constructor(userRepository, dealerNotificationService) {
        this.userRepository = userRepository;
        this.dealerNotificationService = dealerNotificationService;
    }
    normalizeRole(role) {
        return String(role !== null && role !== void 0 ? role : "")
            .trim()
            .toUpperCase();
    }
    isAdminRole(role) {
        const normalizedRole = this.normalizeRole(role);
        return normalizedRole === "ADMIN" || normalizedRole === "SUPERADMIN";
    }
    isSuperAdminRole(role) {
        return this.normalizeRole(role) === "SUPERADMIN";
    }
    normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
    normalizePhone(phone, label = "Phone number") {
        const normalized = String(phone !== null && phone !== void 0 ? phone : "").trim();
        if (!normalized) {
            throw new AppError_1.default(400, `${label} is required`);
        }
        if (!/^[0-9()+\-\s]{7,20}$/.test(normalized)) {
            throw new AppError_1.default(400, `${label} must be 7-20 characters and contain only valid digits/symbols`);
        }
        return normalized;
    }
    normalizeDisplayName(name, label = "name") {
        const normalized = String(name !== null && name !== void 0 ? name : "")
            .replace(/\s+/g, " ")
            .trim();
        if (!normalized) {
            throw new AppError_1.default(400, `${label} is required`);
        }
        if (normalized.length < 2) {
            throw new AppError_1.default(400, `${label} must be at least 2 characters long`);
        }
        if (normalized.length > 80) {
            throw new AppError_1.default(400, `${label} must be at most 80 characters long`);
        }
        return normalized;
    }
    assertUuid(value, label) {
        const normalized = value === null || value === void 0 ? void 0 : value.trim();
        if (!normalized || !UserService.UUID_PATTERN.test(normalized)) {
            throw new AppError_1.default(400, `Invalid ${label}`);
        }
        return normalized;
    }
    resolveActorName(actor) {
        var _a, _b;
        return ((_a = actor.name) === null || _a === void 0 ? void 0 : _a.trim()) || ((_b = actor.email) === null || _b === void 0 ? void 0 : _b.trim()) || "Admin Team";
    }
    withAccountReference(entity) {
        return Object.assign(Object.assign({}, entity), { accountReference: (0, accountReference_1.toAccountReference)(entity.id) });
    }
    buildDealerPricingDiff(previous, next) {
        const previousByVariant = new Map(previous.map((row) => [row.variantId, row]));
        const nextByVariant = new Map(next.map((row) => [row.variantId, row]));
        const variantIds = new Set([
            ...previousByVariant.keys(),
            ...nextByVariant.keys(),
        ]);
        const changes = [];
        variantIds.forEach((variantId) => {
            var _a, _b, _c, _d, _e, _f;
            const previousRow = previousByVariant.get(variantId);
            const nextRow = nextByVariant.get(variantId);
            const previousPrice = (_a = previousRow === null || previousRow === void 0 ? void 0 : previousRow.customPrice) !== null && _a !== void 0 ? _a : null;
            const nextPrice = (_b = nextRow === null || nextRow === void 0 ? void 0 : nextRow.customPrice) !== null && _b !== void 0 ? _b : null;
            if (previousPrice === nextPrice) {
                return;
            }
            changes.push({
                sku: (_d = (_c = nextRow === null || nextRow === void 0 ? void 0 : nextRow.sku) !== null && _c !== void 0 ? _c : previousRow === null || previousRow === void 0 ? void 0 : previousRow.sku) !== null && _d !== void 0 ? _d : variantId,
                productName: (_f = (_e = nextRow === null || nextRow === void 0 ? void 0 : nextRow.productName) !== null && _e !== void 0 ? _e : previousRow === null || previousRow === void 0 ? void 0 : previousRow.productName) !== null && _f !== void 0 ? _f : "Product",
                previousPrice,
                nextPrice,
            });
        });
        return changes;
    }
    getAllUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            const users = yield this.userRepository.findAllUsers();
            return users.map((user) => this.withAccountReference(user));
        });
    }
    getUserById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = this.assertUuid(id, "user id");
            const user = yield this.userRepository.findUserById(userId);
            if (!user) {
                throw new AppError_1.default(404, "User not found");
            }
            return this.withAccountReference(user);
        });
    }
    getUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userRepository.findUserByEmail(this.normalizeEmail(email));
            if (!user) {
                throw new AppError_1.default(404, "User not found");
            }
            return this.withAccountReference(user);
        });
    }
    getMe(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = this.assertUuid(id, "session user id");
            const user = yield this.userRepository.findUserById(userId);
            if (!user) {
                throw new AppError_1.default(404, "User not found");
            }
            return this.withAccountReference(user);
        });
    }
    updateMe(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = this.assertUuid(id, "user id");
            const user = yield this.userRepository.findUserById(userId);
            if (!user) {
                throw new AppError_1.default(404, "User not found");
            }
            const payload = Object.assign({}, data);
            if (data.name !== undefined) {
                payload.name = this.normalizeDisplayName(data.name, "Name");
            }
            const updatedUser = yield this.userRepository.updateUser(userId, payload);
            return this.withAccountReference(updatedUser);
        });
    }
    updateCurrentUserProfile(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = this.assertUuid(id, "user id");
            const user = yield this.userRepository.findUserById(userId);
            if (!user) {
                throw new AppError_1.default(404, "User not found");
            }
            const updatedUser = yield this.userRepository.updateUser(userId, {
                name: this.normalizeDisplayName(data.name, "Name"),
            });
            return this.withAccountReference(updatedUser);
        });
    }
    deleteUser(id, currentUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const targetUserId = this.assertUuid(id, "user id");
            const actorUserId = this.assertUuid(currentUserId, "actor user id");
            // Prevent self-deletion
            if (targetUserId === actorUserId) {
                throw new AppError_1.default(400, "You cannot delete your own account");
            }
            const user = yield this.userRepository.findUserById(targetUserId);
            if (!user) {
                throw new AppError_1.default(404, "User not found");
            }
            // Prevent deletion of last SUPERADMIN
            if (user.role === "SUPERADMIN") {
                const superAdminCount = yield this.userRepository.countUsersByRole("SUPERADMIN");
                if (superAdminCount <= 1) {
                    throw new AppError_1.default(400, "Cannot delete the last SuperAdmin");
                }
            }
            yield this.userRepository.deleteUser(targetUserId);
        });
    }
    createAdmin(adminData, createdByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actorUserId = this.assertUuid(createdByUserId, "actor user id");
            const creator = yield this.userRepository.findUserById(actorUserId);
            if (!creator) {
                throw new AppError_1.default(404, "Creator user not found");
            }
            if (!this.isSuperAdminRole(creator.role)) {
                throw new AppError_1.default(403, "Only SuperAdmins can create new admins");
            }
            // Check if user already exists
            const normalizedEmail = this.normalizeEmail(adminData.email);
            const normalizedPhone = this.normalizePhone(adminData.phone);
            const existingUser = yield this.userRepository.findUserByEmail(normalizedEmail);
            if (existingUser) {
                throw new AppError_1.default(400, "User with this email already exists");
            }
            // Create new admin with ADMIN role (not SUPERADMIN)
            const newAdmin = yield this.userRepository.createUser(Object.assign(Object.assign({}, adminData), { email: normalizedEmail, phone: normalizedPhone, role: "ADMIN" }));
            return this.withAccountReference(newAdmin);
        });
    }
    getDealers(status) {
        return __awaiter(this, void 0, void 0, function* () {
            const dealers = yield this.userRepository.getDealers(status);
            return dealers.map((dealer) => ({
                id: dealer.id,
                accountReference: (0, accountReference_1.toAccountReference)(dealer.id),
                name: dealer.name,
                email: dealer.email,
                role: dealer.role,
                avatar: dealer.avatar,
                createdAt: dealer.createdAt,
                updatedAt: dealer.updatedAt,
                dealerProfile: {
                    id: dealer.dealerProfileId,
                    businessName: dealer.businessName,
                    contactPhone: dealer.contactPhone,
                    status: dealer.status,
                    approvedAt: dealer.approvedAt,
                    approvedBy: dealer.approvedBy,
                    createdAt: dealer.dealerCreatedAt,
                    updatedAt: dealer.dealerUpdatedAt,
                },
            }));
        });
    }
    createDealer(dealerData, createdByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const actorUserId = this.assertUuid(createdByUserId, "actor user id");
            const creator = yield this.userRepository.findUserById(actorUserId);
            if (!creator) {
                throw new AppError_1.default(404, "Creator user not found");
            }
            if (!this.isAdminRole(creator.role)) {
                throw new AppError_1.default(403, "Only Admin or SuperAdmin can register dealers");
            }
            const normalizedEmail = this.normalizeEmail(dealerData.email);
            const normalizedPhone = this.normalizePhone(dealerData.contactPhone, "Contact phone");
            const existingUser = yield this.userRepository.findUserByEmail(normalizedEmail);
            if (existingUser) {
                throw new AppError_1.default(400, "User with this email already exists");
            }
            const newDealerUser = yield this.userRepository.createUser({
                name: dealerData.name,
                email: normalizedEmail,
                phone: normalizedPhone,
                password: dealerData.password,
                role: "USER",
            });
            yield this.userRepository.upsertDealerProfile({
                userId: newDealerUser.id,
                businessName: (_a = dealerData.businessName) !== null && _a !== void 0 ? _a : null,
                contactPhone: normalizedPhone,
                status: "APPROVED",
                approvedBy: actorUserId,
            });
            const dealerUser = yield this.userRepository.findUserById(newDealerUser.id);
            if (dealerUser) {
                yield this.dealerNotificationService.sendDealerAccountCreated({
                    recipientName: dealerUser.name,
                    recipientEmail: dealerUser.email,
                    businessName: (_b = dealerData.businessName) !== null && _b !== void 0 ? _b : null,
                    accountReference: (0, accountReference_1.toAccountReference)(dealerUser.id),
                    temporaryPassword: dealerData.password,
                });
            }
            if (!dealerUser) {
                throw new AppError_1.default(500, "Dealer account created but profile load failed");
            }
            return this.withAccountReference(dealerUser);
        });
    }
    updateDealerStatus(dealerId, status, updatedByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actorUserId = this.assertUuid(updatedByUserId, "actor user id");
            const safeDealerId = this.assertUuid(dealerId, "dealer id");
            const currentUser = yield this.userRepository.findUserById(actorUserId);
            if (!currentUser) {
                throw new AppError_1.default(404, "User not found");
            }
            if (!this.isAdminRole(currentUser.role)) {
                throw new AppError_1.default(403, "Only Admin or SuperAdmin can update dealer status");
            }
            const dealerUser = yield this.userRepository.findUserById(safeDealerId);
            if (!dealerUser) {
                throw new AppError_1.default(404, "Dealer user not found");
            }
            const dealerProfile = yield this.userRepository.updateDealerStatus(safeDealerId, status, actorUserId);
            if (!dealerProfile) {
                throw new AppError_1.default(404, "Dealer profile not found");
            }
            yield this.dealerNotificationService.sendDealerStatusUpdated({
                recipientName: dealerUser.name,
                recipientEmail: dealerUser.email,
                businessName: dealerProfile.businessName,
                accountReference: (0, accountReference_1.toAccountReference)(dealerUser.id),
                status,
                reviewedBy: this.resolveActorName(currentUser),
            });
            return Object.assign(Object.assign({}, this.withAccountReference(dealerUser)), { dealerProfile });
        });
    }
    deleteDealer(dealerId, deletedByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actorUserId = this.assertUuid(deletedByUserId, "actor user id");
            const safeDealerId = this.assertUuid(dealerId, "dealer id");
            const currentUser = yield this.userRepository.findUserById(actorUserId);
            if (!currentUser) {
                throw new AppError_1.default(404, "User not found");
            }
            if (!this.isAdminRole(currentUser.role)) {
                throw new AppError_1.default(403, "Only Admin or SuperAdmin can delete dealer accounts");
            }
            const dealerUser = yield this.userRepository.findUserById(safeDealerId);
            if (!dealerUser) {
                throw new AppError_1.default(404, "Dealer user not found");
            }
            if (dealerUser.role !== "USER") {
                throw new AppError_1.default(400, "Only USER role can be treated as dealer account");
            }
            const dealerProfile = yield this.userRepository.findDealerProfileByUserId(safeDealerId);
            if (!dealerProfile) {
                throw new AppError_1.default(404, "Dealer profile not found");
            }
            yield this.userRepository.deleteUser(safeDealerId);
            yield this.dealerNotificationService.sendDealerRemoved({
                recipientName: dealerUser.name,
                recipientEmail: dealerUser.email,
                businessName: dealerProfile.businessName,
                accountReference: (0, accountReference_1.toAccountReference)(dealerUser.id),
                removedBy: this.resolveActorName(currentUser),
            });
        });
    }
    setDealerPrices(dealerId, prices, updatedByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actorUserId = this.assertUuid(updatedByUserId, "actor user id");
            const safeDealerId = this.assertUuid(dealerId, "dealer id");
            const currentUser = yield this.userRepository.findUserById(actorUserId);
            if (!currentUser) {
                throw new AppError_1.default(404, "User not found");
            }
            if (!this.isAdminRole(currentUser.role)) {
                throw new AppError_1.default(403, "Only Admin or SuperAdmin can configure dealer prices");
            }
            const dealerProfile = yield this.userRepository.findDealerProfileByUserId(safeDealerId);
            if (!dealerProfile) {
                throw new AppError_1.default(404, "Dealer profile not found");
            }
            const normalizedPrices = Array.from(new Map(prices.map((price) => {
                const safeVariantId = this.assertUuid(price.variantId, "variant id");
                return [
                    safeVariantId,
                    {
                        variantId: safeVariantId,
                        customPrice: Number(price.customPrice),
                    },
                ];
            })).values());
            if (normalizedPrices.some((price) => Number.isNaN(price.customPrice))) {
                throw new AppError_1.default(400, "Custom price must be numeric");
            }
            if (normalizedPrices.some((price) => price.customPrice < 0)) {
                throw new AppError_1.default(400, "Custom price cannot be negative");
            }
            const variantIds = normalizedPrices.map((price) => price.variantId);
            if (variantIds.length > 0) {
                const uniqueVariantIds = new Set(variantIds);
                if (uniqueVariantIds.size !== variantIds.length) {
                    throw new AppError_1.default(400, "Duplicate variants found in pricing payload");
                }
                const validVariantCount = yield this.userRepository.countValidVariants(variantIds);
                if (validVariantCount !== variantIds.length) {
                    throw new AppError_1.default(400, "One or more variant IDs are invalid");
                }
            }
            const dealerUser = yield this.userRepository.findUserById(safeDealerId);
            const previousMappings = yield this.userRepository.getDealerPrices(safeDealerId);
            const updatedMappings = yield this.userRepository.setDealerPrices(safeDealerId, normalizedPrices);
            if (dealerUser) {
                const pricingChanges = this.buildDealerPricingDiff(previousMappings, updatedMappings);
                if (pricingChanges.length > 0) {
                    yield this.dealerNotificationService.sendDealerPricingUpdated({
                        recipientName: dealerUser.name,
                        recipientEmail: dealerUser.email,
                        businessName: dealerProfile.businessName,
                        accountReference: (0, accountReference_1.toAccountReference)(dealerUser.id),
                        updatedBy: this.resolveActorName(currentUser),
                        changeCount: pricingChanges.length,
                        totalMappedVariants: updatedMappings.length,
                        changes: pricingChanges,
                    });
                }
            }
            return updatedMappings;
        });
    }
    getDealerPrices(dealerId, currentUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actorUserId = this.assertUuid(currentUserId, "actor user id");
            const safeDealerId = this.assertUuid(dealerId, "dealer id");
            const currentUser = yield this.userRepository.findUserById(actorUserId);
            if (!currentUser) {
                throw new AppError_1.default(404, "User not found");
            }
            if (!this.isAdminRole(currentUser.role)) {
                throw new AppError_1.default(403, "Only Admin or SuperAdmin can view dealer prices");
            }
            const dealerProfile = yield this.userRepository.findDealerProfileByUserId(safeDealerId);
            if (!dealerProfile) {
                throw new AppError_1.default(404, "Dealer profile not found");
            }
            return this.userRepository.getDealerPrices(safeDealerId);
        });
    }
}
exports.UserService = UserService;
UserService.UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
