"use client";

import { Building2, Crown, Shield, User } from "lucide-react";
import { toAccountReference } from "@/app/lib/utils/accountReference";
import { getRoleBadgeClass, resolveDisplayRole } from "@/app/lib/userRole";

const CustomerInformation = ({ user, customerType }) => {
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

  const displayRole = resolveDisplayRole({
    ...user,
    effectiveRole:
      user?.effectiveRole ||
      (customerType === "DEALER" || customerType === "USER"
        ? customerType
        : undefined),
  });

  const getRoleIcon = () => {
    if (displayRole === "SUPERADMIN") {
      return <Crown className="h-3.5 w-3.5" />;
    }
    if (displayRole === "ADMIN") {
      return <Shield className="h-3.5 w-3.5" />;
    }
    if (displayRole === "DEALER") {
      return <Building2 className="h-3.5 w-3.5" />;
    }
    return <User className="h-3.5 w-3.5" />;
  };

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
          <p className="text-sm text-gray-500">Phone Number</p>
          <p>{user.phone || "Not available"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Account Reference</p>
          <p className="font-mono">
            {user.accountReference || toAccountReference(user.id)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Role</p>
          <p
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${getRoleBadgeClass(
              displayRole
            )}`}
          >
            {getRoleIcon()}
            {displayRole}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerInformation;

