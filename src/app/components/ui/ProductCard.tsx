"use client";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { useAddToCartMutation } from "@/app/store/endpoints/cart";
import { useAppDispatch } from "@/app/store/hooks";
import { addToast } from "@/app/store/toast.slice";

export function ProductCard({ product }: { product: any }) {
  const firstVariant = product.variants?.[0];
  const price = firstVariant?.price ?? 0;
  const image = firstVariant?.images?.[0];
  const dispatch = useAppDispatch();
  const [addToCart, { isLoading }] = useAddToCartMutation();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!firstVariant) return;
    try {
      await addToCart({ variantId: firstVariant.id }).unwrap();
      dispatch(addToast({ type: "success", message: "Added to cart!" }));
    } catch (err: any) {
      const msg = err?.data?.message ?? "Please sign in to add to cart";
      dispatch(addToast({ type: "error", message: msg }));
    }
  };

  return (
    <Link href={`/product/${product.slug}`} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {image ? (
          <Image src={image} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 50vw, 25vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">📦</div>
        )}
      </div>
      <div className="p-4">
        <div className="text-xs text-gray-500 mb-1">{product.category?.name}</div>
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mb-2">{product.name}</h3>
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-900">₹{price.toLocaleString("en-IN")}</span>
          <button
            onClick={handleAddToCart}
            disabled={isLoading || !firstVariant}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </Link>
  );
}
