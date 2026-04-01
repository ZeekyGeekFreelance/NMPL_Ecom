import { NextRequest } from "next/server";
import { getUserOrders } from "@/lib/services/order.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const { searchParams } = req.nextUrl;
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 10);
    return ok(await getUserOrders(session.sub, page, limit));
  } catch (err) {
    return handleError(err);
  }
}
