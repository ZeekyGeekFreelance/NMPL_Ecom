import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/tokens";

const PUBLIC_PATHS = [
  "/",
  "/shop",
  "/products",
  "/about-us",
  "/brands",
  "/maintenance",
  "/sign-in",
  "/sign-up",
  "/password-reset",
  "/dealer/sign-in",
  "/dealer/register",
];

const AUTH_ONLY_PATHS = [
  "/dashboard",
  "/orders",
  "/profile",
  "/payment-success",
  "/cancel",
  "/failure",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip API routes and static files
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get("access_token")?.value;
  const session = accessToken ? await verifyAccessToken(accessToken) : null;

  const isAuthRoute =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/dealer/sign-in") ||
    pathname.startsWith("/dealer/register") ||
    pathname.startsWith("/password-reset");

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Require auth for protected routes
  const requiresAuth = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));
  if (requiresAuth && !session) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Dashboard requires admin/superadmin
  if (pathname.startsWith("/dashboard") && session) {
    if (session.role !== "ADMIN" && session.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
