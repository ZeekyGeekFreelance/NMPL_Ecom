import { endOfYear, startOfYear, subDays, subMonths, subYears } from "date-fns";

interface DateRangeInput {
  timePeriod?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
}

interface DateRangeOutput {
  currentStartDate?: Date;
  previousStartDate?: Date;
  previousEndDate?: Date;
  yearStart?: Date;
  yearEnd?: Date;
}

const parseDateOrThrow = (value: string, field: "startDate" | "endDate"): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${field} format. Use YYYY-MM-DD.`);
  }

  return parsed;
};

export function getDateRange({
  timePeriod,
  year,
  startDate,
  endDate,
}: DateRangeInput): DateRangeOutput {
  const now = new Date();

  let currentStartDate: Date | undefined;
  let previousStartDate: Date | undefined;
  let previousEndDate: Date | undefined;
  let yearStart: Date | undefined;
  let yearEnd: Date | undefined;

  if (year) {
    if (!Number.isInteger(year) || year < 1900 || year > now.getFullYear()) {
      throw new Error("Invalid year range.");
    }

    yearStart = startOfYear(new Date(year, 0, 1));
    yearEnd = endOfYear(new Date(year, 0, 1));
  }

  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new Error("Both startDate and endDate must be provided.");
    }

    const parsedStartDate = parseDateOrThrow(startDate, "startDate");
    const parsedEndDate = parseDateOrThrow(endDate, "endDate");

    if (parsedStartDate > now || parsedEndDate > now) {
      throw new Error("Future dates are not allowed.");
    }

    if (parsedStartDate > parsedEndDate) {
      throw new Error("startDate must be before or equal to endDate.");
    }

    currentStartDate = parsedStartDate;
    previousStartDate = undefined;
    previousEndDate = undefined;
  } else {
    switch (timePeriod) {
      case "last7days":
        currentStartDate = subDays(now, 7);
        previousStartDate = subDays(now, 14);
        previousEndDate = subDays(now, 7);
        break;
      case "lastMonth":
        currentStartDate = subMonths(now, 1);
        previousStartDate = subMonths(now, 2);
        previousEndDate = subMonths(now, 1);
        break;
      case "lastYear":
        currentStartDate = subYears(now, 1);
        previousStartDate = subYears(now, 2);
        previousEndDate = subYears(now, 1);
        break;
      case "allTime":
      case undefined:
        currentStartDate = undefined;
        previousStartDate = undefined;
        previousEndDate = undefined;
        break;
      case "custom":
        throw new Error("Custom time period requires startDate and endDate.");
      default:
        throw new Error(`Invalid time period: ${timePeriod}`);
    }
  }

  return {
    currentStartDate,
    previousStartDate,
    previousEndDate,
    yearStart,
    yearEnd,
  };
}
