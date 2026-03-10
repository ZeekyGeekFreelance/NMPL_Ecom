const EXACT_AUTH_OPTIONAL_PATHS = new Set<string>(["/"]);
const PREFIX_AUTH_OPTIONAL_PATHS = [
  "/about-us",
  "/brands",
  "/dot-tm",
  "/cart",
  "/product",
  "/products",
  "/shop",
  "/success",
];

const normalizePathname = (pathname?: string | null): string => {
  if (!pathname) {
    return "/";
  }

  if (pathname === "/") {
    return pathname;
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
};

export const isAuthOptionalPublicPath = (pathname?: string | null): boolean => {
  const normalizedPathname = normalizePathname(pathname);

  if (EXACT_AUTH_OPTIONAL_PATHS.has(normalizedPathname)) {
    return true;
  }

  return PREFIX_AUTH_OPTIONAL_PATHS.some(
    (prefix) =>
      normalizedPathname === prefix ||
      normalizedPathname.startsWith(`${prefix}/`)
  );
};

export const shouldTreatAuthAsLoading = (
  pathname: string | null | undefined,
  user: unknown | null | undefined
): boolean => {
  if (user !== undefined) {
    return false;
  }

  return !isAuthOptionalPublicPath(pathname);
};
