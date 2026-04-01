import { NextRequest } from "next/server";
import { z } from "zod";
import { updateCartItem, removeCartItem } from "@/lib/services/cart.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, noContent, handleError, validationError } from "@/lib/api";

const updateSchema = z.object({ quantity: z.number().int().min(0) });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return ok(await updateCartItem(session.sub, id, parsed.data.quantity));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const { id } = await params;
    await removeCartItem(session.sub, id);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
