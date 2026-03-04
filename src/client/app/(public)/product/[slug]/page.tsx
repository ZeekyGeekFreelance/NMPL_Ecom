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
  variants.find((variant) => variant.stock > 0) || variants[0] || null;

const isBrandAttribute = (name: string) => name.trim().toLowerCase() === "brand";

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

    // Always reset to a clean state when product changes.
    setSelectedVariant(firstVariant);
    setSelectedAttributes({});
  }, [data?.product?.id]);

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
    const hasSelections = Object.values(selectedAttributes).some(
      (value) => value !== ""
    );
    const matchesSelections = hasSelections
      ? Object.entries(selectedAttributes).every(
          ([attrName, attrValue]) =>
            !attrName ||
            !attrValue ||
            variant.attributes.some(
              (attr) =>
                attr.attribute.name === attrName &&
                attr.value.value === attrValue
            )
        )
      : true;
    if (matchesSelections) {
      variant.attributes.forEach(({ attribute, value }) => {
        if (isBrandAttribute(attribute.name)) {
          return;
        }

        if (!acc[attribute.name]) {
          acc[attribute.name] = { values: new Set<string>() };
        }
        acc[attribute.name].values.add(value.value);
      });
    }
    return acc;
  }, {} as Record<string, { values: Set<string> }>);

  const resetSelections = () => {
    const firstVariant = getDefaultVariant(product.variants);
    if (!firstVariant) {
      setSelectedAttributes({});
      setSelectedVariant(null);
      return;
    }

    setSelectedAttributes({});
    setSelectedVariant(firstVariant);
  };

  const handleVariantChange = (attributeName: string, value: string) => {
    const newSelections = { ...selectedAttributes, [attributeName]: value };
    setSelectedAttributes(newSelections);
    const variant = product.variants.find((v) =>
      Object.entries(newSelections).every(
        ([attrName, attrValue]) =>
          !attrName ||
          !attrValue ||
          v.attributes.some(
            (attr) =>
            attr.attribute.name === attrName && attr.value.value === attrValue
          )
      )
    );
    setSelectedVariant(variant || getDefaultVariant(product.variants));
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
                resetSelections={resetSelections}
              />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProductDetailsPage;


