"use client";
import { Controller, UseFormReturn } from "react-hook-form";
import { Tag } from "lucide-react";
import Dropdown from "@/app/components/molecules/Dropdown";
import { ProductFormData } from "./product.types";
import CheckBox from "@/app/components/atoms/CheckBox";
import VariantForm from "./VariantForm";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";

interface ProductFormProps {
  form: UseFormReturn<ProductFormData>;
  onSubmit: (data: ProductFormData) => void;
  categories?: { label: string; value: string }[];
  categoryAttributes?: {
    id: string;
    name: string;
    isRequired: boolean;
    values: { id: string; value: string; slug: string }[];
  }[];
  isLoading?: boolean;
  error?: any;
  submitLabel?: string;
  onCancel?: () => void;
  isEditMode?: boolean;
  disableSubmit?: boolean;
  noChangesMessage?: string;
}

const ProductForm: React.FC<ProductFormProps> = ({
  form,
  onSubmit,
  categories = [],
  categoryAttributes = [],
  isLoading,
  error,
  submitLabel = "Save",
  onCancel,
  isEditMode = false,
  disableSubmit = false,
  noChangesMessage,
}) => {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = form;
  const rootVariantGuardMessage = String(
    (errors as any)?.root?.variantGuard?.message || ""
  ).trim();
  const serverErrorMessage =
    error && !rootVariantGuardMessage
      ? getApiErrorMessage(error, "Unable to save product changes.")
      : "";
  const actionErrorMessage = rootVariantGuardMessage || serverErrorMessage;
  const showNoChangesHint = isEditMode && !isDirty;
  const submitDisabled = Boolean(isLoading || disableSubmit || showNoChangesHint);

  return (
    <form
      encType="multipart/form-data"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name
          </label>
          <div className="relative">
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <input
                  {...field}
                  value={field.value ?? ""}
                  type="text"
                  className="pl-10 pr-4 py-3 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-200"
                  placeholder="Amazing Product"
                />
              )}
            />
            <Tag className="absolute left-3 top-3.5 text-gray-400" size={18} />
          </div>
          {errors.name && (
            <p className="text-red-500 text-xs mt-1 pl-10">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <Controller
            name="categoryId"
            control={control}
            rules={{ required: "Category is required" }}
            render={({ field }) => (
              <Dropdown
                onChange={(value) => {
                  field.onChange(value);
                  setValue("variants", []); // Reset variants when category changes
                }}
                options={categories}
                value={field.value ?? ""}
                label="e.g. Clothing"
                className="py-[14px]"
              />
            )}
          />
          {errors.categoryId && (
            <p className="text-red-500 text-xs mt-1">
              {errors.categoryId.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product Flags
        </label>
        <div className="grid grid-cols-2 gap-4">
          <CheckBox
            name="isNew"
            control={control}
            label="New Product"
            defaultValue={false}
          />
          <CheckBox
            name="isBestSeller"
            control={control}
            label="Best Seller"
            defaultValue={false}
          />
          <CheckBox
            name="isFeatured"
            control={control}
            label="Featured"
            defaultValue={false}
          />
          <CheckBox
            name="isTrending"
            control={control}
            label="Trending"
            defaultValue={false}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              value={field.value ?? ""}
              className="px-4 py-3 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-200"
              placeholder="Describe your amazing product here..."
              rows={3}
            />
          )}
        />
      </div>

      <VariantForm form={form} categoryAttributes={categoryAttributes} />

      <div className="sticky bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur pt-4 pb-2">
        {actionErrorMessage ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm font-medium text-red-700">{actionErrorMessage}</p>
          </div>
        ) : null}
        {showNoChangesHint ? (
          <p className="mb-2 text-xs text-gray-500">
            {noChangesMessage || "No changes detected."}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitDisabled}
            className={`px-6 py-3 text-white rounded-lg shadow-md font-medium flex items-center justify-center min-w-24 ${
              submitDisabled
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            } transition-all duration-200`}
          >
            {isLoading ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ProductForm;
