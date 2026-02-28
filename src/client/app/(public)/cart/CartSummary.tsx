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
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toOrderReference } from "@/app/lib/utils/accountReference";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";

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
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [deliveryMode, setDeliveryMode] =
    useState<CheckoutDeliveryMode>("DELIVERY");
  const [checkoutSummary, setCheckoutSummary] =
    useState<CheckoutSummaryData | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [addressInputMode, setAddressInputMode] =
    useState<AddressInputMode>("saved");
  const [addressForm, setAddressForm] = useState<AddressFormState>(
    getEmptyAddressForm()
  );
  const checkoutInFlightRef = useRef(false);
  const latestSummaryRequestRef = useRef("");

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

  const currentPathWithSearch = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!addresses.length) {
      setAddressInputMode("new");
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
  }, [addressInputMode, addresses, defaultAddressId, isAuthenticated]);

  const requestCheckoutSummary = useCallback(
    async (force = false) => {
      if (!selectedAddressId || totalItems <= 0) {
        setCheckoutSummary(null);
        setSummaryError(null);
        latestSummaryRequestRef.current = "";
        return null;
      }

      const requestKey = [
        selectedAddressId,
        deliveryMode,
        subtotal,
        totalItems,
      ].join(":");

      if (
        !force &&
        latestSummaryRequestRef.current === requestKey &&
        checkoutSummary
      ) {
        return checkoutSummary;
      }

      latestSummaryRequestRef.current = requestKey;
      setSummaryError(null);

      try {
        const response = await getCheckoutSummary({
          addressId: selectedAddressId,
          deliveryMode,
        }).unwrap();
        const parsedSummary = parseCheckoutSummary(response);

        if (!parsedSummary) {
          throw new Error("Unable to calculate checkout summary.");
        }

        setCheckoutSummary(parsedSummary);
        return parsedSummary;
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Unable to calculate checkout summary. Please verify address and delivery mode."
        );
        setCheckoutSummary(null);
        setSummaryError(message);
        return null;
      }
    },
    [
      checkoutSummary,
      deliveryMode,
      getCheckoutSummary,
      selectedAddressId,
      subtotal,
      totalItems,
    ]
  );

  useEffect(() => {
    if (
      !isAuthenticated ||
      addressInputMode !== "saved" ||
      !selectedAddressId ||
      totalItems <= 0
    ) {
      return;
    }

    void requestCheckoutSummary();
  }, [
    addressInputMode,
    isAuthenticated,
    requestCheckoutSummary,
    selectedAddressId,
    totalItems,
  ]);

  const handleAddressInputChange = (
    key: keyof AddressFormState,
    value: string | boolean
  ) => {
    setAddressForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleCreateAddress = async (event: React.FormEvent<HTMLFormElement>) => {
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

      const createdAddress = parseAddress(response);
      if (createdAddress?.id) {
        setSelectedAddressId(createdAddress.id);
        setAddressInputMode("saved");
      }

      setAddressForm(getEmptyAddressForm());
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

  const handleInitiateCheckout = async () => {
    if (checkoutInFlightRef.current || isPlacingOrder) {
      return;
    }

    if (!selectedAddressId) {
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
      const res = await initiateCheckout({
        addressId: selectedAddressId,
        deliveryMode,
      }).unwrap();
      const payload = (res as any)?.data ?? res;
      const orderId = payload?.orderId;
      const orderReference =
        payload?.orderReference || (orderId ? toOrderReference(orderId) : null);
      showToast(
        orderReference
          ? `Order ${orderReference} submitted. Stock will be verified and quotation will be shared before payment.`
          : "Order submitted. Stock will be verified and quotation will be shared before payment.",
        "success"
      );

      if (orderReference) {
        router.push(`/orders/${orderReference}`);
      } else if (orderId) {
        router.push(`/orders/${orderId}`);
      } else {
        router.push("/orders");
      }
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

    if (!selectedAddressId) {
      showToast("Please select an address before checkout.", "error");
      return;
    }

    if (summaryError) {
      showToast(summaryError, "error");
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
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-lg p-6 sm:p-8 border border-gray-200"
      >
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">
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
          Select delivery mode and address to calculate final payable amount.
        </p>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Delivery Address
          </h3>

          <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAddressInputMode("saved");
                setSummaryError(null);
                latestSummaryRequestRef.current = "";
                if (!selectedAddressId && defaultAddressId) {
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
                            setSummaryError(null);
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
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No saved address found. Choose "Deliver to New Address" to continue.
              </p>
            )
          ) : (
            <form onSubmit={handleCreateAddress} className="mt-3 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                className="w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium hover:bg-black disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isCreatingAddress ? "Saving..." : "Save Address and Use for Checkout"}
              </button>
            </form>
          )}
        </div>

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
                  setSummaryError(null);
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
                  setSummaryError(null);
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

          {summaryError ? (
            <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {summaryError}
            </p>
          ) : null}
        </div>

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
            disabled={isBusy || totalItems === 0 || !selectedAddressId}
            onClick={handleCheckoutClick}
            className="mt-4 w-full bg-indigo-600 text-white py-2.5 rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isBusy
              ? "Processing..."
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

      <ConfirmModal
        isOpen={isCheckoutConfirmOpen}
        title="Submit Order for Verification?"
        type="warning"
        message={`Stock will be verified first. Delivery mode: ${activeDeliveryLabel}. Final total: ${formatPrice(
          summaryFinalTotal
        )}. You will receive a quotation and payment request only after approval.`}
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
