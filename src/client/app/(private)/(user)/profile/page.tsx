"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { withAuth } from "@/app/components/HOC/WithAuth";
import MainLayout from "@/app/components/templates/MainLayout";
import {
  useGetMeQuery,
  useUpdateMyProfileMutation,
} from "@/app/store/apis/UserApi";
import { toAccountReference } from "@/app/lib/utils/accountReference";
import useToast from "@/app/hooks/ui/useToast";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/slices/AuthSlice";
import {
  useCreateAddressMutation,
  useGetAddressesQuery,
  useSetDefaultAddressMutation,
  type Address,
  type AddressType,
} from "@/app/store/apis/AddressApi";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  Crown,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MapPin,
  Phone,
  PackageSearch,
  PlusCircle,
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
  phone?: string | null;
  role?: string | null;
  avatar?: string | null;
  dealerProfile?: DealerProfile | null;
  isDealer?: boolean;
  dealerStatus?: DealerStatus | null;
  dealerBusinessName?: string | null;
  dealerContactPhone?: string | null;
};

type AddressFormState = {
  type: AddressType;
  fullName: string;
  phoneNumber: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  isDefault: boolean;
};

const getEmptyAddressForm = (): AddressFormState => ({
  type: "HOME",
  fullName: "",
  phoneNumber: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  isDefault: false,
});

const parseAddressesPayload = (payload: unknown): Address[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const typedPayload = payload as {
    addresses?: Address[];
    data?: { addresses?: Address[] };
  };

  return typedPayload.addresses || typedPayload.data?.addresses || [];
};

const parseAddressPayload = (payload: unknown): Address | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typedPayload = payload as {
    address?: Address;
    data?: { address?: Address };
  };

  return typedPayload.address || typedPayload.data?.address || null;
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
    title: "Dealer request is under evaluation",
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

const normalizePhoneNumber = (phone: string): string =>
  phone.replace(/\s+/g, " ").trim();

const getPhoneNumberError = (value: string): string | null => {
  if (!value) {
    return "Phone number is required.";
  }

  if (!/^[0-9()+\-\s]{7,20}$/.test(value)) {
    return "Phone number must be 7-20 characters and contain only valid digits/symbols.";
  }

  return null;
};

