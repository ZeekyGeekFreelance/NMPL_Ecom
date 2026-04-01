import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/auth/csrf";
import { config } from "@/lib/config";

export async function GET() {
  const token = generateCsrfToken();
  const res = NextResponse.json({ success: true, data: { token } });
  res.cookies.set("csrf_token", token, {
    httpOnly: false, // must be readable by JS
    secure: config.isProduction,
    sameSite: config.auth.cookieSameSite,
    path: "/",
    maxAge: 3600,
  });
  return res;
}
