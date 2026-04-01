import { NextRequest } from "next/server";
import { getProductBySlug } from "@/lib/services/product.service";
import { getSessionFromRequest } from "@/lib/auth/session";
import { ok, handleError } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const session = await getSessionFromRequest(req);
    const product = await getProductBySlug(slug, session?.role === "DEALER" ? session.sub : undefined);
    return ok(product);
  } catch (err) {
    return handleError(err);
  }
}
