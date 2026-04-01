import { MainLayout } from "@/app/components/layout/MainLayout";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await getSession();
  if (!session) return notFound();

  const isAdmin = session.role === "ADMIN" || session.role === "SUPERADMIN";
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...(isAdmin ? {} : { userId: session.sub }) },
    include: {
      orderItems: {
        include: {
          variant: {
            include: {
              product: { select: { name: true, slug: true } },
              attributes: { include: { attribute: { select: { name: true } }, value: { select: { value: true } } } },
            },
          },
        },
      },
      address: true,
      transaction: true,
    },
  });

  if (!order) return notFound();

  const statusColors: Record<string, string> = {
    PENDING_VERIFICATION: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-green-100 text-green-700",
    QUOTATION_REJECTED: "bg-red-100 text-red-700",
    AWAITING_PAYMENT: "bg-purple-100 text-purple-700",
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-sm text-gray-500 mt-1">{format(new Date(order.createdAt), "MMMM d, yyyy")}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${statusColors[order.status] ?? "bg-gray-100 text-gray-700"}`}>
            {order.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Items */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="font-semibold text-gray-900">Items</h2>
            {order.orderItems.map((item: any) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex justify-between">
                <div>
                  <div className="font-medium text-gray-900">{item.variant.product.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {item.variant.attributes.map((a: any) => `${a.attribute.name}: ${a.value.value}`).join(", ") || item.variant.sku}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Qty: {item.quantity} × ₹{Number(item.price).toLocaleString("en-IN")}</div>
                </div>
                <div className="font-bold text-gray-900">₹{Number(item.total).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{Number(order.subtotalAmount).toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-gray-600"><span>Delivery</span><span>₹{Number(order.deliveryCharge).toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between font-bold text-gray-900 border-t pt-2"><span>Total</span><span>₹{Number(order.amount).toLocaleString("en-IN")}</span></div>
              </div>
            </div>

            {order.address && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="font-semibold text-gray-900 mb-2">Delivery Address</h2>
                <div className="text-sm text-gray-600 space-y-0.5">
                  <div className="font-medium text-gray-800">{order.address.fullName}</div>
                  <div>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}</div>
                  <div>{order.address.city}, {order.address.state} — {order.address.pincode}</div>
                  <div>{order.address.phoneNumber}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Link href="/orders" className="text-blue-600 hover:underline text-sm">← Back to Orders</Link>
        </div>
      </div>
    </MainLayout>
  );
}
