"use client";
import {
  CheckoutDeliveryMode,
  CheckoutSummary as CheckoutSummaryData,
  useGetCheckoutSummaryMutation,
  useInitiateCheckoutMutation,
} from "@/app/store/apis/CheckoutApi";
import {
  Address,
  AddressType,
  useCreateAddressMutation,
  useGetAddressesQuery,
  useSetDefaultAddressMutation,
} from "@/app/store/apis/AddressApi";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useToast from "@/app/hooks/ui/useToast";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toOrderReference } from "@/app/lib/utils/accountReference";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import Dropdown from "@/app/components/molecules/Dropdown";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import {
  ADDRESS_STATE_OPTIONS,
  AddressFieldErrors,
  INDIA_COUNTRY_NAME,
  getAddressCitiesByState,
  getAddressFieldErrors,
  getAddressValidationError,
  normalizeAddressPayload,
  normalizeAddressPhone,
  normalizeAddressPincode,
} from "@/app/lib/validators/address";

interface CartSummaryProps {
  subtotal: number;
  totalItems: number;
}

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

type AddressInputMode = "saved" | "new";

type AddressTouchedFields = Partial<Record<keyof AddressFieldErrors, boolean>>;

type CheckoutSuccessState = {
  isOpen: boolean;
  orderReference: string | null;
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
  country: INDIA_COUNTRY_NAME,
  pincode: "",
  isDefault: false,
});

const parseAddresses = (payload: unknown): Address[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const typedPayload = payload as {
    addresses?: Address[];
    data?: { addresses?: Address[] };
  };

  return typedPayload.addresses || typedPayload.data?.addresses || [];
};

const parseAddress = (payload: unknown): Address | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typedPayload = payload as {
    address?: Address;
    data?: { address?: Address };
  };

  return typedPayload.address || typedPayload.data?.address || null;
};

const parseCheckoutSummary = (payload: unknown): CheckoutSummaryData | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typedPayload = payload as
    | CheckoutSummaryData
    | { data?: CheckoutSummaryData };

  const summary =
    "finalTotal" in typedPayload ? typedPayload : typedPayload.data;

  if (!summary || typeof summary.finalTotal !== "number") {
    return null;
  }

  return summary;
};

