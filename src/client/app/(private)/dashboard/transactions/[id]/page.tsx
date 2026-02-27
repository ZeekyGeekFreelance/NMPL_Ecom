"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { withAuth } from "@/app/components/HOC/WithAuth";
import useToast from "@/app/hooks/ui/useToast";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useGetTransactionQuery,
  useUpdateTransactionStatusMutation,
} from "@/app/store/apis/TransactionApi";
import PageHeader from "../PageHeader";
import ErrorState from "../ErrorState";
import TransactionOverview from "../TransactionOverview";
import OrderInformation from "../OrderInformation";
import CustomerInformation from "../CustomerInformation";
import PaymentInformation from "../PaymentInformation";
import ShipmentInformation from "../ShipmentInformation";
import ShippingAddress from "../ShippingAddress";
import TransactionTimeline from "../TransactionTimeline";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import CustomLoader from "@/app/components/feedback/CustomLoader";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import {
  ORDER_STATUS_OPTIONS,
  getAllowedNextOrderStatuses,
  getOrderStatusLabel,
  normalizeOrderStatus,
  requiresConfirmedRejectionSafetyCheck,
  type OrderLifecycleStatus,
} from "@/app/lib/orderLifecycle";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { toTransactionReference } from "@/app/lib/utils/accountReference";

const TransactionDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [newStatus, setNewStatus] = useState<OrderLifecycleStatus | "">("");
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isStatusConfirmModalOpen, setIsStatusConfirmModalOpen] =
    useState(false);
  const [isConfirmedRejectionModalOpen, setIsConfirmedRejectionModalOpen] =
    useState(false);
  const [updateTransactionStatus, { isLoading: isUpdating }] =
    useUpdateTransactionStatusMutation();

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useGetTransactionQuery(id, {
    skip: !id || !isAdmin,
    pollingInterval: 8000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const transaction = data?.transaction;
  const order = transaction?.order;
  const transactionReferenceForDisplay = transaction?.id
    ? toTransactionReference(transaction.id)
    : id.toUpperCase().startsWith("TXN-")
    ? id.toUpperCase()
    : toTransactionReference(id);

  const currentStatus = useMemo(
    () => normalizeOrderStatus(transaction?.status),
    [transaction?.status]
  );

  const availableNextStatuses = useMemo(
    () => getAllowedNextOrderStatuses(currentStatus),
    [currentStatus]
  );

  const statusOptions = useMemo(
    () => {
      if (!availableNextStatuses.length) {
        return [
          {
            label: getOrderStatusLabel(currentStatus),
            value: currentStatus,
          },
        ];
      }

      return availableNextStatuses.map((status) => {
        const existingOption = ORDER_STATUS_OPTIONS.find(
          (option) => option.value === status
        );

        return (
          existingOption || {
            label: getOrderStatusLabel(status),
            value: status,
          }
        );
      });
    },
    [availableNextStatuses, currentStatus]
  );

  const selectedStatus = useMemo(
    () =>
      normalizeOrderStatus(
        newStatus || availableNextStatuses[0] || transaction?.status
      ),
    [newStatus, availableNextStatuses, transaction?.status]
  );

  const canUpdateStatus =
    availableNextStatuses.length > 0 &&
    availableNextStatuses.includes(selectedStatus);

  const handleBack = () => {
    router.push("/dashboard/transactions");
  };

  const executeStatusUpdate = async (params: {
    id: string;
    status: OrderLifecycleStatus;
    forceConfirmedRejection?: boolean;
  }) => {
    try {
      await updateTransactionStatus({
        id: params.id,
        status: params.status,
        ...(params.forceConfirmedRejection
          ? {
              forceConfirmedRejection: true,
              confirmationToken: "CONFIRMED_ORDER_REJECTION",
            }
          : {}),
      }).unwrap();

      showToast("Transaction status updated successfully", "success");
      setNewStatus("");
      refetch();
    } catch (updateError: any) {
      showToast(
        getApiErrorMessage(updateError, "Failed to update transaction status"),
        "error"
      );
    }
  };

  const handleUpdateStatus = async () => {
    if (!id || !selectedStatus || !canUpdateStatus) return;
    setIsStatusConfirmModalOpen(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!id || !selectedStatus || !canUpdateStatus) {
      setIsStatusConfirmModalOpen(false);
      return;
    }

    setIsStatusConfirmModalOpen(false);
    if (
      requiresConfirmedRejectionSafetyCheck({
        currentStatus,
        nextStatus: selectedStatus,
      })
    ) {
      setIsConfirmedRejectionModalOpen(true);
      return;
    }

    await executeStatusUpdate({
      id,
      status: selectedStatus,
    });
  };

  const handleConfirmForcedRejection = async () => {
    if (!id || !selectedStatus) {
      setIsConfirmedRejectionModalOpen(false);
      return;
    }

    setIsConfirmedRejectionModalOpen(false);
    await executeStatusUpdate({
      id,
      status: selectedStatus,
      forceConfirmedRejection: true,
    });
  };

  const handleCancelForcedRejection = () => {
    setIsConfirmedRejectionModalOpen(false);
  };

  const handleCancelStatusUpdate = () => {
    setIsStatusConfirmModalOpen(false);
  };

  const handleDownloadInvoice = useCallback(async () => {
    if (!order?.id) return;

    setIsDownloadingInvoice(true);
    try {
      await downloadInvoiceByOrderId(order.id);
      showToast("Invoice downloaded successfully", "success");
    } catch (downloadError: unknown) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download invoice";
      showToast(message, "error");
    } finally {
      setIsDownloadingInvoice(false);
    }
  }, [order?.id, showToast]);

  if (isAuthLoading) {
    return <CustomLoader />;
  }

  if (!isAdmin) {
    return (
      <ErrorState
        message="You are not authorized to view transaction details."
        onBack={handleBack}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-32 bg-gray-200 rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <ErrorState
        message={
          (error as any)?.data?.message ||
          "The requested transaction could not be found."
        }
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        onBack={handleBack}
        onUpdateStatus={handleUpdateStatus}
        onDownloadInvoice={handleDownloadInvoice}
        isDownloadingInvoice={isDownloadingInvoice}
        isUpdating={isUpdating}
        canUpdateStatus={canUpdateStatus}
        newStatus={selectedStatus}
        setNewStatus={setNewStatus}
        statusOptions={statusOptions}
      />

      <TransactionOverview transaction={transaction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OrderInformation order={order} className="lg:col-span-2" />
        <CustomerInformation user={order?.user} customerType={order?.customerType} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentInformation payment={order?.payment} />
        <ShipmentInformation shipment={order?.shipment} />
      </div>

      <ShippingAddress address={order?.address} />

      <TransactionTimeline transaction={transaction} payment={order?.payment} />

      <ConfirmModal
        isOpen={isStatusConfirmModalOpen}
        title="Confirm Status Update"
        type="warning"
        message={`Are you sure you want to update ${transactionReferenceForDisplay} from ${getOrderStatusLabel(
          currentStatus
        )} to ${getOrderStatusLabel(
          selectedStatus
        )}?`}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={handleCancelStatusUpdate}
      />

      <ConfirmModal
        isOpen={isConfirmedRejectionModalOpen}
        title="Reject Confirmed Order?"
        type="danger"
        message="This order has already been confirmed. Rejecting now will restore stock and override the prior confirmation. Continue only if this is intentional."
        onConfirm={handleConfirmForcedRejection}
        onCancel={handleCancelForcedRejection}
      />
    </div>
  );
};

export default withAuth(TransactionDetailsPage);
