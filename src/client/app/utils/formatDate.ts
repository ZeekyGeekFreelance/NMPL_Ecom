const IST_TIMEZONE = "Asia/Kolkata";

type FormatDateOptions = {
  withTime?: boolean;
  includeTimezoneLabel?: boolean;
  fallback?: string;
};

export default function formatDate(
  dateInput: string | number | Date | null | undefined,
  options?: FormatDateOptions
) {
  const { withTime = true, includeTimezoneLabel = true, fallback = "N/A" } =
    options || {};

  if (!dateInput) {
    return fallback;
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);

  if (!withTime) {
    return includeTimezoneLabel ? `${datePart} IST` : datePart;
  }

  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  return includeTimezoneLabel
    ? `${datePart}, ${timePart} IST`
    : `${datePart}, ${timePart}`;
}
