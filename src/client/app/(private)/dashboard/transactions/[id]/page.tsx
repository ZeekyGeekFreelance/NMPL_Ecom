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

const STATUS_OPTIONS = [
  { label: "Order Placed", value: "PENDING" },
  { label: "Confirm Order", value: "PROCESSING" },
  { label: "Out for Delivery", value: "IN_TRANSIT" },
  { label: "Delivered", value: "DELIVERED" },
];

const normalizeTransactionStatus = (status?: string) => {
  if (!status) {
    return "PENDING";
  }
  const normalizedStatus = status === "SHIPPED" ? "IN_TRANSIT" : status;
  const supportedStatuses = new Set([
    "PENDING",
    "PROCESSING",
    "IN_TRANSIT",
    "DELIVERED",
  ]);

  return supportedStatuses.has(normalizedStatus) ? normalizedStatus : "PENDING";
};

const TransactionDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [newStatus, setNewStatus] = useState("");
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
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

  const selectedStatus = useMemo(
    () => normalizeTransactionStatus(newStatus || transaction?.status),
    [newStatus, transaction?.status]
  );

  const handleBack = () => {
    router.push("/dashboard/transactions");
  };

  const handleUpdateStatus = async () => {
    if (!id || !selectedStatus) return;

    try {
      await updateTransactionStatus({
        id,
        status: selectedStatus,
      }).unwrap();

      showToast("Transaction status updated successfully", "success");
      setNewStatus("");
      refetch();
    } catch (updateError: any) {
      showToast(
        updateError?.data?.message || "Failed to update transaction status",
        "error"
      );
    }
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
        transaction={transaction}
        onBack={handleBack}
        onUpdateStatus={handleUpdateStatus}
        onDownloadInvoice={handleDownloadInvoice}
        isDownloadingInvoice={isDownloadingInvoice}
        isUpdating={isUpdating}
        newStatus={selectedStatus}
        setNewStatus={setNewStatus}
        statusOptions={STATUS_OPTIONS}
      />

      <TransactionOverview transaction={transaction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OrderInformation order={order} className="lg:col-span-2" />
        <CustomerInformation user={order?.user} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentInformation payment={order?.payment} />
        <ShipmentInformation shipment={order?.shipment} />
      </div>

      <ShippingAddress address={order?.address} />

      <TransactionTimeline transaction={transaction} payment={order?.payment} />
    </div>
  );
};

export default withAuth(TransactionDetailsPage);
