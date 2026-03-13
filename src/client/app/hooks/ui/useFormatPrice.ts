"use client";

const useFormatPrice = () => {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatPrice = (amount: number) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) {
      return formatter.format(0);
    }

    return formatter.format(value);
  };

  return formatPrice;
};

export default useFormatPrice;
