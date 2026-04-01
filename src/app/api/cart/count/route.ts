import { NextRequest } from "next/server";
import { getCartCount } from "@/lib/services/cart.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    return ok({ count: await getCartCount(session.sub) });
  } catch (err) {
    return handleError(err);
  }
}
