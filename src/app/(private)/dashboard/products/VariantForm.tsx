"use client";
import { Controller, useFieldArray, UseFormReturn } from "react-hook-form";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import Dropdown from "@/app/components/molecules/Dropdown";
import ImageUploader from "@/app/components/molecules/ImageUploader";
import { ProductFormData } from "./product.types";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";

interface VariantFormProps {
  form: UseFormReturn<ProductFormData>;
  categoryAttributes: {
    id: string;
    name: string;
    isRequired: boolean;
    values: { id: string; value: string; slug: string }[];
  }[];
}

const VariantForm: React.FC<VariantFormProps> = ({
  form,
  categoryAttributes,
}) => {
  const variantsPerPage = 6;
  const baseVariantDeleteMessage =
    "Base variant cannot be deleted. Add another variant first or delete the product instead.";
  const {
    control,
    formState: { errors },
    setValue,
    getValues,
    setError,
    clearErrors,
  } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const [currentVariantPage, setCurrentVariantPage] = useState(1);
  const [expandedVariantIndex, setExpandedVariantIndex] = useState<number>(0);

  useEffect(() => {
    if (!categoryAttributes.length || !fields.length) {
      return;
    }

    const variants = getValues("variants") || [];

    variants.forEach((variant, variantIndex) => {
      const existingAttributes = Array.isArray(variant?.attributes)
        ? variant.attributes
        : [];
      const valueByAttributeId = new Map<string, string>();

      existingAttributes.forEach((attribute) => {
        const attributeId = String(attribute?.attributeId || "").trim();
        if (!attributeId || valueByAttributeId.has(attributeId)) {
          return;
        }

        valueByAttributeId.set(
          attributeId,
          String(attribute?.valueId || "").trim()
        );
      });

      const normalizedAttributes = categoryAttributes.map((attribute) => ({
        attributeId: attribute.id,
        valueId: valueByAttributeId.get(attribute.id) || "",
      }));

      const hasSameShape =
        existingAttributes.length === normalizedAttributes.length &&
        normalizedAttributes.every((attribute, attrIndex) => {
          const current = existingAttributes[attrIndex];
          return (
            String(current?.attributeId || "") === attribute.attributeId &&
            String(current?.valueId || "") === attribute.valueId
          );
        });

      if (!hasSameShape) {
        setValue(`variants.${variantIndex}.attributes`, normalizedAttributes, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        });
      }
    });
  }, [categoryAttributes, fields.length, getValues, setValue]);

  const totalVariantPages = Math.max(1, Math.ceil(fields.length / variantsPerPage));
  const safeCurrentVariantPage = Math.min(
    Math.max(currentVariantPage, 1),
    totalVariantPages
  );
  const pageStartIndex = (safeCurrentVariantPage - 1) * variantsPerPage;
  const pageEndIndex = pageStartIndex + variantsPerPage;
  const visibleVariantFields = fields.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (fields.length === 0) {
      setCurrentVariantPage(1);
      setExpandedVariantIndex(0);
      return;
    }

    setCurrentVariantPage((previousPage) => {
      const maxPage = Math.max(1, Math.ceil(fields.length / variantsPerPage));
      return Math.min(Math.max(previousPage, 1), maxPage);
    });

    setExpandedVariantIndex((previousIndex) =>
      Math.min(Math.max(previousIndex, 0), fields.length - 1)
    );
  }, [fields.length]);

  useEffect(() => {
    if (!fields.length) {
      return;
    }

    const pageMinIndex = (safeCurrentVariantPage - 1) * variantsPerPage;
    const pageMaxIndex = Math.min(
      fields.length - 1,
      pageMinIndex + variantsPerPage - 1
    );

    setExpandedVariantIndex((previousIndex) => {
      if (previousIndex < pageMinIndex || previousIndex > pageMaxIndex) {
        return pageMinIndex;
      }
      return previousIndex;
    });
  }, [fields.length, safeCurrentVariantPage]);

  const removeVariantAt = (index: number) => {
    const nextVariantCount = Math.max(0, fields.length - 1);
    const nextTotalPages = Math.max(1, Math.ceil(nextVariantCount / variantsPerPage));
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-product-form-scroll='true']"
    );
    const scrollTop = scrollContainer?.scrollTop ?? null;
    const windowScrollY = typeof window !== "undefined" ? window.scrollY : 0;

    remove(index);
    clearErrors("root.variantGuard");
    setCurrentVariantPage((previousPage) =>
      Math.min(Math.max(previousPage, 1), nextTotalPages)
    );
    setExpandedVariantIndex((previousIndex) => {
      if (nextVariantCount === 0) {
        return 0;
      }
      if (previousIndex === index) {
        return Math.max(0, index - 1);
      }
      if (previousIndex > index) {
        return previousIndex - 1;
      }
      return previousIndex;
    });

    requestAnimationFrame(() => {
      if (scrollContainer && scrollTop !== null) {
        scrollContainer.scrollTop = Math.min(scrollTop, scrollContainer.scrollHeight);
        return;
      }

      if (typeof window !== "undefined") {
        window.scrollTo({ top: windowScrollY });
      }
    });
  };

  const requestRemoveVariant = (index: number) => {
    if (fields.length <= 1) {
      setError("root.variantGuard", {
        type: "manual",
        message: baseVariantDeleteMessage,
      });
      return;
    }

    const variant = getValues(`variants.${index}`);
    const hasPersistedId = Boolean(String(variant?.id || "").trim());

    // Unsaved variants are local form state only, so remove them directly.
    if (!hasPersistedId) {
      removeVariantAt(index);
      return;
    }

    clearErrors("root.variantGuard");
    setPendingRemoveIndex(index);
  };

  const inputStyles =
    "w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 transition-colors";

  return (
    <div className="space-y-6 p-6 bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Product Variants
        </h2>
        <button
          type="button"
          onClick={() => {
            const nextVariantIndex = fields.length;
            const nextVariantPage =
              Math.floor(nextVariantIndex / variantsPerPage) + 1;
            clearErrors("root.variantGuard");
            append({
              id: "",
              sku: "",
              price: 0,
              defaultDealerPrice: null,
              stock: 0,
              lowStockThreshold: 10,
              barcode: "",
              images: [],
              attributes: categoryAttributes.map((attr) => ({
                attributeId: attr.id,
                valueId: "",
              })),
            });
            setCurrentVariantPage(nextVariantPage);
            setExpandedVariantIndex(nextVariantIndex);
          }}
          className="flex items-center gap-2 font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          <Plus size={20} /> Add Variant
        </button>
      </div>

      {visibleVariantFields.map((field, localIndex) => {
        const variantIndex = pageStartIndex + localIndex;
        const variantSku = String(
          getValues(`variants.${variantIndex}.sku`) || ""
        ).trim();
        const isExpanded = expandedVariantIndex === variantIndex;

        return (
          <div
            key={field.id}
            className="rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setExpandedVariantIndex((previousIndex) =>
                    previousIndex === variantIndex ? -1 : variantIndex
                  )
                }
                className="flex flex-1 items-center justify-between rounded-md px-1 py-1 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="text-base font-medium text-gray-800">
                    Variant {variantIndex + 1}
                  </p>
                  <p className="text-xs text-gray-500">
                    {variantSku ? `SKU: ${variantSku}` : "Click to configure details"}
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-gray-500 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => requestRemoveVariant(variantIndex)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 size={20} />
              </button>
            </div>

            {isExpanded ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      SKU
                    </label>
                    <Controller
                      name={`variants.${variantIndex}.sku`}
                      control={control}
                      rules={{
                        required: "SKU is required",
                        pattern: {
                          value: /^[a-zA-Z0-9-]+$/,
                          message: "SKU must be alphanumeric with dashes",
                        },
                      }}
                      render={({ field }) => (
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="text"
                          className={inputStyles}
                          placeholder="TSH-RED-S"
                        />
                      )}
                    />
                    {errors.variants?.[variantIndex]?.sku && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.variants[variantIndex].sku?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Retail Price
                    </label>
                    <Controller
                      name={`variants.${variantIndex}.price`}
                      control={control}
                      rules={{
                        required: "Price is required",
                        min: { value: 0.01, message: "Price must be positive" },
                      }}
                      render={({ field }) => (
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="number"
                          step="0.01"
                          className={inputStyles}
                          placeholder="19.99"
                        />
                      )}
                    />
                    {errors.variants?.[variantIndex]?.price && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.variants[variantIndex].price?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Dealer Base Price
                    </label>
                    <Controller
                      name={`variants.${variantIndex}.defaultDealerPrice`}
                      control={control}
                      rules={{
                        validate: (value) => {
                          if (value === null || value === undefined) {
                            return true;
                          }

                          const dealerPrice = Number(value);
                          if (Number.isNaN(dealerPrice)) {
                            return "Dealer base price must be numeric";
                          }

                          if (dealerPrice < 0) {
                            return "Dealer base price cannot be negative";
                          }

                          const retailPrice = Number(
                            getValues(`variants.${variantIndex}.price`) ?? 0
                          );

                          if (
                            Number.isFinite(retailPrice) &&
                            retailPrice > 0 &&
                            dealerPrice > retailPrice
                          ) {
                            return "Dealer base price cannot exceed retail price";
                          }

                          return true;
                        },
                      }}
                      render={({ field }) => (
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="number"
                          step="0.01"
                          min="0"
                          onChange={(event) => {
                            const rawValue = event.target.value;
                            if (rawValue === "") {
                              field.onChange(null);
                              return;
                            }

                            field.onChange(Number(rawValue));
                          }}
                          className={inputStyles}
                          placeholder="Optional dealer baseline"
                        />
                      )}
                    />
                    {errors.variants?.[variantIndex]?.defaultDealerPrice && (
                      <p className="mt-1 text-xs text-red-500">
                        {String(
                          errors.variants[variantIndex].defaultDealerPrice?.message || ""
                        )}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Stock
                    </label>
                    <Controller
                      name={`variants.${variantIndex}.stock`}
                      control={control}
                      rules={{
                        required: "Stock is required",
                        min: { value: 0, message: "Stock cannot be negative" },
                      }}
                      render={({ field }) => (
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="number"
                          className={inputStyles}
                          placeholder="50"
                        />
                      )}
                    />
                    {errors.variants?.[variantIndex]?.stock && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.variants[variantIndex].stock?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Low Stock Threshold
                    </label>
                    <Controller
                      name={`variants.${variantIndex}.lowStockThreshold`}
                      control={control}
                      rules={{ min: { value: 0, message: "Cannot be negative" } }}
                      render={({ field }) => (
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="number"
                          className={inputStyles}
                          placeholder="10"
                        />
                      )}
                    />
                    {errors.variants?.[variantIndex]?.lowStockThreshold && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.variants[variantIndex].lowStockThreshold?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Barcode
                    </label>
                    <Controller
                      name={`variants.${variantIndex}.barcode`}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="text"
                          className={inputStyles}
                          placeholder="123456789012"
                        />
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <ImageUploader
                      control={control}
                      errors={errors}
                      setValue={setValue}
                      label="Variant Images"
                      name={`variants.${variantIndex}.images`}
                      maxFiles={5}
                    />
                    {errors.variants?.[variantIndex]?.images && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.variants[variantIndex].images?.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Attributes</h4>
                  {categoryAttributes.map((attr, attrIndex) => (
                    <div key={attr.id}>
                      <label className="mb-1 block text-sm font-medium text-gray-600">
                        {attr.name}{" "}
                        {attr.isRequired && <span className="text-red-500">*</span>}
                      </label>
                      <Controller
                        name={`variants.${variantIndex}.attributes.${attrIndex}.valueId`}
                        control={control}
                        rules={
                          attr.isRequired
                            ? { required: `${attr.name} is required` }
                            : undefined
                        }
                        render={({ field }) => (
                          <Dropdown
                            options={attr.values.map((v) => ({
                              label: v.value,
                              value: v.id,
                            }))}
                            value={field.value ?? ""}
                            onChange={(value) => {
                              field.onChange(value);
                              form.setValue(
                                `variants.${variantIndex}.attributes.${attrIndex}.attributeId`,
                                attr.id
                              );
                            }}
                            label={`Select ${attr.name}`}
                            className="p-2"
                          />
                        )}
                      />
                      {errors.variants?.[variantIndex]?.attributes?.[attrIndex]?.valueId && (
                        <p className="mt-1 text-xs text-red-500">
                          {
                            errors.variants[variantIndex].attributes?.[attrIndex]?.valueId
                              ?.message
                          }
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {fields.length > 0 ? (
        <div className="mt-1 border-t border-gray-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Showing page {safeCurrentVariantPage} of {totalVariantPages} (
              {fields.length} variants)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCurrentVariantPage((previousPage) =>
                    Math.max(1, previousPage - 1)
                  )
                }
                disabled={safeCurrentVariantPage <= 1}
                className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ border: '1px solid var(--color-border)' }}
              >
                Previous
              </button>
              <span className="rounded px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
                {safeCurrentVariantPage} / {totalVariantPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentVariantPage((previousPage) =>
                    Math.min(totalVariantPages, previousPage + 1)
                  )
                }
                disabled={safeCurrentVariantPage >= totalVariantPages}
                className="rounded px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-secondary)' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {errors.variants && !Array.isArray(errors.variants) && (
        <p className="text-red-500 text-xs mt-2">
          At least one variant is required
        </p>
      )}

      <ConfirmModal
        isOpen={pendingRemoveIndex !== null}
        title="Remove Variant?"
        message="You are about to remove this variant from the product form. Saving the product after this will permanently remove it from the database. This action cannot be undone."
        type="danger"
        confirmLabel="Remove Variant"
        cancelLabel="Keep Variant"
        onConfirm={() => {
          if (pendingRemoveIndex !== null) {
            removeVariantAt(pendingRemoveIndex);
          }
          setPendingRemoveIndex(null);
        }}
        onCancel={() => setPendingRemoveIndex(null)}
      />
    </div>
  );
};

export default VariantForm;
