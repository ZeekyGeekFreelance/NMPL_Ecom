import { NextRequest } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/services/auth.service";
import { setAuthCookies } from "@/lib/auth/session";
import { ok, handleError, validationError } from "@/lib/api";
import { NextResponse } from "next/server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { accessToken, refreshToken, user } = await signIn(parsed.data.email, parsed.data.password);
    const res = ok(user, "Signed in successfully");
    return setAuthCookies(res as unknown as NextResponse, accessToken, refreshToken);
  } catch (err) {
    return handleError(err);
  }
}
