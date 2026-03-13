"use client";

import { useState } from "react";
import { Controller, UseFormReturn } from "react-hook-form";
import { UserPlus, Mail, User, Lock, Phone, FileText, Eye, EyeOff } from "lucide-react";
import {
  normalizeEmailValue,
  normalizePhoneDigits,
  sanitizeLooseTextInput,
  validateDisplayName,
  validateEmailValue,
  validatePasswordPolicy,
  validateTenDigitPhone,
} from "@/app/lib/validators/common";

export interface CreateAdminFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface CreateAdminFormProps {
  form: UseFormReturn<CreateAdminFormData>;
  onSubmit: (data: CreateAdminFormData) => void;
  isLoading?: boolean;
  submitLabel?: string;
  accountType?: "ADMIN" | "BILLING";
}

const CreateAdminForm: React.FC<CreateAdminFormProps> = ({
  form,
  onSubmit,
  isLoading,
  submitLabel = "Create Admin",
  accountType = "ADMIN",
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  const password = watch("password");
  const watchedName = watch("name");
  const watchedEmail = watch("email");
  const watchedPhone = watch("phone");
  const watchedConfirmPassword = watch("confirmPassword");

  const isBillingAccount = accountType === "BILLING";
  const canSubmitForm =
    validateDisplayName(watchedName || "", 2, 120, "Full name") === true &&
    validateEmailValue(watchedEmail || "") === true &&
    validateTenDigitPhone(watchedPhone || "", "Phone number") === true &&
    validatePasswordPolicy(password || "") === true &&
    watchedConfirmPassword === password;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Full Name
        </label>
        <div className="relative">
          <Controller
            name="name"
            control={control}
            rules={{
              required: "Name is required",
              validate: (value: string) =>
                validateDisplayName(value, 2, 120, "Full name"),
            }}
            render={({ field, fieldState }) => (
              <input
                {...field}
                type="text"
                onChange={(event) =>
                  field.onChange(sanitizeLooseTextInput(event.target.value))
                }
                className={`w-full pl-10 pr-10 p-3 rounded-lg focus:outline-none focus:ring-2 text-gray-800 ${
                  fieldState.error
                    ? "border border-red-500 bg-red-50 focus:ring-red-200"
                    : "border border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="John Doe"
              />
            )}
          />
          <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
        </div>
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <div className="relative">
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
                onChange={(event) => field.onChange(normalizeEmailValue(event.target.value))}
                className={`w-full pl-10 pr-10 p-3 rounded-lg focus:outline-none focus:ring-2 text-gray-800 ${
                  fieldState.error
                    ? "border border-red-500 bg-red-50 focus:ring-red-200"
                    : "border border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="john.doe@example.com"
              />
            )}
          />
          <Mail className="absolute left-3 top-3.5 text-gray-400" size={18} />
        </div>
        {errors.email && (
          <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <div className="relative">
          <Controller
            name="phone"
            control={control}
            rules={{
              required: "Phone number is required",
              validate: (value: string) =>
                validateTenDigitPhone(value, "Phone number"),
            }}
            render={({ field, fieldState }) => (
              <input
                {...field}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                onChange={(event) =>
                  field.onChange(normalizePhoneDigits(event.target.value, 10))
                }
                className={`w-full pl-10 p-3 rounded-lg focus:outline-none focus:ring-2 text-gray-800 ${
                  fieldState.error
                    ? "border border-red-500 bg-red-50 focus:ring-red-200"
                    : "border border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="9876543210"
              />
            )}
          />
          <Phone className="absolute left-3 top-3.5 text-gray-400" size={18} />
        </div>
        {errors.phone && (
          <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <div className="relative">
          <Controller
            name="password"
            control={control}
            rules={{
              required: "Password is required",
              validate: (value: string) => validatePasswordPolicy(value),
            }}
            render={({ field, fieldState }) => (
              <input
                {...field}
                type={showPassword ? "text" : "password"}
                className={`w-full pl-10 p-3 rounded-lg focus:outline-none focus:ring-2 text-gray-800 ${
                  fieldState.error
                    ? "border border-red-500 bg-red-50 focus:ring-red-200"
                    : "border border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="Enter password"
              />
            )}
          />
          <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
          <button
            type="button"
            onClick={() => setShowPassword((previous) => !previous)}
            className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <Controller
            name="confirmPassword"
            control={control}
            rules={{
              required: "Please confirm your password",
              validate: (value) =>
                value === password || "Passwords do not match",
            }}
            render={({ field, fieldState }) => (
              <input
                {...field}
                type={showConfirmPassword ? "text" : "password"}
                className={`w-full pl-10 p-3 rounded-lg focus:outline-none focus:ring-2 text-gray-800 ${
                  fieldState.error
                    ? "border border-red-500 bg-red-50 focus:ring-red-200"
                    : "border border-gray-300 focus:ring-blue-500"
                }`}
                placeholder="Confirm password"
              />
            )}
          />
          <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((previous) => !previous)}
            className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-700"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-red-500 text-sm mt-1">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* Role Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          {isBillingAccount ? (
            <FileText className="w-5 h-5 text-blue-600" />
          ) : (
            <UserPlus className="w-5 h-5 text-blue-600" />
          )}
          <span className="text-sm font-medium text-blue-800">
            {isBillingAccount ? "Billing Account" : "Admin Account"}
          </span>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          {isBillingAccount
            ? "This user will be included in billing/invoice email copy notifications only. No admin privileges will be granted."
            : "This user will be created with Admin privileges and can manage users and system settings."}
        </p>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !canSubmitForm}
          className={`px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-300 flex items-center space-x-2 ${
            isLoading || !canSubmitForm ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>{isLoading ? "Creating..." : submitLabel}</span>
        </button>
      </div>
    </form>
  );
};

export default CreateAdminForm;
