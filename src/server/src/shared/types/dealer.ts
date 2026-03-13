/**
 * Single source of truth for dealer status types and eligibility rules.
 *
 * Import from here — do NOT redeclare DealerStatus in individual modules.
 * This prevents enum-extension bugs (e.g. adding a new status and forgetting
 * to update one of several scattered type definitions).
 */

export type DealerStatus =
  | "PENDING"
  | "APPROVED"
  | "LEGACY"
  | "REJECTED"
  | "SUSPENDED";

/**
 * Statuses that grant full dealer access:
 * - APPROVED: standard active dealer
 * - LEGACY:   grandfathered dealer with preserved access
 *
 * PENDING, REJECTED, SUSPENDED must NOT receive dealer pricing or catalog access.
 */
export const DEALER_ACTIVE_STATUSES = new Set<DealerStatus>([
  "APPROVED",
  "LEGACY",
]);

/**
 * Returns true if the dealer's current status grants active dealer access.
 * Safe to call with null/undefined — returns false for non-dealers.
 */
export const isDealerEligible = (
  status: DealerStatus | string | null | undefined
): boolean => {
  if (!status) return false;
  return DEALER_ACTIVE_STATUSES.has(status as DealerStatus);
};
