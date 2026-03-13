import logger from "@/infra/winston/logger";
import {
  buildDealerAccountCreatedEmail,
  buildDealerApplicationSubmittedEmail,
  buildDealerPricingUpdatedEmail,
  buildDealerRemovedEmail,
  buildDealerStatusUpdatedEmail,
  DealerPricingChangeRow,
  DealerStatusEmail,
} from "@/shared/templates/dealerNotifications";
import { getSupportEmail } from "@/shared/utils/branding";
import sendEmail from "@/shared/utils/sendEmail";
import { config } from "@/config";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export class DealerNotificationService {
  private getPortalUrl(): string {
    const clientUrl = config.isProduction
      ? config.urls.clientProd
      : config.urls.clientDev;
    return clientUrl.replace(/\/+$/, "");
  }

  private getSupportEmail(): string {
    return getSupportEmail();
  }

  private async sendNotification(
    payload: EmailPayload,
    context: string
  ): Promise<void> {
    const sent = await sendEmail(payload);
    if (!sent) {
      logger.warn(
        `[DealerNotificationService] Failed to send "${context}" email to ${payload.to}`
      );
    }
  }

  async sendDealerApplicationSubmitted(params: {
    recipientName: string;
    recipientEmail: string;
    businessName: string | null;
    accountReference?: string | null;
    wasResubmission?: boolean;
  }): Promise<void> {
    const { subject, text, html } = buildDealerApplicationSubmittedEmail({
      recipientName: params.recipientName,
      businessName: params.businessName,
      accountReference: params.accountReference ?? null,
      portalUrl: this.getPortalUrl(),
      supportEmail: this.getSupportEmail(),
      wasResubmission: params.wasResubmission ?? false,
    });

    await this.sendNotification(
      {
        to: params.recipientEmail,
        subject,
        text,
        html,
      },
      params.wasResubmission
        ? "dealer_application_resubmitted"
        : "dealer_application_submitted"
    );
  }

  async sendDealerStatusUpdated(params: {
    recipientName: string;
    recipientEmail: string;
    businessName: string | null;
    accountReference?: string | null;
    status: DealerStatusEmail;
    reviewedBy: string;
  }): Promise<void> {
    const { subject, text, html } = buildDealerStatusUpdatedEmail({
      recipientName: params.recipientName,
      businessName: params.businessName,
      accountReference: params.accountReference ?? null,
      status: params.status,
      reviewedBy: params.reviewedBy,
      portalUrl: this.getPortalUrl(),
      supportEmail: this.getSupportEmail(),
    });

    await this.sendNotification(
      {
        to: params.recipientEmail,
        subject,
        text,
        html,
      },
      `dealer_status_${params.status.toLowerCase()}`
    );
  }

  async sendDealerPricingUpdated(params: {
    recipientName: string;
    recipientEmail: string;
    businessName: string | null;
    accountReference?: string | null;
    updatedBy: string;
    changeCount: number;
    totalMappedVariants: number;
    changes: DealerPricingChangeRow[];
  }): Promise<void> {
    const { subject, text, html } = buildDealerPricingUpdatedEmail({
      recipientName: params.recipientName,
      businessName: params.businessName,
      accountReference: params.accountReference ?? null,
      updatedBy: params.updatedBy,
      changeCount: params.changeCount,
      totalMappedVariants: params.totalMappedVariants,
      changes: params.changes,
      portalUrl: this.getPortalUrl(),
      supportEmail: this.getSupportEmail(),
    });

    await this.sendNotification(
      {
        to: params.recipientEmail,
        subject,
        text,
        html,
      },
      "dealer_pricing_updated"
    );
  }

  async sendDealerAccountCreated(params: {
    recipientName: string;
    recipientEmail: string;
    businessName: string | null;
    accountReference?: string | null;
    temporaryPassword: string;
    /**
     * Pass true when the account was created as a legacy pay-later dealer.
     * Renders the "Dealer Account Created" variant with credential block and
     * forced password-change notice instead of the standard approval email.
     */
    isLegacy?: boolean;
  }): Promise<void> {
    const { subject, text, html } = buildDealerAccountCreatedEmail({
      recipientName: params.recipientName,
      businessName: params.businessName,
      accountReference: params.accountReference ?? null,
      email: params.recipientEmail,
      temporaryPassword: params.temporaryPassword,
      portalUrl: this.getPortalUrl(),
      supportEmail: this.getSupportEmail(),
      isLegacy: params.isLegacy ?? false,
    });

    await this.sendNotification(
      {
        to: params.recipientEmail,
        subject,
        text,
        html,
      },
      "dealer_account_created"
    );
  }

  async sendDealerRemoved(params: {
    recipientName: string;
    recipientEmail: string;
    businessName: string | null;
    accountReference?: string | null;
    removedBy: string;
  }): Promise<void> {
    const { subject, text, html } = buildDealerRemovedEmail({
      recipientName: params.recipientName,
      businessName: params.businessName,
      accountReference: params.accountReference ?? null,
      removedBy: params.removedBy,
      supportEmail: this.getSupportEmail(),
    });

    await this.sendNotification(
      {
        to: params.recipientEmail,
        subject,
        text,
        html,
      },
      "dealer_removed"
    );
  }
}
