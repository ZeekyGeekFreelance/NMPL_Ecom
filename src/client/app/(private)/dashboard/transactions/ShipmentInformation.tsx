"use client";

import formatDate from "@/app/utils/formatDate";
import { toShipmentReference } from "@/app/lib/utils/accountReference";
import { Truck } from "lucide-react";

const ShipmentInformation = ({ shipment }) => {
  if (!shipment) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
        <div className="flex items-center mb-4">
          <Truck className="mr-2 text-blue-600" size={20} />
          <h2 className="text-lg font-semibold">Shipment Information</h2>
        </div>
        <p className="text-sm text-gray-500">Shipment details are not available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center mb-4">
        <Truck className="mr-2 text-blue-600" size={20} />
        <h2 className="text-lg font-semibold">Shipment Information</h2>
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
