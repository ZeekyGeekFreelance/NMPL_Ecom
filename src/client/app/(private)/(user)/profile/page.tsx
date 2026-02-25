"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { withAuth } from "@/app/components/HOC/WithAuth";
import MainLayout from "@/app/components/templates/MainLayout";
import {
  useGetMeQuery,
  useUpdateMyProfileNameMutation,
} from "@/app/store/apis/UserApi";
import { toAccountReference } from "@/app/lib/utils/accountReference";
import useToast from "@/app/hooks/ui/useToast";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/slices/AuthSlice";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  Crown,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  PackageSearch,
  ReceiptText,
  Shield,
  User,
  Users,
  WalletCards,
} from "lucide-react";

type Role = "USER" | "ADMIN" | "SUPERADMIN";
type AccountKind = Role | "DEALER";
type DealerStatus = "PENDING" | "APPROVED" | "REJECTED";

type DealerProfile = {
  businessName?: string | null;
  contactPhone?: string | null;
  status?: DealerStatus | null;
  approvedAt?: string | null;
  updatedAt?: string | null;
};

type ProfileUser = {
  id: string;
  accountReference?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  avatar?: string | null;
  dealerProfile?: DealerProfile | null;
  isDealer?: boolean;
  dealerStatus?: DealerStatus | null;
  dealerBusinessName?: string | null;
  dealerContactPhone?: string | null;
};

const ACCOUNT_META: Record<
  AccountKind,
  {
    title: string;
    subtitle: string;
    badgeClass: string;
  }
