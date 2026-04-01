import { NextRequest } from "next/server";
import { deleteAddress } from "@/lib/services/user.service";
import { requireAuth } from "@/lib/auth/guard";
import { noContent, handleError } from "@/lib/api";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const { id } = await params;
    await deleteAddress(session.sub, id);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
