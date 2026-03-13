export type OrderLifecycleStatus =
  | "PENDING_VERIFICATION"
  | "WAITLISTED"
  | "AWAITING_PAYMENT"
  | "QUOTATION_REJECTED"
  | "QUOTATION_EXPIRED"
  | "CONFIRMED"
  | "DELIVERED";

export type PaymentState =
  | "PAID"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_PENDING";

const legacyStatusMap: Record<string, OrderLifecycleStatus> = {
  PLACED: "PENDING_VERIFICATION",
  PENDING: "PENDING_VERIFICATION",
  PROCESSING: "CONFIRMED",
  SHIPPED: "CONFIRMED",
  IN_TRANSIT: "CONFIRMED",
  PAID: "CONFIRMED",
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

const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  PAID: "Paid",
  PAYMENT_DUE: "Payment Due",
  PAYMENT_OVERDUE: "Payment Overdue",
  PAYMENT_PENDING: "Payment Pending",
};

const PAYMENT_STATE_COLORS: Record<PaymentState, string> = {
  PAID: "bg-green-100 text-green-800",
  PAYMENT_DUE: "bg-amber-100 text-amber-800",
  PAYMENT_OVERDUE: "bg-red-100 text-red-800",
  PAYMENT_PENDING: "bg-gray-100 text-gray-700",
};

const resolvePaymentDueDate = (
  value?: string | Date | null
): Date | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const hasConfirmedPayment = (
  paymentTransactions?: Array<{ status?: string | null }>
) =>
  Array.isArray(paymentTransactions) &&
  paymentTransactions.some(
    (transaction) => String(transaction?.status || "").toUpperCase() === "CONFIRMED"
  );

export const resolvePaymentState = (params?: {
  isPayLater?: boolean | null;
  paymentDueDate?: string | Date | null;
  paymentTransactions?: Array<{ status?: string | null }>;
  payment?: { status?: string | null } | null;
  now?: Date;
}): {
  state: PaymentState;
  isPayLater: boolean;
  isPaid: boolean;
  isOverdue: boolean;
} => {
  const isPayLater = Boolean(params?.isPayLater);
  const now = params?.now ?? new Date();
  const dueDate = resolvePaymentDueDate(params?.paymentDueDate);
  const paymentStatus = String(params?.payment?.status || "").toUpperCase();
  const isPaid = hasConfirmedPayment(params?.paymentTransactions) || paymentStatus === "PAID";

  if (isPaid) {
    return {
      state: "PAID",
      isPayLater,
      isPaid: true,
      isOverdue: false,
    };
  }

  if (isPayLater && dueDate) {
    const isOverdue = dueDate.getTime() < now.getTime();
    return {
      state: isOverdue ? "PAYMENT_OVERDUE" : "PAYMENT_DUE",
      isPayLater,
      isPaid: false,
      isOverdue,
    };
  }

  return {
    state: "PAYMENT_PENDING",
    isPayLater,
    isPaid: false,
    isOverdue: false,
  };
};

export const getPaymentStateLabel = (state: PaymentState): string =>
  PAYMENT_STATE_LABELS[state];

export const getPaymentStateColor = (state: PaymentState): string =>
  PAYMENT_STATE_COLORS[state];

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

export const getPaymentAwareOrderStatusLabel = (params?: {
  status?: string | null;
  isPayLater?: boolean | null;
  paymentDueDate?: string | Date | null;
  paymentTransactions?: Array<{ status?: string | null }>;
  payment?: { status?: string | null } | null;
  now?: Date;
}): string => {
  const normalizedStatus = normalizeOrderStatus(params?.status);
  const baseLabel = getOrderStatusLabel(normalizedStatus);

  if (!params?.isPayLater) {
    return baseLabel;
  }

  const dueDate = resolvePaymentDueDate(params?.paymentDueDate);
  const hasDueDate = !!dueDate;
  const { state, isPaid } = resolvePaymentState({
    isPayLater: params?.isPayLater,
    paymentDueDate: params?.paymentDueDate,
    paymentTransactions: params?.paymentTransactions,
    payment: params?.payment,
    now: params?.now,
  });

  if (normalizedStatus === "DELIVERED" && !hasDueDate && !isPaid) {
    return `${baseLabel} - Due Date Missing`;
  }

  if (normalizedStatus === "DELIVERED" || normalizedStatus === "CONFIRMED") {
    return `${baseLabel} - ${getPaymentStateLabel(state)}`;
  }

  return baseLabel;
};

export const getPaymentAwareOrderStatusColor = (params?: {
  status?: string | null;
  isPayLater?: boolean | null;
  paymentDueDate?: string | Date | null;
  paymentTransactions?: Array<{ status?: string | null }>;
  payment?: { status?: string | null } | null;
  now?: Date;
}): string => {
  const normalizedStatus = normalizeOrderStatus(params?.status);

  if (!params?.isPayLater) {
    return getOrderStatusColor(normalizedStatus);
  }

  const dueDate = resolvePaymentDueDate(params?.paymentDueDate);
  const hasDueDate = !!dueDate;
  const { state, isPaid } = resolvePaymentState({
    isPayLater: params?.isPayLater,
    paymentDueDate: params?.paymentDueDate,
    paymentTransactions: params?.paymentTransactions,
    payment: params?.payment,
    now: params?.now,
  });

  if (normalizedStatus === "DELIVERED" && !hasDueDate && !isPaid) {
    return PAYMENT_STATE_COLORS.PAYMENT_OVERDUE;
  }

  if (normalizedStatus === "DELIVERED" || normalizedStatus === "CONFIRMED") {
    if (state === "PAID") {
      return PAYMENT_STATE_COLORS.PAID;
    }
    if (state === "PAYMENT_OVERDUE") {
      return PAYMENT_STATE_COLORS.PAYMENT_OVERDUE;
    }
    if (state === "PAYMENT_PENDING") {
      return PAYMENT_STATE_COLORS.PAYMENT_PENDING;
    }
    return PAYMENT_STATE_COLORS.PAYMENT_DUE;
  }

  return getOrderStatusColor(normalizedStatus);
};

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
