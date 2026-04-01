import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/session";
import { ok } from "@/lib/api";

export async function POST() {
  const res = ok(null, "Signed out") as unknown as NextResponse;
  return clearAuthCookies(res);
}
