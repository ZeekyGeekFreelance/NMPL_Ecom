"use client";
import { Controller, UseFormReturn } from "react-hook-form";
import { Tag } from "lucide-react";
import Dropdown from "@/app/components/molecules/Dropdown";
import { ProductFormData } from "./product.types";
import CheckBox from "@/app/components/atoms/CheckBox";
import VariantForm from "./VariantForm";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";

interface ProductFormProps {
  form: UseFormReturn<ProductFormData>;
  onSubmit: (data: ProductFormData) => void;
  categories?: { label: string; value: string }[];
  gsts?: { label: string; value: string; disabled?: boolean }[];
  categoryAttributes?: {
    id: string;
    name: string;
    isRequired: boolean;
    values: { id: string; value: string; slug: string }[];
  }[];
  isGstsLoading?: boolean;
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
  gsts = [],
  categoryAttributes = [],
  isGstsLoading = false,
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
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2"
                    style={{ ['--tw-ring-color' as any]: 'var(--color-primary-muted)' }}
                    placeholder="Amazing Product"
                  />
                )}
              />
              <Tag className="absolute left-3 top-3 text-gray-400" size={18} />
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
                  className="py-2.5"
                />
              )}
            />
            {errors.categoryId && (
              <p className="text-red-500 text-xs mt-1">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GST
            </label>
            <Controller
              name="gstId"
              control={control}
              rules={{ required: "GST is required" }}
              render={({ field }) => (
                <Dropdown
                  onChange={(value) => field.onChange(value || "")}
                  options={gsts}
                  value={field.value ?? ""}
                  label="Select GST"
                  className="py-2.5"
                  isLoading={isGstsLoading}
                  clearable={false}
                />
              )}
            />
            {errors.gstId && (
              <p className="text-red-500 text-xs mt-1">
                {errors.gstId.message}
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
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: 'var(--color-primary-muted)' }}
                placeholder="Describe your amazing product here..."
                rows={3}
              />
            )}
          />
        </div>

        <VariantForm form={form} categoryAttributes={categoryAttributes} />
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white pt-4 pb-2">
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
              className="rounded-md border border-gray-300 px-5 py-2.5 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitDisabled}
            className={`flex min-w-32 items-center justify-center gap-2 rounded-md px-5 py-2.5 font-medium text-white ${
              submitDisabled ? "cursor-not-allowed" : ""
            }`}
            style={{ backgroundColor: submitDisabled ? 'var(--color-primary-muted)' : 'var(--color-primary)' }}
          >
            {isLoading ? <MiniSpinner size={16} /> : null}
            <span>{submitLabel}</span>
          </button>
        </div>
      </div>
    </form>
  );
};

export default ProductForm;
