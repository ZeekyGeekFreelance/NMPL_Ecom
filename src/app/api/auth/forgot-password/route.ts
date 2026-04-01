import { NextRequest } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/services/auth.service";
import { ok, handleError, validationError } from "@/lib/api";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    await requestPasswordReset(parsed.data.email);
    return ok(null, "If that email exists, a reset link was sent");
  } catch (err) {
    return handleError(err);
  }
}
