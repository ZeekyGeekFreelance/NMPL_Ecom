"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDateFilter = void 0;
const buildDateFilter = (startDate, endDate, yearStart, yearEnd) => {
    // Explicit date windows take precedence over year presets.
    if (startDate || endDate) {
        return Object.assign(Object.assign({}, (startDate && { gte: startDate })), (endDate && { lte: new Date(endDate) }));
    }
    if (yearStart || yearEnd) {
        return Object.assign(Object.assign({}, (yearStart && { gte: yearStart })), (yearEnd && { lte: new Date(yearEnd) }));
    }
    return {};
};
exports.buildDateFilter = buildDateFilter;
