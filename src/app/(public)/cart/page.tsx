"use client";
import { MainLayout } from "@/app/components/layout/MainLayout";
import { useGetCartQuery, useUpdateCartItemMutation, useRemoveCartItemMutation } from "@/app/store/endpoints/cart";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Loader2 } from "lucide-react";

export default function CartPage() {
  const { data, isLoading } = useGetCartQuery();
  const [updateItem] = useUpdateCartItemMutation();
  const [removeItem] = useRemoveCartItemMutation();

  const cart = data?.data;
  const items = cart?.cartItems ?? [];
  const total = items.reduce((sum: number, item: any) => sum + item.variant.price * item.quantity, 0);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={40} /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🛒</div>
            <p className="text-gray-500 mb-6">Your cart is empty</p>
            <Link href="/shop" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item: any) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden relative shrink-0">
                    {item.variant.images?.[0] ? (
                      <Image src={item.variant.images[0]} alt={item.variant.product.name} fill className="object-cover" sizes="96px" />
                    ) : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{item.variant.product.name}</h3>
                    <p className="text-sm text-gray-500 mb-2">SKU: {item.variant.sku}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={() => updateItem({ id: item.id, quantity: item.quantity - 1 })} className="px-3 py-1.5 hover:bg-gray-100 text-sm">−</button>
                        <span className="px-3 py-1.5 text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateItem({ id: item.id, quantity: item.quantity + 1 })} className="px-3 py-1.5 hover:bg-gray-100 text-sm">+</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">₹{(item.variant.price * item.quantity).toLocaleString("en-IN")}</span>
                        <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Order Summary</h2>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Subtotal ({items.length} items)</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mb-4">
                <span>Delivery</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="border-t pt-4 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <Link href="/orders" className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors block text-center">
                Proceed to Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
