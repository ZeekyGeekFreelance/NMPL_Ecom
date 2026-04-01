import { NextRequest } from "next/server";
import { z } from "zod";
import { getCheckoutSummary, placeOrder } from "@/lib/services/order.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";

const summarySchema = z.object({
  addressId: z.string().optional(),
  deliveryMode: z.enum(["PICKUP", "DELIVERY"]).default("DELIVERY"),
});

const orderSchema = z.object({
  cartId: z.string().uuid(),
  addressId: z.string().optional(),
  deliveryMode: z.enum(["PICKUP", "DELIVERY"]).default("DELIVERY"),
  expectedTotal: z.number().positive().optional(),
});

// GET /api/checkout?addressId=...&deliveryMode=...
export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const { searchParams } = req.nextUrl;
    const parsed = summarySchema.safeParse({
      addressId: searchParams.get("addressId") ?? undefined,
      deliveryMode: searchParams.get("deliveryMode") ?? "DELIVERY",
    });
    if (!parsed.success) return validationError(parsed.error);
    return ok(await getCheckoutSummary(session.sub, parsed.data.addressId, parsed.data.deliveryMode));
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/checkout — place order
export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const body = await req.json();
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const order = await placeOrder(session.sub, parsed.data);
    return created(order, "Order placed successfully");
  } catch (err) {
    return handleError(err);
  }
}
