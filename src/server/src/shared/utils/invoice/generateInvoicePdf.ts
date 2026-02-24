import PDFDocument from "pdfkit";
import { getPlatformName } from "../branding";

interface InvoicePdfItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface InvoiceAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface InvoicePdfInput {
  invoiceNumber: string;
  orderId: string;
  orderDate: Date;
  customerName: string;
  accountReference?: string;
  customerEmail: string;
  customerType: "DEALER" | "CLIENT";
  items: InvoicePdfItem[];
  totalAmount: number;
  billingAddress?: InvoiceAddress | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);

const drawSectionTitle = (doc: PDFKit.PDFDocument, label: string) => {
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(11).text(label);
  doc.moveDown(0.2);
};

const drawItemsTable = (doc: PDFKit.PDFDocument, items: InvoicePdfItem[]) => {
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Item", 50, doc.y, { width: 200 });
  doc.text("Qty", 260, doc.y, { width: 40, align: "right" });
  doc.text("Unit Price", 310, doc.y, { width: 90, align: "right" });
  doc.text("Subtotal", 410, doc.y, { width: 130, align: "right" });
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
  doc.moveDown(0.4);

  doc.font("Helvetica").fontSize(10);
  items.forEach((item) => {
    const rowY = doc.y;
    const itemTitle = `${item.productName} (${item.sku})`;
    doc.text(itemTitle, 50, rowY, { width: 200 });
    doc.text(String(item.quantity), 260, rowY, { width: 40, align: "right" });
    doc.text(formatCurrency(item.unitPrice), 310, rowY, {
      width: 90,
      align: "right",
    });
    doc.text(formatCurrency(item.subtotal), 410, rowY, {
      width: 130,
      align: "right",
    });
    doc.moveDown(0.8);
  });
};

export default function generateInvoicePdf(
  invoice: InvoicePdfInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const platformName = getPlatformName();
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error: Error) =>
      reject(new Error(`Invoice PDF generation failed: ${error.message}`))
    );

    try {
      doc.font("Helvetica-Bold").fontSize(11).text(platformName.toUpperCase(), {
        align: "left",
      });
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(22).text("INVOICE", {
        align: "left",
      });
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Invoice #: ${invoice.invoiceNumber}`);
      doc.text(`Order ID: ${invoice.orderId}`);
      doc.text(`Date: ${formatDate(invoice.orderDate)}`);
      doc.text(`Customer Type: ${invoice.customerType}`);

      drawSectionTitle(doc, "Bill To");
      doc.font("Helvetica").fontSize(10);
      doc.text(invoice.customerName);
      if (invoice.accountReference) {
        doc.text(`Account Ref: ${invoice.accountReference}`);
      }
      doc.text(invoice.customerEmail);
      if (invoice.billingAddress) {
        doc.text(invoice.billingAddress.street);
        doc.text(
          `${invoice.billingAddress.city}, ${invoice.billingAddress.state} ${invoice.billingAddress.zip}`
        );
        doc.text(invoice.billingAddress.country);
      }

      drawSectionTitle(doc, "Items");
      if (!invoice.items.length) {
        doc.font("Helvetica").fontSize(10).text("No items available.");
      } else {
        drawItemsTable(doc, invoice.items);
      }

      doc.moveDown(0.8);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text(`Total: ${formatCurrency(invoice.totalAmount)}`, 50, doc.y, {
        align: "right",
      });

      doc.moveDown(1);
      doc
        .font("Helvetica")
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
