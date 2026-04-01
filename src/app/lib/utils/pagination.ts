export const getPaginatedSerialNumber = (
  rowIndex: number,
  currentPage: number = 1,
  resultsPerPage?: number
): number => {
  const safeIndex = Number.isFinite(rowIndex) ? Math.max(0, Math.floor(rowIndex)) : 0;
  const safePage =
    Number.isFinite(currentPage) && currentPage > 0
      ? Math.floor(currentPage)
      : 1;
  const safeResultsPerPage =
    Number.isFinite(resultsPerPage) && (resultsPerPage as number) > 0
      ? Math.floor(resultsPerPage as number)
      : 0;

  const offset = safeResultsPerPage > 0 ? (safePage - 1) * safeResultsPerPage : 0;
  return offset + safeIndex + 1;
};
