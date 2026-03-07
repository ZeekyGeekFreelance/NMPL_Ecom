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
  customerPhone?: string | null;
  accountReference?: string;
  customerEmail: string;
  customerType: "DEALER" | "USER";
  items: InvoicePdfItem[];
  subtotalAmount: number;
  deliveryCharge: number;
  deliveryMode: string;
  totalAmount: number;
  locationLabel: string;
  locationAddress?: InvoiceAddress | null;
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

const toSafeText = (value: unknown, fallback = "N/A"): string => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const drawAddressBlock = (
  doc: PDFKit.PDFDocument,
  address: InvoiceAddress | null | undefined,
  fallbackName: string,
  fallbackPhone: string,
  contactLabel = "Receiver"
) => {
  if (!address) {
    doc.fontSize(10).text("Address details are unavailable.");
    return;
  }

  doc
    .fontSize(10)
    .text(`${contactLabel}: ${toSafeText(address.fullName, fallbackName)}`);
  doc.fontSize(10).text(`Phone: ${toSafeText(address.phoneNumber, fallbackPhone)}`);
  doc.fontSize(10).text(toSafeText(address.line1, "Address line not available"));

  if (address.line2) {
    doc.fontSize(10).text(address.line2);
  }
  if (address.landmark) {
    doc.fontSize(10).text(`Landmark: ${address.landmark}`);
  }

  doc
    .fontSize(10)
    .text(
      `${toSafeText(address.city)}, ${toSafeText(address.state)} ${toSafeText(
        address.pincode
      )}`
    );
  doc.fontSize(10).text(toSafeText(address.country));
};

const drawItemsTable = (
  doc: PDFKit.PDFDocument,
  items: InvoicePdfItem[],
  fonts: { regular: string; bold: string },
  formatCurrency: (value: number) => string
) => {
  const left = 50;
  const right = 545;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const columns = [
    { key: "product", label: "Product", x: 50, width: 205, align: "left" },
    { key: "sku", label: "SKU", x: 260, width: 95, align: "left" },
    { key: "qty", label: "Qty", x: 360, width: 50, align: "right" },
    { key: "unit", label: "Unit Price", x: 415, width: 60, align: "right" },
    { key: "line", label: "Line Total", x: 480, width: 65, align: "right" },
  ] as const;

  const drawTableHeader = () => {
    doc.font(fonts.bold).fontSize(9.5);
    columns.forEach((column) => {
      doc.text(column.label, column.x, doc.y, {
        width: column.width,
        align: column.align,
      });
    });
    doc.moveDown(0.35);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#d1d5db").stroke();
    doc.moveDown(0.35);
  };

  drawTableHeader();

  if (!items.length) {
    doc
      .font(fonts.regular)
      .fontSize(10)
      .text("No items available.", left, doc.y, { width: right - left });
    return;
  }

  doc.font(fonts.regular).fontSize(9.5);
  items.forEach((item) => {
    const productName = toSafeText(item.productName, "Product");
    const sku = toSafeText(item.sku, "-");
    const quantity = String(Number(item.quantity) || 0);
    const unitPrice = formatCurrency(Number(item.unitPrice) || 0);
    const lineTotal = formatCurrency(Number(item.subtotal) || 0);

    const productHeight = doc.heightOfString(productName, {
      width: columns[0].width,
      align: "left",
    });
    const skuHeight = doc.heightOfString(sku, {
      width: columns[1].width,
      align: "left",
    });
    const rowHeight = Math.max(productHeight, skuHeight, doc.currentLineHeight()) + 6;

    if (doc.y + rowHeight > pageBottom() - 70) {
      doc.addPage();
      drawTableHeader();
      doc.font(fonts.regular).fontSize(9.5);
    }

    const rowY = doc.y;
    doc.text(productName, columns[0].x, rowY, {
      width: columns[0].width,
      align: "left",
    });
    doc.text(sku, columns[1].x, rowY, {
      width: columns[1].width,
      align: "left",
    });
    doc.text(quantity, columns[2].x, rowY, {
      width: columns[2].width,
      align: "right",
    });
    doc.text(unitPrice, columns[3].x, rowY, {
      width: columns[3].width,
      align: "right",
    });
    doc.text(lineTotal, columns[4].x, rowY, {
      width: columns[4].width,
      align: "right",
    });

    doc.y = rowY + rowHeight;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#eef2f7").stroke();
    doc.moveDown(0.2);
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
      const normalizedDeliveryMode = String(invoice.deliveryMode || "DELIVERY")
        .trim()
        .toUpperCase();
      const deliveryLabel =
        normalizedDeliveryMode === "PICKUP" ? "In-Store Pickup" : "Delivery";

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
      doc.text(`Order Date (IST): ${formatDateTimeInIST(invoice.orderDate)}`);
      doc.text(`Generated At (IST): ${formatDateTimeInIST(new Date())}`);

      drawSectionTitle(doc, "Billing Identity", fonts);
      doc.font(fonts.regular).fontSize(10);
      doc.text(`Customer Name: ${toSafeText(invoice.customerName, "Customer")}`);
      doc.text(`Phone: ${toSafeText(invoice.customerPhone, "Not provided")}`);
      doc.text(`Email: ${toSafeText(invoice.customerEmail)}`);
      doc.text(`Customer Type: ${toSafeText(invoice.customerType)}`);
      if (invoice.accountReference) {
        doc.text(`Account Ref: ${invoice.accountReference}`);
      }

      drawSectionTitle(doc, "Fulfillment", fonts);
      doc
        .font(fonts.regular)
        .fontSize(10)
        .text(`Fulfillment Mode: ${deliveryLabel}`);

      drawSectionTitle(
        doc,
        toSafeText(
          invoice.locationLabel,
          normalizedDeliveryMode === "PICKUP" ? "Pickup Location" : "Delivery To"
        ),
        fonts
      );
      drawAddressBlock(
        doc,
        invoice.locationAddress,
        invoice.customerName,
        toSafeText(invoice.customerPhone, "Not provided"),
        normalizedDeliveryMode === "PICKUP" ? "Store" : "Receiver"
      );

      drawSectionTitle(doc, "Items :", fonts);
      drawItemsTable(doc, invoice.items, fonts, formatCurrency);

      doc.moveDown(0.8);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
      doc.moveDown(0.8);
      doc.font(fonts.regular).fontSize(10);
      doc.text(`Subtotal: ${formatCurrency(invoice.subtotalAmount)}`, 50, doc.y, {
        align: "right",
      });
      doc.moveDown(0.3);
      doc.text(
        `${deliveryLabel}: ${formatCurrency(invoice.deliveryCharge)}`,
        50,
        doc.y,
        {
          align: "right",
        }
      );
      doc.moveDown(0.3);
      doc.font(fonts.bold).fontSize(12);
      doc.text(`Total: ${formatCurrency(invoice.totalAmount)}`, 50, doc.y, {
        align: "right",
      });

      doc.moveDown(1);
      doc
        .font(fonts.regular)
        .fontSize(9)
        .fillColor("#6b7280")
        .text(`${platformName} system generated invoice. No signature required.`, {
          align: "left",
        });

      doc.end();
    } catch (error: unknown) {
      doc.end();
      const message =
        error instanceof Error ? error.message : "Unknown generation error";
      reject(new Error(`Invoice PDF generation failed: ${message}`));
    }
  });
}
