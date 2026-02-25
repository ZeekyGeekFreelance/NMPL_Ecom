export type OrderLifecycleStatus =
  | "PLACED"
  | "CONFIRMED"
  | "REJECTED"
  | "DELIVERED";

const legacyStatusMap: Record<string, OrderLifecycleStatus> = {
  PENDING: "PLACED",
  PROCESSING: "CONFIRMED",
  SHIPPED: "CONFIRMED",
  IN_TRANSIT: "CONFIRMED",
  CANCELED: "REJECTED",
  RETURNED: "REJECTED",
  REFUNDED: "REJECTED",
};

export const normalizeOrderStatus = (
  status?: string | null
): OrderLifecycleStatus => {
  const normalized = (status || "").trim().toUpperCase();

  if (normalized === "PLACED") return "PLACED";
  if (normalized === "CONFIRMED") return "CONFIRMED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "DELIVERED") return "DELIVERED";

  return legacyStatusMap[normalized] || "PLACED";
};

export const ORDER_STATUS_LABELS: Record<OrderLifecycleStatus, string> = {
  PLACED: "Order Placed",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  DELIVERED: "Delivered",
};

export const CUSTOMER_ORDER_STATUS_LABELS: Record<
  OrderLifecycleStatus,
  string
> = {
  PLACED: "Order Placed",
  CONFIRMED: "Confirmed",
  REJECTED: "Cancelled",
  DELIVERED: "Delivered",
};

export const ORDER_STATUS_COLORS: Record<OrderLifecycleStatus, string> = {
  PLACED: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  DELIVERED: "bg-green-100 text-green-800",
};

export const ORDER_STATUS_OPTIONS: Array<{
  label: string;
  value: OrderLifecycleStatus;
}> = [
  { label: "Order Placed", value: "PLACED" },
  { label: "Confirm Order", value: "CONFIRMED" },
  { label: "Reject Order", value: "REJECTED" },
  { label: "Delivered", value: "DELIVERED" },
];

const allowedStatusTransitions: Record<OrderLifecycleStatus, OrderLifecycleStatus[]> = {
  PLACED: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["DELIVERED", "REJECTED"],
  REJECTED: [],
  DELIVERED: [],
};

export const getAllowedNextOrderStatuses = (
  status?: string | null
): OrderLifecycleStatus[] => {
  const normalized = normalizeOrderStatus(status);
  return allowedStatusTransitions[normalized];
};

export const requiresConfirmedRejectionSafetyCheck = (params: {
  currentStatus?: string | null;
  nextStatus?: string | null;
}): boolean => {
  const current = normalizeOrderStatus(params.currentStatus);
  const next = normalizeOrderStatus(params.nextStatus);
  return current === "CONFIRMED" && next === "REJECTED";
};

export const getOrderStatusLabel = (status?: string | null): string =>
  ORDER_STATUS_LABELS[normalizeOrderStatus(status)];

export const getCustomerOrderStatusLabel = (status?: string | null): string =>
  CUSTOMER_ORDER_STATUS_LABELS[normalizeOrderStatus(status)];

export const getOrderStatusColor = (status?: string | null): string =>
  ORDER_STATUS_COLORS[normalizeOrderStatus(status)];

export const canDownloadInvoiceForStatus = (status?: string | null): boolean => {
  const normalized = normalizeOrderStatus(status);
  return normalized === "CONFIRMED" || normalized === "DELIVERED";
};

export const isTerminalOrderStatus = (status?: string | null): boolean => {
  const normalized = normalizeOrderStatus(status);
  return normalized === "REJECTED" || normalized === "DELIVERED";
};
