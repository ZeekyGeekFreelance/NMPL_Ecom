export type DisplayRole = "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
export type AccountBoundary = "INTERNAL" | "EXTERNAL";

type RoleInput = {
  role?: string | null;
  effectiveRole?: string | null;
  dealerStatus?:
    | "PENDING"
    | "APPROVED"
    | "LEGACY"
    | "REJECTED"
    | "SUSPENDED"
    | null
    | string;
  dealerProfile?: {
    status?:
      | "PENDING"
      | "APPROVED"
      | "LEGACY"
      | "REJECTED"
      | "SUSPENDED"
      | null
      | string;
  } | null;
  isDealer?: boolean | null;
};

const normalizeUpper = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const isKnownRole = (value: string): value is DisplayRole =>
  value === "USER" ||
  value === "DEALER" ||
  value === "ADMIN" ||
  value === "SUPERADMIN";

export const resolveDisplayRole = (input?: RoleInput | null): DisplayRole => {
  const normalizedEffectiveRole = normalizeUpper(input?.effectiveRole);
  if (isKnownRole(normalizedEffectiveRole)) {
    return normalizedEffectiveRole;
  }

  const normalizedBaseRole = normalizeUpper(input?.role);
  if (normalizedBaseRole === "SUPERADMIN") {
    return "SUPERADMIN";
  }

  if (normalizedBaseRole === "ADMIN") {
    return "ADMIN";
  }

  if (normalizedBaseRole === "DEALER") {
    return "DEALER";
  }

  const normalizedDealerStatus = normalizeUpper(
    input?.dealerProfile?.status ?? input?.dealerStatus
  );

  if (
    normalizedDealerStatus === "APPROVED" ||
    normalizedDealerStatus === "LEGACY" ||
    normalizedDealerStatus === "SUSPENDED"
  ) {
    return "DEALER";
  }

  return "USER";
};

export const getRoleBadgeClass = (role: DisplayRole): string => {
  const styles: Record<DisplayRole, string> = {
    USER: "bg-blue-100 text-blue-800 border-blue-200",
    DEALER: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    SUPERADMIN: "bg-red-100 text-red-800 border-red-200",
  };

  return styles[role];
};

export const isAdminDisplayRole = (role: DisplayRole): boolean =>
  role === "ADMIN" || role === "SUPERADMIN";

export const isCustomerDisplayRole = (role: DisplayRole): boolean =>
  role === "USER" || role === "DEALER";

export const isInternalDisplayRole = (role: DisplayRole): boolean =>
  role === "ADMIN" || role === "SUPERADMIN";

export const isExternalDisplayRole = (role: DisplayRole): boolean =>
  role === "USER" || role === "DEALER";

export const resolveAccountBoundary = (input?: RoleInput | null): AccountBoundary =>
  isInternalDisplayRole(resolveDisplayRole(input)) ? "INTERNAL" : "EXTERNAL";
