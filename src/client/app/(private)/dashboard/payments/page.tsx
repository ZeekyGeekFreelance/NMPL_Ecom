"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { withAuth } from "@/app/components/HOC/WithAuth";
import PermissionGuard from "@/app/components/auth/PermissionGuard";
import { 
  useGetOutstandingPaymentsQuery,
  useRecordPaymentMutation
} from "@/app/store/apis/PaymentApi";
import useToast from "@/app/hooks/ui/useToast";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { 
  Calendar, 
  Clock, 
  CreditCard, 
  DollarSign, 
  FileText, 
  Search, 
  AlertTriangle,
  XCircle,
  Eye,
  Plus,
  ExternalLink
} from "lucide-react";
import Modal from "@/app/components/organisms/Modal";
import PaymentRecordingForm from "./PaymentRecordingForm";
import CreditLedgerModal from "./CreditLedgerModal";
import PaymentAuditModal from "./PaymentAuditModal";
import { toOrderReference, toTransactionReference, toPaymentReference } from "@/app/lib/utils/accountReference";
import { normalizeOrderStatus } from "@/app/lib/orderLifecycle";

type PaymentFilter = "ALL" | "DUE" | "OVERDUE";

const PaymentsDashboard = () => {
  const { showToast } = useToast();
  const formatPrice = useFormatPrice();
  const searchParams = useSearchParams();

  const initialSearchTerm = useMemo(() => {
    const param =
      searchParams.get("transaction") ||
      searchParams.get("order") ||
      searchParams.get("invoice") ||
      searchParams.get("q");
    return param ? param.trim() : "";
  }, [searchParams]);

  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Modal states
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isCreditLedgerModalOpen, setIsCreditLedgerModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const { data: outstandingData, isLoading } = useGetOutstandingPaymentsQuery();

  useEffect(() => {
    if (initialSearchTerm && initialSearchTerm !== searchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm, searchTerm]);

  const [recordPayment, { isLoading: isRecording }] = useRecordPaymentMutation();

  const outstandingOrders = outstandingData?.orders || [];

  // Filter and search logic
  const filteredOrders = useMemo(() => {
    let filtered = outstandingOrders;

    // Apply payment filter
    if (paymentFilter === "DUE") {
      filtered = filtered.filter(order => 
        order.paymentDueDate && new Date(order.paymentDueDate) > new Date()
      );
    } else if (paymentFilter === "OVERDUE") {
      filtered = filtered.filter(order => 
        order.paymentDueDate && new Date(order.paymentDueDate) <= new Date()
      );
    }

    // Apply search
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((order) => {
        const orderRef = toOrderReference(order.id).toLowerCase();
        const rawOrderId = order.id.toLowerCase();
        const transactionId = order.transaction?.id;
        const transactionRef = transactionId
          ? toTransactionReference(transactionId).toLowerCase()
          : "";
        const rawTransactionId = transactionId ? transactionId.toLowerCase() : "";
        const invoice = Array.isArray(order.invoice)
          ? order.invoice[0]
          : order.invoice;
        const invoiceNumber = String(invoice?.invoiceNumber || "").toLowerCase();
        const paymentRefs = (order.paymentTransactions || [])
          .map((pt: any) => toPaymentReference(pt.id).toLowerCase());

        return (
          order.user.name.toLowerCase().includes(search) ||
          order.user.email.toLowerCase().includes(search) ||
          order.user.dealerProfile?.businessName?.toLowerCase().includes(search) ||
          orderRef.includes(search) ||
          rawOrderId.includes(search) ||
          transactionRef.includes(search) ||
          rawTransactionId.includes(search) ||
          invoiceNumber.includes(search) ||
          paymentRefs.some((ref: string) => ref.includes(search))
        );
      });
    }

    return filtered;
  }, [outstandingOrders, paymentFilter, searchTerm]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalOutstanding = outstandingOrders.reduce((sum, order) => sum + order.amount, 0);
    const overdueOrders = outstandingOrders.filter(order => 
      order.paymentDueDate && new Date(order.paymentDueDate) <= new Date()
    );
    const totalOverdue = overdueOrders.reduce((sum, order) => sum + order.amount, 0);
    
    return {
      totalOrders: outstandingOrders.length,
      totalOutstanding,
      overdueCount: overdueOrders.length,
      totalOverdue
    };
  }, [outstandingOrders]);

  const handleRecordPayment = async (paymentData: any) => {
    try {
      await recordPayment(paymentData).unwrap();
      showToast("Payment recorded successfully", "success");
      setIsRecordingModalOpen(false);
      setSelectedOrderId(null);
    } catch (error) {
      showToast(getApiErrorMessage(error as any, "Failed to record payment"), "error");
    }
  };

  const openRecordingModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsRecordingModalOpen(true);
  };

  const openCreditLedger = (dealerId: string) => {
    setSelectedDealerId(dealerId);
    setIsCreditLedgerModalOpen(true);
  };

  const openAuditTrail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsAuditModalOpen(true);
  };

  const getStatusBadge = (order: any) => {
    const dueDate = order.paymentDueDate ? new Date(order.paymentDueDate) : null;
    const hasDueDate = !!dueDate && !Number.isNaN(dueDate.getTime());
    const isOverdue = hasDueDate && dueDate.getTime() <= Date.now();
    const normalizedStatus = normalizeOrderStatus(order.status);

    if (!hasDueDate) {
      const isDelivered = normalizedStatus === "DELIVERED";
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            isDelivered
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {isDelivered ? <AlertTriangle size={12} /> : <Clock size={12} />}
          {isDelivered ? "DUE DATE MISSING" : "DUE ON DELIVERY"}
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
          <AlertTriangle size={12} />
          OVERDUE
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
        <Clock size={12} />
        PAYMENT DUE
      </span>
    );
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return "Due today";
    } else {
      return `${diffDays} days remaining`;
    }
  };

  return (
    <PermissionGuard
      allowedRoles={["ADMIN", "SUPERADMIN"]}
      fallback={
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Access denied. Only ADMIN or SUPERADMIN can manage payments.
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
            <p className="text-sm text-gray-600 mt-1">
              Track outstanding payments, record offline payments, and manage dealer credit.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <FileText size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Outstanding Orders</p>
                <p className="text-xl font-semibold text-gray-900">{stats.totalOrders}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Outstanding</p>
                <p className="text-xl font-semibold text-gray-900">{formatPrice(stats.totalOutstanding)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue Orders</p>
                <p className="text-xl font-semibold text-gray-900">{stats.overdueCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <XCircle size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue Amount</p>
                <p className="text-xl font-semibold text-gray-900">{formatPrice(stats.totalOverdue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by dealer, order, transaction, or invoice"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              {(["ALL", "DUE", "OVERDUE"] as PaymentFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPaymentFilter(filter)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    paymentFilter === filter
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {filter === "ALL" ? "All Orders" : filter === "DUE" ? "Payment Due" : "Overdue"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Outstanding Orders Table */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Dealer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Order Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Loading outstanding payments...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {searchTerm ? "No orders match your search." : "No outstanding payments found."}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const orderRef = toOrderReference(order.id);
                    const transactionRef = order.transaction?.id
                      ? toTransactionReference(order.transaction.id)
                      : null;
                    const invoice = Array.isArray(order.invoice)
                      ? order.invoice[0]
                      : order.invoice;
                    const normalizedStatus = normalizeOrderStatus(order.status);
                    const dueDate = order.paymentDueDate
                      ? new Date(order.paymentDueDate)
                      : null;
                    const hasDueDate =
                      !!dueDate && !Number.isNaN(dueDate.getTime());
                    const isDelivered = normalizedStatus === "DELIVERED";
                    const dueDateLabel = hasDueDate
                      ? dueDate.toLocaleDateString()
                      : isDelivered
                      ? "Missing due date"
                      : "On delivery";

                    return (
                      <tr key={order.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-gray-900">{orderRef}</p>
                            {transactionRef ? (
                              <Link
                                href={`/dashboard/transactions/${transactionRef}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                              >
                                <ExternalLink size={12} />
                                {transactionRef}
                              </Link>
                            ) : (
                              <p className="text-xs text-gray-400">
                                Transaction not linked
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              Invoice: {invoice?.invoiceNumber || "Not issued"}
                            </p>
                            {order.paymentTransactions && order.paymentTransactions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openAuditTrail(order.id)}
                                className="inline-flex items-center gap-1 text-xs font-mono font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                title="Click to view audit trail for this payment"
                              >
                                <Eye size={10} />
                                {toPaymentReference(order.paymentTransactions[0].id)}
                              </button>
                            )}
                            <p className="text-xs text-gray-500">
                              {order.orderItems?.length || 0} items
                            </p>
                          </div>
                        </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{order.user.name}</p>
                          <p className="text-xs text-gray-600">{order.user.email}</p>
                          {order.user.dealerProfile?.businessName && (
                            <p className="text-xs text-gray-500">{order.user.dealerProfile.businessName}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{formatPrice(order.amount)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p
                            className={
                              !hasDueDate && isDelivered
                                ? "text-red-600"
                                : "text-gray-700"
                            }
                          >
                            {dueDateLabel}
                          </p>
                          {hasDueDate && order.paymentDueDate && (
                            <p className="text-xs text-gray-500">
                              {getDaysUntilDue(order.paymentDueDate)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(order)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openRecordingModal(order.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                          >
                            <Plus size={12} />
                            Record Payment
                          </button>
                          <button
                            onClick={() => openCreditLedger(order.user.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            <CreditCard size={12} />
                            Credit History
                          </button>
                          <button
                            onClick={() => openAuditTrail(order.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                          >
                            <Eye size={12} />
                            Audit Trail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Recording Modal */}
        <Modal
          open={isRecordingModalOpen}
          onClose={() => {
            setIsRecordingModalOpen(false);
            setSelectedOrderId(null);
          }}
          contentClassName="max-w-2xl"
        >
          <PaymentRecordingForm
            orderId={selectedOrderId}
            onSubmit={handleRecordPayment}
            onCancel={() => {
              setIsRecordingModalOpen(false);
              setSelectedOrderId(null);
            }}
          />
        </Modal>

        {/* Credit Ledger Modal */}
        <CreditLedgerModal
          isOpen={isCreditLedgerModalOpen}
          onClose={() => {
            setIsCreditLedgerModalOpen(false);
            setSelectedDealerId(null);
          }}
          dealerId={selectedDealerId}
        />

        {/* Payment Audit Modal */}
        <PaymentAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => {
            setIsAuditModalOpen(false);
            setSelectedOrderId(null);
          }}
          orderId={selectedOrderId}
        />
      </div>
    </PermissionGuard>
  );
};

export default withAuth(PaymentsDashboard, {
  allowedRoles: ["ADMIN", "SUPERADMIN"],
});
