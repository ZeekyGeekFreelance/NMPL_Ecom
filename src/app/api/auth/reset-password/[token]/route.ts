import { NextRequest } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/services/auth.service";
import { ok, handleError, validationError } from "@/lib/api";

const schema = z.object({ password: z.string().min(8) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    await resetPassword(token, parsed.data.password);
    return ok(null, "Password reset successfully");
  } catch (err) {
    return handleError(err);
  }
}
