import { apiSlice } from "../slices/ApiSlice";

interface PaymentTransaction {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  paymentSource: string;
  paymentReceivedAt: string;
  status: string;
  notes?: string;
  utrNumber?: string;
  bankName?: string;
  chequeNumber?: string;
  gatewayPaymentId?: string;
  createdAt: string;
}

interface CreditLedgerEntry {
  id: string;
  dealerId: string;
  orderId?: string;
  paymentTxnId?: string;
  eventType: string;
  debitAmount: number;
  creditAmount: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
}

interface DealerCreditLedger {
  entries: CreditLedgerEntry[];
  currentBalance: number;
  totalEntries: number;
}

interface OutstandingOrder {
  id: string;
  userId: string;
  amount: number;
  orderDate: string;
  paymentDueDate?: string;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
    dealerProfile?: {
      businessName?: string;
      status: string;
      creditTermDays: number;
    };
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    paymentStatus: string;
    paymentDueDate?: string;
  } | Array<{
    id: string;
    invoiceNumber: string;
    paymentStatus: string;
    paymentDueDate?: string;
  }>;
  transaction?: {
    id: string;
    status: string;
    transactionDate: string;
  };
  orderItems?: Array<{
    id: string;
    quantity: number;
    price: number;
  }>;
}

interface AuditLogEntry {
  id: string;
  orderId: string;
  action: string;
  actorRole: string;
  previousStatus?: string;
  nextStatus?: string;
  metadata?: any;
  createdAt: string;
  actorUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  paymentTxn?: {
    id: string;
    paymentMethod: string;
    amount: number;
    status: string;
  };
}

export const paymentApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDealerCreditLedger: builder.query<DealerCreditLedger, string>({
      query: (dealerId) => ({
        url: `/payments/credit-ledger/${dealerId}`,
        method: "GET",
      }),
      providesTags: ["Order"],
    }),
    getOutstandingPaymentOrders: builder.query<
      { orders: OutstandingOrder[]; totalCount: number },
      { dealerId?: string; isOverdue?: boolean; limit?: number; offset?: number } | void
    >({
      query: (params) => ({
        url: "/payments/outstanding",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: ["Order"],
    }),
    // Alias for backward compatibility
    getOutstandingPayments: builder.query<
      { orders: OutstandingOrder[]; totalCount: number },
      { dealerId?: string; isOverdue?: boolean; limit?: number; offset?: number } | void
    >({
      query: (params) => ({
        url: "/payments/outstanding",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: ["Order"],
    }),
    getOrderAuditTrail: builder.query<{ logs: AuditLogEntry[]; totalCount: number }, string>({
      query: (orderId) => ({
        url: `/payments/audit-trail/${orderId}`,
        method: "GET",
      }),
      providesTags: ["Order"],
    }),
    // Alias for backward compatibility
    getPaymentAuditTrail: builder.query<{ logs: AuditLogEntry[]; totalCount: number }, string>({
      query: (orderId) => ({
        url: `/payments/audit-trail/${orderId}`,
        method: "GET",
      }),
      providesTags: ["Order"],
    }),
    recordAdminPayment: builder.mutation<
      { paymentTransaction: PaymentTransaction; message: string },
      {
        orderId: string;
        paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE";
        amount: number;
        paymentReceivedAt: string;
        notes?: string;
        utrNumber?: string;
        bankName?: string;
        transferDate?: string;
        chequeNumber?: string;
        chequeDate?: string;
        chequeClearingDate?: string;
      }
    >({
      query: (data) => ({
        url: "/payments/record",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Order"],
    }),
    // Alias for backward compatibility
    recordPayment: builder.mutation<
      { paymentTransaction: PaymentTransaction; message: string },
      {
        orderId: string;
        paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE";
        amount: number;
        paymentReceivedAt: string;
        notes?: string;
        utrNumber?: string;
        bankName?: string;
        transferDate?: string;
        chequeNumber?: string;
        chequeDate?: string;
        chequeClearingDate?: string;
      }
    >({
      query: (data) => ({
        url: "/payments/record",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Order"],
    }),
  }),
});

export const {
  useGetDealerCreditLedgerQuery,
  useGetOutstandingPaymentOrdersQuery,
  useGetOutstandingPaymentsQuery,
  useGetOrderAuditTrailQuery,
  useGetPaymentAuditTrailQuery,
  useRecordAdminPaymentMutation,
  useRecordPaymentMutation,
} = paymentApi;
