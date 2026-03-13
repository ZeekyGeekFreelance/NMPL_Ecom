export const buildDateFilter = (
  startDate?: Date,
  endDate?: Date,
  yearStart?: Date,
  yearEnd?: Date
) => {
  // Explicit date windows take precedence over year presets.
  if (startDate || endDate) {
    return {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  if (yearStart || yearEnd) {
    return {
      ...(yearStart && { gte: yearStart }),
      ...(yearEnd && { lte: new Date(yearEnd) }),
    };
  }

  return {};
};
