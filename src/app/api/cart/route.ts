import { NextRequest } from "next/server";
import { z } from "zod";
import { getOrCreateCart, addToCart } from "@/lib/services/cart.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError, validationError } from "@/lib/api";

const addSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    return ok(await getOrCreateCart(session.sub));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return ok(await addToCart(session.sub, parsed.data.variantId, parsed.data.quantity));
  } catch (err) {
    return handleError(err);
  }
}
