"use client";

import { useEffect, useState } from "react";
import MainLayout from "@/app/components/templates/MainLayout";
import BreadCrumb from "@/app/components/feedback/BreadCrumb";
import ProductImageGallery from "../ProductImageGallery";
import ProductInfo from "../ProductInfo";
import { generateProductPlaceholder } from "@/app/utils/placeholderImage";
import ProductDetailSkeletonLoader from "@/app/components/feedback/ProductDetailSkeletonLoader";
import { Product } from "@/app/types/productTypes";
import { useGetProductBySlugQuery } from "@/app/store/apis/ProductApi";

const isBrandAttribute = (name: string) => name.trim().toLowerCase() === "brand";

const isVariantAvailable = (variant: Product["variants"][0] | null | undefined) =>
  typeof variant?.stock !== "number" || variant.stock > 0;

const getDefaultVariant = (variants: Product["variants"]) =>
  variants.find((variant) => isVariantAvailable(variant)) || variants[0] || null;

const getVariantAttributeValue = (
  variant: Product["variants"][0],
  attributeName: string
) =>
  variant.attributes.find(
    (attribute) =>
      !isBrandAttribute(attribute.attribute.name) &&
      attribute.attribute.name === attributeName
  )?.value.value ?? null;

const buildVariantSelectionMap = (variant: Product["variants"][0] | null) => {
  if (!variant) return {};
  return variant.attributes.reduce<Record<string, string>>((acc, attr) => {
    if (isBrandAttribute(attr.attribute.name)) return acc;
    acc[attr.attribute.name] = attr.value.value;
    return acc;
  }, {});
};

const findClosestAvailableVariant = (params: {
  variants: Product["variants"];
  attributeName: string;
  value: string;
  currentSelections: Record<string, string>;
}) => {
  const candidates = params.variants.filter(
    (variant) => getVariantAttributeValue(variant, params.attributeName) === params.value
  );
  if (!candidates.length) return null;

  const pool = candidates.filter(isVariantAvailable).length > 0
    ? candidates.filter(isVariantAvailable)
    : candidates;

  return pool
    .map((variant) => ({
      variant,
      score: Object.entries(params.currentSelections).reduce(
        (total, [attributeName, attributeValue]) =>
          attributeName === params.attributeName
            ? total
            : total + (getVariantAttributeValue(variant, attributeName) === attributeValue ? 1 : 0),
        0
      ),
    }))
    .sort((l, r) => r.score - l.score)[0]?.variant ?? null;
};

interface ProductDetailsClientProps {
  slug: string;
  initialProduct: Product | null;
}

const ProductDetailsClient = ({ slug, initialProduct }: ProductDetailsClientProps) => {
  const { data, isLoading, error } = useGetProductBySlugQuery(slug, {
    skip: !slug || Boolean(initialProduct),
  });

  const product = data?.product ?? data ?? initialProduct;

  const [selectedVariant, setSelectedVariant] = useState<Product["variants"][0] | null>(
    () => getDefaultVariant(initialProduct?.variants || [])
  );
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(
    () => buildVariantSelectionMap(getDefaultVariant(initialProduct?.variants || []))
  );

  useEffect(() => {
    const firstVariant = product?.variants ? getDefaultVariant(product.variants) : null;
    if (!firstVariant) { setSelectedVariant(null); setSelectedAttributes({}); return; }
    setSelectedVariant(firstVariant);
    setSelectedAttributes(buildVariantSelectionMap(firstVariant));
  }, [product?.id]);

  useEffect(() => {
    const variants = product?.variants || [];
    if (!variants.length) return;
    const stillExists = selectedVariant ? variants.some((v) => v.id === selectedVariant.id) : false;
    if (stillExists) return;
    const fallbackVariant = getDefaultVariant(variants);
    if (!fallbackVariant) return;
    setSelectedVariant(fallbackVariant);
    setSelectedAttributes(buildVariantSelectionMap(fallbackVariant));
  }, [product?.variants, selectedVariant]);

  if (!slug || (isLoading && !product)) return <ProductDetailSkeletonLoader />;

  if (error && !product) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-lg text-red-500">Unable to load product. Please refresh and try again.</p>
        </div>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-lg text-gray-600">Product not found</p>
        </div>
      </MainLayout>
    );
  }

  const attributeGroups = product.variants.reduce((acc: any, variant: any) => {
    variant.attributes.forEach(({ attribute, value }: any) => {
      if (isBrandAttribute(attribute.name)) return;
      if (!acc[attribute.name]) acc[attribute.name] = { values: new Set<string>() };
      acc[attribute.name].values.add(value.value);
    });
    return acc;
  }, {} as Record<string, { values: Set<string> }>);

  const handleVariantChange = (attributeName: string, value: string) => {
    const baselineSelectionMap = {
      ...buildVariantSelectionMap(selectedVariant || getDefaultVariant(product.variants)),
      ...selectedAttributes,
    };
    const nextVariant = findClosestAvailableVariant({
      variants: product.variants,
      attributeName,
      value,
      currentSelections: baselineSelectionMap,
    });
    if (!nextVariant) return;
    setSelectedVariant(nextVariant);
    setSelectedAttributes(buildVariantSelectionMap(nextVariant));
  };

  const selectedVariantImages =
    selectedVariant?.images?.filter(Boolean) || product.variants[0]?.images?.filter(Boolean) || [];

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <BreadCrumb />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <ProductImageGallery
                images={selectedVariantImages}
                defaultImage={
                  selectedVariant?.images[0] ||
                  product.variants[0]?.images[0] ||
                  generateProductPlaceholder(product.name)
                }
                name={product.name}
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <ProductInfo
                id={product.id}
                name={product.name}
                description={product.description || "No description available"}
                variants={product.variants}
                selectedVariant={selectedVariant}
                onVariantChange={handleVariantChange}
                attributeGroups={attributeGroups}
                selectedAttributes={selectedAttributes}
              />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProductDetailsClient;
