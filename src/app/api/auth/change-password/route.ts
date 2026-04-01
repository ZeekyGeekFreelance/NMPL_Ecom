import { NextRequest } from "next/server";
import { z } from "zod";
import { changePassword } from "@/lib/services/auth.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError, validationError } from "@/lib/api";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    await changePassword(session.sub, parsed.data.currentPassword, parsed.data.newPassword);
    return ok(null, "Password changed successfully");
  } catch (err) {
    return handleError(err);
  }
}
