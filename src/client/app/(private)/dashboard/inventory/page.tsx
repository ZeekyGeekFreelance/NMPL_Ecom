"use client";
import { useState } from "react";
import {
  useGetAllVariantsQuery,
  useRestockVariantMutation,
} from "@/app/store/apis/VariantApi";
import Table from "@/app/components/layout/Table";
import { History, Plus } from "lucide-react";
import useToast from "@/app/hooks/ui/useToast";
import RestockModal from "./RestockModal";
import RestockHistoryModal from "./RestockHistoryModal";
import { withAuth } from "@/app/components/HOC/WithAuth";

const isDevelopment = process.env.NODE_ENV !== "production";
const debugLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

interface Variant {
  id: string;
  productId: string;
  sku: string;
  price: number;
  stock: number;
  lowStockThreshold?: number;
  barcode?: string;
  attributes: Array<{
    attributeId: string;
    valueId: string;
    attribute: { id: string; name: string; slug: string };
    value: { id: string; value: string; slug: string };
  }>;
  product: { id: string; name: string };
}

const InventoryDashboard = () => {
  const { showToast } = useToast();
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const { data, isLoading, refetch } = useGetAllVariantsQuery({});
  debugLog("data: ", data);
  const [restockVariant, { isLoading: isRestocking }] =
    useRestockVariantMutation();
  const variants = data?.variants || [];
  debugLog("variants: ", variants);

  const handleRestock = async (
    variantId: string,
    data: { quantity: number; notes?: string }
  ) => {
    try {
      await restockVariant({ id: variantId, data }).unwrap();
      setIsRestockModalOpen(false);
      setSelectedVariant(null);
      showToast("Variant restocked successfully", "success");
    } catch (err) {
      console.error("Failed to restock variant:", err);
      showToast("Failed to restock variant", "error");
    }
  };

  const columns = [
    {
      key: "product.name",
      label: "Product",
      sortable: true,
      render: (row: Variant) => <span>{row.product.name}</span>,
    },
    {
      key: "sku",
      label: "SKU",
      sortable: true,
      render: (row: Variant) => <span>{row.sku}</span>,
    },
    {
      key: "attributes",
      label: "Attributes",
      sortable: false,
      render: (row: Variant) => (
        <div className="flex flex-wrap gap-2">
          {row.attributes.map((attr) => (
            <span
              key={attr.attributeId}
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
            >
              {attr.attribute.name}: {attr.value.value}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      sortable: true,
      render: (row: Variant) => (
        <span
          className={
            row.stock <= (row.lowStockThreshold || 10)
              ? "text-red-600 font-medium"
              : ""
          }
        >
          {row.stock}
        </span>
      ),
    },
    {
      key: "lowStockThreshold",
      label: "Low Stock Threshold",
      sortable: true,
      render: (row: Variant) => <span>{row.lowStockThreshold || 10}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (row: Variant) => (
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
            row.stock <= (row.lowStockThreshold || 10)
              ? "bg-red-100 text-red-600"
              : "bg-green-100 text-green-600"
          }`}
        >
          {row.stock <= (row.lowStockThreshold || 10)
            ? "Low Stock"
            : "In Stock"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: Variant) => (
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedVariant(row);
              setIsRestockModalOpen(true);
            }}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            disabled={isRestocking}
          >
            <Plus size={16} />
            + Restock
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedVariant(row);
              setIsHistoryModalOpen(true);
            }}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
          >
            <History size={16} />
            History
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inventory Dashboard</h1>
          <p className="text-sm text-gray-500">
            Manage variant stock and restock history
          </p>
        </div>
      </div>

      <Table
        data={variants}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No variants available"
        totalPages={data?.totalPages}
        totalResults={data?.totalResults}
        resultsPerPage={data?.resultsPerPage}
        currentPage={data?.currentPage}
        onRefresh={refetch}
      />

      <RestockModal
        isOpen={isRestockModalOpen}
        onClose={() => {
          setIsRestockModalOpen(false);
          setSelectedVariant(null);
        }}
        onSubmit={handleRestock}
        variant={selectedVariant}
        isLoading={isRestocking}
      />

      <RestockHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedVariant(null);
        }}
        variantId={selectedVariant?.id}
      />
    </div>
  );
};

export default withAuth(InventoryDashboard);



