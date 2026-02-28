import AppError from "@/shared/errors/AppError";
import {
  DealerStatus,
  UserRepository,
  DealerPriceInput,
} from "./user.repository";
import { DealerNotificationService } from "@/shared/services/dealerNotification.service";
import { DealerPricingChangeRow } from "@/shared/templates/dealerNotifications";
import { toAccountReference } from "@/shared/utils/accountReference";
import { resolveEffectiveRoleFromUser } from "@/shared/utils/userRole";

export class UserService {
  private static readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    private userRepository: UserRepository,
    private dealerNotificationService: DealerNotificationService
  ) {}

  private normalizeRole(role: unknown): string {
    return String(role ?? "")
      .trim()
      .toUpperCase();
  }

  private isAdminRole(role: unknown): boolean {
    const normalizedRole = this.normalizeRole(role);
    return normalizedRole === "ADMIN" || normalizedRole === "SUPERADMIN";
  }

  private isSuperAdminRole(role: unknown): boolean {
    return this.normalizeRole(role) === "SUPERADMIN";
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizePhone(phone: string | undefined, label = "Phone number"): string {
    const normalized = String(phone ?? "").trim();
    if (!normalized) {
      throw new AppError(400, `${label} is required`);
    }

    if (!/^[0-9()+\-\s]{7,20}$/.test(normalized)) {
      throw new AppError(
        400,
        `${label} must be 7-20 characters and contain only valid digits/symbols`
      );
    }

    return normalized;
  }

  private normalizeDisplayName(name: string | undefined, label = "name"): string {
    const normalized = String(name ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) {
      throw new AppError(400, `${label} is required`);
    }

    if (normalized.length < 2) {
      throw new AppError(400, `${label} must be at least 2 characters long`);
    }

    if (normalized.length > 80) {
      throw new AppError(400, `${label} must be at most 80 characters long`);
    }

    return normalized;
  }

  private assertUuid(value: string | undefined, label: string): string {
    const normalized = value?.trim();
    if (!normalized || !UserService.UUID_PATTERN.test(normalized)) {
      throw new AppError(400, `Invalid ${label}`);
    }

    return normalized;
  }

  private resolveActorName(actor: { name?: string; email?: string }): string {
    return actor.name?.trim() || actor.email?.trim() || "Admin Team";
  }

  private withAccountReference<T extends { id: string }>(entity: T): T & {
    accountReference: string;
    effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
  } {
    const candidate = entity as T & {
      role?: unknown;
      dealerStatus?: unknown;
      dealerProfile?: { status?: unknown } | null;
    };

    return {
      ...entity,
      accountReference: toAccountReference(entity.id),
      ...(candidate.role !== undefined
        ? {
            effectiveRole: resolveEffectiveRoleFromUser({
              role: candidate.role,
              dealerStatus: candidate.dealerStatus,
              dealerProfile: candidate.dealerProfile,
            }),
          }
        : {}),
    };
  }

  private buildDealerPricingDiff(
    previous: Array<{
      variantId: string;
      customPrice: number;
      sku: string;
      productName: string;
    }>,
    next: Array<{
      variantId: string;
      customPrice: number;
      sku: string;
      productName: string;
    }>
  ): DealerPricingChangeRow[] {
    const previousByVariant = new Map(
      previous.map((row) => [row.variantId, row])
    );
    const nextByVariant = new Map(next.map((row) => [row.variantId, row]));

    const variantIds = new Set([
      ...previousByVariant.keys(),
      ...nextByVariant.keys(),
    ]);

    const changes: DealerPricingChangeRow[] = [];
    variantIds.forEach((variantId) => {
      const previousRow = previousByVariant.get(variantId);
      const nextRow = nextByVariant.get(variantId);

      const previousPrice = previousRow?.customPrice ?? null;
      const nextPrice = nextRow?.customPrice ?? null;
      if (previousPrice === nextPrice) {
        return;
      }

      changes.push({
        sku: nextRow?.sku ?? previousRow?.sku ?? variantId,
        productName:
          nextRow?.productName ?? previousRow?.productName ?? "Product",
        previousPrice,
        nextPrice,
      });
    });

    return changes;
  }

  async getAllUsers() {
    const users = await this.userRepository.findAllUsers();
    return users.map((user) => this.withAccountReference(user));
  }

  async getUserById(id: string) {
    const userId = this.assertUuid(id, "user id");
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    return this.withAccountReference(user);
  }

  async getUserByEmail(email: string) {
    const user = await this.userRepository.findUserByEmail(
      this.normalizeEmail(email)
    );
    if (!user) {
      throw new AppError(404, "User not found");
    }
    return this.withAccountReference(user);
  }

  async getMe(id: string | undefined) {
    const userId = this.assertUuid(id, "session user id");
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    return this.withAccountReference(user);
  }

  async updateMe(
    id: string,
    data: Partial<{
      name?: string;
      email?: string;
      phone?: string;
      avatar?: string;
    }>
  ) {
    const userId = this.assertUuid(id, "user id");
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const payload: Partial<{
      name?: string;
      email?: string;
      phone?: string;
      avatar?: string;
    }> = {
      ...data,
    };

    if (data.name !== undefined) {
      payload.name = this.normalizeDisplayName(data.name, "Name");
    }

    if (data.phone !== undefined) {
      payload.phone = this.normalizePhone(data.phone, "Phone number");
    }

    const updatedUser = await this.userRepository.updateUser(userId, payload);
    return this.withAccountReference(updatedUser);
  }

  async updateCurrentUserProfile(
    id: string,
    data: { name?: string; phone?: string }
  ) {
    const userId = this.assertUuid(id, "user id");
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const payload: {
      name?: string;
      phone?: string;
    } = {};

    if (data.name !== undefined) {
      payload.name = this.normalizeDisplayName(data.name, "Name");
    }

    if (data.phone !== undefined) {
      payload.phone = this.normalizePhone(data.phone, "Phone number");
    }

    if (Object.keys(payload).length === 0) {
      throw new AppError(400, "At least one profile field is required");
    }

    const updatedUser = await this.userRepository.updateUser(userId, payload);

    return this.withAccountReference(updatedUser);
  }

  async deleteUser(id: string, currentUserId: string) {
    const targetUserId = this.assertUuid(id, "user id");
    const actorUserId = this.assertUuid(currentUserId, "actor user id");

    // Prevent self-deletion
    if (targetUserId === actorUserId) {
      throw new AppError(400, "You cannot delete your own account");
    }

    const user = await this.userRepository.findUserById(targetUserId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    // Prevent deletion of last SUPERADMIN
    if (user.role === "SUPERADMIN") {
      const superAdminCount = await this.userRepository.countUsersByRole(
        "SUPERADMIN"
      );
      if (superAdminCount <= 1) {
        throw new AppError(400, "Cannot delete the last SuperAdmin");
      }
    }

    await this.userRepository.deleteUser(targetUserId);
  }

  async createAdmin(
    adminData: {
      name: string;
      email: string;
      phone: string;
      password: string;
    },
    createdByUserId: string
  ) {
    const actorUserId = this.assertUuid(createdByUserId, "actor user id");
    const creator = await this.userRepository.findUserById(actorUserId);

    if (!creator) {
      throw new AppError(404, "Creator user not found");
    }

    if (!this.isSuperAdminRole(creator.role)) {
      throw new AppError(403, "Only SuperAdmins can create new admins");
    }

    // Check if user already exists
    const normalizedEmail = this.normalizeEmail(adminData.email);
    const normalizedPhone = this.normalizePhone(adminData.phone);
    const existingUser = await this.userRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError(400, "User with this email already exists");
    }

    // Create new admin with ADMIN role (not SUPERADMIN)
    const newAdmin = await this.userRepository.createUser({
      ...adminData,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: "ADMIN",
    });

    return this.withAccountReference(newAdmin);
  }

  async getDealers(status?: DealerStatus) {
    const dealers = await this.userRepository.getDealers(status);
    return dealers.map((dealer) => ({
      id: dealer.id,
      accountReference: toAccountReference(dealer.id),
      name: dealer.name,
      email: dealer.email,
      phone: dealer.phone,
      role: dealer.role,
      effectiveRole: resolveEffectiveRoleFromUser({
        role: dealer.role,
        dealerStatus: dealer.status,
      }),
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
  }

  async createDealer(
    dealerData: {
      name: string;
      email: string;
      password: string;
      businessName?: string;
      contactPhone: string;
    },
    createdByUserId: string
  ) {
    const actorUserId = this.assertUuid(createdByUserId, "actor user id");
    const creator = await this.userRepository.findUserById(actorUserId);

    if (!creator) {
      throw new AppError(404, "Creator user not found");
    }

    if (!this.isAdminRole(creator.role)) {
      throw new AppError(
        403,
        "Only Admin or SuperAdmin can register dealers"
      );
    }

    const normalizedEmail = this.normalizeEmail(dealerData.email);
    const normalizedPhone = this.normalizePhone(
      dealerData.contactPhone,
      "Contact phone"
    );
    const existingUser = await this.userRepository.findUserByEmail(
      normalizedEmail
    );
    if (existingUser) {
      throw new AppError(400, "User with this email already exists");
    }

    const newDealerUser = await this.userRepository.createUser({
      name: dealerData.name,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: dealerData.password,
      role: "USER",
    });

    await this.userRepository.upsertDealerProfile({
      userId: newDealerUser.id,
      businessName: dealerData.businessName ?? null,
      contactPhone: normalizedPhone,
      status: "APPROVED",
      approvedBy: actorUserId,
    });

    const dealerUser = await this.userRepository.findUserById(newDealerUser.id);

    if (dealerUser) {
      await this.dealerNotificationService.sendDealerAccountCreated({
        recipientName: dealerUser.name,
        recipientEmail: dealerUser.email,
        businessName: dealerData.businessName ?? null,
        accountReference: toAccountReference(dealerUser.id),
        temporaryPassword: dealerData.password,
      });
    }

    if (!dealerUser) {
      throw new AppError(500, "Dealer account created but profile load failed");
    }

    return this.withAccountReference(dealerUser);
  }

  async updateDealerStatus(
    dealerId: string,
    status: DealerStatus,
    updatedByUserId: string
  ) {
    const actorUserId = this.assertUuid(updatedByUserId, "actor user id");
    const safeDealerId = this.assertUuid(dealerId, "dealer id");
    const currentUser = await this.userRepository.findUserById(actorUserId);

    if (!currentUser) {
      throw new AppError(404, "User not found");
    }

    if (!this.isAdminRole(currentUser.role)) {
      throw new AppError(
        403,
        "Only Admin or SuperAdmin can update dealer status"
      );
    }

    const dealerUser = await this.userRepository.findUserById(safeDealerId);
    if (!dealerUser) {
      throw new AppError(404, "Dealer user not found");
    }

    const dealerProfile = await this.userRepository.updateDealerStatus(
      safeDealerId,
      status,
      actorUserId
    );

    if (!dealerProfile) {
      throw new AppError(404, "Dealer profile not found");
    }

    await this.dealerNotificationService.sendDealerStatusUpdated({
      recipientName: dealerUser.name,
      recipientEmail: dealerUser.email,
      businessName: dealerProfile.businessName,
      accountReference: toAccountReference(dealerUser.id),
      status,
      reviewedBy: this.resolveActorName(currentUser),
    });

    return {
      ...this.withAccountReference(dealerUser),
      dealerProfile,
    };
  }

  async deleteDealer(dealerId: string, deletedByUserId: string) {
    const actorUserId = this.assertUuid(deletedByUserId, "actor user id");
    const safeDealerId = this.assertUuid(dealerId, "dealer id");
    const currentUser = await this.userRepository.findUserById(actorUserId);

    if (!currentUser) {
      throw new AppError(404, "User not found");
    }

    if (!this.isAdminRole(currentUser.role)) {
      throw new AppError(
        403,
        "Only Admin or SuperAdmin can delete dealer accounts"
      );
    }

    const dealerUser = await this.userRepository.findUserById(safeDealerId);
    if (!dealerUser) {
      throw new AppError(404, "Dealer user not found");
    }

    if (dealerUser.role !== "USER") {
      throw new AppError(400, "Only USER role can be treated as dealer account");
    }

    const dealerProfile = await this.userRepository.findDealerProfileByUserId(
      safeDealerId
    );
    if (!dealerProfile) {
      throw new AppError(404, "Dealer profile not found");
    }

    await this.userRepository.deleteUser(safeDealerId);

    await this.dealerNotificationService.sendDealerRemoved({
      recipientName: dealerUser.name,
      recipientEmail: dealerUser.email,
      businessName: dealerProfile.businessName,
      accountReference: toAccountReference(dealerUser.id),
      removedBy: this.resolveActorName(currentUser),
    });
  }

  async setDealerPrices(
    dealerId: string,
    prices: DealerPriceInput[],
    updatedByUserId: string
  ) {
    const actorUserId = this.assertUuid(updatedByUserId, "actor user id");
    const safeDealerId = this.assertUuid(dealerId, "dealer id");
    const currentUser = await this.userRepository.findUserById(actorUserId);

    if (!currentUser) {
      throw new AppError(404, "User not found");
    }

    if (!this.isAdminRole(currentUser.role)) {
      throw new AppError(
        403,
        "Only Admin or SuperAdmin can configure dealer prices"
      );
    }

    const dealerProfile = await this.userRepository.findDealerProfileByUserId(
      safeDealerId
    );
    if (!dealerProfile) {
      throw new AppError(404, "Dealer profile not found");
    }

    const normalizedPrices = Array.from(
      new Map(
        prices.map(
          (
            price
          ): [string, { variantId: string; customPrice: number }] => {
            const safeVariantId = this.assertUuid(price.variantId, "variant id");

            return [
              safeVariantId,
              {
                variantId: safeVariantId,
                customPrice: Number(price.customPrice),
              },
            ];
          }
        )
      ).values()
    );

    if (normalizedPrices.some((price) => Number.isNaN(price.customPrice))) {
      throw new AppError(400, "Custom price must be numeric");
    }

    if (normalizedPrices.some((price) => price.customPrice < 0)) {
      throw new AppError(400, "Custom price cannot be negative");
    }

    const variantIds = normalizedPrices.map((price) => price.variantId);
    if (variantIds.length > 0) {
      const uniqueVariantIds = new Set(variantIds);
      if (uniqueVariantIds.size !== variantIds.length) {
        throw new AppError(400, "Duplicate variants found in pricing payload");
      }

      const validVariantCount = await this.userRepository.countValidVariants(
        variantIds
      );
      if (validVariantCount !== variantIds.length) {
        throw new AppError(400, "One or more variant IDs are invalid");
      }
    }

    const dealerUser = await this.userRepository.findUserById(safeDealerId);
    const previousMappings = await this.userRepository.getDealerPrices(safeDealerId);
    const updatedMappings = await this.userRepository.setDealerPrices(
      safeDealerId,
      normalizedPrices
    );

    if (dealerUser) {
      const pricingChanges = this.buildDealerPricingDiff(
        previousMappings,
        updatedMappings
      );

      if (pricingChanges.length > 0) {
        await this.dealerNotificationService.sendDealerPricingUpdated({
          recipientName: dealerUser.name,
          recipientEmail: dealerUser.email,
          businessName: dealerProfile.businessName,
          accountReference: toAccountReference(dealerUser.id),
          updatedBy: this.resolveActorName(currentUser),
          changeCount: pricingChanges.length,
          totalMappedVariants: updatedMappings.length,
          changes: pricingChanges,
        });
      }
    }

    return updatedMappings;
  }

  async getDealerPrices(dealerId: string, currentUserId: string) {
    const actorUserId = this.assertUuid(currentUserId, "actor user id");
    const safeDealerId = this.assertUuid(dealerId, "dealer id");
    const currentUser = await this.userRepository.findUserById(actorUserId);

    if (!currentUser) {
      throw new AppError(404, "User not found");
    }

    if (!this.isAdminRole(currentUser.role)) {
      throw new AppError(
        403,
        "Only Admin or SuperAdmin can view dealer prices"
      );
    }

    const dealerProfile = await this.userRepository.findDealerProfileByUserId(
      safeDealerId
    );
    if (!dealerProfile) {
      throw new AppError(404, "Dealer profile not found");
    }

    return this.userRepository.getDealerPrices(safeDealerId);
  }
}