> = {
  DEALER: {
    title: "Dealer Account",
    subtitle:
      "Access dealer-specific pricing, place wholesale orders, and track dealer approval status.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  USER: {
    title: "Customer Account",
    subtitle:
      "Browse products, place orders, and track order/invoice history.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  ADMIN: {
    title: "Admin Account",
    subtitle:
      "Manage products, categories, inventory, transactions, and dealer approvals.",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  SUPERADMIN: {
    title: "Superadmin Account",
    subtitle:
      "System-wide access including admin governance, user roles, and logs.",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

const ACTIONS_BY_ACCOUNT: Record<
  AccountKind,
  Array<{ href: string; label: string }>
> = {
  DEALER: [
    { href: "/shop", label: "Dealer Catalog" },
    { href: "/orders", label: "Dealer Orders" },
    { href: "/support", label: "Contact Support" },
    { href: "/password-reset", label: "Reset Password" },
  ],
  USER: [
    { href: "/orders", label: "My Orders" },
    { href: "/shop", label: "Continue Shopping" },
    { href: "/support", label: "Contact Support" },
    { href: "/password-reset", label: "Reset Password" },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Open Dashboard" },
    { href: "/dashboard/inventory", label: "Inventory" },
    { href: "/dashboard/transactions", label: "Transactions" },
    { href: "/dashboard/dealers", label: "Dealer Management" },
  ],
  SUPERADMIN: [
    { href: "/dashboard", label: "Open Dashboard" },
    { href: "/dashboard/users", label: "Manage Users" },
    { href: "/dashboard/dealers", label: "Dealer Management" },
    { href: "/dashboard/logs", label: "System Logs" },
  ],
};

const statusClassMap: Record<DealerStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

const DEALER_STATUS_COPY: Record<
  DealerStatus,
  { title: string; description: string; className: string }
> = {
  PENDING: {
    title: "Dealer request is under review",
    description:
      "Universal/base pricing stays active until an admin approves your dealer access.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  APPROVED: {
    title: "Dealer account approved",
    description:
      "Your assigned dealer pricing is active and resolved securely on the server.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  REJECTED: {
    title: "Dealer request was rejected",
    description:
      "Contact support/admin to resolve details before another dealership request.",
    className: "border-red-200 bg-red-50 text-red-900",
  },
};

const normalizeDealerProfile = (user: ProfileUser): DealerProfile | null => {
  if (user.dealerProfile) {
    return user.dealerProfile;
  }

  if (user.isDealer || user.dealerStatus) {
    return {
      businessName: user.dealerBusinessName,
      contactPhone: user.dealerContactPhone,
      status: user.dealerStatus,
    };
  }

  return null;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleDateString();
};

const getInitials = (name?: string | null) => {
  if (!name || !name.trim()) {
    return "U";
  }

  return name
    .trim()
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const normalizeDisplayName = (name: string): string =>
  name.replace(/\s+/g, " ").trim();

const getDisplayNameError = (value: string): string | null => {
  if (!value) {
    return "Name is required.";
  }

  if (value.length < 2) {
    return "Name must be at least 2 characters long.";
  }

  if (value.length > 80) {
    return "Name must be at most 80 characters long.";
  }

  return null;
};

const UserProfile = () => {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const { data, isLoading, error, refetch } = useGetMeQuery(undefined);
  const [updateMyProfileName, { isLoading: isUpdatingName }] =
    useUpdateMyProfileNameMutation();
  const [editableName, setEditableName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const user = (data as { user?: ProfileUser } | undefined)?.user;

  const normalizeRole = (value?: string | null): Role => {
    if (value === "ADMIN" || value === "SUPERADMIN" || value === "USER") {
      return value;
    }
    return "USER";
  };

  const role = normalizeRole(user?.role);
  const dealerProfile = user ? normalizeDealerProfile(user) : null;
  const isDealerAccount =
    role === "USER" &&
    !!(dealerProfile || user?.isDealer === true || user?.dealerStatus);
  const accountKind: AccountKind = isDealerAccount ? "DEALER" : role;
  const isPrivilegedAccount =
    accountKind === "ADMIN" || accountKind === "SUPERADMIN";
  const accountReference =
    user?.accountReference || (user?.id ? toAccountReference(user.id) : "ACC-UNKNOWN");
  const accountMeta = ACCOUNT_META[accountKind];
  const dealerStatus = (dealerProfile?.status || user?.dealerStatus || "PENDING") as DealerStatus;
  const dealerStatusCopy = DEALER_STATUS_COPY[dealerStatus];
  const normalizedCurrentName = normalizeDisplayName(user?.name || "");
  const normalizedEditableName = normalizeDisplayName(editableName);
  const canSaveName = useMemo(
    () =>
      normalizedEditableName.length > 0 &&
      normalizedEditableName !== normalizedCurrentName &&
      !isUpdatingName,
    [normalizedCurrentName, normalizedEditableName, isUpdatingName]
  );

  useEffect(() => {
    setEditableName(user?.name || "");
    setNameError(null);
  }, [user?.id, user?.name]);

  const handleNameChange = (value: string) => {
    setEditableName(value);
    if (nameError) {
      setNameError(null);
    }
  };

  const handleSaveName = async () => {
    const nextName = normalizeDisplayName(editableName);
    const validationError = getDisplayNameError(nextName);

    if (validationError) {
      setNameError(validationError);
      return;
    }

    if (!user?.id || nextName === normalizedCurrentName) {
      return;
    }

    try {
      const response = (await updateMyProfileName({
        name: nextName,
      }).unwrap()) as {
        user?: ProfileUser;
      };

      const updatedUser = response.user;
      if (updatedUser) {
        dispatch(
          setUser({
            user: {
              id: updatedUser.id,
              accountReference:
                updatedUser.accountReference || toAccountReference(updatedUser.id),
              name: updatedUser.name || nextName,
              email: updatedUser.email || user.email || "",
              role: updatedUser.role || role,
              avatar: updatedUser.avatar || null,
              isDealer:
                Boolean(updatedUser.dealerProfile) ||
                Boolean(updatedUser.isDealer),
              dealerStatus:
                updatedUser.dealerProfile?.status ||
                updatedUser.dealerStatus ||
                null,
              dealerBusinessName:
                updatedUser.dealerProfile?.businessName ||
                updatedUser.dealerBusinessName ||
                null,
              dealerContactPhone:
                updatedUser.dealerProfile?.contactPhone ||
                updatedUser.dealerContactPhone ||
                null,
            },
          })
        );
      }

      setEditableName(nextName);
      setNameError(null);
      showToast("Profile name updated successfully.", "success");
      await refetch();
    } catch (saveError: unknown) {
      const apiMessage =
        typeof saveError === "object" && saveError !== null
          ? (saveError as { data?: { message?: string } }).data?.message
          : null;
      showToast(apiMessage || "Failed to update profile name.", "error");
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
          <div className="max-w-5xl mx-auto rounded-2xl border border-gray-200 bg-white p-8 animate-pulse">
            <div className="h-8 w-56 rounded bg-gray-200 mb-6" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-28 rounded-xl bg-gray-100" />
              <div className="h-28 rounded-xl bg-gray-100" />
              <div className="h-28 rounded-xl bg-gray-100" />
              <div className="h-28 rounded-xl bg-gray-100" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !user) {
    return (
      <MainLayout>
        <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
          <div className="max-w-4xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Profile Error</h3>
            <p className="text-red-600 mt-2">
              Unable to fetch profile data. Please refresh and try again.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 p-5 sm:p-7 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt="Profile"
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] rounded-full border-2 border-white/30 object-cover"
                    />
                  ) : (
                    <div className="h-[72px] w-[72px] rounded-full border-2 border-white/30 bg-white/20 flex items-center justify-center">
                      <span className="text-xl font-semibold">
                        {getInitials(user.name)}
                      </span>
                    </div>
                  )}

                  <div>
                    <h1 className="text-2xl font-semibold">
                      {user.name || "Account"}
                    </h1>
                    <p className="text-sm text-slate-200 mt-1">
                      {accountMeta.title}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${accountMeta.badgeClass}`}
                >
                  {accountKind === "SUPERADMIN" ? (
                    <Crown size={14} />
                  ) : accountKind === "DEALER" ? (
                    <Building2 size={14} />
                  ) : (
                    <Shield size={14} />
                  )}
                  {accountKind}
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-7 space-y-5">
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                <p className="text-sm text-gray-700">{accountMeta.subtitle}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-semibold text-gray-800">Identity</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="text-gray-700">
                      <p className="text-gray-500">Name</p>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={editableName}
                          onChange={(event) => handleNameChange(event.target.value)}
                          onBlur={() =>
                            setNameError(
                              getDisplayNameError(normalizeDisplayName(editableName))
                            )
                          }
                          maxLength={80}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Enter your display name"
                        />
                        <button
                          type="button"
                          onClick={handleSaveName}
                          disabled={!canSaveName}
                          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                        >
                          {isUpdatingName ? "Saving..." : "Save"}
                        </button>
                      </div>
                      {nameError && (
                        <p className="mt-1 text-xs text-red-600">{nameError}</p>
                      )}
                    </div>
                    <p className="text-gray-700 break-all">
                      <span className="text-gray-500">Email:</span>{" "}
                      {user.email || "Not provided"}
                    </p>
                    <p className="text-gray-700 break-all">
                      <span className="text-gray-500">Account Reference:</span>{" "}
                      {accountReference}
                    </p>
                    {isPrivilegedAccount && (
                      <p className="text-gray-700 break-all">
                        <span className="text-gray-500">Internal User ID:</span> {user.id}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-semibold text-gray-800">Account Status</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700">
                      <span className="text-gray-500">Role:</span>{" "}
                      {accountKind === "DEALER" ? "USER (Dealer)" : role}
                    </p>
                    <p className="text-gray-700">
                      <span className="text-gray-500">Profile Updated:</span>{" "}
                      {formatDate(dealerProfile?.updatedAt)}
                    </p>
                    {accountKind === "DEALER" ? (
                      <div className="text-gray-700">
                        <span className="text-gray-500">Dealer Status:</span>{" "}
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            statusClassMap[dealerStatus]
                          }`}
                        >
                          {dealerStatus}
                        </span>
                      </div>
                    ) : (
                      <p className="text-green-700 font-medium">Account active</p>
                    )}
                  </div>
                </div>
              </div>

              {accountKind === "DEALER" && (
                <>
                  <div className={`rounded-xl border p-4 ${dealerStatusCopy.className}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={16} />
                      <h3 className="text-sm font-semibold">{dealerStatusCopy.title}</h3>
                    </div>
                    <p className="text-sm">{dealerStatusCopy.description}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={16} className="text-indigo-600" />
                      <h3 className="text-sm font-semibold text-gray-800">Dealer Profile</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <p className="text-gray-700">
                        <span className="text-gray-500">Business Name:</span>{" "}
                        {dealerProfile?.businessName || "Not set"}
                      </p>
                      <p className="text-gray-700">
                        <span className="text-gray-500">Contact Phone:</span>{" "}
                        {dealerProfile?.contactPhone || "Not set"}
                      </p>
                      <p className="text-gray-700">
                        <span className="text-gray-500">Approval Date:</span>{" "}
                        {formatDate(dealerProfile?.approvedAt)}
                      </p>
                      <p className="text-gray-700">
                        <span className="text-gray-500">Pricing Mode:</span>{" "}
                        {dealerStatus === "APPROVED"
                          ? "Dealer-specific pricing"
                          : "Universal/base pricing"}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {accountKind === "USER" && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <WalletCards size={16} className="text-blue-700" />
                    <h3 className="text-sm font-semibold text-blue-900">
                      Customer Scope
                    </h3>
                  </div>
                  <p className="text-sm text-blue-800">
                    You can browse products, manage cart and orders, and contact
                    support. Pricing is auto-calculated from your account type.
                  </p>
                </div>
              )}

              {accountKind === "ADMIN" && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <LayoutDashboard size={16} className="text-indigo-700" />
                    <h3 className="text-sm font-semibold text-indigo-900">
                      Admin Scope
                    </h3>
                  </div>
                  <p className="text-sm text-indigo-800">
                    You can manage catalog, stock, transactions, and dealer pricing.
                    Superadmin-only actions like user role governance are restricted.
                  </p>
                </div>
              )}

              {accountKind === "SUPERADMIN" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={16} className="text-rose-700" />
                    <h3 className="text-sm font-semibold text-rose-900">
                      Superadmin Scope
                    </h3>
                  </div>
                  <p className="text-sm text-rose-800">
                    You have full system access, including role management,
                    logs, and privileged administrative operations.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <PackageSearch size={16} className="text-indigo-600" />
                  <h3 className="text-sm font-semibold text-gray-800">
                    Quick Navigation
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ACTIONS_BY_ACCOUNT[accountKind].map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="inline-flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <span>{action.label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail size={16} className="text-indigo-600" />
                    <p className="text-sm font-semibold text-gray-800">Account Email</p>
                  </div>
                  <p className="text-sm text-gray-700 break-all">
                    {user.email || "Not provided"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={16} className="text-indigo-600" />
                    <p className="text-sm font-semibold text-gray-800">Account Type</p>
                  </div>
                  <p className="text-sm text-gray-700">{accountKind}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <LifeBuoy size={16} className="text-indigo-600" />
                    <p className="text-sm font-semibold text-gray-800">
                      Security
                    </p>
                  </div>
                  <Link
                    href="/password-reset"
                    className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:text-indigo-900"
                  >
                    <ReceiptText size={14} />
                    Reset Password
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
};

export default withAuth(UserProfile);
