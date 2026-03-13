/**
 * Maps a search query to a list of valid transaction statuses (enums)
 * that include the query substring (case-insensitive).
 *
 * This is helpful because enum fields in Prisma can't use `contains`,
 * so we map user input to possible enum values using `.includes()`.
 */
const mapTransactionStatus = (searchQuery: string): string[] => {
  const query = searchQuery.toLowerCase();

  // These are all the possible enum values for the `status` field
  const validStatuses = [
    "PENDING_VERIFICATION",
    "WAITLISTED",
    "AWAITING_PAYMENT",
    "QUOTATION_REJECTED",
    "QUOTATION_EXPIRED",
    "CONFIRMED",
    "DELIVERED",
  ];

  // Filter enums that match the search query (case-insensitive)
  return validStatuses.filter((status) =>
    status.toLowerCase().includes(query)
  );
};

export default mapTransactionStatus;
