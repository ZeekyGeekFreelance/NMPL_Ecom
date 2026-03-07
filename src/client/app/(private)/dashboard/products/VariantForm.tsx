"use client";
import { Controller, useFieldArray, UseFormReturn } from "react-hook-form";
import { Trash2, Plus } from "lucide-react";
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

  const removeVariantAt = (index: number) => {
    const scrollContainer = document.querySelector<HTMLElement>(
      "[data-product-form-scroll='true']"
    );
    const scrollTop = scrollContainer?.scrollTop ?? null;
    const windowScrollY = typeof window !== "undefined" ? window.scrollY : 0;

    remove(index);
    clearErrors("root.variantGuard");

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
    "w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors";

  return (
    <div className="space-y-6 p-6 bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Product Variants
        </h2>
        <button
          type="button"
          onClick={() => {
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
          }}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus size={20} /> Add Variant
        </button>
      </div>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="border border-gray-200 rounded-lg p-4 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-base font-medium text-gray-800">
              Variant {index + 1}
            </h3>
            <button
              type="button"
              onClick={() => requestRemoveVariant(index)}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU
              </label>
              <Controller
                name={`variants.${index}.sku`}
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
              {errors.variants?.[index]?.sku && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.variants[index].sku?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retail Price
              </label>
              <Controller
                name={`variants.${index}.price`}
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
              {errors.variants?.[index]?.price && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.variants[index].price?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dealer Base Price
              </label>
              <Controller
                name={`variants.${index}.defaultDealerPrice`}
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
                      getValues(`variants.${index}.price`) ?? 0
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
              {errors.variants?.[index]?.defaultDealerPrice && (
                <p className="text-red-500 text-xs mt-1">
                  {String(errors.variants[index].defaultDealerPrice?.message || "")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock
              </label>
              <Controller
                name={`variants.${index}.stock`}
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
              {errors.variants?.[index]?.stock && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.variants[index].stock?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Low Stock Threshold
              </label>
              <Controller
                name={`variants.${index}.lowStockThreshold`}
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
              {errors.variants?.[index]?.lowStockThreshold && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.variants[index].lowStockThreshold?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barcode
              </label>
              <Controller
                name={`variants.${index}.barcode`}
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
                name={`variants.${index}.images`}
                maxFiles={5}
              />
              {errors.variants?.[index]?.images && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.variants[index].images?.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Attributes</h4>
            {categoryAttributes.map((attr, attrIndex) => (
              <div key={attr.id}>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  {attr.name}{" "}
                  {attr.isRequired && <span className="text-red-500">*</span>}
                </label>
                <Controller
                  name={`variants.${index}.attributes.${attrIndex}.valueId`}
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
                          `variants.${index}.attributes.${attrIndex}.attributeId`,
                          attr.id
                        );
                      }}
                      label={`Select ${attr.name}`}
                      className="p-2"
                    />
                  )}
                />
                {errors.variants?.[index]?.attributes?.[attrIndex]?.valueId && (
                  <p className="text-red-500 text-xs mt-1">
                    {
                      errors.variants[index].attributes?.[attrIndex]?.valueId
                        ?.message
                    }
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
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
