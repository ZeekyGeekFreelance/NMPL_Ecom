export type OrderLifecycleStatus =
  | "PENDING_VERIFICATION"
  | "WAITLISTED"
  | "AWAITING_PAYMENT"
  | "QUOTATION_REJECTED"
  | "QUOTATION_EXPIRED"
  | "CONFIRMED"
  | "DELIVERED";

const legacyStatusMap: Record<string, OrderLifecycleStatus> = {
  PLACED: "PENDING_VERIFICATION",
  PENDING: "PENDING_VERIFICATION",
  PROCESSING: "CONFIRMED",
  SHIPPED: "CONFIRMED",
  IN_TRANSIT: "CONFIRMED",
  DELIVERED: "DELIVERED",
  REJECTED: "QUOTATION_REJECTED",
  CANCELED: "QUOTATION_REJECTED",
  CANCELLED: "QUOTATION_REJECTED",
  RETURNED: "QUOTATION_REJECTED",
  REFUNDED: "QUOTATION_REJECTED",
};

export const normalizeOrderStatus = (
  status?: string | null
): OrderLifecycleStatus => {
  const normalized = (status || "").trim().toUpperCase();

  if (normalized === "PENDING_VERIFICATION") return "PENDING_VERIFICATION";
  if (normalized === "WAITLISTED") return "WAITLISTED";
  if (normalized === "AWAITING_PAYMENT") return "AWAITING_PAYMENT";
  if (normalized === "QUOTATION_REJECTED") return "QUOTATION_REJECTED";
  if (normalized === "QUOTATION_EXPIRED") return "QUOTATION_EXPIRED";
  if (normalized === "CONFIRMED") return "CONFIRMED";
  if (normalized === "DELIVERED") return "DELIVERED";

  return legacyStatusMap[normalized] || "PENDING_VERIFICATION";
};

export const ORDER_STATUS_LABELS: Record<OrderLifecycleStatus, string> = {
  PENDING_VERIFICATION: "Pending Verification",
  WAITLISTED: "Waitlisted",
  AWAITING_PAYMENT: "Awaiting Payment",
  QUOTATION_REJECTED: "Quotation Rejected",
  QUOTATION_EXPIRED: "Quotation Expired",
  CONFIRMED: "Confirmed",
  DELIVERED: "Delivered",
};

export const CUSTOMER_ORDER_STATUS_LABELS: Record<
  OrderLifecycleStatus,
  string
> = {
  PENDING_VERIFICATION: "Verification Pending",
  WAITLISTED: "Waitlisted",
  AWAITING_PAYMENT: "Awaiting Payment",
  QUOTATION_REJECTED: "Quotation Rejected",
  QUOTATION_EXPIRED: "Quotation Expired",
  CONFIRMED: "Confirmed",
  DELIVERED: "Delivered",
};

export const ORDER_STATUS_COLORS: Record<OrderLifecycleStatus, string> = {
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
  WAITLISTED: "bg-orange-100 text-orange-800",
  AWAITING_PAYMENT: "bg-blue-100 text-blue-800",
  QUOTATION_REJECTED: "bg-red-100 text-red-800",
  QUOTATION_EXPIRED: "bg-red-100 text-red-800",
  CONFIRMED: "bg-green-100 text-green-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
};

export const ORDER_STATUS_OPTIONS: Array<{
  label: string;
  value: OrderLifecycleStatus;
}> = [
  { label: "Approve Quotation & Reserve", value: "AWAITING_PAYMENT" },
  { label: "Move to Waitlist", value: "WAITLISTED" },
  { label: "Mark as Delivered", value: "DELIVERED" },
  { label: "Reject Quotation", value: "QUOTATION_REJECTED" },
  { label: "Mark Quotation Expired", value: "QUOTATION_EXPIRED" },
];

const allowedStatusTransitions: Record<
  OrderLifecycleStatus,
  OrderLifecycleStatus[]
> = {
  PENDING_VERIFICATION: ["AWAITING_PAYMENT", "WAITLISTED"],
  WAITLISTED: ["AWAITING_PAYMENT"],
  AWAITING_PAYMENT: ["QUOTATION_REJECTED", "QUOTATION_EXPIRED"],
  QUOTATION_REJECTED: [],
  QUOTATION_EXPIRED: [],
  CONFIRMED: ["DELIVERED"],
  DELIVERED: [],
};

export const getAllowedNextOrderStatuses = (
  status?: string | null
): OrderLifecycleStatus[] => {
  const normalized = normalizeOrderStatus(status);
  return allowedStatusTransitions[normalized];
};

export const requiresConfirmedRejectionSafetyCheck = (): boolean => false;

export const getOrderStatusLabel = (status?: string | null): string =>
  ORDER_STATUS_LABELS[normalizeOrderStatus(status)];

export const getCustomerOrderStatusLabel = (status?: string | null): string =>
  CUSTOMER_ORDER_STATUS_LABELS[normalizeOrderStatus(status)];

export const getOrderStatusColor = (status?: string | null): string =>
  ORDER_STATUS_COLORS[normalizeOrderStatus(status)];

export const canDownloadInvoiceForStatus = (status?: string | null): boolean =>
  ["CONFIRMED", "DELIVERED"].includes(normalizeOrderStatus(status));

export const isTerminalOrderStatus = (status?: string | null): boolean => {
  const normalized = normalizeOrderStatus(status);
  return (
    normalized === "DELIVERED" ||
    normalized === "QUOTATION_REJECTED" ||
    normalized === "QUOTATION_EXPIRED"
  );
};
