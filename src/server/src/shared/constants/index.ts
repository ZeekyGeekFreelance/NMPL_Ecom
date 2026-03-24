import { config } from "@/config";

export const cookieParserOptions = {};

export const cookieOptions = {
  httpOnly: true,
  secure: config.security.cookieSecure,
  sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days — must match REFRESH_TOKEN_ABS_TTL_SECONDS (604800)
  // Only set domain if explicitly configured (production)
  // Leave undefined for localhost to work correctly
  ...(config.security.cookieDomain ? { domain: config.security.cookieDomain } : {}),
};
