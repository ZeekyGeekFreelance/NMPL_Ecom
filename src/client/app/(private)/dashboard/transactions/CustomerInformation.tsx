"use client";

import { User } from "lucide-react";
import { toAccountReference } from "@/app/lib/utils/accountReference";

const CustomerInformation = ({ user }) => {
  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
        <div className="flex items-center mb-4">
          <User className="mr-2 text-blue-600" size={20} />
          <h2 className="text-lg font-semibold">Customer Information</h2>
        </div>
        <p className="text-sm text-gray-500">Customer information is not available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center mb-4">
        <User className="mr-2 text-blue-600" size={20} />
        <h2 className="text-lg font-semibold">Customer Information</h2>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-500">Customer Name</p>
          <p>{user.name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Email</p>
          <p>{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Account Reference</p>
          <p className="font-mono">
            {user.accountReference || toAccountReference(user.id)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Role</p>
          <p className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {user.role}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerInformation;

