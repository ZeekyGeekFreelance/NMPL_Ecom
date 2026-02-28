import PDFDocument from "pdfkit";
import { getPlatformName } from "../branding";
import { formatDateTimeInIST } from "../dateTime";
import { configurePdfFonts } from "../pdfFonts";
import { formatINRCurrency } from "../currency";

interface InvoicePdfItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface InvoiceAddress {
  fullName?: string;
  phoneNumber?: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface InvoicePdfInput {
  invoiceNumber: string;
  orderId: string;
  orderDate: Date;
  customerName: string;
  accountReference?: string;
  customerEmail: string;
  customerType: "DEALER" | "USER";
  items: InvoicePdfItem[];
  subtotalAmount: number;
  deliveryCharge: number;
  deliveryMode: string;
  totalAmount: number;
  billingAddress?: InvoiceAddress | null;
}

const drawSectionTitle = (
  doc: PDFKit.PDFDocument,
  label: string,
  fonts: { bold: string }
) => {
  doc.moveDown(0.5);
  doc.font(fonts.bold).fontSize(11).text(label);
  doc.moveDown(0.2);
};

const drawItemsTable = (
  doc: PDFKit.PDFDocument,
  items: InvoicePdfItem[],
  fonts: { regular: string; bold: string },
  formatCurrency: (value: number) => string
) => {
  doc.font(fonts.bold).fontSize(10);
  doc.text("SN No.", 50, doc.y, { width: 45 });
  doc.text("Item", 98, doc.y, { width: 215 });
  doc.text("Qty", 318, doc.y, { width: 40, align: "right" });
  doc.text("Unit Price", 365, doc.y, { width: 80, align: "right" });
  doc.text("Subtotal", 450, doc.y, { width: 95, align: "right" });
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
  doc.moveDown(0.4);

  doc.font(fonts.regular).fontSize(10);
  items.forEach((item, index) => {
    const rowY = doc.y;
    const itemTitle = `${item.productName} (${item.sku})`;
    doc.text(String(index + 1), 50, rowY, { width: 45 });
    doc.text(itemTitle, 98, rowY, { width: 215 });
    doc.text(String(item.quantity), 318, rowY, { width: 40, align: "right" });
    doc.text(formatCurrency(item.unitPrice), 365, rowY, {
      width: 80,
      align: "right",
    });
    doc.text(formatCurrency(item.subtotal), 450, rowY, {
      width: 95,
      align: "right",
    });
    const itemHeight = doc.heightOfString(itemTitle, { width: 215 });
    const rowHeight = Math.max(itemHeight, doc.currentLineHeight()) + 6;
    doc.y = rowY + rowHeight;
  });
};

export default function generateInvoicePdf(
  invoice: InvoicePdfInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const platformName = getPlatformName();
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    const fonts = configurePdfFonts(doc);
    const formatCurrency = (value: number): string =>
      fonts.supportsUnicode
        ? formatINRCurrency(value)
        : `INR ${Number(value || 0).toFixed(2)}`;

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error: Error) =>
      reject(new Error(`Invoice PDF generation failed: ${error.message}`))
    );

    try {
      doc.font(fonts.bold).fontSize(11).text(platformName.toUpperCase(), {
        align: "left",
      });
      doc.moveDown(0.3);
      doc.font(fonts.bold).fontSize(22).text("INVOICE", {
        align: "left",
      });
      doc.moveDown(0.4);
      doc.font(fonts.regular).fontSize(10);
      doc.text(`Invoice #: ${invoice.invoiceNumber}`);
      doc.text(`Order ID: ${invoice.orderId}`);
      doc.text(`Date (IST): ${formatDateTimeInIST(invoice.orderDate)}`);
      doc.text(`Generated At (IST): ${formatDateTimeInIST(new Date())}`);
      doc.text(`Customer Type: ${invoice.customerType}`);

      drawSectionTitle(doc, "Bill To", fonts);
      doc.font(fonts.regular).fontSize(10);
      doc.text(invoice.customerName);
      if (invoice.accountReference) {
        doc.text(`Account Ref: ${invoice.accountReference}`);
      }
      doc.text(invoice.customerEmail);
      if (invoice.billingAddress) {
        if (invoice.billingAddress.fullName) {
          doc.text(invoice.billingAddress.fullName);
        }
        if (invoice.billingAddress.phoneNumber) {
          doc.text(invoice.billingAddress.phoneNumber);
        }
        doc.text(invoice.billingAddress.line1);
        if (invoice.billingAddress.line2) {
          doc.text(invoice.billingAddress.line2);
        }
        if (invoice.billingAddress.landmark) {
          doc.text(`Landmark: ${invoice.billingAddress.landmark}`);
        }
        doc.text(
          `${invoice.billingAddress.city}, ${invoice.billingAddress.state} ${invoice.billingAddress.pincode}`
        );
        doc.text(invoice.billingAddress.country);
      }

      drawSectionTitle(doc, "Items", fonts);
      if (!invoice.items.length) {
        doc.font(fonts.regular).fontSize(10).text("No items available.");
      } else {
        drawItemsTable(doc, invoice.items, fonts, formatCurrency);
      }

      doc.moveDown(0.8);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
      doc.moveDown(0.8);
      doc.font(fonts.regular).fontSize(10);
      doc.text(`Subtotal: ${formatCurrency(invoice.subtotalAmount)}`, 50, doc.y, {
        align: "right",
      });
      doc.moveDown(0.3);
      doc.text(
        `Delivery (${invoice.deliveryMode}): ${formatCurrency(
          invoice.deliveryCharge
        )}`,
        50,
        doc.y,
        {
          align: "right",
        }
      );
      doc.moveDown(0.3);
      doc.font(fonts.bold).fontSize(12);
      doc.text(`Final Total: ${formatCurrency(invoice.totalAmount)}`, 50, doc.y, {
        align: "right",
      });

      doc.moveDown(1);
      doc
        .font(fonts.regular)
        .fontSize(9)
        .fillColor("#6b7280")
        .text(
          `${platformName} system generated invoice. No signature required.`,
          {
            align: "left",
          }
        );

      doc.end();
    } catch (error: unknown) {
      doc.end();
      const message =
        error instanceof Error ? error.message : "Unknown generation error";
      reject(new Error(`Invoice PDF generation failed: ${message}`));
    }
  });
}
