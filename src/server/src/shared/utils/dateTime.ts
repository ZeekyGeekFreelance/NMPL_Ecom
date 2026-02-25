const IST_TIMEZONE = "Asia/Kolkata";

const toDate = (value: Date | string | number): Date => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }
  return date;
};

export const formatDateInIST = (value: Date | string | number): string => {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

export const formatDateTimeInIST = (
  value: Date | string | number
): string => {
  const date = toDate(value);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  return `${formatted} IST`;
};

