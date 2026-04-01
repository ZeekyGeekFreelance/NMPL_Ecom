import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/services/auth.service";
import { setAuthCookies } from "@/lib/auth/session";
import { created, handleError, validationError } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { accessToken, refreshToken, user } = await registerUser(parsed.data);
    const res = created(user, "Account created") as unknown as NextResponse;
    return setAuthCookies(res, accessToken, refreshToken);
  } catch (err) {
    return handleError(err);
  }
}
