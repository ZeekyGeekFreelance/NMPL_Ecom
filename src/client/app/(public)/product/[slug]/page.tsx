"use client";
import { useEffect, useState } from "react";
import MainLayout from "@/app/components/templates/MainLayout";
import BreadCrumb from "@/app/components/feedback/BreadCrumb";
import { useParams } from "next/navigation";
import ProductImageGallery from "../ProductImageGallery";
import ProductInfo from "../ProductInfo";
import { useQuery } from "@apollo/client";
import { generateProductPlaceholder } from "@/app/utils/placeholderImage";
import { GET_SINGLE_PRODUCT } from "@/app/gql/Product";
import ProductDetailSkeletonLoader from "@/app/components/feedback/ProductDetailSkeletonLoader";
import { Product } from "@/app/types/productTypes";
import { useDealerCatalogPollInterval } from "@/app/hooks/network/useDealerCatalogPollInterval";

const getDefaultVariant = (variants: Product["variants"]) =>
  variants[0] || null;

const isBrandAttribute = (name: string) => name.trim().toLowerCase() === "brand";

const buildVariantSelectionMap = (variant: Product["variants"][0] | null) => {
  if (!variant) {
    return {};
  }

  return variant.attributes.reduce<Record<string, string>>((acc, attr) => {
    if (isBrandAttribute(attr.attribute.name)) {
      return acc;
    }

    acc[attr.attribute.name] = attr.value.value;
    return acc;
  }, {});
};

const ProductDetailsPage = () => {
  const { slug } = useParams();
  const resolvedSlug =
    typeof slug === "string" ? slug : (slug?.[0] ?? "").trim();
  const dealerCatalogPollInterval = useDealerCatalogPollInterval();
  const { data, loading, error } = useQuery<{ product: Product }>(
    GET_SINGLE_PRODUCT,
    {
      variables: { slug: resolvedSlug },
      skip: !resolvedSlug,
      // cache-and-network: serves the cached variant immediately (no flash)
      // then updates it from the network in the background. Avoids the
      // full round-trip on every poll that "no-cache" caused.
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      pollInterval: dealerCatalogPollInterval,
      // publicCatalog: true instructs publicCatalogLink (apolloClient.ts) to
      // inject x-public-catalog: 1 so the server skips session middleware for
      // this unauthenticated catalog request — saving a Redis round-trip.
      context: { publicCatalog: true },
    }
  );

  const [selectedVariant, setSelectedVariant] = useState<
    Product["variants"][0] | null
  >(null);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const firstVariant = data?.product?.variants
      ? getDefaultVariant(data.product.variants)
      : null;
    if (!firstVariant) {
      setSelectedVariant(null);
      setSelectedAttributes({});
      return;
    }

    // Always initialize with a valid default variant and its attribute selections.
    setSelectedVariant(firstVariant);
    setSelectedAttributes(buildVariantSelectionMap(firstVariant));
  }, [data?.product?.id]);

  useEffect(() => {
    const variants = data?.product?.variants || [];
    if (!variants.length) {
      return;
    }

    const stillExists = selectedVariant
      ? variants.some((variant) => variant.id === selectedVariant.id)
      : false;
    if (stillExists) {
      return;
    }

    const fallbackVariant = getDefaultVariant(variants);
    if (!fallbackVariant) {
      return;
    }

    setSelectedVariant(fallbackVariant);
    setSelectedAttributes(buildVariantSelectionMap(fallbackVariant));
  }, [data?.product?.variants, selectedVariant]);

  if (!resolvedSlug || loading) return <ProductDetailSkeletonLoader />;

  if (error && !data?.product) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-lg text-red-500">
            Unable to load product. Please refresh and try again.
          </p>
        </div>
      </MainLayout>
    );
  }

  const product = data?.product;

  if (!product) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-lg text-gray-600">Product not found</p>
        </div>
      </MainLayout>
    );
  }

  const attributeGroups = product.variants.reduce((acc, variant) => {
    variant.attributes.forEach(({ attribute, value }) => {
      if (isBrandAttribute(attribute.name)) {
        return;
      }

      if (!acc[attribute.name]) {
        acc[attribute.name] = { values: new Set<string>() };
      }
      acc[attribute.name].values.add(value.value);
    });
    return acc;
  }, {} as Record<string, { values: Set<string> }>);

  const handleVariantChange = (attributeName: string, value: string) => {
    const baselineSelectionMap = {
      ...buildVariantSelectionMap(
        selectedVariant || getDefaultVariant(product.variants)
      ),
      ...selectedAttributes,
    };
    const nextSelections = {
      ...baselineSelectionMap,
      [attributeName]: value,
    };

    const exactMatch = product.variants.find((variant) => {
      return Object.entries(nextSelections).every(
        ([attributeKey, attributeValue]) =>
          variant.attributes.some(
            (attribute) =>
              attribute.attribute.name === attributeKey &&
              attribute.value.value === attributeValue
          )
      );
    });

    if (!exactMatch) {
      // Keep current selection intact instead of auto-switching another attribute.
      return;
    }

    setSelectedAttributes(nextSelections);
    setSelectedVariant(exactMatch);
  };

  const selectedVariantImages =
    selectedVariant?.images?.filter((image) => Boolean(image)) ||
    product.variants[0]?.images?.filter((image) => Boolean(image)) ||
    [];

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <BreadCrumb />
          </div>
        </div>

        {/* Product Details */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Product Images */}
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

            {/* Product Info */}
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

export default ProductDetailsPage;
