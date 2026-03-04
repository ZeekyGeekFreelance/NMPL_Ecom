export type EffectiveRole = "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
export type CustomerType = "USER" | "DEALER";

type UserRoleInput = {
  role?: unknown;
  dealerStatus?: unknown;
};

const normalizeUpper = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toUpperCase();

export const isAdminRole = (role: unknown): boolean => {
  const normalized = normalizeUpper(role);
  return normalized === "ADMIN" || normalized === "SUPERADMIN";
};

export const resolveEffectiveRole = ({
  role,
  dealerStatus,
}: UserRoleInput): EffectiveRole => {
  const normalizedRole = normalizeUpper(role);
  if (normalizedRole === "SUPERADMIN") {
    return "SUPERADMIN";
  }

  if (normalizedRole === "ADMIN") {
    return "ADMIN";
  }

  const normalizedDealerStatus = normalizeUpper(dealerStatus);
  if (normalizedDealerStatus === "APPROVED" || normalizedDealerStatus === "LEGACY") {
    return "DEALER";
  }

  return "USER";
};

export const resolveEffectiveRoleFromUser = (user?: {
  role?: unknown;
  dealerStatus?: unknown;
  dealerProfile?: { status?: unknown } | null;
} | null): EffectiveRole =>
  resolveEffectiveRole({
    role: user?.role,
    dealerStatus: user?.dealerProfile?.status ?? user?.dealerStatus,
  });

export const resolveCustomerType = (input: UserRoleInput): CustomerType =>
  resolveEffectiveRole(input) === "DEALER" ? "DEALER" : "USER";

export const resolveCustomerTypeFromUser = (user?: {
  role?: unknown;
  dealerStatus?: unknown;
  dealerProfile?: { status?: unknown } | null;
} | null): CustomerType =>
  resolveCustomerType({
    role: user?.role,
    dealerStatus: user?.dealerProfile?.status ?? user?.dealerStatus,
  });
