import prisma from "@/infra/database/database.config";
import { Prisma } from "@prisma/client";

const invoiceWithDetailsInclude = {
  order: {
    include: {
      orderItems: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
      payment: true,
      address: true,
      transaction: true,
    },
  },
  paymentTransactions: {
    orderBy: {
      paymentReceivedAt: "desc",
    },
    include: {
      recordedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
  user: {
    include: {
      dealerProfile: true,
    },
  },
} satisfies Prisma.InvoiceInclude;

const orderInvoiceInclude = {
  user: {
    include: {
      dealerProfile: true,
    },
  },
  orderItems: {
    include: {
      variant: {
        include: {
          product: true,
        },
      },
    },
  },
  address: true,
  payment: true,
  transaction: true,
  invoice: true,
} satisfies Prisma.OrderInclude;

export type InvoiceWithDetails = Prisma.InvoiceGetPayload<{
  include: typeof invoiceWithDetailsInclude;
}>;

export type OrderForInvoice = Prisma.OrderGetPayload<{
  include: typeof orderInvoiceInclude;
}>;

export class InvoiceRepository {
  async findAllInvoices() {
    return prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            subtotalAmount: true,
            deliveryCharge: true,
            deliveryMode: true,
            amount: true,
            status: true,
            customerRoleSnapshot: true,
            orderDate: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            dealerProfile: {
              select: {
                status: true,
                businessName: true,
              },
            },
          },
        },
      },
    });
  }

  async findInvoicesByUserId(userId: string) {
    return prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            subtotalAmount: true,
            deliveryCharge: true,
            deliveryMode: true,
            amount: true,
            status: true,
            customerRoleSnapshot: true,
            orderDate: true,
          },
        },
      },
    });
  }

  async findInvoiceById(invoiceId: string): Promise<InvoiceWithDetails | null> {
    return prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: invoiceWithDetailsInclude,
    });
  }

  async findInvoiceByOrderId(
    orderId: string
  ): Promise<InvoiceWithDetails | null> {
    return prisma.invoice.findFirst({
      where: { orderId, isLatest: true },
      include: invoiceWithDetailsInclude,
    });
  }

  async findOrderForInvoice(orderId: string): Promise<OrderForInvoice | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: orderInvoiceInclude,
    });
  }

  async ensureInvoiceRecord(data: {
    orderId: string;
    userId: string;
    customerEmail: string;
    year: number;
    /**
     * PAYMENT_DUE for pay-later orders.
     * Omit for prepaid orders — the DB column defaults to PAID.
     */
    paymentStatus?: string;
    /** Payment due date for pay-later invoices. */
    paymentDueDate?: Date;
    /** Human-readable payment terms (e.g. "NET 30 from delivery date"). */
    paymentTerms?: string;
  }): Promise<InvoiceWithDetails> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const existing = await tx.invoice.findFirst({
            where: { orderId: data.orderId, isLatest: true },
            include: invoiceWithDetailsInclude,
          });

          if (existing) {
            return existing;
          }

          const counter = await tx.invoiceCounter.upsert({
            where: { year: data.year },
            create: {
              year: data.year,
              sequence: 1,
            },
            update: {
              sequence: { increment: 1 },
            },
          });

          const sequence = String(counter.sequence).padStart(4, "0");
          const invoiceNumber = `INV-${data.year}-${sequence}`;

          return tx.invoice.create({
            data: {
              orderId: data.orderId,
              userId: data.userId,
              customerEmail: data.customerEmail,
              invoiceNumber,
              // Pay-later fields: only supplied for LEGACY dealer orders.
              // Prepaid orders use DB defaults (paymentStatus = PAID).
              ...(data.paymentStatus
                ? { paymentStatus: data.paymentStatus as any }
                : {}),
              ...(data.paymentDueDate
                ? { paymentDueDate: data.paymentDueDate }
                : {}),
              ...(data.paymentTerms
                ? { paymentTerms: data.paymentTerms }
                : {}),
            },
            include: invoiceWithDetailsInclude,
          });
        });
      } catch (error: unknown) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";

        if (!isUniqueConflict || attempt === 2) {
          throw error;
        }
      }
    }

    throw new Error("Failed to generate invoice number after retries.");
  }

  async updateInvoiceEmailStatus(
    invoiceId: string,
    data: {
      customerEmailSentAt?: Date | null;
      internalEmailSentAt?: Date | null;
      lastEmailError?: string | null;
    }
  ): Promise<void> {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data,
    });
  }
}
