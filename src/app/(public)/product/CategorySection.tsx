"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Package } from "lucide-react";
import ProductCard from "./ProductCard";
import SkeletonLoader from "@/app/components/feedback/SkeletonLoader";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";
import { useGetAllProductsQuery } from "@/app/store/apis/ProductApi";

interface CategorySectionProps {
  categoryId: string;
  categoryName: string;
  pageSize: number;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  categoryId,
  categoryName,
  pageSize,
}) => {
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const { data, isLoading, error } = useGetAllProductsQuery(
    { category: categoryId, limit: String(pageSize), page: String(page) },
  );

  const products = data?.products || [];
  const hasMore = data?.hasMore || false;

  React.useEffect(() => {
    if (products.length > 0) {
      if (page === 1) {
        setAllProducts(products);
      } else {
        setAllProducts((prev) => [...prev, ...products]);
      }
    }
  }, [data, page]);

  const displayProducts = page === 1 && allProducts.length === 0 ? products : allProducts;

  if (isLoading && page === 1) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-red-500">Error loading {categoryName}</p>
      </div>
    );
  }

  if (!displayProducts.length) {
    return (
      <div className="text-center py-12">
        <Package size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-lg text-gray-600">No products found in {categoryName}</p>
      </div>
    );
  }

  return (
    <div className="w-full p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center space-x-3">
          <div className="h-6 w-1 rounded-full bg-primary"></div>
          <h2 className="ml-2 text-xl font-extrabold font-sans tracking-wide text-gray-700 capitalize">
            {categoryName}
          </h2>
        </div>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayProducts.map((product: any) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </div>
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="bg-primary text-white px-8 py-3 rounded transition-colors duration-300 font-medium"
            disabled={isLoading}
          >
            {isLoading ? <MiniSpinner size={16} /> : "Show More"}
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(CategorySection);
