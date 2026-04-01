"use client";

import { toAddressReference } from "@/app/lib/utils/accountReference";
import { MapPin } from "lucide-react";

const ShippingAddress = ({ address }) => {
  const street = address?.line1 || address?.street || "";
  const city = address?.city || "";
  const state = address?.state || "";
  const country = address?.country || "";
  const zip = address?.pincode || address?.zip || "";
  const fullName = address?.fullName || "";
  const phoneNumber = address?.phoneNumber || "";

  if (!address) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
        <div className="flex items-center mb-4">
          <MapPin className="mr-2 text-blue-600" size={20} />
          <h2 className="text-base sm:text-lg font-semibold">Shipping Address</h2>
        </div>
        <p className="text-sm text-gray-500">Shipping address is not available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center mb-4">
        <MapPin className="mr-2 text-blue-600" size={20} />
        <h2 className="text-base sm:text-lg font-semibold">Shipping Address</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6">
        <div>
          <p className="text-sm text-gray-500">Recipient</p>
          <p>{fullName || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Phone</p>
          <p>{phoneNumber || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Address Type</p>
          <p>{address?.addressType || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Street</p>
          <p>{street || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">City</p>
          <p>{city || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">State</p>
          <p>{state || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Country</p>
          <p>{country || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">ZIP</p>
          <p>{zip || "Not provided"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Address ID</p>
          <p className="font-mono text-sm break-all">
            {toAddressReference(address.id || "")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShippingAddress;
