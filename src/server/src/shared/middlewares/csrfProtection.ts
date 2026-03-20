import { Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "crypto";
import AppError from "@/shared/errors/AppError";
import { config } from "@/config";

/**
 * CSRF Protection Middleware using Double-Submit Cookie Pattern
 * 
 * This middleware provides CSRF protection for state-changing operations (POST, PUT, PATCH, DELETE).
 * It works alongside the existing JWT authentication and SameSite cookies for defense-in-depth.
 * 
 * How it works:
 * 1. Server generates a CSRF token and sends it in a cookie
 * 2. Client must include the same token in the X-CSRF-Token header
 * 3. Server validates that both tokens match
 * 
 * This prevents CSRF attacks because:
 * - Cookies are automatically sent by the browser
 * - Headers must be explicitly set by JavaScript
 * - Cross-origin requests cannot read cookies or set custom headers (CORS policy)
 */

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Generate a cryptographically secure CSRF token
 */
const generateCsrfToken = (): string => {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
};

/**
 * Hash a token for comparison (prevents timing attacks)
 */
const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

/**
 * Check if the request method requires CSRF protection
 */
const requiresCsrfProtection = (method: string): boolean => {
  return MUTATION_METHODS.has(method.toUpperCase());
};

/**
 * Extract CSRF token from cookie
 */
const getCsrfTokenFromCookie = (req: Request): string | null => {
  const token = req.cookies?.[CSRF_COOKIE_NAME];
  return typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
};

/**
 * Extract CSRF token from header
 */
const getCsrfTokenFromHeader = (req: Request): string | null => {
  const token = req.headers[CSRF_HEADER_NAME];
  const normalized = Array.isArray(token) ? token[0] : token;
  return typeof normalized === "string" && normalized.trim().length > 0
    ? normalized.trim()
    : null;
};

/**
 * Set CSRF token cookie
 */
const setCsrfTokenCookie = (res: Response, token: string): void => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript to include in headers
    secure: config.isProduction,
    sameSite: config.security.cookieSameSite as "lax" | "strict" | "none",
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    path: "/",
    ...(config.security.cookieDomain
      ? { domain: config.security.cookieDomain }
      : {}),
  });
};

/**
 * CSRF Protection Middleware
 * 
 * For GET requests: Generates and sets a CSRF token cookie
 * For POST/PUT/PATCH/DELETE: Validates that cookie and header tokens match
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
  if (!requiresCsrfProtection(req.method)) {
    // For GET requests, ensure a CSRF token exists
    let csrfToken = getCsrfTokenFromCookie(req);
    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      setCsrfTokenCookie(res, csrfToken);
    }
    next();
    return;
  }

  // For mutation requests, validate CSRF token
  const cookieToken = getCsrfTokenFromCookie(req);
  const headerToken = getCsrfTokenFromHeader(req);

  // Both tokens must be present
  if (!cookieToken || !headerToken) {
    throw new AppError(
      403,
      "CSRF token missing. Please refresh the page and try again."
    );
  }

  // Tokens must match (using constant-time comparison via hashing)
  const cookieHash = hashToken(cookieToken);
  const headerHash = hashToken(headerToken);

  if (cookieHash !== headerHash) {
    throw new AppError(
      403,
      "CSRF token mismatch. Please refresh the page and try again."
    );
  }

  // Token is valid, proceed with the request
  next();
};

/**
 * Optional: Middleware to expose CSRF token in response header
 * Useful for SPAs that need to read the token programmatically
 */
export const exposeCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // Generate token if it doesn't exist
  let token = getCsrfTokenFromCookie(req);
  if (!token) {
    token = generateCsrfToken();
    setCsrfTokenCookie(res, token);
  }
  res.setHeader("X-CSRF-Token", token);
  next();
};

export default csrfProtection;
