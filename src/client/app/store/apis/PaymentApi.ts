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
  paymentTransactions?: Array<{
    id: string;
    status: string;
    amount: number;
    paymentMethod: string;
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
    createGatewayPaymentOrder: builder.mutation<
      any,
      {
        orderId: string;
        customerEmail: string;
        customerName: string;
        customerPhone?: string;
      }
    >({
      query: (data) => ({
        url: "/payments/gateway/create-order",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Order"],
    }),
    processGatewayPayment: builder.mutation<
      any,
      {
        orderId: string;
        paymentMethod: string;
        amount: number;
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
        gatewayPayload: any;
      }
    >({
      query: (data) => ({
        url: "/payments/gateway/verify-payment",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Order"],
    }),
    getDealerCreditLedger: builder.query<DealerCreditLedger, string>({
      query: (dealerId) => ({
        url: `/payments/credit-ledger/${dealerId}`,
        method: "GET",
      }),
      providesTags: ["OutstandingPayments"],
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
      providesTags: ["OutstandingPayments"],
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
      providesTags: ["OutstandingPayments"],
    }),
    getOrderAuditTrail: builder.query<{ logs: AuditLogEntry[]; totalCount: number }, string>({
      query: (orderId) => ({
        url: `/payments/audit-trail/${orderId}`,
        method: "GET",
      }),
      providesTags: ["OutstandingPayments"],
    }),
    // Alias for backward compatibility
    getPaymentAuditTrail: builder.query<{ logs: AuditLogEntry[]; totalCount: number }, string>({
      query: (orderId) => ({
        url: `/payments/audit-trail/${orderId}`,
        method: "GET",
      }),
      providesTags: ["OutstandingPayments"],
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
      invalidatesTags: ["OutstandingPayments"],
    }),
    getPaymentSummary: builder.query<
      {
        totalOutstanding: number;
        totalOverdue: number;
        outstandingOrdersCount: number;
        overdueOrdersCount: number;
        recentPayments: Array<{
          id: string;
          orderId: string;
          amount: number;
          paymentMethod: string;
          createdAt: string;
          user: { name: string; email: string };
        }>;
      },
      void
    >({
      query: () => "/payments/summary",
      providesTags: ["OutstandingPayments"],
    }),
  }),
});

export const {
  useCreateGatewayPaymentOrderMutation,
  useProcessGatewayPaymentMutation,
  useGetDealerCreditLedgerQuery,
  useGetOutstandingPaymentOrdersQuery,
  useGetOutstandingPaymentsQuery,
  useGetOrderAuditTrailQuery,
  useGetPaymentAuditTrailQuery,
  useRecordAdminPaymentMutation,
  useRecordPaymentMutation,
  useGetPaymentSummaryQuery,
} = paymentApi;
