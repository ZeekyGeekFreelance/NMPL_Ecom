"use client";
import Table from "@/app/components/layout/Table";
import {
  useCreateProductMutation,
  useDeleteProductMutation,
  useGetAllProductsQuery,
  useLazyGetProductByIdQuery,
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
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";

const UPLOADED_IMAGE_TOKEN_PREFIX = "__UPLOADED_FILE_INDEX__";

const normalizeVariantAttributes = (
  attributes: any[] | undefined
): { attributeId: string; valueId: string }[] =>
  (Array.isArray(attributes) ? attributes : [])
    .map((attribute) => ({
      attributeId: String(
        attribute?.attributeId || attribute?.attribute?.id || ""
      ).trim(),
      valueId: String(attribute?.valueId || attribute?.value?.id || "").trim(),
    }))
    .filter((attribute) => attribute.attributeId && attribute.valueId);

const mapProductToFormData = (product: any): ProductFormData => ({
  id: String(product?.id || ""),
  name: product?.name || "",
  isNew: Boolean(product?.isNew),
  isTrending: Boolean(product?.isTrending),
  isBestSeller: Boolean(product?.isBestSeller),
  isFeatured: Boolean(product?.isFeatured),
  categoryId: product?.categoryId || "",
  description: product?.description || "",
  variants: (Array.isArray(product?.variants) ? product.variants : []).map(
    (variant: any) => ({
      ...variant,
      id: String(variant?.id || ""),
      sku: variant?.sku ?? "",
      price: Number(variant?.price ?? 0),
    defaultDealerPrice:
      variant?.defaultDealerPrice === null ||
      variant?.defaultDealerPrice === undefined
        ? null
        : Number(variant.defaultDealerPrice),
    stock: Number(variant?.stock ?? 0),
    lowStockThreshold: Number(variant?.lowStockThreshold ?? 10),
    barcode: variant?.barcode ?? "",
    attributes: normalizeVariantAttributes(variant?.attributes),
      images: Array.isArray(variant?.images) ? variant.images : [],
    })
  ),
});

const extractProductPayload = (response: any): any | null => {
  if (!response || typeof response !== "object") {
    return null;
  }

  if (response.id) {
    return response;
  }

  if (response.product?.id) {
    return response.product;
  }

  if (response.data?.id) {
    return response.data;
  }

  if (response.data?.product?.id) {
    return response.data.product;
  }

  return null;
};

const ProductsDashboard = () => {
  const { showToast } = useToast();
  const [createProduct, { isLoading: isCreating, error: createError }] =
    useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating, error: updateError }] =
    useUpdateProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();
  const [fetchProductById, { isFetching: isFetchingEditProduct }] =
    useLazyGetProductByIdQuery();

  const pathname = usePathname();
  const shouldFetchProducts = pathname === "/dashboard/products";
  const { page, setPage } = usePageQuery();

  const { data, isLoading, refetch } = useGetAllProductsQuery(
    { page },
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
      payload.append(
        `variants[${index}][defaultDealerPrice]`,
        variant.defaultDealerPrice === null ||
          variant.defaultDealerPrice === undefined
          ? ""
          : String(variant.defaultDealerPrice)
      );
      payload.append(`variants[${index}][stock]`, variant.stock.toString());
      payload.append(
        `variants[${index}][lowStockThreshold]`,
        variant.lowStockThreshold?.toString() || "10"
      );
      payload.append(`variants[${index}][barcode]`, variant.barcode || "");
      const normalizedAttributes = normalizeVariantAttributes(variant.attributes);
      // Append attributes as JSON
      payload.append(
        `variants[${index}][attributes]`,
        JSON.stringify(normalizedAttributes)
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
    if (!editingProduct || isUpdating) return;

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
      payload.append(
        `variants[${index}][defaultDealerPrice]`,
        variant.defaultDealerPrice === null ||
          variant.defaultDealerPrice === undefined
          ? ""
          : String(variant.defaultDealerPrice)
      );
      payload.append(`variants[${index}][stock]`, String(variant.stock ?? 0));
      payload.append(
        `variants[${index}][lowStockThreshold]`,
        String(variant.lowStockThreshold ?? 10)
      );
      payload.append(`variants[${index}][barcode]`, variant.barcode || "");
      const normalizedAttributes = normalizeVariantAttributes(variant.attributes);
      payload.append(
        `variants[${index}][attributes]`,
        JSON.stringify(normalizedAttributes)
      );

      const orderedImages: string[] = [];
      const imageIndexes: number[] = [];

      (variant.images || []).forEach((image) => {
        if (image instanceof File) {
          payload.append("images", image);
          orderedImages.push(`${UPLOADED_IMAGE_TOKEN_PREFIX}${imageIndex}`);
          imageIndexes.push(imageIndex);
          imageIndex += 1;
        } else if (typeof image === "string" && image.trim()) {
          orderedImages.push(image);
        }
      });

      payload.append(
        `variants[${index}][images]`,
        JSON.stringify(orderedImages)
      );
      payload.append(
        `variants[${index}][imageIndexes]`,
        JSON.stringify(imageIndexes)
      );
    });

    try {
      const response = await updateProduct({
        id: editingProduct.id!,
        data: payload,
      }).unwrap();
      const didChange = Boolean(
        (response as any)?.didChange ?? (response as any)?.data?.didChange ?? true
      );

      if (!didChange) {
        showToast("No changes detected.", "info");
        return;
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      showToast("Product updated successfully", "success");
    } catch (err: unknown) {
      console.error("Failed to update product:", err);
      showToast(getApiErrorMessage(err, "Failed to update product"), "error");
    }
  };

  const handleDeleteProduct = (id: string) => {
    setProductToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleOpenEditProduct = async (row: any) => {
    try {
      const response = await fetchProductById(String(row.id)).unwrap();
      const fullProduct = extractProductPayload(response);

      if (!fullProduct) {
        throw new Error("Invalid product payload received for edit mode.");
      }

      setEditingProduct(mapProductToFormData(fullProduct));
      setIsModalOpen(true);
    } catch (error) {
      console.error("Failed to fetch product details for edit:", error);
      const fallbackProduct = mapProductToFormData(row);

      if (fallbackProduct.variants.length > 0) {
        setEditingProduct(fallbackProduct);
        setIsModalOpen(true);
        showToast(
          "Loaded cached product data. Some latest variant details may be missing.",
          "info"
        );
        return;
      }

      showToast(
        getApiErrorMessage(error, "Failed to load full product details for editing."),
        "error"
      );
    }
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
            onClick={() => void handleOpenEditProduct(row)}
            disabled={isFetchingEditProduct}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-blue-300"
          >
            <Edit size={16} />
            {isFetchingEditProduct ? "Loading..." : "Edit"}
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
          <h1 className="type-h4 text-gray-900">Product List</h1>
          <p className="type-body-sm text-gray-500">Manage and view your products</p>
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
            <h2 className="text-base sm:text-lg font-semibold">Import Products</h2>
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
        type="danger"
        isConfirming={isDeleting}
        disableCancelWhileConfirming
      />
    </div>
  );
};

export default withAuth(ProductsDashboard);