const UserProfile = () => {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const { data, isLoading, error, refetch } = useGetMeQuery(undefined);
  const [updateMyProfile, { isLoading: isUpdatingProfile }] =
    useUpdateMyProfileMutation();
  const [editableName, setEditableName] = useState("");
  const [editablePhone, setEditablePhone] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
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
  const canSelfResetPassword =
    accountKind === "USER" || accountKind === "DEALER";
  const accountReference =
    user?.accountReference || (user?.id ? toAccountReference(user.id) : "ACC-UNKNOWN");
  const accountMeta = ACCOUNT_META[accountKind];
  const dealerStatus = (dealerProfile?.status || user?.dealerStatus || "PENDING") as DealerStatus;
  const dealerStatusCopy = DEALER_STATUS_COPY[dealerStatus];
  const normalizedCurrentName = normalizeDisplayName(user?.name || "");
  const normalizedCurrentPhone = normalizePhoneNumber(user?.phone || "");
  const normalizedEditableName = normalizeDisplayName(editableName);
  const normalizedEditablePhone = normalizePhoneNumber(editablePhone);
  const canSaveProfile = useMemo(
    () =>
      !isUpdatingProfile &&
      (normalizedEditableName !== normalizedCurrentName ||
        normalizedEditablePhone !== normalizedCurrentPhone),
    [
      isUpdatingProfile,
      normalizedCurrentName,
      normalizedCurrentPhone,
      normalizedEditableName,
      normalizedEditablePhone,
    ]
  );
  const shouldShowAddressBook =
    accountKind === "USER" || accountKind === "DEALER";
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>(
    getEmptyAddressForm()
  );
  const {
    data: addressesResponse,
    isLoading: isAddressesLoading,
    isFetching: isAddressesFetching,
    refetch: refetchAddresses,
  } = useGetAddressesQuery(undefined, {
    skip: !shouldShowAddressBook,
  });
  const [createAddress, { isLoading: isCreatingAddress }] =
    useCreateAddressMutation();
  const [setDefaultAddress, { isLoading: isSettingDefaultAddress }] =
    useSetDefaultAddressMutation();
  const addresses = useMemo(
    () => parseAddressesPayload(addressesResponse),
    [addressesResponse]
  );

  useEffect(() => {
    setEditableName(user?.name || "");
    setEditablePhone(user?.phone || "");
    setNameError(null);
    setPhoneError(null);
  }, [user?.id, user?.name, user?.phone]);

  useEffect(() => {
    if (!shouldShowAddressBook || isAddressesLoading) {
      return;
    }

    if (addresses.length === 0) {
      setIsAddressFormOpen(true);
    }
  }, [addresses.length, isAddressesLoading, shouldShowAddressBook]);

  const handleNameChange = (value: string) => {
    setEditableName(value);
    if (nameError) {
      setNameError(null);
    }
  };

  const handlePhoneChange = (value: string) => {
    setEditablePhone(value);
    if (phoneError) {
      setPhoneError(null);
    }
  };

  const handleSaveProfile = async () => {
    const nextName = normalizeDisplayName(editableName);
    const nextPhone = normalizePhoneNumber(editablePhone);
    const nextNameError = getDisplayNameError(nextName);
    const nextPhoneError = getPhoneNumberError(nextPhone);

    setNameError(nextNameError);
    setPhoneError(nextPhoneError);

    if (nextNameError || nextPhoneError) {
      return;
    }

    if (
      !user?.id ||
      (nextName === normalizedCurrentName && nextPhone === normalizedCurrentPhone)
    ) {
      return;
    }

    try {
      const response = (await updateMyProfile({
        name: nextName,
        phone: nextPhone,
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
              phone: updatedUser.phone || nextPhone,
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
      setEditablePhone(nextPhone);
      setNameError(null);
      setPhoneError(null);
      showToast("Profile updated successfully.", "success");
      await refetch();
    } catch (saveError: unknown) {
      const apiMessage =
        typeof saveError === "object" && saveError !== null
          ? (saveError as { data?: { message?: string } }).data?.message
          : null;
      showToast(apiMessage || "Failed to update profile.", "error");
    }
  };

  const handleAddressInputChange = (
    key: keyof AddressFormState,
    value: string | boolean
  ) => {
    setAddressForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleCreateAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const requiredFields: Array<keyof AddressFormState> = [
      "fullName",
      "phoneNumber",
      "line1",
      "city",
      "state",
      "country",
      "pincode",
    ];

    const hasMissingField = requiredFields.some(
      (field) => !String(addressForm[field] ?? "").trim()
    );

    if (hasMissingField) {
      showToast("Please complete all required address fields.", "error");
      return;
    }

    try {
      const response = await createAddress({
        type: addressForm.type,
        fullName: addressForm.fullName.trim(),
        phoneNumber: addressForm.phoneNumber.trim(),
        line1: addressForm.line1.trim(),
        line2: addressForm.line2.trim() || undefined,
        landmark: addressForm.landmark.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        country: addressForm.country.trim(),
        pincode: addressForm.pincode.trim(),
        isDefault: addressForm.isDefault,
      }).unwrap();

      const createdAddress = parseAddressPayload(response);
      setAddressForm(getEmptyAddressForm());
      setIsAddressFormOpen(false);
      await refetchAddresses();
      showToast(
        createdAddress
          ? "Address saved in your account successfully."
          : "Address saved successfully.",
        "success"
      );
    } catch (addressError: unknown) {
      showToast(getApiErrorMessage(addressError, "Failed to save address."), "error");
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await setDefaultAddress(addressId).unwrap();
      await refetchAddresses();
      showToast("Default address updated.", "success");
    } catch (addressError: unknown) {
      showToast(
        getApiErrorMessage(addressError, "Failed to set default address."),
        "error"
      );
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
                          onClick={handleSaveProfile}
                          disabled={!canSaveProfile}
                          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                        >
                          {isUpdatingProfile ? "Saving..." : "Save"}
                        </button>
                      </div>
                      {nameError && (
                        <p className="mt-1 text-xs text-red-600">{nameError}</p>
                      )}
                    </div>
                    <div className="text-gray-700">
                      <p className="text-gray-500">Account Phone</p>
                      <div className="mt-1">
                        <input
                          type="tel"
                          value={editablePhone}
                          onChange={(event) => handlePhoneChange(event.target.value)}
                          onBlur={() =>
                            setPhoneError(
                              getPhoneNumberError(normalizePhoneNumber(editablePhone))
                            )
                          }
                          maxLength={20}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Enter your account phone number"
                        />
                      </div>
                      {phoneError && (
                        <p className="mt-1 text-xs text-red-600">{phoneError}</p>
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
                        {dealerProfile?.contactPhone || user.phone || "Not set"}
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

              {shouldShowAddressBook && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-indigo-600" />
                      <h3 className="text-sm font-semibold text-gray-800">
                        Saved Addresses
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddressFormOpen((previous) => !previous)}
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      <PlusCircle size={14} />
                      {isAddressFormOpen ? "Hide Form" : "Add New Address"}
                    </button>
                  </div>

                  {isAddressesLoading ? (
                    <p className="text-sm text-gray-600">Loading saved addresses...</p>
                  ) : addresses.length === 0 ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      No address saved yet. Add one now for faster checkout.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {addresses.map((address) => (
                        <div
                          key={address.id}
                          className="rounded-md border border-gray-200 bg-gray-50 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-800">
                                  {address.fullName}
                                </p>
                                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                  {address.type}
                                </span>
                                {address.isDefault && (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {address.line1}
                                {address.line2 ? `, ${address.line2}` : ""}
                                {address.landmark ? `, ${address.landmark}` : ""}
                              </p>
                              <p className="text-xs text-gray-600">
                                {[address.city, address.state, address.country]
                                  .filter(Boolean)
                                  .join(", ")}{" "}
                                - {address.pincode}
                              </p>
                              <p className="text-xs text-gray-600">
                                Phone: {address.phoneNumber}
                              </p>
                            </div>

                            {!address.isDefault && (
                              <button
                                type="button"
                                onClick={() => void handleSetDefaultAddress(address.id)}
                                disabled={isSettingDefaultAddress}
                                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Set Default
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAddressesFetching && (
                    <p className="mt-2 text-xs text-gray-500">Refreshing address list...</p>
                  )}

                  {isAddressFormOpen && (
                    <form
                      onSubmit={handleCreateAddress}
                      className="mt-4 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3"
                    >
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Address Type
                        </label>
                        <select
                          value={addressForm.type}
                          onChange={(event) =>
                            handleAddressInputChange(
                              "type",
                              event.target.value as AddressType
                            )
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="HOME">Home</option>
                          <option value="OFFICE">Office</option>
                          <option value="WAREHOUSE">Warehouse</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={addressForm.fullName}
                          onChange={(event) =>
                            handleAddressInputChange("fullName", event.target.value)
                          }
                          placeholder="Full Name *"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          value={addressForm.phoneNumber}
                          onChange={(event) =>
                            handleAddressInputChange("phoneNumber", event.target.value)
                          }
                          placeholder="Phone Number *"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>

                      <input
                        value={addressForm.line1}
                        onChange={(event) =>
                          handleAddressInputChange("line1", event.target.value)
                        }
                        placeholder="Address Line 1 *"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        value={addressForm.line2}
                        onChange={(event) =>
                          handleAddressInputChange("line2", event.target.value)
                        }
                        placeholder="Address Line 2 (optional)"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                      <input
                        value={addressForm.landmark}
                        onChange={(event) =>
                          handleAddressInputChange("landmark", event.target.value)
                        }
                        placeholder="Landmark (optional)"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />

                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={addressForm.city}
                          onChange={(event) =>
                            handleAddressInputChange("city", event.target.value)
                          }
                          placeholder="City *"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          value={addressForm.state}
                          onChange={(event) =>
                            handleAddressInputChange("state", event.target.value)
                          }
                          placeholder="State *"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          value={addressForm.country}
                          onChange={(event) =>
                            handleAddressInputChange("country", event.target.value)
                          }
                          placeholder="Country *"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          value={addressForm.pincode}
                          onChange={(event) =>
                            handleAddressInputChange("pincode", event.target.value)
                          }
                          placeholder="Pincode *"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={addressForm.isDefault}
                          onChange={(event) =>
                            handleAddressInputChange("isDefault", event.target.checked)
                          }
                        />
                        Set as default address
                      </label>

                      <button
                        type="submit"
                        disabled={isCreatingAddress}
                        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                      >
                        {isCreatingAddress ? "Saving..." : "Save Address"}
                      </button>
                    </form>
                  )}
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

              <div className="grid gap-4 md:grid-cols-4">
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
                    <Phone size={16} className="text-indigo-600" />
                    <p className="text-sm font-semibold text-gray-800">Account Phone</p>
                  </div>
                  <p className="text-sm text-gray-700 break-all">
                    {user.phone || "Not provided"}
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
                  {canSelfResetPassword ? (
                    <Link
                      href="/password-reset"
                      className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:text-indigo-900"
                    >
                      <ReceiptText size={14} />
                      Reset Password
                    </Link>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Admin/SuperAdmin password changes are handled by SuperAdmin via
                      offline channels.
                    </p>
                  )}
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