const CartSummary: React.FC<CartSummaryProps> = ({ subtotal, totalItems }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formatPrice = useFormatPrice();
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [checkoutSuccessState, setCheckoutSuccessState] =
    useState<CheckoutSuccessState | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [deliveryMode, setDeliveryMode] =
    useState<CheckoutDeliveryMode>("DELIVERY");
  const [checkoutSummary, setCheckoutSummary] =
    useState<CheckoutSummaryData | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [hasReviewedPriceBreakup, setHasReviewedPriceBreakup] = useState(false);
  const [isSummaryHighlighted, setIsSummaryHighlighted] = useState(false);
  const [addressInputMode, setAddressInputMode] =
    useState<AddressInputMode>("saved");
  const [addressForm, setAddressForm] = useState<AddressFormState>(
    getEmptyAddressForm()
  );
  const [addressSubmitAttempted, setAddressSubmitAttempted] = useState(false);
  const [addressTouchedFields, setAddressTouchedFields] = useState<AddressTouchedFields>(
    {}
  );
  const addressFieldErrors = useMemo(
    () =>
      getAddressFieldErrors({
        fullName: addressForm.fullName,
        phoneNumber: addressForm.phoneNumber,
        line1: addressForm.line1,
        line2: addressForm.line2,
        landmark: addressForm.landmark,
        city: addressForm.city,
        state: addressForm.state,
        country: addressForm.country,
        pincode: addressForm.pincode,
      }),
    [addressForm]
  );
  const markAddressFieldTouched = (field: keyof AddressFieldErrors) => {
    setAddressTouchedFields((previous) => ({ ...previous, [field]: true }));
  };
  const getVisibleAddressFieldError = (field: keyof AddressFieldErrors, value: string) => {
    const error = addressFieldErrors[field];
    if (!error) {
      return null;
    }

    if (addressSubmitAttempted || addressTouchedFields[field] || value.trim().length > 0) {
      return error;
    }

    return null;
  };
  const availableCities = useMemo(
    () => getAddressCitiesByState(addressForm.state),
    [addressForm.state]
  );
  const checkoutInFlightRef = useRef(false);
  const orderSummaryRef = useRef<HTMLDivElement | null>(null);
  const orderSummaryHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const shouldFocusSummaryOnNextSuccessRef = useRef(false);
  const summaryHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const latestSummaryRequestRef = useRef("");
  const checkoutSuccessRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const {
    data: addressesResponse,
    isLoading: isAddressesLoading,
    isFetching: isAddressesFetching,
  } = useGetAddressesQuery(undefined, {
    skip: !isAuthenticated,
  });

  const [createAddress, { isLoading: isCreatingAddress }] =
    useCreateAddressMutation();
  const [setDefaultAddress, { isLoading: isSettingDefaultAddress }] =
    useSetDefaultAddressMutation();
  const [getCheckoutSummary, { isLoading: isCalculatingSummary }] =
    useGetCheckoutSummaryMutation();

  const [initiateCheckout, { isLoading: isPlacingOrder }] =
    useInitiateCheckoutMutation();

  const addresses = useMemo(
    () => parseAddresses(addressesResponse),
    [addressesResponse]
  );
  const hasSavedAddresses = addresses.length > 0;

  const defaultAddressId = useMemo(() => {
    const defaultAddress = addresses.find((address) => address.isDefault);
    return defaultAddress?.id || addresses[0]?.id || "";
  }, [addresses]);

  const summarySubtotal = checkoutSummary?.subtotalAmount ?? subtotal;
  const summaryDeliveryCharge = checkoutSummary?.deliveryCharge;
  const summaryFinalTotal = checkoutSummary?.finalTotal ?? summarySubtotal;
  const activeDeliveryLabel =
    checkoutSummary?.deliveryLabel ||
    (deliveryMode === "PICKUP" ? "In-Store Pickup" : "Delivery");
  const isBusy =
    isPlacingOrder ||
    isSubmittingCheckout ||
    isCalculatingSummary ||
    isCreatingAddress ||
    isSettingDefaultAddress;
  const canReviewPriceBreakup =
    !!checkoutSummary &&
    !summaryError &&
    !isCalculatingSummary &&
    (deliveryMode === "PICKUP" || !!selectedAddressId);
  const shouldShowAddressUnlockNote =
    deliveryMode === "DELIVERY" && !selectedAddressId;

  const currentPathWithSearch = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const focusOrderSummary = useCallback(() => {
    const targetNode = orderSummaryHeadingRef.current || orderSummaryRef.current;
    if (!targetNode) {
      return;
    }

    if (typeof window !== "undefined") {
      const topOverlayHeight = (() => {
        const intervals = Array.from(
          document.body.querySelectorAll<HTMLElement>("*")
        )
          .map((node) => {
            const style = window.getComputedStyle(node);
            if (style.display === "none" || style.visibility === "hidden") {
              return null;
            }

            if (style.position !== "fixed" && style.position !== "sticky") {
              return null;
            }

            const rect = node.getBoundingClientRect();
            if (rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) {
              return null;
            }

            return {
              top: Math.max(rect.top, 0),
              bottom: Math.max(rect.bottom, 0),
            };
          })
          .filter(
            (
              interval
            ): interval is {
              top: number;
              bottom: number;
            } => interval !== null
          )
          .sort((a, b) => a.top - b.top);

        let coveredTop = 0;
        for (const interval of intervals) {
          if (interval.top > coveredTop + 1) {
            continue;
          }
          if (interval.bottom > coveredTop) {
            coveredTop = interval.bottom;
          }
        }

        return coveredTop;
      })();

      const targetTop =
        targetNode.getBoundingClientRect().top + window.scrollY - topOverlayHeight;
      window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
      window.requestAnimationFrame(() => {
        orderSummaryHeadingRef.current?.focus({ preventScroll: true });
      });
    }
  }, []);

  const focusAndHighlightSummary = useCallback(() => {
    focusOrderSummary();
    if (summaryHighlightTimerRef.current) {
      clearTimeout(summaryHighlightTimerRef.current);
    }
    setIsSummaryHighlighted(true);
    summaryHighlightTimerRef.current = setTimeout(() => {
      setIsSummaryHighlighted(false);
      summaryHighlightTimerRef.current = null;
    }, 1800);
  }, [focusOrderSummary]);

  const clearCheckoutSuccessRedirectTimer = useCallback(() => {
    if (checkoutSuccessRedirectTimerRef.current) {
      clearTimeout(checkoutSuccessRedirectTimerRef.current);
      checkoutSuccessRedirectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (summaryHighlightTimerRef.current) {
        clearTimeout(summaryHighlightTimerRef.current);
      }
      clearCheckoutSuccessRedirectTimer();
    };
  }, [clearCheckoutSuccessRedirectTimer]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!hasSavedAddresses) {
      setSelectedAddressId("");
      setCheckoutSummary(null);
      setSummaryError(null);
      latestSummaryRequestRef.current = "";
      return;
    }

    if (addressInputMode === "new") {
      return;
    }

    setSelectedAddressId((previous) => {
      if (previous && addresses.some((address) => address.id === previous)) {
        return previous;
      }
      return defaultAddressId;
    });
  }, [
    addressInputMode,
    addresses,
    defaultAddressId,
    hasSavedAddresses,
    isAuthenticated,
  ]);

  const requestCheckoutSummary = useCallback(
    async (force = false) => {
      const requiresAddress = deliveryMode === "DELIVERY";
      const effectiveAddressId = requiresAddress ? selectedAddressId : undefined;

      if (totalItems <= 0 || (requiresAddress && !effectiveAddressId)) {
        setCheckoutSummary(null);
        setSummaryError(null);
        shouldFocusSummaryOnNextSuccessRef.current = false;
        latestSummaryRequestRef.current = "";
        return null;
      }

      const requestKey = [
        effectiveAddressId || "PICKUP",
        deliveryMode,
        subtotal,
        totalItems,
      ].join(":");

      if (
        !force &&
        latestSummaryRequestRef.current === requestKey &&
        checkoutSummary
      ) {
        if (shouldFocusSummaryOnNextSuccessRef.current) {
          focusAndHighlightSummary();
          shouldFocusSummaryOnNextSuccessRef.current = false;
        }
        return checkoutSummary;
      }

      latestSummaryRequestRef.current = requestKey;
      setSummaryError(null);

      try {
        const response = await getCheckoutSummary(
          effectiveAddressId
            ? {
                addressId: effectiveAddressId,
                deliveryMode,
              }
            : {
                deliveryMode,
              }
        ).unwrap();
        const parsedSummary = parseCheckoutSummary(response);

        if (!parsedSummary) {
          throw new Error("Unable to calculate checkout summary.");
        }

        setCheckoutSummary(parsedSummary);
        if (shouldFocusSummaryOnNextSuccessRef.current) {
          focusAndHighlightSummary();
          shouldFocusSummaryOnNextSuccessRef.current = false;
        }
        return parsedSummary;
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Unable to calculate checkout summary. Please verify address and delivery mode."
        );
        setCheckoutSummary(null);
        setSummaryError(message);
        shouldFocusSummaryOnNextSuccessRef.current = false;
        return null;
      }
    },
    [
      checkoutSummary,
      deliveryMode,
      focusAndHighlightSummary,
      getCheckoutSummary,
      selectedAddressId,
      subtotal,
      totalItems,
    ]
  );

  useEffect(() => {
    const requiresAddress = deliveryMode === "DELIVERY";
    if (
      !isAuthenticated ||
      (requiresAddress && addressInputMode !== "saved") ||
      (requiresAddress && !selectedAddressId) ||
      totalItems <= 0
    ) {
      return;
    }

    void requestCheckoutSummary();
  }, [
    addressInputMode,
    deliveryMode,
    isAuthenticated,
    requestCheckoutSummary,
    selectedAddressId,
    totalItems,
  ]);

  useEffect(() => {
    if (summaryError) {
      setHasReviewedPriceBreakup(false);
    }
  }, [summaryError]);

  const handleAddressInputChange = (
    key: keyof AddressFormState,
    value: string | boolean
  ) => {
    if (key === "state" && typeof value === "string") {
      setAddressForm((previous) => ({
        ...previous,
        state: value,
        city: "",
        country: INDIA_COUNTRY_NAME,
      }));
      return;
    }

    if (key === "city" && typeof value === "string") {
      setAddressForm((previous) => ({
        ...previous,
        city: value,
      }));
      return;
    }

    if (key === "country" && typeof value === "string") {
      setAddressForm((previous) => ({
        ...previous,
        country: INDIA_COUNTRY_NAME,
      }));
      return;
    }

    if (key === "phoneNumber" && typeof value === "string") {
      setAddressForm((previous) => ({
        ...previous,
        phoneNumber: normalizeAddressPhone(value),
      }));
      return;
    }

    if (key === "pincode" && typeof value === "string") {
      setAddressForm((previous) => ({
        ...previous,
        pincode: normalizeAddressPincode(value),
      }));
      return;
    }

    setAddressForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleCreateAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddressSubmitAttempted(true);

    const normalizedAddress = normalizeAddressPayload({
      fullName: addressForm.fullName,
      phoneNumber: addressForm.phoneNumber,
      line1: addressForm.line1,
      line2: addressForm.line2,
      landmark: addressForm.landmark,
      city: addressForm.city,
      state: addressForm.state,
      country: addressForm.country,
      pincode: addressForm.pincode,
    });

    const addressValidationError = getAddressValidationError(normalizedAddress);
    if (addressValidationError) {
      showToast(addressValidationError, "error");
      return;
    }

    try {
      const response = await createAddress({
        type: addressForm.type,
        fullName: normalizedAddress.fullName,
        phoneNumber: normalizedAddress.phoneNumber,
        line1: normalizedAddress.line1,
        line2: normalizedAddress.line2 || undefined,
        landmark: normalizedAddress.landmark || undefined,
        city: normalizedAddress.city,
        state: normalizedAddress.state,
        country: normalizedAddress.country,
        pincode: normalizedAddress.pincode,
        isDefault: addressForm.isDefault,
      }).unwrap();

      const createdAddress = parseAddress(response);
      if (createdAddress?.id) {
        setSelectedAddressId(createdAddress.id);
        setAddressInputMode("saved");
      }

      setAddressForm(getEmptyAddressForm());
      setAddressSubmitAttempted(false);
      setAddressTouchedFields({});
      setHasReviewedPriceBreakup(false);
      shouldFocusSummaryOnNextSuccessRef.current = true;
      latestSummaryRequestRef.current = "";
      showToast("Address saved successfully.", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to save address."), "error");
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await setDefaultAddress(addressId).unwrap();
      showToast("Default address updated.", "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to set default address."), "error");
    }
  };

  const fullNameAddressError = getVisibleAddressFieldError(
    "fullName",
    addressForm.fullName
  );
  const phoneAddressError = getVisibleAddressFieldError(
    "phoneNumber",
    addressForm.phoneNumber
  );
  const line1AddressError = getVisibleAddressFieldError("line1", addressForm.line1);
  const cityAddressError = getVisibleAddressFieldError("city", addressForm.city);
  const stateAddressError = getVisibleAddressFieldError("state", addressForm.state);
  const countryAddressError = getVisibleAddressFieldError(
    "country",
    addressForm.country
  );
  const pincodeAddressError = getVisibleAddressFieldError(
    "pincode",
    addressForm.pincode
  );
  const hasAddressValidationErrors = Object.values(addressFieldErrors).some(Boolean);

  const handleInitiateCheckout = async () => {
    if (checkoutInFlightRef.current || isPlacingOrder) {
      return;
    }

    const requiresAddress = deliveryMode === "DELIVERY";
    if (requiresAddress && !selectedAddressId) {
      showToast("Please select an address before checkout.", "error");
      return;
    }

    const resolvedSummary = await requestCheckoutSummary(true);
    if (!resolvedSummary) {
      showToast(
        summaryError ||
          "Checkout summary is not ready. Please verify address and delivery mode.",
        "error"
      );
      return;
    }

    checkoutInFlightRef.current = true;
    setIsSubmittingCheckout(true);

    try {
      const checkoutPayload = requiresAddress
        ? {
            addressId: selectedAddressId,
            deliveryMode,
          }
        : {
            deliveryMode,
          };

      const res = await initiateCheckout(checkoutPayload).unwrap();
      const responsePayload = (res as any)?.data ?? res;
      const orderId = responsePayload?.orderId;
      const orderReference =
        responsePayload?.orderReference ||
        (orderId ? toOrderReference(orderId) : null);
      const redirectPath = orderReference
        ? `/orders/${orderReference}#tracking`
        : orderId
          ? `/orders/${orderId}#tracking`
          : "/orders";

      setCheckoutSuccessState({
        isOpen: true,
        orderReference: orderReference ?? null,
      });

      clearCheckoutSuccessRedirectTimer();
      checkoutSuccessRedirectTimerRef.current = setTimeout(() => {
        setCheckoutSuccessState((previous) =>
          previous ? { ...previous, isOpen: false } : previous
        );
        router.push(redirectPath);
      }, 900);
    } catch (error: any) {
      showToast(error?.data?.message || "Failed to place order", "error");
    } finally {
      checkoutInFlightRef.current = false;
      setIsSubmittingCheckout(false);
    }
  };

  const handleCheckoutClick = () => {
    if (isBusy || totalItems === 0) {
      return;
    }

    if (deliveryMode === "DELIVERY" && !selectedAddressId) {
      showToast("Please select an address before checkout.", "error");
      return;
    }

    if (summaryError) {
      showToast(summaryError, "error");
      return;
    }

    if (!checkoutSummary) {
      showToast("Calculating delivery charges. Please wait a moment.", "error");
      focusAndHighlightSummary();
      return;
    }

    if (!hasReviewedPriceBreakup) {
      showToast(
        "Please review the price breakup (subtotal, delivery, total) before checkout.",
        "error"
      );
      focusAndHighlightSummary();
      return;
    }

    setIsCheckoutConfirmOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (isBusy) {
      return;
    }

    setIsCheckoutConfirmOpen(false);
    await handleInitiateCheckout();
  };

  return (
    <>
      <motion.div
        ref={orderSummaryRef}
        tabIndex={-1}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className={`bg-white rounded-lg p-6 sm:p-8 border transition-shadow duration-300 ${
          isSummaryHighlighted
            ? "border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
            : "border-gray-200"
        }`}
      >
        <h2
          ref={orderSummaryHeadingRef}
          tabIndex={-1}
          className="text-lg sm:text-xl font-semibold text-gray-800 mb-4"
        >
          Order Summary
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-gray-700">
            <span>Total Items</span>
            <span>{totalItems}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Subtotal</span>
            <span className="font-medium text-gray-800">
              {formatPrice(summarySubtotal)}
            </span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>{activeDeliveryLabel}</span>
            {summaryDeliveryCharge !== undefined ? (
              <span className="font-medium text-gray-800">
                {formatPrice(summaryDeliveryCharge)}
              </span>
            ) : (
              <span className="font-medium text-gray-500">Select options</span>
            )}
          </div>
          <div className="flex justify-between pt-3 border-t border-gray-200">
            <span className="font-semibold text-gray-800">Total</span>
            <span className="font-semibold text-gray-800">
              {formatPrice(summaryFinalTotal)}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {deliveryMode === "DELIVERY"
            ? "Select delivery mode and address to calculate final payable amount."
            : "In-store pickup selected. No delivery address is required."}
        </p>
        {shouldShowAddressUnlockNote ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Select a delivery address to unlock final charge review.
          </div>
        ) : (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              hasReviewedPriceBreakup
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <label className="inline-flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={hasReviewedPriceBreakup}
                disabled={!canReviewPriceBreakup}
                onChange={(event) => setHasReviewedPriceBreakup(event.target.checked)}
              />
              <span>Review subtotal, delivery, and total before checkout.</span>
            </label>
          </div>
        )}

        <div className="mt-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Delivery Method
          </h3>

          <div className="space-y-2">
            <label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 cursor-pointer hover:border-gray-300">
              <input
                type="radio"
                name="delivery-mode"
                className="mt-1"
                checked={deliveryMode === "DELIVERY"}
                onChange={() => {
                  setDeliveryMode("DELIVERY");
                  setHasReviewedPriceBreakup(false);
                  setSummaryError(null);
                  shouldFocusSummaryOnNextSuccessRef.current = true;
                  latestSummaryRequestRef.current = "";
                }}
              />
              <span className="text-sm text-gray-700">
                <span className="font-medium text-gray-800 block">Delivery</span>
                Charge is calculated from selected address city/pincode.
              </span>
            </label>

            <label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 cursor-pointer hover:border-gray-300">
              <input
                type="radio"
                name="delivery-mode"
                className="mt-1"
                checked={deliveryMode === "PICKUP"}
                onChange={() => {
                  setDeliveryMode("PICKUP");
                  setHasReviewedPriceBreakup(false);
                  setSummaryError(null);
                  shouldFocusSummaryOnNextSuccessRef.current = true;
                  latestSummaryRequestRef.current = "";
                }}
              />
              <span className="text-sm text-gray-700">
                <span className="font-medium text-gray-800 block">
                  In-Store Pickup
                </span>
                No delivery charge is applied.
              </span>
            </label>
          </div>
        </div>

        {deliveryMode === "DELIVERY" ? (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Delivery Address
            </h3>

            <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddressInputMode("saved");
                  setAddressSubmitAttempted(false);
                  setAddressTouchedFields({});
                  setHasReviewedPriceBreakup(false);
                  setSummaryError(null);
                  latestSummaryRequestRef.current = "";
                  if (!isAddressesLoading && !hasSavedAddresses) {
                    setSelectedAddressId("");
                    setCheckoutSummary(null);
                  } else if (!selectedAddressId && defaultAddressId) {
                    setSelectedAddressId(defaultAddressId);
                  }
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  addressInputMode === "saved"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                Choose Saved Address
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddressInputMode("new");
                  setAddressSubmitAttempted(false);
                  setAddressTouchedFields({});
                  setHasReviewedPriceBreakup(false);
                  setSelectedAddressId("");
                  setCheckoutSummary(null);
                  setSummaryError(null);
                  latestSummaryRequestRef.current = "";
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  addressInputMode === "new"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                Deliver to New Address
              </button>
            </div>

            {addressInputMode === "saved" ? (
              isAddressesLoading ? (
                <p className="text-xs text-gray-500">Loading addresses...</p>
              ) : addresses.length > 0 ? (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {addresses.map((address) => {
                    const isSelected = selectedAddressId === address.id;

                    return (
                      <label
                        key={address.id}
                        className={`block rounded-md border p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="checkout-address"
                            className="mt-1"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedAddressId(address.id);
                              setHasReviewedPriceBreakup(false);
                              setSummaryError(null);
                              shouldFocusSummaryOnNextSuccessRef.current = true;
                              latestSummaryRequestRef.current = "";
                            }}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-800">
                                {address.fullName}
                              </p>
                              {address.isDefault ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {address.line1}
                              {address.line2 ? `, ${address.line2}` : ""}
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

                          {!address.isDefault ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                void handleSetDefaultAddress(address.id);
                              }}
                              disabled={isSettingDefaultAddress}
                              className="text-xs text-indigo-600 hover:text-indigo-700 disabled:text-gray-400"
                            >
                              Set default
                            </button>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-xs text-amber-700">
                    No saved address found. Add a new address to continue with
                    delivery.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAddressInputMode("new");
                      setAddressSubmitAttempted(false);
                      setAddressTouchedFields({});
                      setHasReviewedPriceBreakup(false);
                      setSummaryError(null);
                      latestSummaryRequestRef.current = "";
                    }}
                    className="mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-800"
                  >
                    Add New Address
                  </button>
                </div>
              )
            ) : (
              <form onSubmit={handleCreateAddress} className="mt-3 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Address Type
                  </label>
                  <Dropdown
                    label="Address Type"
                    options={[
                      { value: "HOME", label: "Home" },
                      { value: "OFFICE", label: "Office" },
                      { value: "WAREHOUSE", label: "Warehouse" },
                      { value: "OTHER", label: "Other" },
                    ]}
                    value={addressForm.type}
                    onChange={(value) => {
                      if (!value) return;
                      handleAddressInputChange("type", value as AddressType);
                    }}
                    clearable={false}
                    className="h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      value={addressForm.fullName}
                      onChange={(event) =>
                        handleAddressInputChange("fullName", event.target.value)
                      }
                      onBlur={() => markAddressFieldTouched("fullName")}
                      minLength={2}
                      maxLength={120}
                      placeholder="Full Name *"
                      className={`w-full rounded-md border px-3 py-2 text-sm ${
                        fullNameAddressError
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                      required
                    />
                    {fullNameAddressError && (
                      <p className="mt-1 text-xs text-red-600">{fullNameAddressError}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="tel"
                      value={addressForm.phoneNumber}
                      onChange={(event) =>
                        handleAddressInputChange("phoneNumber", event.target.value)
                      }
                      onBlur={() => markAddressFieldTouched("phoneNumber")}
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="Phone Number *"
                      className={`w-full rounded-md border px-3 py-2 text-sm ${
                        phoneAddressError
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                      required
                    />
                    {phoneAddressError && (
                      <p className="mt-1 text-xs text-red-600">{phoneAddressError}</p>
                    )}
                  </div>
                </div>

                <div>
                  <input
                    value={addressForm.line1}
                    onChange={(event) =>
                      handleAddressInputChange("line1", event.target.value)
                    }
                    onBlur={() => markAddressFieldTouched("line1")}
                    minLength={5}
                    maxLength={255}
                    placeholder="Address Line 1 *"
                    className={`w-full rounded-md border px-3 py-2 text-sm ${
                      line1AddressError
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    required
                  />
                  {line1AddressError && (
                    <p className="mt-1 text-xs text-red-600">{line1AddressError}</p>
                  )}
                </div>

                <input
                  value={addressForm.line2}
                  onChange={(event) =>
                    handleAddressInputChange("line2", event.target.value)
                  }
                  maxLength={255}
                  placeholder="Address Line 2 (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />

                <input
                  value={addressForm.landmark}
                  onChange={(event) =>
                    handleAddressInputChange("landmark", event.target.value)
                  }
                  maxLength={255}
                  placeholder="Landmark (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Dropdown
                      label="Select State *"
                      options={ADDRESS_STATE_OPTIONS.map((stateOption) => ({
                        value: stateOption,
                        label: stateOption,
                      }))}
                      value={addressForm.state || null}
                      onChange={(value) => {
                        markAddressFieldTouched("state");
                        handleAddressInputChange("state", value || "");
                      }}
                      onBlur={() => markAddressFieldTouched("state")}
                      clearable={false}
                      className={`h-10 w-full rounded-md border px-3 py-2 text-sm ${
                        stateAddressError
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                    {stateAddressError && (
                      <p className="mt-1 text-xs text-red-600">{stateAddressError}</p>
                    )}
                  </div>
                  <div>
                    <Dropdown
                      label="Select City *"
                      options={availableCities.map((cityOption) => ({
                        value: cityOption,
                        label: cityOption,
                      }))}
                      value={addressForm.city || null}
                      onChange={(value) => {
                        markAddressFieldTouched("city");
                        handleAddressInputChange("city", value || "");
                      }}
                      onBlur={() => markAddressFieldTouched("city")}
                      disabled={!addressForm.state}
                      clearable={false}
                      className={`h-10 w-full rounded-md border px-3 py-2 text-sm ${
                        cityAddressError
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                    {cityAddressError && (
                      <p className="mt-1 text-xs text-red-600">{cityAddressError}</p>
                    )}
                  </div>
                  <div>
                    <Dropdown
                      label="Country"
                      options={[
                        { value: INDIA_COUNTRY_NAME, label: INDIA_COUNTRY_NAME },
                      ]}
                      value={addressForm.country || INDIA_COUNTRY_NAME}
                      onChange={() => undefined}
                      onBlur={() => markAddressFieldTouched("country")}
                      className={`h-10 w-full rounded-md border px-3 py-2 text-sm ${
                        countryAddressError
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                      disabled
                      clearable={false}
                    />
                    {countryAddressError && (
                      <p className="mt-1 text-xs text-red-600">{countryAddressError}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={addressForm.pincode}
                      onChange={(event) =>
                        handleAddressInputChange("pincode", event.target.value)
                      }
                      onBlur={() => markAddressFieldTouched("pincode")}
                      inputMode="numeric"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      placeholder="Pincode *"
                      className={`w-full rounded-md border px-3 py-2 text-sm ${
                        pincodeAddressError
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                      required
                    />
                    {pincodeAddressError && (
                      <p className="mt-1 text-xs text-red-600">{pincodeAddressError}</p>
                    )}
                  </div>
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
                  disabled={isCreatingAddress || hasAddressValidationErrors}
                  className="w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium hover:bg-black disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isCreatingAddress ? "Saving..." : "Save Address and Use for Checkout"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              In-store pickup selected. Delivery address is not required for this order.
            </p>
          </div>
        )}

          {summaryError ? (
            <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {summaryError}
            </p>
          ) : null}

        {isAddressesFetching ? (
          <p className="mt-3 text-xs text-gray-500">Refreshing addresses...</p>
        ) : null}
        {isCalculatingSummary ? (
          <p className="mt-3 text-xs text-gray-500">
            Calculating checkout summary...
          </p>
        ) : null}

        {isAuthLoading ? (
          <button
            disabled
            className="mt-4 w-full bg-gray-300 text-gray-700 py-2.5 rounded-md font-medium text-sm cursor-not-allowed"
          >
            Checking session...
          </button>
        ) : isAuthenticated ? (
          <button
            disabled={
              isBusy ||
              totalItems === 0 ||
              (deliveryMode === "DELIVERY" && !selectedAddressId) ||
              !checkoutSummary ||
              !!summaryError ||
              !hasReviewedPriceBreakup
            }
            onClick={handleCheckoutClick}
            className="mt-4 w-full bg-indigo-600 text-white py-2.5 rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isBusy
              ? "Processing..."
              : !hasReviewedPriceBreakup
              ? "Review Price Breakup to Continue"
              : "Proceed to Checkout"}
          </button>
        ) : (
          <Link
            href={`/sign-in?next=${encodeURIComponent(currentPathWithSearch)}`}
            className="mt-4 w-full inline-block text-center bg-gray-300 text-gray-800 py-2.5 rounded-md font-medium text-sm hover:bg-gray-400 transition-colors"
          >
            Sign in to Checkout
          </Link>
        )}
      </motion.div>

      <AnimatePresence>
        {checkoutSuccessState?.isOpen ? (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-2xl"
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <motion.div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </motion.div>

              <p className="text-lg font-semibold text-gray-900">
                Order Placed Successfully
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {checkoutSuccessState.orderReference
                  ? `Order #${checkoutSuccessState.orderReference}`
                  : "Your order has been submitted."}
              </p>
              <p className="mt-3 text-xs font-medium text-emerald-700">
                Redirecting to tracking...
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isCheckoutConfirmOpen}
        title="Submit Order for Verification?"
        type="warning"
        message={`Please confirm this price breakup: Subtotal ${formatPrice(
          summarySubtotal
        )}, ${activeDeliveryLabel} ${
          summaryDeliveryCharge !== undefined
            ? formatPrice(summaryDeliveryCharge)
            : "Pending"
        }, Final total ${formatPrice(
          summaryFinalTotal
        )}. Stock will be verified first, and payment is requested only after approval.`}
        onConfirm={handleConfirmCheckout}
        onCancel={() => setIsCheckoutConfirmOpen(false)}
        confirmLabel="Submit Order"
        isConfirming={isSubmittingCheckout || isPlacingOrder}
        disableCancelWhileConfirming
      />
    </>
  );
};

export default CartSummary;
