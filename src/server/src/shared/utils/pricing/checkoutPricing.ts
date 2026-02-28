import prisma from "@/infra/database/database.config";
import AppError from "@/shared/errors/AppError";
import { DELIVERY_MODE, type Address } from "@prisma/client";

type LineItem = {
  quantity: number;
  price: number;
};

type DeliveryQuote = {
  deliveryMode: DELIVERY_MODE;
  deliveryCharge: number;
  deliveryLabel: string;
  serviceArea: string | null;
};

const parseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const getBangaloreAliases = () => {
  const rawAliases =
    process.env.BANGALORE_CITY_ALIASES || "BANGALORE,BENGALURU";
  return rawAliases
    .split(",")
    .map((value) => normalizeText(value))
    .filter(Boolean);
};

const getBangaloreDeliveryCharge = () =>
  parseNumber(process.env.BANGALORE_DELIVERY_CHARGE, 75);

const normalizeDeliveryMode = (mode: unknown): DELIVERY_MODE => {
  const normalizedMode = normalizeText(mode);
  if (normalizedMode === DELIVERY_MODE.PICKUP) {
    return DELIVERY_MODE.PICKUP;
  }
  return DELIVERY_MODE.DELIVERY;
};

export const calculateItemsSubtotal = (items: LineItem[]): number => {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(400, "Invalid item quantity in checkout payload.");
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(400, "Invalid item price in checkout payload.");
    }

    return sum + quantity * price;
  }, 0);

  return Number(subtotal.toFixed(2));
};

export const getAddressForCheckout = async (
  userId: string,
  addressId: string
): Promise<Address> => {
  const normalizedAddressId = String(addressId || "").trim();
  if (!normalizedAddressId) {
    throw new AppError(400, "Address selection is required.");
  }

  const address = await prisma.address.findUnique({
    where: {
      id: normalizedAddressId,
    },
  });

  if (!address || address.userId !== userId) {
    throw new AppError(404, "Selected address was not found for this account.");
  }

  return address;
};

export const resolveDeliveryQuote = async (params: {
  deliveryMode: unknown;
  address: Address;
}): Promise<DeliveryQuote> => {
  const mode = normalizeDeliveryMode(params.deliveryMode);
  const city = String(params.address.city || "").trim();
  const normalizedCity = normalizeText(city);
  const normalizedPincode = String(params.address.pincode || "").trim();

  if (mode === DELIVERY_MODE.PICKUP) {
    return {
      deliveryMode: DELIVERY_MODE.PICKUP,
      deliveryCharge: 0,
      deliveryLabel: "In-Store Pickup",
      serviceArea: city || null,
    };
  }

  if (!normalizedPincode) {
    throw new AppError(
      400,
      "Selected address has no valid pincode for delivery calculation."
    );
  }

  const bangaloreAliases = getBangaloreAliases();
  if (bangaloreAliases.includes(normalizedCity)) {
    return {
      deliveryMode: DELIVERY_MODE.DELIVERY,
      deliveryCharge: Number(getBangaloreDeliveryCharge().toFixed(2)),
      deliveryLabel: "Bangalore Delivery",
      serviceArea: city || "Bangalore",
    };
  }

  const deliveryRate = await prisma.deliveryRate.findUnique({
    where: {
      pincode: normalizedPincode,
    },
    select: {
      pincode: true,
      city: true,
      state: true,
      charge: true,
      isServiceable: true,
    },
  });

  if (!deliveryRate || !deliveryRate.isServiceable) {
    throw new AppError(
      400,
      "Delivery is unavailable for this pincode. Choose pickup or another address."
    );
  }

  return {
    deliveryMode: DELIVERY_MODE.DELIVERY,
    deliveryCharge: Number(Number(deliveryRate.charge || 0).toFixed(2)),
    deliveryLabel: `Delivery (${deliveryRate.pincode})`,
    serviceArea:
      [deliveryRate.city, deliveryRate.state].filter(Boolean).join(", ") ||
      deliveryRate.pincode,
  };
};

export const buildCheckoutPricing = (params: {
  items: LineItem[];
  deliveryQuote: DeliveryQuote;
}) => {
  const subtotalAmount = calculateItemsSubtotal(params.items);
  const deliveryCharge = Number(params.deliveryQuote.deliveryCharge.toFixed(2));
  const finalTotal = Number((subtotalAmount + deliveryCharge).toFixed(2));

  return {
    subtotalAmount,
    deliveryCharge,
    finalTotal,
    deliveryMode: params.deliveryQuote.deliveryMode,
    deliveryLabel: params.deliveryQuote.deliveryLabel,
    serviceArea: params.deliveryQuote.serviceArea,
  };
};
