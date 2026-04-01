import { NextRequest, NextResponse } from "next/server";
import { rotateTokens, setAuthCookies } from "@/lib/auth/session";
import { ok, unauthorized } from "@/lib/api";

export async function POST(req: NextRequest) {
  const result = await rotateTokens(req);
  if (!result) return unauthorized("Refresh token invalid or expired");

  const res = ok(null, "Token refreshed") as unknown as NextResponse;
  return setAuthCookies(res, result.accessToken, result.refreshToken);
}
