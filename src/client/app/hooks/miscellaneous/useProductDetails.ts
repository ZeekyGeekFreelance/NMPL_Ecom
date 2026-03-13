"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGetProductByIdQuery,
} from "@/app/store/apis/ProductApi";
import { useGetAllCategoriesQuery } from "@/app/store/apis/CategoryApi";
import useToast from "@/app/hooks/ui/useToast";
import { ProductFormData } from "@/app/(private)/dashboard/products/product.types";
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

export const useProductDetail = () => {
  const { id } = useParams();
  const productId =
    typeof id === "string" ? id.trim() : (id?.[0] ?? "").trim();
  const productQueryArg = productId || skipToken;
  const router = useRouter();
  const { showToast } = useToast();

  const {
    data: product,
    isLoading: productsLoading,
    error: productsError,
  } = useGetProductByIdQuery(productQueryArg);

  const { data: categoriesData, isLoading: categoriesLoading } =
    useGetAllCategoriesQuery({});

  const categories =
    categoriesData?.categories.map((c) => ({
      label: c.name,
      value: c.id,
    })) || [];

  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Variant selection state
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedAttributes, setSelectedAttributes] = useState({});

  // Form setup with initial empty default values
  const form = useForm<ProductFormData>({
    defaultValues: {
      id: "",
      name: "",
      description: "",
      categoryId: "",
      isNew: false,
      isTrending: false,
      isBestSeller: false,
      isFeatured: false,
      variants: [],
    },
  });

  // Reset form and selected variant when product data is fetched
  useEffect(() => {
    if (product) {
      setSubmitError(null);
      form.reset({
        id: product.id || "",
        name: product.name || "",
        description: product.description || "",
        categoryId: product.categoryId || "",
        isNew: product.isNew || false,
        isTrending: product.isTrending || false,
        isBestSeller: product.isBestSeller || false,
        isFeatured: product.isFeatured || false,
        variants:
          product.variants?.map((v) => ({
            id: v.id || "",
            sku: v.sku || "",
            price: v.price || 0,
            defaultDealerPrice: v.defaultDealerPrice ?? null,
            stock: v.stock || 0,
            lowStockThreshold: v.lowStockThreshold || 10,
            barcode: v.barcode || "",
            attributes: normalizeVariantAttributes(v.attributes),
            images: v.images || [],
          })) || [],
      });
      // Set default selected variant to the first one
      setSelectedVariant(product.variants?.[0] || null);
      setSelectedAttributes({});
    }
  }, [product, form]);

  // Handle variant change based on attribute selections
  const handleVariantChange = (attributeName, value) => {
    const newSelections = { ...selectedAttributes, [attributeName]: value };
    setSelectedAttributes(newSelections);

    const variant = product?.variants.find((v) =>
      Object.entries(newSelections).every(
        ([attrName, attrValue]) =>
          attrName === "" ||
          v.attributes.some(
            (attr) =>
              attr.attribute?.name === attrName &&
              attr.value?.value === attrValue
          )
      )
    );
    setSelectedVariant(variant || product?.variants?.[0] || null);
  };

  // Reset variant selections
  const resetSelections = () => {
    setSelectedAttributes({});
    setSelectedVariant(product?.variants?.[0] || null);
  };

  // Handle update
  const onSubmit = async (data: ProductFormData) => {
    if (isUpdating) {
      return;
    }

    if (!form.formState.isDirty) {
      setSubmitError(null);
      showToast("No changes detected.", "info");
      return;
    }

    const payload = new FormData();
    payload.append("name", data.name || "");
    payload.append("description", data.description || "");
    payload.append("isNew", data.isNew.toString());
    payload.append("isTrending", data.isTrending.toString());
    payload.append("isBestSeller", data.isBestSeller.toString());
    payload.append("isFeatured", data.isFeatured.toString());
    payload.append("categoryId", data.categoryId || "");

    // Handle variants
    let imageIndex = 0;
    data.variants.forEach((variant, index) => {
      payload.append(`variants[${index}][id]`, variant.id || "");
      payload.append(`variants[${index}][sku]`, variant.sku || "");
      payload.append(`variants[${index}][price]`, variant.price.toString());
      payload.append(
        `variants[${index}][defaultDealerPrice]`,
        variant.defaultDealerPrice != null ? variant.defaultDealerPrice.toString() : ""
      );
      payload.append(`variants[${index}][stock]`, variant.stock.toString());
      payload.append(
        `variants[${index}][lowStockThreshold]`,
        variant.lowStockThreshold?.toString() || "10"
      );
      payload.append(`variants[${index}][barcode]`, variant.barcode || "");
      const normalizedAttributes = normalizeVariantAttributes(variant.attributes);
      payload.append(
        `variants[${index}][attributes]`,
        JSON.stringify(normalizedAttributes)
      );

      const orderedImages: string[] = [];
      const imageIndexes: number[] = [];

      if (variant.images && variant.images.length > 0) {
        variant.images.forEach((image) => {
          if (image instanceof File) {
            payload.append("images", image);
            orderedImages.push(`${UPLOADED_IMAGE_TOKEN_PREFIX}${imageIndex}`);
            imageIndexes.push(imageIndex);
            imageIndex += 1;
          } else if (typeof image === "string" && image.trim()) {
            orderedImages.push(image);
          }
        });
      }

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
      if (!productId) {
        setSubmitError("Product id is missing. Please reload and try again.");
        showToast("Product id is missing. Please reload and try again.", "error");
        return;
      }

      const response = await updateProduct({
        id: productId,
        data: payload,
      }).unwrap();
      const didChange = Boolean(
        (response as any)?.didChange ?? (response as any)?.data?.didChange ?? true
      );

      if (!didChange) {
        setSubmitError(null);
        showToast("No changes detected.", "info");
        return;
      }

      form.reset(data);
      setSubmitError(null);
      showToast("Product updated successfully", "success");
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to update product");
      setSubmitError(message);
      console.error("Failed to update product:", err);
      showToast(message, "error");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      if (!productId) {
        showToast("Product id is missing. Please reload and try again.", "error");
        return;
      }

      await deleteProduct(productId).unwrap();
      showToast("Product deleted successfully", "success");
      router.push("/dashboard/products");
    } catch (err) {
      console.error("Failed to delete product:", err);
      showToast("Failed to delete product", "error");
    }
  };

  // Compute attribute groups for variant selection
  const attributeGroups = product?.variants.reduce((acc, variant) => {
    const hasSelections = Object.values(selectedAttributes).some(
      (value) => value !== ""
    );
    const matchesSelections = hasSelections
      ? Object.entries(selectedAttributes).every(
          ([attrName, attrValue]) =>
            attrName === "" ||
            variant.attributes.some(
              (attr) =>
                attr.attribute?.name === attrName &&
                attr.value?.value === attrValue
            )
        )
      : true;
    if (matchesSelections) {
      variant.attributes.forEach(({ attribute, value }) => {
        if (!acc[attribute.name]) {
          acc[attribute.name] = { values: new Set<string>() };
        }
        acc[attribute.name].values.add(value.value);
      });
    }
    return acc;
  }, {} as Record<string, { values: Set<string> }>);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  return {
    product,
    categories,
    productsLoading,
    categoriesLoading,
    productsError,
    form,
    submitError,
    isUpdating,
    isDeleting,
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    onSubmit,
    handleDelete,
    router,
    selectedVariant,
    setSelectedVariant,
    selectedAttributes,
    handleVariantChange,
    resetSelections,
    attributeGroups,
  };
};
