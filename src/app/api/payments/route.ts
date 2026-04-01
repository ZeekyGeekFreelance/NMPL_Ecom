import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const { searchParams } = req.nextUrl;
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);
    const [total, payments] = await Promise.all([
      prisma.paymentTransaction.count(),
      prisma.paymentTransaction.findMany({
        include: {
          order: { select: { id: true } },
          user: { select: { id: true, name: true, email: true } },
          recordedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return ok({ payments, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleError(err);
  }
}

const recordSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "NET_BANKING", "CARD", "WALLET"]),
  paymentReceivedAt: z.string(),
  notes: z.string().optional(),
  utrNumber: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const body = await req.json();
    const parsed = recordSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const txn = await prisma.paymentTransaction.create({
      data: {
        id: uuidv4(),
        ...parsed.data,
        paymentReceivedAt: new Date(parsed.data.paymentReceivedAt),
        paymentSource: "ADMIN_MANUAL",
        status: "CONFIRMED",
        recordedByUserId: session.sub,
      },
    });
    return created(txn);
  } catch (err) {
    return handleError(err);
  }
}
