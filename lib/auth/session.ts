import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, verifyRefreshToken, signAccessToken, signRefreshToken, AccessTokenPayload } from "./tokens";
import prisma from "@/lib/db";
import { config } from "@/lib/config";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.auth.cookieSameSite,
  domain: config.isProduction ? config.auth.cookieDomain : undefined,
  path: "/",
} as const;

export async function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: config.auth.accessTtlSeconds,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: config.auth.refreshTtlSeconds,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}

export async function getSessionFromRequest(req: NextRequest): Promise<AccessTokenPayload | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function getSession(): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function rotateTokens(req: NextRequest): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, tokenVersion: true, mustChangePassword: true },
  });

  if (!user || user.tokenVersion !== payload.tokenVersion) return null;

  const [newAccess, newRefresh] = await Promise.all([
    signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword,
    }),
    signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion }),
  ]);

  return { accessToken: newAccess, refreshToken: newRefresh };
}
