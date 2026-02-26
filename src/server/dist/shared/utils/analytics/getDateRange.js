"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateRange = getDateRange;
const date_fns_1 = require("date-fns");
const parseDateOrThrow = (value, field) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid ${field} format. Use YYYY-MM-DD.`);
    }
    return parsed;
};
function getDateRange({ timePeriod, year, startDate, endDate, }) {
    const now = new Date();
    let currentStartDate;
    let previousStartDate;
    let previousEndDate;
    let yearStart;
    let yearEnd;
    if (year) {
        if (!Number.isInteger(year) || year < 1900 || year > now.getFullYear()) {
            throw new Error("Invalid year range.");
        }
        yearStart = (0, date_fns_1.startOfYear)(new Date(year, 0, 1));
        yearEnd = (0, date_fns_1.endOfYear)(new Date(year, 0, 1));
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
    }
    else {
        switch (timePeriod) {
            case "last7days":
                currentStartDate = (0, date_fns_1.subDays)(now, 7);
                previousStartDate = (0, date_fns_1.subDays)(now, 14);
                previousEndDate = (0, date_fns_1.subDays)(now, 7);
                break;
            case "lastMonth":
                currentStartDate = (0, date_fns_1.subMonths)(now, 1);
                previousStartDate = (0, date_fns_1.subMonths)(now, 2);
                previousEndDate = (0, date_fns_1.subMonths)(now, 1);
                break;
            case "lastYear":
                currentStartDate = (0, date_fns_1.subYears)(now, 1);
                previousStartDate = (0, date_fns_1.subYears)(now, 2);
                previousEndDate = (0, date_fns_1.subYears)(now, 1);
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
