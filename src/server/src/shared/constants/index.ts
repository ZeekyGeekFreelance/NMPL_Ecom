import { config } from "@/config";

export const cookieParserOptions = {};

export const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
  path: "/",
  domain: config.security.cookieDomain,
};
