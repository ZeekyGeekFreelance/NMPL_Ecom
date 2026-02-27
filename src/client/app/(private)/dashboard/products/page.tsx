"use client";
import Table from "@/app/components/layout/Table";
import {
  useCreateProductMutation,
  useDeleteProductMutation,
  useGetAllProductsQuery,
  useUpdateProductMutation,
} from "@/app/store/apis/ProductApi";
import { useState } from "react";
import ProductModal from "./ProductModal";
import { Trash2, Edit, Upload, X } from "lucide-react";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import useToast from "@/app/hooks/ui/useToast";
import ProductFileUpload from "./ProductFileUpload";
import { usePathname } from "next/navigation";
import { ProductFormData } from "./product.types";
import { withAuth } from "@/app/components/HOC/WithAuth";
import usePageQuery from "@/app/hooks/network/usePageQuery";

const ProductsDashboard = () => {
  const { showToast } = useToast();
  const [createProduct, { isLoading: isCreating, error: createError }] =
    useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating, error: updateError }] =
    useUpdateProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();

  const pathname = usePathname();
  const shouldFetchProducts = pathname === "/dashboard/products";
  const { page, setPage } = usePageQuery();

  const { data, isLoading, refetch } = useGetAllProductsQuery(
    { select: { variants: true }, page }, // Ensure variants are included
    { skip: !shouldFetchProducts }
  );
  const products = data?.products || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(
    null
  );
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);

  const handleCreateProduct = async (data: ProductFormData) => {
    const payload = new FormData();
    payload.append("name", data.name || "");
    payload.append("description", data.description || "");
    payload.append("isNew", data.isNew.toString());
    payload.append("isTrending", data.isTrending.toString());
    payload.append("isBestSeller", data.isBestSeller.toString());
    payload.append("isFeatured", data.isFeatured.toString());
    payload.append("categoryId", data.categoryId || "");

    // Track image indexes for each variant
    let imageIndex = 0;
    data.variants.forEach((variant, index) => {
      payload.append(`variants[${index}][sku]`, variant.sku || "");
      payload.append(`variants[${index}][price]`, variant.price.toString());
      payload.append(`variants[${index}][stock]`, variant.stock.toString());
      payload.append(
        `variants[${index}][lowStockThreshold]`,
        variant.lowStockThreshold?.toString() || "10"
      );
      payload.append(`variants[${index}][barcode]`, variant.barcode || "");
      // Append attributes as JSON
      payload.append(
        `variants[${index}][attributes]`,
        JSON.stringify(variant.attributes || [])
      );
      // Track image indexes for this variant
      if (Array.isArray(variant.images) && variant.images.length > 0) {
        const imageIndexes = variant.images
          .map((file) => {
            if (file instanceof File) {
              payload.append(`images`, file);
              return imageIndex++;
            }
            return null;
          })
          .filter((idx) => idx !== null);
        payload.append(
          `variants[${index}][imageIndexes]`,
          JSON.stringify(imageIndexes)
        );
      } else {
        payload.append(`variants[${index}][imageIndexes]`, JSON.stringify([]));
      }
    });

    try {
      await createProduct(payload).unwrap();
      setIsModalOpen(false);
      showToast("Product created successfully", "success");
    } catch (err) {
      console.error("Failed to create product:", err);
      showToast("Failed to create product", "error");
    }
  };

  const handleUpdateProduct = async (data: ProductFormData) => {
    if (!editingProduct) return;

    const payload = new FormData();
    payload.append("name", data.name || "");
    payload.append("description", data.description || "");
    payload.append("isNew", data.isNew.toString());
    payload.append("isTrending", data.isTrending.toString());
    payload.append("isBestSeller", data.isBestSeller.toString());
    payload.append("isFeatured", data.isFeatured.toString());
    payload.append("categoryId", data.categoryId || "");

    let imageIndex = 0;
    data.variants.forEach((variant, index) => {
      payload.append(`variants[${index}][id]`, variant.id || "");
      payload.append(`variants[${index}][sku]`, variant.sku || "");
      payload.append(`variants[${index}][price]`, String(variant.price ?? 0));
      payload.append(`variants[${index}][stock]`, String(variant.stock ?? 0));
      payload.append(
        `variants[${index}][lowStockThreshold]`,
        String(variant.lowStockThreshold ?? 10)
      );
      payload.append(`variants[${index}][barcode]`, variant.barcode || "");
      payload.append(
        `variants[${index}][attributes]`,
        JSON.stringify(variant.attributes || [])
      );

      const existingImages: string[] = [];
      const imageIndexes: number[] = [];

      (variant.images || []).forEach((image) => {
        if (image instanceof File) {
          payload.append("images", image);
          imageIndexes.push(imageIndex);
          imageIndex += 1;
        } else if (typeof image === "string" && image.trim()) {
          existingImages.push(image);
        }
      });

      payload.append(
        `variants[${index}][images]`,
        JSON.stringify(existingImages)
      );
      payload.append(
        `variants[${index}][imageIndexes]`,
        JSON.stringify(imageIndexes)
      );
    });

    try {
      await updateProduct({
        id: editingProduct.id!,
        data: payload,
      }).unwrap();
      setIsModalOpen(false);
      setEditingProduct(null);
      showToast("Product updated successfully", "success");
    } catch (err) {
      console.error("Failed to update product:", err);
      showToast("Failed to update product", "error");
    }
  };

  const handleDeleteProduct = (id: string) => {
    setProductToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct(productToDelete).unwrap();
      setIsConfirmModalOpen(false);
      setProductToDelete(null);
      showToast("Product deleted successfully", "success");
    } catch (err) {
      console.error("Failed to delete product:", err);
      showToast("Failed to delete product", "error");
    }
  };

  const cancelDelete = () => {
    setIsConfirmModalOpen(false);
    setProductToDelete(null);
  };

  const handleFileUploadSuccess = () => {
    void refetch();
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row: any) => (
        <div className="flex items-center space-x-2">
          <span>{row.name}</span>
        </div>
      ),
    },
    {
      key: "variants",
      label: "Variants",
      sortable: false,
      render: (row: any) => (
        <div className="flex flex-wrap gap-2">
          {row.variants?.length > 0 ? (
            row.variants.map((v: any) => (
              <span
                key={v.id}
                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
              >
                {v.sku}
              </span>
            ))
          ) : (
            <span className="text-gray-500">No variants</span>
          )}
        </div>
      ),
    },
    {
      key: "salesCount",
      label: "Sales Count",
      sortable: true,
      render: (row: any) => <span className="tabular-nums">{row.salesCount}</span>,
      align: "right" as const,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: any) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingProduct({
                id: row.id,
                name: row.name,
                isNew: row.isNew,
                isTrending: row.isTrending,
                isBestSeller: row.isBestSeller,
                isFeatured: row.isFeatured,
                categoryId: row.categoryId,
                description: row.description || "",
                variants: row.variants || [],
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          >
            <Edit size={16} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDeleteProduct(row.id)}
            className="flex items-center gap-1 text-red-600 hover:text-red-800"
            disabled={isDeleting}
          >
            <Trash2 size={16} />
            {isDeleting && productToDelete === row.id
              ? "Deleting..."
              : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Product List</h1>
          <p className="text-sm text-gray-500">Manage and view your products</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsFileUploadOpen(!isFileUploadOpen)}
            className="flex items-center rounded-md bg-[#5d8a02] px-4 py-2 text-white"
          >
            <Upload className="mr-2 h-4 w-4" />
            Excel Sheet
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Product
          </button>
        </div>
      </div>

      {isFileUploadOpen && (
        <div className="mb-6 bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium">Import Products</h2>
            <button
              onClick={() => setIsFileUploadOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
          <ProductFileUpload onUploadSuccess={handleFileUploadSuccess} />
        </div>
      )}

      <Table
        data={products}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No products available"
        onRefresh={refetch}
        totalPages={data?.totalPages}
        totalResults={data?.totalResults}
        resultsPerPage={data?.resultsPerPage}
        currentPage={data?.currentPage}
        onPageChange={setPage}
      />

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
        initialData={editingProduct || undefined}
        isLoading={editingProduct ? isUpdating : isCreating}
        error={editingProduct ? updateError : createError}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        message="Are you sure you want to delete this product? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default withAuth(ProductsDashboard);
