"use client";

import formatDate from "@/app/utils/formatDate";
import { toShipmentReference } from "@/app/lib/utils/accountReference";
import { Truck } from "lucide-react";
import { normalizeOrderStatus } from "@/app/lib/orderLifecycle";

const ShipmentInformation = ({ shipment, order }) => {
  const normalizedStatus = normalizeOrderStatus(order?.status);
  const deliveryMode = order?.deliveryMode || order?.address?.deliveryMode;
  const isPickupOrder = deliveryMode === "PICKUP";

  if (!shipment) {
    const pendingDispatchStatuses = new Set([
      "PENDING_VERIFICATION",
      "WAITLISTED",
      "AWAITING_PAYMENT",
      "CONFIRMED",
    ]);
    const dispatchMessage = isPickupOrder
      ? "This order is marked as in-store pickup. Shipment record is not required."
      : pendingDispatchStatuses.has(normalizedStatus)
      ? "Shipment record will appear after dispatch. Current lifecycle stage has not reached shipment creation yet."
      : "Shipment details are not available yet.";

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
        <div className="flex items-center mb-4">
          <Truck className="mr-2 text-blue-600" size={20} />
          <h2 className="text-base sm:text-lg font-semibold">Shipment Information</h2>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-700">{dispatchMessage}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Order Status</p>
              <p className="font-medium text-gray-800">{normalizedStatus}</p>
            </div>
            <div>
              <p className="text-gray-500">Delivery Mode</p>
              <p className="font-medium text-gray-800">
                {deliveryMode || "Not specified"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center mb-4">
        <Truck className="mr-2 text-blue-600" size={20} />
        <h2 className="text-base sm:text-lg font-semibold">Shipment Information</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
        <div>
          <p className="text-sm text-gray-500">Shipment ID</p>
          <p className="font-mono text-sm break-all">
            {toShipmentReference(shipment.id || "")}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Carrier</p>
          <p>{shipment.carrier}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Tracking Number</p>
          <p className="font-mono">{shipment.trackingNumber}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Shipped Date</p>
          <p>{formatDate(shipment.shippedDate)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Expected Delivery</p>
          <p>{shipment.deliveryDate ? formatDate(shipment.deliveryDate) : "TBD"}</p>
        </div>
      </div>
    </div>
  );
};

export default ShipmentInformation;
