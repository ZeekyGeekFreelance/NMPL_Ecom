import sendEmail from "@/shared/utils/sendEmail";
import { getPlatformName } from "@/shared/utils/branding";
import { toOrderReference } from "@/shared/utils/accountReference";
import { config } from "@/config";

interface PaymentConfirmationData {
  orderId: string;
  paymentTransactionId: string;
  customerEmail: string;
  customerName: string;
  paymentMethod: string;
  amount: number;
  invoiceNumber: string;
  gatewayPaymentId?: string;
}

export class PaymentNotificationService {
  /**
   * Send payment confirmation emails to customer and admin
   */
  async sendPaymentConfirmation(data: PaymentConfirmationData): Promise<void> {
    const platformName = getPlatformName();
    const orderReference = toOrderReference(data.orderId);

    // Send customer confirmation
    await this.sendCustomerPaymentConfirmation(data, platformName, orderReference);

    // Send admin notification
    await this.sendAdminPaymentNotification(data, platformName, orderReference);
  }

  /**
   * Send payment confirmation email to customer
   */
  private async sendCustomerPaymentConfirmation(
    data: PaymentConfirmationData,
    platformName: string,
    orderReference: string
  ): Promise<void> {
    const subject = `${platformName} | Payment Confirmed | ${data.invoiceNumber}`;
    
    const paymentMethodDisplay = this.formatPaymentMethodDisplay(data.paymentMethod);
    const amountFormatted = `₹${data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-icon { font-size: 48px; margin-bottom: 10px; }
          .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #666; }
          .detail-value { color: #333; }
          .amount { font-size: 24px; font-weight: bold; color: #4CAF50; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">✅</div>
            <h1>Payment Confirmed!</h1>
            <p>Your payment has been successfully processed</p>
          </div>
          
          <div class="content">
            <p>Dear ${data.customerName},</p>
            
            <p>We have successfully received your payment for order <strong>${orderReference}</strong>.</p>
            
            <div class="payment-details">
              <h3>Payment Details</h3>
              
              <div class="detail-row">
                <span class="detail-label">Order Reference:</span>
                <span class="detail-value">${orderReference}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span class="detail-value">${data.invoiceNumber}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Payment Method:</span>
                <span class="detail-value">${paymentMethodDisplay}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Amount Paid:</span>
                <span class="detail-value amount">${amountFormatted}</span>
              </div>
              
              ${data.gatewayPaymentId ? `
              <div class="detail-row">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${data.gatewayPaymentId}</span>
              </div>
              ` : ''}
              
              <div class="detail-row">
                <span class="detail-label">Payment Date:</span>
                <span class="detail-value">${new Date().toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
            </div>
            
            <p>Your order is now confirmed and will be processed shortly. You will receive another email with tracking information once your order is shipped.</p>
            
            <p>Thank you for choosing ${platformName}!</p>
            
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} ${platformName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Payment Confirmation - ${platformName}

Dear ${data.customerName},

Your payment has been successfully processed!

Payment Details:
- Order Reference: ${orderReference}
- Invoice Number: ${data.invoiceNumber}
- Payment Method: ${paymentMethodDisplay}
- Amount Paid: ${amountFormatted}
${data.gatewayPaymentId ? `- Transaction ID: ${data.gatewayPaymentId}` : ''}
- Payment Date: ${new Date().toLocaleDateString('en-IN')}

Your order is now confirmed and will be processed shortly.

Thank you for choosing ${platformName}!
    `;

    await sendEmail({
      to: data.customerEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });
  }

  /**
   * Send payment notification email to admin
   */
  private async sendAdminPaymentNotification(
    data: PaymentConfirmationData,
    platformName: string,
    orderReference: string
  ): Promise<void> {
    const adminEmails = this.getAdminNotificationEmails();
    
    if (adminEmails.length === 0) {
      return; // No admin emails configured
    }

    const subject = `${platformName} | Payment Received | ${data.invoiceNumber}`;
    const paymentMethodDisplay = this.formatPaymentMethodDisplay(data.paymentMethod);
    const amountFormatted = `₹${data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Received Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #666; }
          .detail-value { color: #333; }
          .amount { font-size: 20px; font-weight: bold; color: #4CAF50; }
          .customer-info { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Payment Received</h1>
            <p>New payment processed successfully</p>
          </div>
          
          <div class="content">
            <p>A new payment has been received and processed.</p>
            
            <div class="customer-info">
              <h3>Customer Information</h3>
              <p><strong>Name:</strong> ${data.customerName}</p>
              <p><strong>Email:</strong> ${data.customerEmail}</p>
            </div>
            
            <div class="payment-details">
              <h3>Payment Details</h3>
              
              <div class="detail-row">
                <span class="detail-label">Order Reference:</span>
                <span class="detail-value">${orderReference}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span class="detail-value">${data.invoiceNumber}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Payment Method:</span>
                <span class="detail-value">${paymentMethodDisplay}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Amount Received:</span>
                <span class="detail-value amount">${amountFormatted}</span>
              </div>
              
              ${data.gatewayPaymentId ? `
              <div class="detail-row">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${data.gatewayPaymentId}</span>
              </div>
              ` : ''}
              
              <div class="detail-row">
                <span class="detail-label">Payment Transaction ID:</span>
                <span class="detail-value">${data.paymentTransactionId}</span>
              </div>
            </div>
            
            <p>The order payment status has been updated and the customer has been notified.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to all admin emails
    await Promise.all(
      adminEmails.map((email) =>
        sendEmail({
          to: email,
          subject,
          html: htmlContent,
          text: `Payment notification for ${platformName}`,
        })
      )
    );
  }

  /**
   * Get admin notification email addresses
   */
  private getAdminNotificationEmails(): string[] {
    const billingEmails = config.branding.billingNotificationEmails || '';
    const smtpUser = config.email.smtpUser || '';
    
    const emails = billingEmails.split(',').map((email: string) => email.trim()).filter(Boolean);
    
    if (emails.length === 0 && smtpUser) {
      emails.push(smtpUser);
    }
    
    return emails;
  }

  /**
   * Format payment method for display
   */
  private formatPaymentMethodDisplay(paymentMethod: string): string {
    const methodMap: Record<string, string> = {
      CASH: "Cash Payment",
      BANK_TRANSFER: "Bank Transfer",
      CHEQUE: "Cheque Payment",
      UPI: "UPI Payment",
      NET_BANKING: "Net Banking",
      CARD: "Card Payment",
      WALLET: "Digital Wallet",
    };

    return methodMap[paymentMethod] || paymentMethod;
  }
}