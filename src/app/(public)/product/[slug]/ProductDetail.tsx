"use client";
import { useState } from "react";
import Image from "next/image";
import { ShoppingCart, CheckCircle } from "lucide-react";
import { useAddToCartMutation } from "@/app/store/endpoints/cart";
import { useAppDispatch } from "@/app/store/hooks";
import { addToast } from "@/app/store/toast.slice";

export function ProductDetail({ product }: { product: any }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0] ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const dispatch = useAppDispatch();
  const [addToCart, { isLoading }] = useAddToCartMutation();

  const image = selectedVariant?.images?.[0];
  const gstRate = product.gst?.rate ?? 0;
  const price = selectedVariant?.price ?? 0;
  const tax = price * qty * (gstRate / 100);
  const total = price * qty + tax;

  const handleAdd = async () => {
    if (!selectedVariant) return;
    try {
      await addToCart({ variantId: selectedVariant.id, quantity: qty }).unwrap();
      setAdded(true);
      dispatch(addToast({ type: "success", message: "Added to cart!" }));
      setTimeout(() => setAdded(false), 2000);
    } catch (err: any) {
      dispatch(addToast({ type: "error", message: err?.data?.message ?? "Please sign in to add to cart" }));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* Image */}
      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative">
        {image ? (
          <Image src={image} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl">📦</div>
        )}
      </div>

      {/* Details */}
      <div>
        <div className="text-sm text-blue-600 font-medium mb-2">{product.category?.name}</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

        {product.description && (
          <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>
        )}

        {/* Variant selector */}
        {product.variants.length > 1 && (
          <div className="mb-6">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Select Variant</label>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v: any) => {
                const label = v.attributes?.map((a: any) => a.value.value).join(", ") || v.sku;
                return (
                  <button key={v.id} onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${selectedVariant?.id === v.id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-400 text-gray-700"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Price</span><span>₹{price.toLocaleString("en-IN")} × {qty}</span>
          </div>
          {gstRate > 0 && (
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>GST ({gstRate}%)</span><span>₹{tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-lg border-t pt-2 mt-2">
            <span>Total</span><span>₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Quantity */}
        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm font-semibold text-gray-700">Qty</label>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-gray-100">−</button>
            <span className="px-4 py-2 font-medium">{qty}</span>
            <button onClick={() => setQty(Math.min(selectedVariant?.stock ?? 1, qty + 1))} className="px-3 py-2 hover:bg-gray-100">+</button>
          </div>
          {selectedVariant && (
            <span className="text-sm text-gray-500">{selectedVariant.stock} in stock</span>
          )}
        </div>

        <button onClick={handleAdd} disabled={isLoading || !selectedVariant || (selectedVariant?.stock ?? 0) === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
          {added ? <CheckCircle size={20} /> : <ShoppingCart size={20} />}
          {added ? "Added!" : isLoading ? "Adding..." : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
