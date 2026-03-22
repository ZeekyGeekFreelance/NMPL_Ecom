"use client";

import { useEffect, useRef, useState } from "react";
import { useApolloClient, useQuery } from "@apollo/client";
import MainLayout from "@/app/components/templates/MainLayout";
import BreadCrumb from "@/app/components/feedback/BreadCrumb";
import ProductImageGallery from "../ProductImageGallery";
import ProductInfo from "../ProductInfo";
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

interface ProductDetailsClientProps {
  slug: string;
  initialProduct: Product | null;
}

const ProductDetailsClient = ({
  slug,
  initialProduct,
}: ProductDetailsClientProps) => {
  const apolloClient = useApolloClient();
  const dealerCatalogPollInterval = useDealerCatalogPollInterval();
  const seededSlugRef = useRef<string | null>(null);

  if (initialProduct && seededSlugRef.current !== slug) {
    try {
      apolloClient.writeQuery({
        query: GET_SINGLE_PRODUCT,
        variables: { slug },
        data: {
          product: initialProduct,
        },
      });
      seededSlugRef.current = slug;
    } catch {
      // Safe to ignore. The next render will retry the seed.
    }
  }

  const { data, loading, error } = useQuery<{ product: Product }>(
    GET_SINGLE_PRODUCT,
    {
      variables: { slug },
      skip: !slug,
      fetchPolicy: "cache-first",
      nextFetchPolicy: "cache-first",
      pollInterval: dealerCatalogPollInterval,
    }
  );

  const product = data?.product ?? initialProduct;

  const [selectedVariant, setSelectedVariant] = useState<
    Product["variants"][0] | null
  >(() => getDefaultVariant(initialProduct?.variants || []));
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >(() => buildVariantSelectionMap(getDefaultVariant(initialProduct?.variants || [])));

  useEffect(() => {
    const firstVariant = product?.variants
      ? getDefaultVariant(product.variants)
      : null;
    if (!firstVariant) {
      setSelectedVariant(null);
      setSelectedAttributes({});
      return;
    }

    setSelectedVariant(firstVariant);
    setSelectedAttributes(buildVariantSelectionMap(firstVariant));
  }, [product?.id]);

  useEffect(() => {
    const variants = product?.variants || [];
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
  }, [product?.variants, selectedVariant]);

  if (!slug || (loading && !product)) return <ProductDetailSkeletonLoader />;

  if (error && !product) {
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
