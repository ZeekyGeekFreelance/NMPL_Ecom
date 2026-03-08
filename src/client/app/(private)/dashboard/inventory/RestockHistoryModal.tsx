"use client";
import { useEffect, useState } from "react";
import { useGetRestockHistoryQuery } from "@/app/store/apis/VariantApi";
import Table from "@/app/components/layout/Table";
import Modal from "@/app/components/organisms/Modal";
import formatDate from "@/app/utils/formatDate";

interface RestockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  variantId?: string;
}

const RestockHistoryModal: React.FC<RestockHistoryModalProps> = ({
  isOpen,
  onClose,
  variantId,
}) => {
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
    }
  }, [isOpen, variantId]);

  const { data, isLoading } = useGetRestockHistoryQuery(
    { variantId: variantId || "all", page, limit: 10 },
    { skip: !isOpen }
  );
  const restocks = data?.restocks || [];

  const columns = [
    {
      key: "quantity",
      label: "Quantity",
      sortable: true,
      render: (row: any) => <span>{row.quantity}</span>,
    },
    {
      key: "notes",
      label: "Notes",
      sortable: false,
      render: (row: any) => <span>{row.notes || "N/A"}</span>,
    },
    {
      key: "user",
      label: "Restocked By",
      sortable: false,
      render: (row: any) => <span>{row.user?.name || "Unknown"}</span>,
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (row: any) => <span>{formatDate(row.createdAt)}</span>,
    },
  ];

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      contentClassName="max-w-6xl overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6">
          <h2 className="pr-12 text-lg font-semibold text-gray-900">
            {variantId ? "Variant Restock History" : "All Restock History"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <Table
            data={restocks}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No restock history available"
            totalPages={data?.totalPages}
            totalResults={data?.totalResults}
            resultsPerPage={data?.resultsPerPage}
            currentPage={data?.currentPage}
            onPageChange={setPage}
          />
        </div>
      </div>
    </Modal>
  );
};

export default RestockHistoryModal;
