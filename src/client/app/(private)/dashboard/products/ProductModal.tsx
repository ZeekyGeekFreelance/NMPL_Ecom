"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  useGetAllCategoriesQuery,
  useGetCategoryAttributesQuery,
} from "@/app/store/apis/CategoryApi";
import Modal from "@/app/components/organisms/Modal";
import { ProductFormData } from "./product.types";
import ProductForm from "./ProductForm";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
  initialData?: ProductFormData;
  isLoading?: boolean;
  error?: any;
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading,
  error,
}) => {
  const { data: categoriesData } = useGetAllCategoriesQuery({});
  const categories =
    categoriesData?.categories?.map((category) => ({
      label: category.name,
      value: category.id,
    })) || [];

  const form = useForm<ProductFormData>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      id: "",
      name: "",
      isNew: false,
      isTrending: false,
      isFeatured: false,
      isBestSeller: false,
      categoryId: "",
      description: "",
      variants: [
        {
          id: "",
          images: [],
          lowStockThreshold: 10,
          barcode: "",
          price: 0,
          defaultDealerPrice: null,
          sku: "",
          stock: 0,
          attributes: [],
        },
      ],
    },
  });

  const selectedCategoryId = form.watch("categoryId");
  const { data: categoryAttributesData } = useGetCategoryAttributesQuery(
    selectedCategoryId,
    {
      skip: !selectedCategoryId,
    }
  );
  const categoryAttributes = categoryAttributesData?.attributes || [];
  const isEditMode = Boolean(initialData?.id);
  const isFormDirty = form.formState.isDirty;

  const handleFormSubmit = (data: ProductFormData) => {
    if (isEditMode && !form.formState.isDirty) {
      return;
    }

    onSubmit(data);
  };

  useEffect(() => {
    if (initialData) {
      form.reset({
        id: initialData.id || "",
        name: initialData.name || "",
        isNew: initialData.isNew || false,
        isTrending: initialData.isTrending || false,
        isFeatured: initialData.isFeatured || false,
        isBestSeller: initialData.isBestSeller || false,
        categoryId: initialData.categoryId || "",
        description: initialData.description || "",
        variants: initialData.variants || [],
      });
    } else {
      form.reset({
        id: "",
        name: "",
        isNew: false,
        isTrending: false,
        isFeatured: false,
        isBestSeller: false,
        categoryId: "",
        description: "",
        variants: [],
      });
    }
  }, [initialData, form]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      contentClassName="max-w-6xl h-[calc(100dvh-2rem)] overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6">
          <h2 className="pr-12 text-lg font-semibold text-gray-900">
            {initialData ? "Edit Product" : "Create Product"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Configure product details, variants, pricing, and metadata.
          </p>
        </div>

        <div
          className="min-h-0 flex-1 overflow-hidden px-6 py-4"
          data-product-form-scroll="true"
        >
          <ProductForm
            form={form}
            onSubmit={handleFormSubmit}
            categories={categories}
            categoryAttributes={categoryAttributes}
            isLoading={isLoading}
            error={error}
            submitLabel={initialData ? "Update" : "Create"}
            onCancel={onClose}
            isEditMode={isEditMode}
            disableSubmit={isEditMode && !isFormDirty}
            noChangesMessage={isEditMode ? "No changes detected." : undefined}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ProductModal;

