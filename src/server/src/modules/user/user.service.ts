import AppError from "@/shared/errors/AppError";
import sendEmail from "@/shared/utils/sendEmail";
import {
  DealerStatus,
  UserRepository,
  DealerPriceInput,
} from "./user.repository";
import { DealerNotificationService } from "@/shared/services/dealerNotification.service";
import { DealerPricingChangeRow } from "@/shared/templates/dealerNotifications";
import { toAccountReference } from "@/shared/utils/accountReference";
import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";
import { resolveEffectiveRoleFromUser } from "@/shared/utils/userRole";
import { makeLogsService } from "../logs/logs.factory";
import { ROLE } from "@prisma/client";

export class UserService {
  private static readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  private logsService = makeLogsService();

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

  private getRoleBoundary(role: unknown): "INTERNAL" | "EXTERNAL" {
    return this.isAdminRole(role) ? "INTERNAL" : "EXTERNAL";
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

  private isDealerAccount(user: {
    dealerProfile?: { status?: string | null } | null;
  }): boolean {
    return !!user.dealerProfile;
  }

  private canBeBillingSupervisor(user: {
    role?: string | null;
    dealerProfile?: { status?: string | null } | null;
  }): boolean {
    const normalizedRole = this.normalizeRole(user.role);
    return normalizedRole === "ADMIN" && !this.isDealerAccount(user);
  }

  private assertStrongPassword(password: string): string {
    const value = String(password ?? "").trim();
    if (value.length < 8) {
      throw new AppError(400, "Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(value)) {
      throw new AppError(400, "Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(value)) {
      throw new AppError(400, "Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(value)) {
      throw new AppError(400, "Password must contain at least one number");
    }
    if (!/[!@#$%^&*]/.test(value)) {
      throw new AppError(
        400,
        "Password must contain at least one special character (!@#$%^&*)"
      );
    }
    return value;
  }

  private getUserLifecycleRoleLabel(user: {
    role?: string | null;
    dealerProfile?: { status?: string | null } | null;
  }): "USER" | "DEALER" | "ADMIN" | "SUPERADMIN" {
    return resolveEffectiveRoleFromUser({
      role: user.role,
      dealerProfile: user.dealerProfile,
    });
  }

  private async notifyBillingSupervisorAssignment(params: {
    recipientName: string;
    recipientEmail: string;
    accountReference: string;
    assignedBy: string;
    isAssigned: boolean;
  }): Promise<void> {
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();
    const actionTitle = params.isAssigned
      ? "Billing Supervisor Assignment"
      : "Billing Supervisor Access Update";
    const statusLine = params.isAssigned
      ? "You have been assigned as Billing Supervisor."
      : "Your Billing Supervisor responsibility has been removed.";
    const responsibilityBlock = params.isAssigned
      ? [
          "Primary responsibilities:",
          "1. Monitor delivered orders for invoice completion.",
          "2. Maintain billing copy communication and escalations.",
          "3. Coordinate with operations and support for billing disputes.",
        ].join("\n")
      : "If this change is unexpected, contact support immediately.";

    const sent = await sendEmail({
      to: params.recipientEmail,
      subject: `${platformName} | ${actionTitle}`,
      text: [
        `Hello ${params.recipientName},`,
        "",
        statusLine,
        `Account Reference: ${params.accountReference}`,
        `Updated By: ${params.assignedBy}`,
        "",
        responsibilityBlock,
        "",
        `Support: ${supportEmail}`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${params.recipientName}</strong>,</p>
          <p>${statusLine}</p>
          <p>
            <strong>Account Reference:</strong> ${params.accountReference}<br />
            <strong>Updated By:</strong> ${params.assignedBy}
          </p>
          ${
            params.isAssigned
              ? `
            <p><strong>Primary responsibilities:</strong></p>
            <ol style="padding-left: 20px; margin: 0 0 12px;">
              <li>Monitor delivered orders for invoice completion.</li>
              <li>Maintain billing copy communication and escalations.</li>
              <li>Coordinate with operations and support for billing disputes.</li>
            </ol>
          `
              : `<p>If this change is unexpected, contact support immediately.</p>`
          }
          <p>
            Support:
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
          </p>
        </div>
      `,
    });

    if (!sent) {
      await this.logsService.warn("Failed to send billing supervisor update email", {
        recipientEmail: params.recipientEmail,
        accountReference: params.accountReference,
        action: params.isAssigned ? "ASSIGN" : "REMOVE",
      });
    }
  }

  private async notifyAccountTermination(params: {
    recipientName: string;
    recipientEmail: string;
    accountReference: string;
    roleLabel: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
    terminatedBy: string;
  }): Promise<void> {
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();

    const sent = await sendEmail({
      to: params.recipientEmail,
      subject: `${platformName} | Account/Service Terminated (${params.roleLabel})`,
      text: [
        `Hello ${params.recipientName},`,
        "",
        `Your ${platformName} service/account has been terminated for role: ${params.roleLabel}.`,
        `Account Reference: ${params.accountReference}`,
        `Actioned By: ${params.terminatedBy}`,
        "",
        `For clarification, contact ${supportEmail}.`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${params.recipientName}</strong>,</p>
          <p>
            Your <strong>${platformName}</strong> service/account has been terminated for
            role: <strong>${params.roleLabel}</strong>.
          </p>
          <p>
            <strong>Account Reference:</strong> ${params.accountReference}<br />
            <strong>Actioned By:</strong> ${params.terminatedBy}
          </p>
          <p>
            For clarification, contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
          </p>
        </div>
      `,
    });

    if (!sent) {
      await this.logsService.warn("Failed to send account termination email", {
        recipientEmail: params.recipientEmail,
        accountReference: params.accountReference,
        roleLabel: params.roleLabel,
      });
    }
  }

  private async notifyAdminPasswordChanged(params: {
    recipientName: string;
    recipientEmail: string;
    accountReference: string;
    changedBy: string;
  }): Promise<void> {
    const platformName = getPlatformName();
    const supportEmail = getSupportEmail();

    const sent = await sendEmail({
      to: params.recipientEmail,
      subject: `${platformName} | Admin Password Updated`,
      text: [
        `Hello ${params.recipientName},`,
        "",
        `Your admin password was updated by SuperAdmin: ${params.changedBy}.`,
        `Account Reference: ${params.accountReference}`,
        "All active sessions have been logged out.",
        "",
        `If this change was not expected, contact ${supportEmail} immediately.`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello <strong>${params.recipientName}</strong>,</p>
          <p>
            Your admin password was updated by SuperAdmin:
            <strong>${params.changedBy}</strong>.
          </p>
          <p>
            <strong>Account Reference:</strong> ${params.accountReference}<br />
            <strong>Security Action:</strong> All active sessions have been logged out.
          </p>
          <p>
            If this change was not expected, contact
            <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>
            immediately.
          </p>
        </div>
      `,
    });

    if (!sent) {
      await this.logsService.warn("Failed to send admin password change email", {
        recipientEmail: params.recipientEmail,
        accountReference: params.accountReference,
      });
    }
  }

  private withAccountReference<T extends { id: string }>(entity: T): T & {
    accountReference: string;
    effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
    isBillingSupervisor?: boolean;
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
      role?: string;
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
      role?: ROLE;
      isBillingSupervisor?: boolean;
    }> = {};

    if (data.name !== undefined) {
      payload.name = this.normalizeDisplayName(data.name, "Name");
    }

    if (data.email !== undefined) {
      payload.email = this.normalizeEmail(data.email);
    }

    if (data.phone !== undefined) {
      payload.phone = this.normalizePhone(data.phone, "Phone number");
    }

    if (data.avatar !== undefined) {
      payload.avatar = data.avatar;
    }

    if (data.role !== undefined) {
      const requestedRole = this.normalizeRole(data.role);
      if (!["USER", "ADMIN", "SUPERADMIN"].includes(requestedRole)) {
        throw new AppError(400, "Invalid role");
      }

      const currentBoundary = this.getRoleBoundary(user.role);
      const requestedBoundary = this.getRoleBoundary(requestedRole);

      if (currentBoundary !== requestedBoundary) {
        throw new AppError(
          400,
          "Cross-boundary role transitions are not allowed"
        );
      }

      if (currentBoundary === "EXTERNAL" && requestedRole !== "USER") {
        throw new AppError(
          400,
          "External accounts cannot be promoted to ADMIN or SUPERADMIN"
        );
      }

      if (currentBoundary === "INTERNAL" && !["ADMIN", "SUPERADMIN"].includes(requestedRole)) {
        throw new AppError(400, "Internal accounts can only be ADMIN or SUPERADMIN");
      }

      if (this.isDealerAccount(user) && requestedRole !== "USER") {
        throw new AppError(400, "Dealer accounts must stay in external role boundary");
      }

      if (this.isSuperAdminRole(user.role) && requestedRole === "ADMIN") {
        const superAdminCount = await this.userRepository.countUsersByRole(
          "SUPERADMIN"
        );
        if (superAdminCount <= 1) {
          throw new AppError(400, "Cannot demote the last SuperAdmin");
        }
      }

      payload.role = requestedRole as ROLE;
      if (requestedRole !== "ADMIN") {
        payload.isBillingSupervisor = false;
      }
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
    const actor = await this.userRepository.findUserById(actorUserId);

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

    if (user.email) {
      await this.notifyAccountTermination({
        recipientName: user.name,
        recipientEmail: user.email,
        accountReference: toAccountReference(user.id),
        roleLabel: this.getUserLifecycleRoleLabel(user),
        terminatedBy: this.resolveActorName(actor || {}),
      });
    }
  }

  async createAdmin(
    adminData: {
      name: string;
      email: string;
      phone: string;
      password: string;
      assignBillingSupervisor?: boolean;
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

    const newAdmin = await this.userRepository.createUser({
      ...adminData,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: "ADMIN",
      isBillingSupervisor: adminData.assignBillingSupervisor === true,
    });

    if (adminData.assignBillingSupervisor) {
      await this.notifyBillingSupervisorAssignment({
        recipientName: newAdmin.name,
        recipientEmail: newAdmin.email,
        accountReference: toAccountReference(newAdmin.id),
        assignedBy: this.resolveActorName(creator),
        isAssigned: true,
      });
    }

    return this.withAccountReference(newAdmin);
  }

  async updateBillingSupervisor(
    userId: string,
    isBillingSupervisor: boolean,
    updatedByUserId: string
  ) {
    const targetUserId = this.assertUuid(userId, "user id");
    const actorUserId = this.assertUuid(updatedByUserId, "actor user id");

    const actor = await this.userRepository.findUserById(actorUserId);
    if (!actor) {
      throw new AppError(404, "Actor user not found");
    }

    if (!this.isSuperAdminRole(actor.role)) {
      throw new AppError(
        403,
        "Only SuperAdmins can assign billing supervisor responsibility"
      );
    }

    const targetUser = await this.userRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new AppError(404, "User not found");
    }

    if (!this.canBeBillingSupervisor(targetUser)) {
      throw new AppError(
        400,
        "Only ADMIN non-dealer accounts can be assigned as billing supervisor"
      );
    }

    const updatedUser = await this.userRepository.updateUser(targetUserId, {
      isBillingSupervisor,
    });
    const hydratedUser = await this.userRepository.findUserById(targetUserId);
    const userToReturn = hydratedUser || updatedUser;

    await this.notifyBillingSupervisorAssignment({
      recipientName: userToReturn.name,
      recipientEmail: userToReturn.email,
      accountReference: toAccountReference(userToReturn.id),
      assignedBy: this.resolveActorName(actor),
      isAssigned: isBillingSupervisor,
    });

    await this.logsService.info("Billing supervisor flag updated", {
      targetUserId,
      actorUserId,
      isBillingSupervisor,
    });

    return this.withAccountReference(userToReturn);
  }

  async updateAdminPassword(
    userId: string,
    newPassword: string,
    updatedByUserId: string
  ) {
    const targetUserId = this.assertUuid(userId, "user id");
    const actorUserId = this.assertUuid(updatedByUserId, "actor user id");
    const strongPassword = this.assertStrongPassword(newPassword);

    const actor = await this.userRepository.findUserById(actorUserId);
    if (!actor) {
      throw new AppError(404, "Actor user not found");
    }
    if (!this.isSuperAdminRole(actor.role)) {
      throw new AppError(403, "Only SuperAdmins can change admin passwords");
    }

    const targetUser = await this.userRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new AppError(404, "User not found");
    }

    if (targetUser.role !== "ADMIN" || this.isDealerAccount(targetUser)) {
      throw new AppError(400, "Password can only be changed for ADMIN accounts");
    }

    await this.userRepository.updateUserPassword(targetUserId, strongPassword);

    await this.notifyAdminPasswordChanged({
      recipientName: targetUser.name,
      recipientEmail: targetUser.email,
      accountReference: toAccountReference(targetUser.id),
      changedBy: this.resolveActorName(actor),
    });

    await this.logsService.info("Admin password updated by SuperAdmin", {
      targetUserId,
      actorUserId,
    });

    const refreshedUser = await this.userRepository.findUserById(targetUserId);
    return this.withAccountReference(refreshedUser || targetUser);
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

    if (this.isAdminRole(dealerUser.role)) {
      throw new AppError(
        400,
        "Internal team accounts cannot be managed through dealer status workflow"
      );
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
    if (dealerUser && this.isAdminRole(dealerUser.role)) {
      throw new AppError(
        400,
        "Internal team accounts cannot receive dealer pricing maps"
      );
    }
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

    const dealerUser = await this.userRepository.findUserById(safeDealerId);
    if (dealerUser && this.isAdminRole(dealerUser.role)) {
      throw new AppError(
        400,
        "Internal team accounts cannot use dealer pricing workflow"
      );
    }

    return this.userRepository.getDealerPrices(safeDealerId);
  }
}
