import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/config";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  tokenVersion: number;
  mustChangePassword?: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
}

const encoder = new TextEncoder();

function accessKey() {
  return encoder.encode(config.auth.accessSecret);
}

function refreshKey() {
  return encoder.encode(config.auth.refreshSecret);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${config.auth.accessTtlSeconds}s`)
    .sign(accessKey());
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${config.auth.refreshTtlSeconds}s`)
    .sign(refreshKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey());
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshKey());
    return payload as unknown as RefreshTokenPayload;
  } catch {
    return null;
  }
}
