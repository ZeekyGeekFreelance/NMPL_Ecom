"use client";

import Dropdown from "@/app/components/molecules/Dropdown";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";
import Link from "next/link";
import { ArrowLeft, Download, CreditCard, Receipt } from "lucide-react";

/**
 * paymentContextHref is provided by the parent page after computing:
 *   - isPayLater && !isSettled  -> /dashboard/payments   (record outstanding payment)
 *   - dealerId exists otherwise -> /dashboard/dealers?paymentHistory=DEALER_ID
 *   - null                      -> hide the button
 *
 * The label and icon are chosen accordingly so admins always know what they'll
 * land on before they click.
 */
const PageHeader = ({
  onBack,
  onUpdateStatus,
  onOpenQuotationEditor,
  onDownloadInvoice,
  isDownloadingInvoice,
  isUpdating,
  isIssuingQuotation,
  canUpdateStatus,
  canEditQuotation,
  newStatus,
  setNewStatus,
  statusOptions,
  paymentContextHref,
  isPayLater,
  isSettled,
}: {
  onBack: () => void;
  onUpdateStatus: () => void;
  onOpenQuotationEditor: () => void;
  onDownloadInvoice: () => void;
  isDownloadingInvoice: boolean;
  isUpdating: boolean;
  isIssuingQuotation: boolean;
  canUpdateStatus: boolean;
  canEditQuotation: boolean;
  newStatus: string;
  setNewStatus: (v: string) => void;
  statusOptions: Array<{ value: string; label: string }>;
  paymentContextHref: string | null;
  isPayLater?: boolean;
  isSettled?: boolean;
}) => {
  // Decide the label & icon for the payment context button
  const showPaymentButton = !!paymentContextHref;
  const isOutstandingLink = isPayLater && !isSettled;
  const paymentButtonLabel = isOutstandingLink ? "Record Payment" : "Payment History";
  const PaymentIcon = isOutstandingLink ? Receipt : CreditCard;

  return (
    <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center">
      <div>
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-2 transition duration-200"
        >
          <ArrowLeft size={16} className="mr-1" />
          <span className="text-sm">Back to transactions</span>
        </button>
        <h1 className="type-h3 text-gray-900">Transaction Details</h1>
        <p className="text-sm text-gray-500">
          View detailed information about this transaction
        </p>
      </div>

      <div className="flex items-center space-x-3 mt-4 md:mt-0">
        {showPaymentButton && (
          <Link
            href={paymentContextHref!}
            className={`px-4 py-2 border rounded-md hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-200 inline-flex items-center gap-2 text-sm font-medium ${
              isOutstandingLink
                ? "border-green-200 text-green-700 hover:bg-green-50 focus:ring-green-300"
                : "border-blue-200 text-blue-700 hover:bg-blue-50 focus:ring-blue-300"
            }`}
          >
            <PaymentIcon size={16} />
            {paymentButtonLabel}
          </Link>
        )}

        <button
          type="button"
          onClick={onDownloadInvoice}
          disabled={isDownloadingInvoice}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {isDownloadingInvoice ? <MiniSpinner size={16} /> : <Download size={16} />}
          <span>Invoice PDF</span>
        </button>

        <button
          type="button"
          onClick={onOpenQuotationEditor}
          disabled={!canEditQuotation || isIssuingQuotation}
          className="px-4 py-2 border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isIssuingQuotation ? <MiniSpinner size={16} /> : null}
          <span>Edit Quotation</span>
        </button>

        {!isUpdating ? (
          <>
            <Dropdown
              value={newStatus || null}
              onChange={(value) => setNewStatus(value || "")}
              options={statusOptions}
              className="w-40"
              disabled={!canUpdateStatus}
            />
            <button
              onClick={onUpdateStatus}
              disabled={!canUpdateStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Update Status
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <MiniSpinner size={16} />
            <span>Update Status</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
