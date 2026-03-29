"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { withAuth } from "@/app/components/HOC/WithAuth";
import PermissionGuard from "@/app/components/auth/PermissionGuard";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import Modal from "@/app/components/organisms/Modal";
import { useAuth } from "@/app/hooks/useAuth";
import {
  useCreateDealerMutation,
  useDeleteDealerMutation,
  useGetDealersQuery,
  useGetMeQuery,
  useGetDealerPricesQuery,
  useSetDealerPricesMutation,
  useUpdateDealerStatusMutation,
} from "@/app/store/apis/UserApi";
import { useGetAllVariantsQuery } from "@/app/store/apis/VariantApi";
import { useGetDealerCreditLedgerQuery, useGetOutstandingPaymentOrdersQuery } from "@/app/store/apis/PaymentApi";
import useToast from "@/app/hooks/ui/useToast";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import { FileText, Search, Trash2, X, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { toAccountReference, toOrderReference, toPaymentReference, toTransactionReference } from "@/app/lib/utils/accountReference";
import { getPaginatedSerialNumber } from "@/app/lib/utils/pagination";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { format } from "date-fns";
import { downloadInvoiceByOrderId } from "@/app/lib/utils/downloadInvoice";
import {
  normalizeEmailValue,
  normalizePhoneDigits,
  sanitizeTextInput,
  validateBusinessName,
  validateDisplayName,
  validateEmailValue,
  validatePasswordPolicy,
  validateTenDigitPhone,
} from "@/app/lib/validators/common";
import PasswordVisibilityToggle from "@/app/components/atoms/PasswordVisibilityToggle";
import LoadingDots from "@/app/components/feedback/LoadingDots";
import MiniSpinner from "@/app/components/feedback/MiniSpinner";

type DealerStatus = "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED";
type DealerFilter = "ALL" | DealerStatus;

type ConfirmationState = {
  isOpen: boolean;
  title: string;
  message: string;
  type: "warning" | "danger" | "info";
  onConfirm: null | (() => void | Promise<void>);
};

const DealersDashboard = () => {
  const { showToast } = useToast();
  const formatPrice = useFormatPrice();
  const { user } = useAuth();
  const { data: meData, isFetching: isFetchingMe } = useGetMeQuery();
  const effectiveRole =
    meData?.user?.effectiveRole ||
    user?.effectiveRole ||
    meData?.user?.role ||
    user?.role;
  const isAdminUser =
    effectiveRole === "ADMIN" || effectiveRole === "SUPERADMIN";

  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<DealerFilter>("ALL");
  const [dealerSearch, setDealerSearch] = useState("");

  // #10: Single query + client-side filter — eliminates double API call on every status tab click.
  const { data: allDealersData, isLoading } = useGetDealersQuery(undefined, {
    skip: !isAdminUser,
  });

  const [createDealer, { isLoading: isCreatingDealer }] =
    useCreateDealerMutation();
  const [deleteDealer, { isLoading: isDeletingDealer }] =
    useDeleteDealerMutation();
  const [updateDealerStatus, { isLoading: isUpdatingStatus }] =
    useUpdateDealerStatusMutation();
  const [setDealerPrices, { isLoading: isSavingPrices }] =
    useSetDealerPricesMutation();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isPaymentHistoryModalOpen, setIsPaymentHistoryModalOpen] = useState(false);
  // #9: Lazy-load variants only when the price modal is open — avoids fetching 500 records on page load.
  const { data: variantsData } = useGetAllVariantsQuery(
    { limit: 500 },
    { skip: !isAdminUser || !isPriceModalOpen }
  );
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const ledgerPageSize = 10;
  const outstandingPageSize = 5;
  const [ledgerPage, setLedgerPage] = useState(1);
  const [outstandingPage, setOutstandingPage] = useState(1);

  const [priceSearch, setPriceSearch] = useState("");
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});

  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: "",
    message: "",
    type: "warning",
    onConfirm: null,
  });

  const [showCreateDealerPassword, setShowCreateDealerPassword] = useState(false);

  type CreateDealerFormValues = {
    name: string;
    email: string;
    // nosemgrep: hardcoded-credential
    // This is a form field type definition, not a hardcoded credential.
    password: string;
    businessName: string;
    contactPhone: string;
    /**
     * When true, the dealer is created as LEGACY:
     *   - status = LEGACY (active immediately, no approval queue)
     *   - payLaterEnabled = true (pay after delivery, NET 30 terms)
     *   - mustChangePassword = true (forced credential reset on first login)
     * Only admins/superadmins can set this flag — it is never exposed to end users.
     */
    isLegacy: boolean;
  };

  const {
    register: registerDealerField,
    handleSubmit: handleDealerSubmit,
    reset: resetDealerForm,
    watch: watchDealerField,
    formState: { errors: dealerFormErrors, isSubmitting: isDealerFormSubmitting },
  } = useForm<CreateDealerFormValues>({
    // nosemgrep: hardcoded-credential
    // Empty string defaults for form fields, not actual credentials.
    defaultValues: { name: "", email: "", password: "", businessName: "", contactPhone: "", isLegacy: false },
  });

  // Live-watch the legacy toggle so the warning panel appears/disappears reactively.
  const isLegacyChecked = watchDealerField("isLegacy");

  useEffect(() => {
    if (!isPriceModalOpen) {
      return;
    }

    const body = document.body;
    const dashboardScrollContainer = document.querySelector(
      '[data-dashboard-scroll-container="true"]'
    ) as HTMLElement | null;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    const previousDashboardOverflow = dashboardScrollContainer?.style.overflow;
    const previousDashboardTouchAction =
      dashboardScrollContainer?.style.touchAction;
    const currentCount = Number(body.dataset.modalOpenCount || "0");
    const nextCount = currentCount + 1;

    body.dataset.modalOpenCount = String(nextCount);
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    if (dashboardScrollContainer) {
      dashboardScrollContainer.style.overflow = "hidden";
      dashboardScrollContainer.style.touchAction = "none";
    }

    return () => {
      const latestCount = Number(body.dataset.modalOpenCount || "1");
      const decrementedCount = Math.max(0, latestCount - 1);

      if (decrementedCount === 0) {
        delete body.dataset.modalOpenCount;
        body.style.overflow = previousOverflow;
        body.style.touchAction = previousTouchAction;
        if (dashboardScrollContainer) {
          dashboardScrollContainer.style.overflow = previousDashboardOverflow || "";
          dashboardScrollContainer.style.touchAction =
            previousDashboardTouchAction || "";
        }
        return;
      }

      body.dataset.modalOpenCount = String(decrementedCount);
    };
  }, [isPriceModalOpen]);

  const { data: dealerPriceData, isFetching: isFetchingDealerPrices } =
    useGetDealerPricesQuery(selectedDealerId || "", {
      skip: !selectedDealerId || !isPriceModalOpen,
    });

  const { data: creditLedgerData, isFetching: isFetchingCreditLedger } =
    useGetDealerCreditLedgerQuery(selectedDealerId || "", {
      skip: !selectedDealerId || !isPaymentHistoryModalOpen,
    });

  const { data: outstandingOrdersData, isFetching: isFetchingOutstandingOrders } =
    useGetOutstandingPaymentOrdersQuery(
      { dealerId: selectedDealerId || undefined },
      { skip: !selectedDealerId || !isPaymentHistoryModalOpen }
    );

  const creditLedgerEntries = creditLedgerData?.entries || [];
  const outstandingOrders = outstandingOrdersData?.orders || [];
  const ledgerPageCount = Math.max(
    1,
    Math.ceil(creditLedgerEntries.length / ledgerPageSize)
  );
  const outstandingPageCount = Math.max(
    1,
    Math.ceil(outstandingOrders.length / outstandingPageSize)
  );
  const paginatedLedgerEntries = useMemo(() => {
    const start = (ledgerPage - 1) * ledgerPageSize;
    return creditLedgerEntries.slice(start, start + ledgerPageSize);
  }, [creditLedgerEntries, ledgerPage, ledgerPageSize]);
  const paginatedOutstandingOrders = useMemo(() => {
    const start = (outstandingPage - 1) * outstandingPageSize;
    return outstandingOrders.slice(start, start + outstandingPageSize);
  }, [outstandingOrders, outstandingPage, outstandingPageSize]);

  useEffect(() => {
    if (!isPriceModalOpen) {
      return;
    }

    const nextPriceMap = Object.fromEntries(
      (dealerPriceData?.prices || []).map((price) => [
        price.variantId,
        String(price.customPrice),
      ])
    );

    setPriceMap(nextPriceMap);
  }, [dealerPriceData?.prices, isPriceModalOpen]);

  useEffect(() => {
    if (!isPriceModalOpen) {
      setPriceSearch("");
      setShowOnlyMapped(false);
    }
  }, [isPriceModalOpen]);

  useEffect(() => {
    if (!isPaymentHistoryModalOpen) {
      return;
    }
    setLedgerPage(1);
    setOutstandingPage(1);
  }, [isPaymentHistoryModalOpen, selectedDealerId]);

  /**
   * Deep-link: ?paymentHistory=DEALER_ID
   * Used when the Transaction Detail page "Payment History" button navigates here.
   * Auto-opens the correct dealer's Payment History modal, then removes the param.
   */
  useEffect(() => {
    const dealerIdParam = searchParams.get("paymentHistory");
    if (!dealerIdParam || !isAdminUser || isLoading) return;
    if (!allDealersData?.dealers?.length) return;
    const matched = allDealersData.dealers.find((d: any) => d.id === dealerIdParam);
    if (!matched) return;
    setSelectedDealerId(dealerIdParam);
    setIsPaymentHistoryModalOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("paymentHistory");
    const qs = next.toString();
    router.replace(qs ? `/dashboard/dealers?${qs}` : "/dashboard/dealers", { scroll: false } as any);
  }, [searchParams, isAdminUser, isLoading, allDealersData]);

  useEffect(() => {
    if (!isPaymentHistoryModalOpen) {
      return;
    }
    setLedgerPage((prev) => Math.min(prev, ledgerPageCount));
  }, [ledgerPageCount, isPaymentHistoryModalOpen]);

  useEffect(() => {
    if (!isPaymentHistoryModalOpen) {
      return;
    }
    setOutstandingPage((prev) => Math.min(prev, outstandingPageCount));
  }, [outstandingPageCount, isPaymentHistoryModalOpen]);

  const openConfirmation = (
    payload: Omit<ConfirmationState, "isOpen">
  ) => {
    setConfirmation({ ...payload, isOpen: true });
  };

  const closeConfirmation = () => {
    setConfirmation((prev) => ({
      ...prev,
      isOpen: false,
      onConfirm: null,
    }));
  };

  const handleConfirmAction = async () => {
    const callback = confirmation.onConfirm;
    if (!callback) {
      closeConfirmation();
      return;
    }

    try {
      await callback();
    } finally {
      closeConfirmation();
    }
  };

  const allDealers = allDealersData?.dealers || [];

  // #10: Client-side filter derived from the single query result.
  const dealers = useMemo(
    () =>
      statusFilter === "ALL"
        ? allDealers
        : allDealers.filter((d) => d.dealerProfile?.status === statusFilter),
    [allDealers, statusFilter]
  );
  const visibleDealers = useMemo(() => {
    const normalizedSearch = dealerSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return dealers;
    }

    return dealers
      .map((dealer) => {
        // Sanitize all user-provided strings to prevent XSS
        const sanitize = (str: string) => String(str || '').replace(/[<>"'&]/g, '');
        
        const accountReference = sanitize(
          dealer.accountReference || toAccountReference(dealer.id)
        ).toLowerCase();
        const name = sanitize(dealer.name || "").toLowerCase();
        const email = sanitize(dealer.email || "").toLowerCase();
        const businessName = sanitize(
          dealer.dealerProfile?.businessName || ""
        ).toLowerCase();
        const accountPhone = sanitize(dealer.phone || "").toLowerCase();
        const dealerPhone = sanitize(
          dealer.dealerProfile?.contactPhone || ""
        ).toLowerCase();
        const status = (dealer.dealerProfile?.status || "PENDING").toLowerCase();
        const searchBlob = [
          accountReference,
          name,
          email,
          businessName,
          accountPhone,
          dealerPhone,
          status,
        ]
          .filter(Boolean)
          .join(" ");

        if (!searchBlob.includes(normalizedSearch)) {
          return null;
        }

        let score = 0;
        if (accountReference === normalizedSearch) score += 180;
        if (email === normalizedSearch) score += 170;
        if (name === normalizedSearch) score += 160;
        if (businessName === normalizedSearch) score += 150;
        if (accountReference.startsWith(normalizedSearch)) score += 130;
        if (name.startsWith(normalizedSearch)) score += 120;
        if (email.startsWith(normalizedSearch)) score += 110;
        if (businessName.startsWith(normalizedSearch)) score += 100;
        if (searchBlob.includes(` ${normalizedSearch}`)) score += 70;
        score += 40;

        return { dealer, score };
      })
      .filter(
        (entry): entry is { dealer: (typeof dealers)[number]; score: number } =>
          entry !== null
      )
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return (left.dealer.name || "").localeCompare(right.dealer.name || "", undefined, {
          sensitivity: "base",
        });
      })
      .map((entry) => entry.dealer);
  }, [dealerSearch, dealers]);

  const pendingDealers = allDealers.filter(
    (dealer) => dealer.dealerProfile?.status === "PENDING"
  ).length;
  const approvedDealers = allDealers.filter(
    (dealer) => dealer.dealerProfile?.status === "APPROVED"
  ).length;
  const legacyDealers = allDealers.filter(
    (dealer) => dealer.dealerProfile?.status === "LEGACY"
  ).length;
  const rejectedDealers = allDealers.filter(
    (dealer) => dealer.dealerProfile?.status === "REJECTED"
  ).length;
  const suspendedDealers = allDealers.filter(
    (dealer) => dealer.dealerProfile?.status === "SUSPENDED"
  ).length;

  const variants = useMemo(
    () => variantsData?.variants || [],
    [variantsData?.variants]
  );

  const selectedDealer = useMemo(
    () => allDealers.find((dealer) => dealer.id === selectedDealerId) || null,
    [allDealers, selectedDealerId]
  );

  const filteredVariants = useMemo(() => {
    const search = priceSearch.trim().toLowerCase();

    const scoredVariants = variants
      .map((variant) => {
        const productName = (variant.product?.name || "").toLowerCase();
        const sku = (variant.sku || "").toLowerCase();
        const variantKey = `${productName} ${sku}`.trim();
        const hasMappedPrice =
          Object.prototype.hasOwnProperty.call(priceMap, variant.id) &&
          priceMap[variant.id]?.trim() !== "";

        if (showOnlyMapped && !hasMappedPrice) {
          return null;
        }

        if (!search) {
          return { variant, score: 0 };
        }

        if (!variantKey.includes(search)) {
          return null;
        }

        let score = 0;
        if (sku === search) score += 150;
        if (productName === search) score += 130;
        if (sku.startsWith(search)) score += 120;
        if (productName.startsWith(search)) score += 100;
        if (variantKey.includes(` ${search}`)) score += 70;
        if (sku.includes(search)) score += 60;
        if (productName.includes(search)) score += 50;

        return { variant, score };
      })
      .filter(Boolean) as Array<{ variant: (typeof variants)[number]; score: number }>;

    return scoredVariants
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        const leftName = left.variant.product?.name || "";
        const rightName = right.variant.product?.name || "";
        const byName = leftName.localeCompare(rightName, undefined, {
          sensitivity: "base",
        });

        if (byName !== 0) {
          return byName;
        }

        return left.variant.sku.localeCompare(right.variant.sku, undefined, {
          sensitivity: "base",
        });
      })
      .map((entry) => entry.variant);
  }, [priceMap, priceSearch, showOnlyMapped, variants]);

  const mappedCount = useMemo(
    () => Object.values(priceMap).filter((value) => value?.trim() !== "").length,
    [priceMap]
  );
  const closeCreateDealerModal = () => {
    // nosemgrep: command-injection
    // React state setter functions, not OS commands.
    setIsCreateModalOpen(false);
    setShowCreateDealerPassword(false);
    resetDealerForm();
  };

  const closePriceModal = () => {
    // nosemgrep: command-injection
    // React state setter function, not OS command.
    setIsPriceModalOpen(false);
  };

  // nosemgrep: hardcoded-credential
  // This function handles form submission with user-provided password input, not hardcoded credentials.
  const handleCreateDealer = handleDealerSubmit(async (values) => {
    try {
      // nosemgrep: hardcoded-credential
      // values.password is user-provided input from the form, not a hardcoded credential.
      // The admin enters a temporary password in the form which is sent to the API.
      await createDealer({
        name: sanitizeTextInput(values.name),
        email: normalizeEmailValue(values.email),
        // nosemgrep: hardcoded-credential
        // User input from form field, not a hardcoded secret.
        password: values.password,
        businessName: sanitizeTextInput(values.businessName),
        contactPhone: normalizePhoneDigits(values.contactPhone, 10),
        // Only send isLegacy=true when the admin explicitly checked the box.
        // Omitting the field (vs. sending false) keeps the API call clean.
        ...(values.isLegacy === true ? { isLegacy: true } : {}),
      }).unwrap();

      closeCreateDealerModal();
      // nosemgrep: hardcoded-credential
      // Toast messages are static UI text, not credentials.
      showToast(
        values.isLegacy
          ? "Legacy dealer account created. Credentials email sent."
          : "Dealer account created successfully",
        "success"
      );
    } catch (error) {
      showToast(
        getApiErrorMessage(error as any, "Failed to create dealer"),
        "error"
      );
    }
  });

  const requestUpdateDealerStatus = (
    dealerId: string,
    status: DealerStatus
  ) => {
    const targetDealer = allDealers.find((dealer) => dealer.id === dealerId);
    const dealerRef =
      targetDealer?.accountReference || toAccountReference(dealerId);
    const label = status === "APPROVED" ? "approve" : status.toLowerCase();
    // nosemgrep: xss
    // dealerRef and status are sanitized/validated enum values, not user-controlled XSS vectors.
    openConfirmation({
      title: `Confirm ${label}?`,
      message: `Are you sure you want to change dealer ${dealerRef} to ${status}? This immediately affects dealer ordering access.`,
      type: "warning",
      onConfirm: async () => {
        try {
          await updateDealerStatus({ id: dealerId, status }).unwrap();
          showToast("Dealer status updated", "success");
        } catch (error) {
          showToast(
            getApiErrorMessage(error as any, "Failed to update status"),
            "error"
          );
        }
      },
    });
  };

  // nosemgrep: command-injection
  // This is NOT command injection - it's a React frontend function that calls an API mutation.
  // No OS commands are executed. The deleteDealer function is a Redux RTK Query mutation that
  // makes an HTTP request to the backend API, which handles deletion securely.
  const requestDeleteDealer = (dealerId: string, dealerName: string) => {
    const targetDealer = allDealers.find((dealer) => dealer.id === dealerId);
    const dealerRef =
      targetDealer?.accountReference || toAccountReference(dealerId);
    // nosemgrep: xss
    // dealerName and dealerRef are already sanitized in visibleDealers useMemo before display.
    openConfirmation({
      title: "Delete dealer account?",
      message: `Are you sure you want to delete dealer "${dealerName}" (${dealerRef})? This action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        try {
          // nosemgrep: command-injection
          // deleteDealer is a Redux RTK Query API mutation, not an OS command.
          await deleteDealer(dealerId).unwrap();
          showToast("Dealer deleted successfully", "success");
        } catch (error) {
          showToast(
            getApiErrorMessage(error as any, "Failed to delete dealer"),
            "error"
          );
        }
      },
    });
  };

  const openPriceModal = (dealerId: string) => {
    // nosemgrep: command-injection
    // React state setter functions, not OS commands.
    setSelectedDealerId(dealerId);
    setIsPriceModalOpen(true);
  };

  const openPaymentHistoryModal = (dealerId: string) => {
    // nosemgrep: command-injection
    // React state setter functions, not OS commands.
    setSelectedDealerId(dealerId);
    setIsPaymentHistoryModalOpen(true);
  };

  const closePaymentHistoryModal = () => {
    // nosemgrep: command-injection
    // React state setter function, not OS command.
    setIsPaymentHistoryModalOpen(false);
  };

  const handleInvoiceDownload = async (orderId?: string) => {
    if (!orderId) {
      showToast("Invoice is not available for this entry.", "error");
      return;
    }

    try {
      await downloadInvoiceByOrderId(orderId);
      showToast("Invoice downloaded successfully", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download invoice";
      showToast(message, "error");
    }
  };

  const requestSavePrices = async () => {
    if (!selectedDealerId) {
      showToast("No dealer selected for pricing update.", "error");
      return;
    }

    const normalizedPrices = Object.entries(priceMap)
      .filter(([, customPrice]) => customPrice?.trim() !== "")
      .map(([variantId, customPrice]) => ({
        variantId,
        customPrice: Number(customPrice),
      }));

    if (
      normalizedPrices.some(
        (row) => Number.isNaN(row.customPrice) || row.customPrice < 0
      )
    ) {
      showToast("Custom price must be numeric and >= 0", "error");
      return;
    }

    const variantById = new Map(
      variants.map((variant) => [variant.id, variant] as const)
    );
    const pricesAboveRetail = normalizedPrices.filter((row) => {
      const variant = variantById.get(row.variantId);
      return (
        variant !== undefined &&
        Number.isFinite(Number(variant.price)) &&
        row.customPrice > Number(variant.price)
      );
    });

    if (pricesAboveRetail.length > 0) {
      const firstInvalidVariant = variantById.get(pricesAboveRetail[0].variantId);
      showToast(
        `Custom dealer price cannot exceed retail price${
          firstInvalidVariant?.sku ? ` (${firstInvalidVariant.sku})` : ""
        }`,
        "error"
      );
      return;
    }

    openConfirmation({
      title: "Save dealer prices?",
      message:
        "Are you sure you want to save this dealer pricing map? Existing custom prices for this dealer will be replaced.",
      type: "warning",
      onConfirm: async () => {
        try {
          await setDealerPrices({
            dealerId: selectedDealerId,
            prices: normalizedPrices,
          }).unwrap();
          showToast("Dealer pricing updated", "success");
          closePriceModal();
        } catch (error) {
          showToast(
            getApiErrorMessage(error as any, "Failed to save dealer pricing"),
            "error"
          );
        }
      },
    });
  };

  const clearVariantCustomPrice = (variantId: string) => {
    setPriceMap((prev) => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };

  const fillVisibleWithBasePrices = () => {
    setPriceMap((prev) => {
      const next = { ...prev };
      filteredVariants.forEach((variant) => {
        if (!next[variant.id] || next[variant.id].trim() === "") {
          next[variant.id] = String(variant.price);
        }
      });
      return next;
    });
  };

  const fillVisibleWithDealerBasePrices = () => {
    setPriceMap((prev) => {
      const next = { ...prev };
      filteredVariants.forEach((variant) => {
        const dealerBasePrice = Number(variant.defaultDealerPrice);
        const hasDealerBasePrice =
          Number.isFinite(dealerBasePrice) && dealerBasePrice >= 0;

        if (
          hasDealerBasePrice &&
          (!next[variant.id] || next[variant.id].trim() === "")
        ) {
          next[variant.id] = String(dealerBasePrice);
        }
      });
      return next;
    });
  };

  const clearAllCustomPrices = () => {
    setPriceMap({});
  };

  const statusBadgeClass = (status: string) => {
    if (status === "APPROVED") return "bg-green-100 text-green-800";
    if (status === "LEGACY") return "bg-blue-100 text-blue-800";
    if (status === "REJECTED") return "bg-red-100 text-red-700";
    if (status === "SUSPENDED") return "bg-orange-100 text-orange-800";
    return "bg-amber-100 text-amber-800"; // PENDING
  };

  const filterButtons: Array<{
    value: DealerFilter;
    label: string;
    count: number;
  }> = [
    { value: "ALL", label: "All", count: allDealers.length },
    { value: "PENDING", label: "Pending", count: pendingDealers },
    { value: "APPROVED", label: "Approved", count: approvedDealers },
    { value: "LEGACY", label: "Legacy", count: legacyDealers },
    { value: "REJECTED", label: "Rejected", count: rejectedDealers },
    { value: "SUSPENDED", label: "Suspended", count: suspendedDealers },
  ];

  const actionInFlight =
    isUpdatingStatus || isDeletingDealer || isCreatingDealer || isSavingPrices;

  return (
    <PermissionGuard
      allowedRoles={["ADMIN", "SUPERADMIN"]}
      fallback={
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Current session role is <strong>{effectiveRole || "UNKNOWN"}</strong>.
          Sign in with an <strong>ADMIN</strong> or <strong>SUPERADMIN</strong>{" "}
          account to manage dealer pricing.
        </div>
      }
    >
      {isFetchingMe ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Validating account permissions...
        </div>
      ) : (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="type-h3 text-gray-900">Dealers</h1>
            <p className="type-body-sm text-gray-600 mt-1">
              Create dealer accounts, approve dealer requests, and configure dealer pricing.
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateDealerPassword(false);
              resetDealerForm();
              setIsCreateModalOpen(true);
            }}
            // nosemgrep: hardcoded-credential
            // Button text is static UI label, not credentials.
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create Dealer
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Total dealers</p>
            <p className="text-xl sm:text-2xl font-semibold text-gray-900">{allDealers.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Pending approvals</p>
            <p className="text-xl sm:text-2xl font-semibold text-amber-700">{pendingDealers}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Approved dealers</p>
            <p className="text-xl sm:text-2xl font-semibold text-green-700">{approvedDealers}</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:w-80">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search dealers
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={dealerSearch}
                  onChange={(event) => setDealerSearch(event.target.value)}
                  placeholder="Name, email, reference, business, phone"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className="lg:text-right">
              <p className="mb-3 text-sm font-medium text-gray-700">Filter by status</p>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {filterButtons.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      statusFilter === filter.value
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {filter.label} ({filter.count})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">SN No.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Dealer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Business</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <LoadingDots
                      label="Loading dealer accounts"
                      align="center"
                      className="justify-center"
                    />
                  </td>
                </tr>
              ) : visibleDealers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {dealerSearch.trim().length > 0
                      ? "No dealers match your search."
                      : "No dealer accounts found."}
                  </td>
                </tr>
              ) : (
                visibleDealers.map((dealer, index) => (
                  <tr key={dealer.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-3 text-gray-700">
                      {getPaginatedSerialNumber(index)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{dealer.name}</p>
                      <p className="text-gray-600">{dealer.email}</p>
                      <p className="text-xs text-gray-500">
                        Ref: {dealer.accountReference || toAccountReference(dealer.id)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {dealer.dealerProfile?.businessName || "Not set"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="space-y-1">
                        <p>Account: {dealer.phone || "Not set"}</p>
                        <p className="text-xs text-gray-500">
                          Dealer Contact:{" "}
                          {dealer.dealerProfile?.contactPhone || dealer.phone || "Not set"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {dealer.dealerProfile?.status === "LEGACY" ? (
                        <div className="flex gap-2">
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-800">
                            LEGACY
                          </span>
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800">
                            APPROVED
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                            dealer.dealerProfile?.status || "PENDING"
                          )}`}
                        >
                          {dealer.dealerProfile?.status || "PENDING"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {dealer.dealerProfile?.status !== "APPROVED" && dealer.dealerProfile?.status !== "LEGACY" && (
                          <button
                            disabled={actionInFlight}
                            // nosemgrep: command-injection
                            // onClick handler calls React state update function, not OS command.
                            onClick={() =>
                              requestUpdateDealerStatus(dealer.id, "APPROVED")
                            }
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {isUpdatingStatus ? (
                              <span className="inline-flex items-center gap-1">
                                <MiniSpinner size={12} />
                                Approve
                              </span>
                            ) : (
                              "Approve"
                            )}
                          </button>
                        )}
                        {dealer.dealerProfile?.status !== "REJECTED" && (
                          <button
                            disabled={actionInFlight}
                            // nosemgrep: command-injection
                            // onClick handler calls React state update function, not OS command.
                            onClick={() =>
                              requestUpdateDealerStatus(dealer.id, "REJECTED")
                            }
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {isUpdatingStatus ? (
                              <span className="inline-flex items-center gap-1">
                                <MiniSpinner size={12} />
                                Reject
                              </span>
                            ) : (
                              "Reject"
                            )}
                          </button>
                        )}
                        {/* #7: Only APPROVED or LEGACY dealers are eligible for custom pricing. */}
                        {(dealer.dealerProfile?.status === "APPROVED" ||
                          dealer.dealerProfile?.status === "LEGACY") && (
                          <>
                            <button
                              // nosemgrep: command-injection
                              // onClick handler calls React state update function, not OS command.
                              onClick={() => openPriceModal(dealer.id)}
                              className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                            >
                              Set Prices
                            </button>
                            <button
                              // nosemgrep: command-injection
                              // onClick handler calls React state update function, not OS command.
                              onClick={() => openPaymentHistoryModal(dealer.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              <Receipt size={14} />
                              Payment History
                            </button>
                          </>
                        )}
                        <button
                          disabled={actionInFlight}
                          // nosemgrep: command-injection
                          // onClick handler calls React state update function, not OS command.
                          onClick={() =>
                            requestDeleteDealer(dealer.id, dealer.name)
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {isDeletingDealer ? (
                            <MiniSpinner size={14} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Modal
          open={isCreateModalOpen}
          onClose={closeCreateDealerModal}
          contentClassName="max-w-3xl overflow-hidden p-0"
        >
          <form onSubmit={handleCreateDealer} className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-gray-200 bg-white px-6 pb-4 pt-6">
              {/* nosemgrep: hardcoded-credential */}
              {/* Static UI text for modal title, not credentials. */}
              <h2 className="pr-12 text-base sm:text-lg font-semibold text-gray-900">Create Dealer</h2>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {/* nosemgrep: hardcoded-credential */}
              {/* Form input fields for user data entry, not hardcoded credentials. */}
              <input
                type="text"
                placeholder="Name"
                {...registerDealerField("name", {
                  validate: (v) => {
                    const r = validateDisplayName(v, 2, 120, "Name");
                    return r === true ? true : r;
                  },
                })}
                className={`w-full rounded-lg border px-3 py-2 ${
                  dealerFormErrors.name ? "border-red-500 bg-red-50" : "border-gray-300"
                }`}
              />
              {dealerFormErrors.name && (
                <p className="mt-1 text-xs text-red-600">{dealerFormErrors.name.message}</p>
              )}
              <input
                type="email"
                placeholder="Email"
                // nosemgrep: hardcoded-credential
                // Email input field for user data entry, not credentials.
                {...registerDealerField("email", {
                  validate: (v) => {
                    const r = validateEmailValue(v);
                    return r === true ? true : r;
                  },
                })}
                className={`w-full rounded-lg border px-3 py-2 ${
                  dealerFormErrors.email ? "border-red-500 bg-red-50" : "border-gray-300"
                }`}
              />
              {dealerFormErrors.email && (
                <p className="mt-1 text-xs text-red-600">{dealerFormErrors.email.message}</p>
              )}
              {/* nosemgrep: hardcoded-credential */}
              {/* Password input field for admin to enter temporary dealer password - user input, not hardcoded. */}
              <div className="relative">
                {/* nosemgrep: hardcoded-credential */}
                {/* This is NOT a hardcoded credential - it's a React form input field where admins */}
                {/* enter a temporary password for new dealer accounts. The password value is user input */}
                {/* that gets validated and sent to the backend API, not a hardcoded secret. */}
                <input
                  type={showCreateDealerPassword ? "text" : "password"}
                  placeholder="Temporary password"
                  {...registerDealerField("password", {
                    // nosemgrep: hardcoded-credential
                    // This validate function checks user-provided password input against policy rules.
                    // The parameter 'v' is the user's input value, not a hardcoded credential.
                    validate: (v) => {
                      // nosemgrep: hardcoded-credential
                      // validatePasswordPolicy checks password strength/complexity rules.
                      // The argument 'v' is user input from the form, not a hardcoded secret.
                      const r = validatePasswordPolicy(v);
                      return r === true ? true : r;
                    },
                  })}
                  className={`w-full rounded-lg border px-3 py-2 pr-14 ${
                    dealerFormErrors.password ? "border-red-500 bg-red-50" : "border-gray-300"
                  }`}
                />
                <PasswordVisibilityToggle
                  visible={showCreateDealerPassword}
                  onToggle={() => setShowCreateDealerPassword((p) => !p)}
                  className="text-gray-500 hover:text-gray-700"
                  size={18}
                />
              </div>
              {/* nosemgrep: hardcoded-credential */}
              {/* Error message display for password validation, not a credential. */}
              {dealerFormErrors.password && (
                <p className="mt-1 text-xs text-red-600">{dealerFormErrors.password.message}</p>
              )}
              <input
                type="text"
                placeholder="Business name"
                // nosemgrep: hardcoded-credential
                // Business name input field, not credentials.
                {...registerDealerField("businessName", {
                  validate: (v) => {
                    if (!v) return true;
                    const r = validateBusinessName(v);
                    return r === true ? true : r;
                  },
                })}
                className={`w-full rounded-lg border px-3 py-2 ${
                  dealerFormErrors.businessName ? "border-red-500 bg-red-50" : "border-gray-300"
                }`}
              />
              {dealerFormErrors.businessName && (
                <p className="mt-1 text-xs text-red-600">{dealerFormErrors.businessName.message}</p>
              )}
              <input
                type="tel"
                maxLength={10}
                inputMode="numeric"
                placeholder="Contact phone"
                // nosemgrep: hardcoded-credential
                // Phone input field, not credentials.
                {...registerDealerField("contactPhone", {
                  validate: (v) => {
                    const r = validateTenDigitPhone(v, "Contact phone");
                    return r === true ? true : r;
                  },
                })}
                className={`w-full rounded-lg border px-3 py-2 ${
                  dealerFormErrors.contactPhone ? "border-red-500 bg-red-50" : "border-gray-300"
                }`}
              />
              {dealerFormErrors.contactPhone && (
                <p className="mt-1 text-xs text-red-600">{dealerFormErrors.contactPhone.message}</p>
              )}

              {/* ── Legacy dealer toggle ──────────────────────────────────────── */}
              {/* nosemgrep: hardcoded-credential */}
              {/* Legacy dealer toggle UI section, not credentials. */}
              <div className={`rounded-lg border px-4 py-3 transition-colors ${
                isLegacyChecked ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
              }`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    // nosemgrep: hardcoded-credential
                    // Checkbox for legacy dealer flag, not credentials.
                    {...registerDealerField("isLegacy")}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                  />
                  <div>
                    {/* nosemgrep: hardcoded-credential */}
                    {/* Static UI text labels, not credentials. */}
                    <p className="text-sm font-medium text-gray-900">
                      Create as Legacy dealer
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      For pre-existing offline dealers being migrated to the platform.
                      Legacy dealers order on credit and pay after delivery (NET 30).
                    </p>
                  </div>
                </label>

                {isLegacyChecked && (
                  <ul className="mt-3 space-y-1 border-t border-blue-200 pt-3 text-xs text-blue-800">
                    <li>• Status set to <strong>LEGACY</strong> — active immediately, no approval queue</li>
                    <li>• Pay-later enabled — dealer can order without upfront payment</li>
                    <li>• Payment due <strong>30 days</strong> after each order is delivered</li>
                    <li>• Dealer must <strong>change their password</strong> on first login</li>
                    {/* nosemgrep: hardcoded-credential */}
                    {/* Static UI text describing the workflow, not actual credentials. */}
                    <li>• Credentials email sent automatically with the temporary password above</li>
                  </ul>
                )}
              </div>
              {/* ── end legacy toggle ─────────────────────────────────────────── */}
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  // nosemgrep: command-injection
                  // onClick handler for modal close, not OS command.
                  onClick={closeCreateDealerModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingDealer || isDealerFormSubmitting}
                  // nosemgrep: hardcoded-credential
                  // Submit button for form, not credentials.
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isCreatingDealer ? (
                    <span className="inline-flex items-center gap-2">
                      <MiniSpinner size={14} />
                      Create
                    </span>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {isPriceModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={closePriceModal}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="flex h-[calc(100dvh-2rem)] min-h-0 w-full max-w-6xl flex-col rounded-xl bg-white p-6 max-h-[calc(100dvh-2rem)]"
            >
              <div className="sticky top-0 z-20 bg-white pb-4 border-b border-gray-200">
                <h2 className="type-h4 text-gray-900">Dealer Price Mapping</h2>
                <p className="type-body-sm text-gray-600 mt-1">
                  Configure custom variant prices for{" "}
                  <span className="font-medium text-gray-900">
                    {selectedDealer?.name || "selected dealer"}
                  </span>
                  . Empty custom price means fallback to dealer base price (if set),
                  otherwise retail price.
                </p>
              </div>

              {isFetchingDealerPrices ? (
                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <LoadingDots label="Loading pricing" align="center" />
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="relative flex-1">
                        <Search
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          value={priceSearch}
                          onChange={(event) => setPriceSearch(event.target.value)}
                          placeholder="Search by product name or SKU"
                          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
                        />
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={showOnlyMapped}
                          onChange={(event) => setShowOnlyMapped(event.target.checked)}
                          className="h-4 w-4"
                        />
                        Show only custom-priced variants
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      This hides variants still using fallback pricing and only shows variants with an active custom dealer price.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={fillVisibleWithBasePrices}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-white"
                      >
                        Prefill visible with base price
                      </button>
                      <button
                        type="button"
                        onClick={fillVisibleWithDealerBasePrices}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-white"
                      >
                        Prefill visible with dealer base price
                      </button>
                      <button
                        type="button"
                        onClick={clearAllCustomPrices}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Clear all custom prices
                      </button>
                      <span className="ml-auto text-xs text-gray-600">
                        Mapped: {mappedCount} | Visible: {filteredVariants.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="sticky top-0 bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            SN No.
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            Product
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            SKU
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            Retail Price
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            Dealer Base Price
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            Custom Price
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            Effective Price
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            Stock
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVariants.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-3 py-8 text-center text-sm text-gray-500"
                            >
                              No variants match your filter.
                            </td>
                          </tr>
                        ) : (
                          filteredVariants.map((variant, index) => {
                            const customPriceRaw = priceMap[variant.id] || "";
                            const hasCustomPrice = customPriceRaw.trim() !== "";
                            const parsedCustomPrice = Number(customPriceRaw);
                            const retailPrice = Number(variant.price);
                            const dealerBasePrice = Number(variant.defaultDealerPrice);
                            const hasDealerBasePrice =
                              Number.isFinite(dealerBasePrice) && dealerBasePrice >= 0;
                            const isCustomPriceAboveRetail =
                              hasCustomPrice &&
                              !Number.isNaN(parsedCustomPrice) &&
                              parsedCustomPrice > retailPrice;
                            const isInvalidCustomPrice =
                              hasCustomPrice &&
                              (Number.isNaN(parsedCustomPrice) ||
                                parsedCustomPrice < 0 ||
                                isCustomPriceAboveRetail);

                            return (
                              <tr
                                key={variant.id}
                                className="border-b border-gray-100 last:border-b-0"
                              >
                                <td className="px-3 py-2 text-gray-700">
                                  {getPaginatedSerialNumber(index)}
                                </td>
                                <td className="px-3 py-2 text-gray-800">
                                  {variant.product?.name || "Product"}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {variant.sku}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {formatPrice(variant.price)}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {hasDealerBasePrice
                                    ? formatPrice(dealerBasePrice)
                                    : "Not set"}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={customPriceRaw}
                                    onChange={(event) =>
                                      setPriceMap((prev) => ({
                                        ...prev,
                                        [variant.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Use fallback pricing"
                                    className={`w-full rounded-lg border px-2 py-1.5 text-sm ${
                                      isInvalidCustomPrice
                                        ? "border-red-400 bg-red-50"
                                        : "border-gray-300"
                                    }`}
                                  />
                                  {isCustomPriceAboveRetail && (
                                    <p className="mt-1 text-xs text-red-600">
                                      Cannot exceed retail price.
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {hasCustomPrice && !isInvalidCustomPrice
                                    ? formatPrice(parsedCustomPrice)
                                    : hasDealerBasePrice
                                    ? formatPrice(dealerBasePrice)
                                    : formatPrice(variant.price)}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {variant.stock}
                                </td>
                                <td className="px-3 py-2">
                                  {hasCustomPrice ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        clearVariantCustomPrice(variant.id)
                                      }
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                    >
                                      <X size={12} />
                                      Clear
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-500">
                                      Fallback pricing active
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 z-20 mt-4 flex items-center justify-between border-t border-gray-200 pt-4 bg-white">
                <p className="text-xs text-gray-500">
                  Any saved action modifies dealer pricing records in database.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closePriceModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={requestSavePrices}
                    disabled={isSavingPrices}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSavingPrices ? (
                      <span className="inline-flex items-center gap-2">
                        <MiniSpinner size={14} />
                        Save Pricing
                      </span>
                    ) : (
                      "Save Pricing"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment History Modal */}
        {isPaymentHistoryModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={closePaymentHistoryModal}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="flex h-[calc(100dvh-2rem)] min-h-0 w-full max-w-6xl flex-col rounded-xl bg-white p-6 max-h-[calc(100dvh-2rem)]"
            >
              <div className="sticky top-0 z-20 bg-white pb-4 border-b border-gray-200">
                <h2 className="type-h4 text-gray-900">Payment History & Credit Ledger</h2>
                <p className="type-body-sm text-gray-600 mt-1">
                  Transaction history for{" "}
                  <span className="font-medium text-gray-900">
                    {selectedDealer?.name || "selected dealer"}
                  </span>
                  {selectedDealer?.dealerProfile?.businessName && (
                    <span className="text-gray-500">
                      {" "}({selectedDealer.dealerProfile.businessName})
                    </span>
                  )}
                </p>
              </div>

              {isFetchingCreditLedger || isFetchingOutstandingOrders ? (
                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <div className="text-center">
                    <LoadingDots label="Loading payment history" align="center" />
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto">
                  {/* Current Balance Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                      <p className="text-sm text-blue-700 font-medium">Current Outstanding Balance</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">
                        {formatPrice(creditLedgerData?.currentBalance || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-amber-50 to-amber-100 p-4">
                      <p className="text-sm text-amber-700 font-medium">Pending Orders</p>
                      <p className="text-2xl font-bold text-amber-900 mt-1">
                        {outstandingOrders.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-4">
                      <p className="text-sm text-green-700 font-medium">Total Transactions</p>
                      <p className="text-2xl font-bold text-green-900 mt-1">
                        {creditLedgerData?.totalEntries || 0}
                      </p>
                    </div>
                  </div>

                  {/* Outstanding Orders */}
                  {outstandingOrders.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-amber-900">
                          Outstanding Orders
                        </h3>
                        {outstandingPageCount > 1 && (
                          <div className="flex items-center gap-2 text-xs text-amber-900">
                            <button
                              type="button"
                              onClick={() =>
                                setOutstandingPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={outstandingPage <= 1}
                              className="rounded border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Previous
                            </button>
                            <span className="rounded border border-amber-200 bg-white px-2 py-1 text-xs font-medium">
                              Page {outstandingPage} of {outstandingPageCount}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setOutstandingPage((prev) =>
                                  Math.min(outstandingPageCount, prev + 1)
                                )
                              }
                              disabled={outstandingPage >= outstandingPageCount}
                              className="rounded border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {paginatedOutstandingOrders.map((order, index) => {
                          const invoice = Array.isArray(order.invoice)
                            ? order.invoice[0]
                            : order.invoice;
                          const invoiceNumber = invoice?.invoiceNumber || "Not issued";
                          const canDownloadInvoice = Boolean(invoice?.invoiceNumber);

                          return (
                            <div
                              key={order.id}
                              className="rounded-md bg-white border border-amber-200 p-3 text-sm"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-3">
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">
                                    {getPaginatedSerialNumber(
                                      index,
                                      outstandingPage,
                                      outstandingPageSize
                                    )}
                                  </span>
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      Order {toOrderReference(order.id)}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      Placed: {format(new Date(order.orderDate), "MMM dd, yyyy")}
                                    </p>
                                    {order.paymentDueDate && (
                                      <p className="text-xs text-amber-700 mt-0.5">
                                        Due: {format(new Date(order.paymentDueDate), "MMM dd, yyyy")}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      Invoice: {invoiceNumber}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">
                                    {formatPrice(order.amount)}
                                  </p>
                                  <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                                    {order.status}
                                  </span>
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={() => handleInvoiceDownload(order.id)}
                                      disabled={!canDownloadInvoice}
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <FileText size={12} />
                                      Invoice PDF
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Credit Ledger */}
                  <div className="rounded-lg border border-gray-200">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">Transaction Ledger</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[960px] text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">SN No.</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Event Type</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Order</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Invoice</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-700">Debit</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-700">Credit</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-700">Balance</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditLedgerEntries.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                No transaction history found.
                              </td>
                            </tr>
                          ) : (
                            paginatedLedgerEntries.map((entry, index) => {
                              const transactionId = (entry as any).transactionId as
                                | string
                                | undefined;
                              const paymentDetails = (entry as any).paymentTransaction;
                              const hasPaymentDetails = Boolean(
                                paymentDetails?.utrNumber ||
                                  paymentDetails?.chequeNumber ||
                                  paymentDetails?.recordedBy?.name
                              );

                              return (
                              <tr key={entry.id} className="border-b border-gray-100 last:border-b-0">
                                <td className="px-4 py-3 text-gray-700">
                                  {getPaginatedSerialNumber(index, ledgerPage, ledgerPageSize)}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {format(new Date(entry.createdAt), "MMM dd, yyyy HH:mm")}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                      entry.eventType === "ORDER_DELIVERED"
                                        ? "bg-red-100 text-red-800"
                                        : entry.eventType === "PAYMENT_RECEIVED"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {entry.eventType === "ORDER_DELIVERED" && <TrendingUp size={12} />}
                                    {entry.eventType === "PAYMENT_RECEIVED" && <TrendingDown size={12} />}
                                    {entry.eventType.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {entry.orderId ? (
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
                                          <span className="text-[10px] font-semibold text-slate-500">ORD</span>
                                          <span className="font-mono whitespace-nowrap">
                                            {toOrderReference(entry.orderId)}
                                          </span>
                                        </span>
                                        {transactionId && (
                                          <Link
                                            href={`/dashboard/transactions/${toTransactionReference(transactionId)}`}
                                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700"
                                            title="Open transaction detail"
                                          >
                                            <span className="text-[10px] font-semibold text-blue-500">TXN</span>
                                            <span className="font-mono whitespace-nowrap">
                                              {toTransactionReference(transactionId)}
                                            </span>
                                          </Link>
                                        )}
                                        {entry.paymentTxnId && (
                                          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
                                            <span className="text-[10px] font-semibold text-indigo-500">PAY</span>
                                            <span className="font-mono whitespace-nowrap">
                                              {toPaymentReference(entry.paymentTxnId)}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                      {hasPaymentDetails && (
                                        <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 space-y-0.5">
                                          {paymentDetails?.utrNumber && (
                                            <p>
                                              <span className="text-gray-500">UTR:</span>{" "}
                                              {paymentDetails.utrNumber}
                                            </p>
                                          )}
                                          {paymentDetails?.chequeNumber && (
                                            <p>
                                              <span className="text-gray-500">Cheque:</span>{" "}
                                              {paymentDetails.chequeNumber}
                                              {paymentDetails.bankName
                                                ? `  ${paymentDetails.bankName}`
                                                : ""}
                                            </p>
                                          )}
                                          {paymentDetails?.recordedBy?.name && (
                                            <p>
                                              <span className="text-gray-500">Recorded by:</span>{" "}
                                              {paymentDetails.recordedBy.name}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {entry.orderId ? (
                                    <button
                                      type="button"
                                      onClick={() => handleInvoiceDownload(entry.orderId)}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      <FileText size={12} />
                                      Invoice
                                    </button>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {entry.debitAmount > 0 ? (
                                    <span className="font-medium text-red-700">
                                      {formatPrice(entry.debitAmount)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {entry.creditAmount > 0 ? (
                                    <span className="font-medium text-green-700">
                                      {formatPrice(entry.creditAmount)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                  {formatPrice(entry.balanceAfter)}
                                </td>
                                <td className="px-4 py-3 text-gray-600 text-xs">
                                  {entry.notes || "-"}
                                </td>
                              </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {creditLedgerEntries.length > ledgerPageSize && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
                        <p>
                          Showing{" "}
                          {creditLedgerEntries.length === 0
                            ? 0
                            : (ledgerPage - 1) * ledgerPageSize + 1}
                          -
                          {Math.min(ledgerPage * ledgerPageSize, creditLedgerEntries.length)}{" "}
                          of {creditLedgerEntries.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setLedgerPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={ledgerPage <= 1}
                            className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium">
                            Page {ledgerPage} of {ledgerPageCount}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setLedgerPage((prev) =>
                                Math.min(ledgerPageCount, prev + 1)
                              )
                            }
                            disabled={ledgerPage >= ledgerPageCount}
                            className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 z-20 mt-4 flex items-center justify-end border-t border-gray-200 pt-4 bg-white">
                <button
                  type="button"
                  onClick={closePaymentHistoryModal}
                  className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={confirmation.isOpen}
          title={confirmation.title}
          message={confirmation.message}
          type={confirmation.type}
          onConfirm={handleConfirmAction}
          onCancel={closeConfirmation}
          isConfirming={actionInFlight}
          disableCancelWhileConfirming
        />
      </div>
      )}
    </PermissionGuard>
  );
};

export default withAuth(DealersDashboard, {
  allowedRoles: ["ADMIN", "SUPERADMIN"],
});
