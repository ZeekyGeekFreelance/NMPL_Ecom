"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetDealerCreditLedgerQuery } from "@/app/store/apis/PaymentApi";
import { useGetProfileQuery } from "@/app/store/apis/UserApi";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import useToast from "@/app/hooks/ui/useToast";
import Link from "next/link";
import { toOrderReference, toPaymentReference, toTransactionReference } from "@/app/lib/utils/accountReference";
import { getPaginatedSerialNumber } from "@/app/lib/utils/pagination";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import { 
  ArrowDown, 
  ArrowUp, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  FileText, 
  Loader2, 
  TrendingDown, 
  TrendingUp, 
  X 
} from "lucide-react";

interface CreditLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealerId: string | null;
}

const CreditLedgerModal = ({ isOpen, onClose, dealerId }: CreditLedgerModalProps) => {
  const formatPrice = useFormatPrice();
  const { showToast } = useToast();
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // useGetProfileQuery maps to GET /users/profile/:id and returns { user: ... }
  const { data: profileData, isLoading: isLoadingDealer } = useGetProfileQuery(dealerId || "", {
    skip: !dealerId || !isOpen,
  });

  const { data: ledgerData, isLoading: isLoadingLedger } = useGetDealerCreditLedgerQuery(dealerId || "", {
    skip: !dealerId || !isOpen,
  });

  const ledgerEntries = ledgerData?.entries || [];
  const dealer = profileData?.user;

  const pageCount = Math.max(1, Math.ceil(ledgerEntries.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return ledgerEntries.slice(start, start + pageSize);
  }, [currentPage, ledgerEntries, pageSize]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCurrentPage(1);
  }, [isOpen, dealerId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCurrentPage((prev) => Math.min(prev, pageCount));
  }, [pageCount, isOpen]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalDebits = ledgerEntries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0);
    const totalCredits = ledgerEntries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0);
    const currentBalance = ledgerEntries.length > 0 ? ledgerEntries[0].balanceAfter : 0;
    
    return {
      totalDebits,
      totalCredits,
      currentBalance,
      totalEntries: ledgerEntries.length
    };
  }, [ledgerEntries]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "ORDER_DELIVERED":
        return <ArrowUp size={16} className="text-red-600" />;
      case "PAYMENT_RECEIVED":
        return <ArrowDown size={16} className="text-green-600" />;
      case "ORDER_CANCELLED":
        return <X size={16} className="text-gray-600" />;
      case "CREDIT_ADJUSTED":
        return <TrendingUp size={16} className="text-blue-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case "ORDER_DELIVERED":
        return "Order Delivered";
      case "PAYMENT_RECEIVED":
        return "Payment Received";
      case "ORDER_CANCELLED":
        return "Order Cancelled";
      case "CREDIT_ADJUSTED":
        return "Credit Adjusted";
      default:
        return eventType;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "ORDER_DELIVERED":
        return "text-red-700 bg-red-50 border-red-200";
      case "PAYMENT_RECEIVED":
        return "text-green-700 bg-green-50 border-green-200";
      case "ORDER_CANCELLED":
        return "text-gray-700 bg-gray-50 border-gray-200";
      case "CREDIT_ADJUSTED":
        return "text-blue-700 bg-blue-50 border-blue-200";
      default:
        return "text-gray-700 bg-gray-50 border-gray-200";
    }
  };

  const handleInvoiceDownload = async (orderId?: string) => {
    if (!orderId) {
      showToast("Invoice is not available for this entry.", "error");
      return;
    }

    try {
      await downloadInvoiceByOrderId(orderId);
      showToast("Invoice downloaded successfully", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download invoice";
      showToast(message, "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[calc(100vh-2rem)] w-full max-w-4xl flex-col rounded-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Credit Ledger</h2>
            {dealer && (
              <p className="text-sm text-gray-600 mt-1">
                Payment history for {dealer.name}
                {dealer.dealerProfile?.businessName && ` (${dealer.dealerProfile.businessName})`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {isLoadingDealer || isLoadingLedger ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 size={24} className="animate-spin text-gray-400" />
              <span className="text-gray-600">Loading credit history...</span>
            </div>
          </div>
        ) : !dealer ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600">Dealer not found</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-600">Current Balance</p>
                      <p className={`text-lg font-semibold ${
                        stats.currentBalance > 0 ? "text-red-700" : "text-green-700"
                      }`}>
                        {formatPrice(Math.abs(stats.currentBalance))}
                        {stats.currentBalance > 0 && " (Owed)"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-red-600" />
                    <div>
                      <p className="text-xs text-red-600">Total Orders</p>
                      <p className="text-lg font-semibold text-red-700">
                        {formatPrice(stats.totalDebits)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={16} className="text-green-600" />
                    <div>
                      <p className="text-xs text-green-600">Total Payments</p>
                      <p className="text-lg font-semibold text-green-700">
                        {formatPrice(stats.totalCredits)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <div>
                      <p className="text-xs text-blue-600">Total Entries</p>
                      <p className="text-lg font-semibold text-blue-700">
                        {stats.totalEntries}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ledger Entries */}
            <div className="flex-1 overflow-hidden">
              {ledgerEntries.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <CreditCard size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No credit history found</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Credit entries will appear here when orders are delivered or payments are received.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-auto">
                  <table className="w-full min-w-[960px] text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">SN No.</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Event</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Order</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Invoice</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Debit</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Credit</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Balance</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEntries.map((entry, index) => (
                        <tr key={entry.id} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-4 py-3 text-gray-700">
                            {getPaginatedSerialNumber(index, currentPage, pageSize)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-gray-400" />
                              <span className="text-gray-700">
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(entry.createdAt).toLocaleTimeString()}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium border ${getEventColor(entry.eventType)}`}>
                              {getEventIcon(entry.eventType)}
                              {getEventLabel(entry.eventType)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {entry.orderId ? (
                              <div className="space-y-1">
                                <p className="text-gray-700">{toOrderReference(entry.orderId)}</p>
                                {(entry as any).transactionId && (
                                  <Link
                                    href={`/dashboard/transactions/${toTransactionReference((entry as any).transactionId)}`}
                                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-mono hover:underline"
                                    title="Open transaction detail"
                                  >
                                    {toTransactionReference((entry as any).transactionId)}
                                  </Link>
                                )}
                                {entry.paymentTxnId && (
                                  <p className="text-[11px] text-indigo-600 font-mono">
                                    {toPaymentReference(entry.paymentTxnId)}
                                  </p>
                                )}
                                {(entry as any).paymentTransaction && (
                                  <div className="mt-1 rounded bg-gray-50 border border-gray-200 px-2 py-1 text-[11px] text-gray-700 space-y-0.5">
                                    <p><span className="text-gray-500">Method:</span> {(entry as any).paymentTransaction.paymentMethod}</p>
                                    {(entry as any).paymentTransaction.gatewayPaymentId && (
                                      <p><span className="text-gray-500">Gateway ID:</span> <span className="font-mono">{(entry as any).paymentTransaction.gatewayPaymentId}</span></p>
                                    )}
                                    {(entry as any).paymentTransaction.utrNumber && (
                                      <p><span className="text-gray-500">UTR:</span> {(entry as any).paymentTransaction.utrNumber}</p>
                                    )}
                                    {(entry as any).paymentTransaction.chequeNumber && (
                                      <p><span className="text-gray-500">Cheque:</span> {(entry as any).paymentTransaction.chequeNumber}{(entry as any).paymentTransaction.bankName ? `  ${(entry as any).paymentTransaction.bankName}` : ""}</p>
                                    )}
                                    {(entry as any).paymentTransaction.recordedBy && (
                                      <p><span className="text-gray-500">Recorded by:</span> {(entry as any).paymentTransaction.recordedBy.name}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {entry.orderId ? (
                              <button
                                type="button"
                                onClick={() => handleInvoiceDownload(entry.orderId)}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <FileText size={12} />
                                Invoice
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {entry.debitAmount > 0 ? (
                              <span className="text-red-700 font-medium">
                                +{formatPrice(entry.debitAmount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {entry.creditAmount > 0 ? (
                              <span className="text-green-700 font-medium">
                                -{formatPrice(entry.creditAmount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${
                              entry.balanceAfter > 0 ? "text-red-700" : "text-green-700"
                            }`}>
                              {formatPrice(Math.abs(entry.balanceAfter))}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {entry.notes ? (
                              <span className="text-gray-600 text-xs">{entry.notes}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ledgerEntries.length > pageSize && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
                      <p>
                        Showing{" "}
                        {ledgerEntries.length === 0
                          ? 0
                          : (currentPage - 1) * pageSize + 1}
                        -
                        {Math.min(currentPage * pageSize, ledgerEntries.length)} of{" "}
                        {ledgerEntries.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage <= 1}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium">
                          Page {currentPage} of {pageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(pageCount, prev + 1))
                          }
                          disabled={currentPage >= pageCount}
                          className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditLedgerModal;
