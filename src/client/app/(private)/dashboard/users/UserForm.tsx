"use client";

import { Controller, UseFormReturn } from "react-hook-form";
import { Users, Shield, Crown } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import Dropdown from "@/app/components/molecules/Dropdown";
import {
  resolveDisplayRole,
  isExternalDisplayRole,
} from "@/app/lib/userRole";
import {
  normalizeEmailValue,
  sanitizeLooseTextInput,
  validateDisplayName,
  validateEmailValue,
} from "@/app/lib/validators/common";

export interface UserFormData {
  id: string | number;
  name: string;
  email: string;
  role: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
}

interface UserFormProps {
  form: UseFormReturn<UserFormData>;
  onSubmit: (data: UserFormData) => void;
  isLoading?: boolean;
  submitLabel?: string;
  targetUser?: {
    role?: string | null;
    effectiveRole?: string | null;
    dealerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null | string;
    dealerProfile?: {
      status?: "PENDING" | "APPROVED" | "REJECTED" | null | string;
    } | null;
  } | null;
}

const UserForm: React.FC<UserFormProps> = ({
  form,
  onSubmit,
  isLoading,
  submitLabel = "Save",
  targetUser = null,
}) => {
  const { user: currentUser } = useAuth();
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = form;

  const selectedRole = watch("role");
  const watchedName = watch("name");
  const watchedEmail = watch("email");
  const targetDisplayRole = resolveDisplayRole({
    role: targetUser?.role ?? selectedRole,
    effectiveRole: targetUser?.effectiveRole,
    dealerStatus: targetUser?.dealerStatus,
    dealerProfile: targetUser?.dealerProfile,
  });
  const isExternalTarget = isExternalDisplayRole(targetDisplayRole);
  const isInternalTarget = !isExternalTarget;

  // Get role color for display
  const getRoleColor = (role: string) => {
    const colors = {
      USER: "bg-blue-100 text-blue-800 border-blue-200",
      DEALER: "bg-emerald-100 text-emerald-800 border-emerald-200",
      ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
      SUPERADMIN: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[role as keyof typeof colors] || colors.USER;
  };

  // Get available roles based on current user's role
  const getAvailableRoles = () => {
    if (!currentUser) return [];

    if (isExternalTarget) {
      const externalRoleValue =
        targetDisplayRole === "DEALER" ? "DEALER" : "USER";
      return [
        {
          value: externalRoleValue,
          label: targetDisplayRole === "DEALER" ? "Dealer Account" : "Customer Account",
          icon: <Users className="w-4 h-4" />,
        },
      ];
    }

    switch (currentUser.role) {
      case "SUPERADMIN":
        return [
          {
            value: "ADMIN",
            label: "Admin",
            icon: <Shield className="w-4 h-4" />,
          },
          {
            value: "SUPERADMIN",
            label: "Super Admin",
            icon: <Crown className="w-4 h-4" />,
          },
        ];
      case "ADMIN":
        return [
          {
            value: "ADMIN",
            label: "Admin",
            icon: <Shield className="w-4 h-4" />,
          },
        ];
      default:
        return [{ value: "USER", label: "User", icon: <Users className="w-4 h-4" /> }];
    }
  };

  const availableRoles = getAvailableRoles();
  const canSubmitForm =
    validateDisplayName(watchedName || "", 2, 120, "Name") === true &&
    validateEmailValue(watchedEmail || "") === true &&
    Boolean(selectedRole);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name
        </label>
        <div className="relative">
          <Controller
            name="name"
            control={control}
            rules={{
              required: "Name is required",
              validate: (value: string) =>
                validateDisplayName(value, 2, 120, "Name"),
            }}
            render={({ field, fieldState }) => (
              <input
                {...field}
                type="text"
                readOnly={isInternalTarget}
                onChange={(event) =>
                  field.onChange(sanitizeLooseTextInput(event.target.value))
                }
                className={`w-full pl-10 p-3 rounded-lg focus:outline-none focus:ring-2 text-gray-800 ${
                  fieldState.error
                    ? "border border-red-500 bg-red-50 focus:ring-red-200"
                    : isInternalTarget
                    ? "border border-gray-200 bg-gray-50 text-gray-500 focus:ring-gray-200"
                    : "border border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="John Doe"
              />
            )}
          />
          <Users className="absolute left-3 top-3.5 text-gray-400" size={18} />
        </div>
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <Controller
          name="email"
          control={control}
          rules={{
            required: "Email is required",
            validate: (value: string) => validateEmailValue(value),
          }}
          render={({ field, fieldState }) => (
            <input
              {...field}
              type="email"
              readOnly={isInternalTarget}
              onChange={(event) => field.onChange(normalizeEmailValue(event.target.value))}
              className={`w-full p-3 rounded-lg focus:outline-none focus:ring-2 text-gray-800 ${
                fieldState.error
                  ? "border border-red-500 bg-red-50 focus:ring-red-200"
                  : isInternalTarget
                  ? "border border-gray-200 bg-gray-50 text-gray-500 focus:ring-gray-200"
                  : "border border-gray-300 focus:ring-blue-500"
              }`}
              placeholder="john.doe@example.com"
            />
          )}
        />
        {errors.email && (
          <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Role
        </label>
        <Controller
          name="role"
          control={control}
          rules={{ required: "Role is required" }}
          render={({ field }) => (
            <div className="space-y-2">
              <Dropdown
                label="Select role"
                options={availableRoles.map((role) => ({
                  label: role.label,
                  value: role.value,
                }))}
                value={field.value}
                onChange={(value) => {
                  if (!value) return;
                  field.onChange(value);
                  field.onBlur();
                }}
                clearable={false}
                className={`w-full rounded-lg text-gray-800 ${
                  errors.role
                    ? "border border-red-500 bg-red-50 focus-visible:ring-red-200"
                    : "border border-gray-300 focus-visible:ring-blue-500/20"
                }`}
              />

              {/* Role Preview */}
              {selectedRole && (
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
                  {availableRoles.find((r) => r.value === selectedRole)?.icon}
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(
                      selectedRole
                    )}`}
                  >
                    {
                      availableRoles.find((r) => r.value === selectedRole)
                        ?.label
                    }
                  </span>
                </div>
              )}
            </div>
          )}
        />
        {errors.role && (
          <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>
        )}
      </div>

      {/* Submit */}
      {isExternalTarget ? (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          This is an external account. Internal role promotions are blocked by policy.
          Use dealer approval/rejection workflow for customer/dealer transitions.
        </p>
      ) : null}
      {isInternalTarget ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Internal account identity fields cannot be changed.
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !canSubmitForm}
          className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300 ${
            isLoading || !canSubmitForm ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isLoading ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
