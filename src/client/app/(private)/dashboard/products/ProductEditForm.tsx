"use client";
import { motion } from "framer-motion";
import { UseFormReturn } from "react-hook-form";
import ProductForm from "./ProductForm";
import { ProductFormData } from "./product.types";

interface ProductEditFormProps {
  form: UseFormReturn<ProductFormData>;
  onSubmit: (data: ProductFormData) => void;
  categories: { label: string; value: string }[];
  isUpdating: boolean;
  onCancel?: () => void;
  error?: unknown;
}

const ProductEditForm: React.FC<ProductEditFormProps> = ({
  form,
  onSubmit,
  categories,
  isUpdating,
  onCancel,
  error,
}) => {
  const isDirty = form.formState.isDirty;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100"
    >
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">Edit Product</h2>
      </div>

      <div className="p-6" data-product-form-scroll="true">
        <ProductForm
          form={form}
          onSubmit={onSubmit}
          categories={categories}
          isLoading={isUpdating}
          error={error}
          submitLabel={isUpdating ? "Saving..." : "Save Changes"}
          onCancel={onCancel || (() => form.reset())}
          isEditMode
          disableSubmit={!isDirty}
          noChangesMessage="No changes detected."
        />
      </div>
    </motion.div>
  );
};

export default ProductEditForm;
