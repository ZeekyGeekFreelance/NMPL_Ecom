const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatINRCurrency = (
  value: number | string | null | undefined
): string => {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) ? parsed : 0;
  return INR_FORMATTER.format(normalized).replace(/\u00A0/g, " ");
};

