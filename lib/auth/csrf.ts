import { randomBytes, createHmac } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { config } from "@/lib/config";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_LENGTH = 32;

export function generateCsrfToken(): string {
  return randomBytes(TOKEN_LENGTH).toString("hex");
}

function signToken(token: string): string {
  return createHmac("sha256", config.auth.cookieSecret).update(token).digest("hex");
}

export function createSignedCsrfToken(): { token: string; signature: string } {
  const token = generateCsrfToken();
  return { token, signature: signToken(token) };
}

export function verifyCsrfToken(token: string, signature: string): boolean {
  const expected = signToken(token);
  // constant-time compare
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function validateCsrfFromRequest(req: NextRequest): Promise<boolean> {
  // Skip for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}
