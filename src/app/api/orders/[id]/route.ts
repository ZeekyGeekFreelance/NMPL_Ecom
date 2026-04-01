import { NextRequest } from "next/server";
import { getOrderById } from "@/lib/services/order.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const { id } = await params;
    // Admin sees all orders; user sees only their own
    const userId = session.role === "ADMIN" || session.role === "SUPERADMIN" ? undefined : session.sub;
    return ok(await getOrderById(id, userId));
  } catch (err) {
    return handleError(err);
  }
}
