const DEFAULT_REFERENCE_PREFIX = "REF";
const DEFAULT_TOKEN_LENGTH = 8;

const normalizeIdentifier = (value: string): string =>
  (value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const normalizePrefix = (prefix: string): string => {
  const normalized = (prefix || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  return normalized || DEFAULT_REFERENCE_PREFIX;
};

const hashIdentifier = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
};

const buildReferenceToken = (
  id: string,
  tokenLength = DEFAULT_TOKEN_LENGTH
): string => {
  const normalized = normalizeIdentifier(id);
  if (!normalized) {
    return "UNKNOWN";
  }

  const length = Math.max(4, Math.floor(tokenLength));
  const hashToken = hashIdentifier(normalized)
    .toString(36)
    .toUpperCase()
    .padStart(length, "0")
    .slice(-length);

  const checksum = normalized.slice(-2).padStart(2, "0");
  return `${hashToken}${checksum}`;
};

export const toPrefixedReference = (
  prefix: string,
  id: string,
  tokenLength = DEFAULT_TOKEN_LENGTH
): string => `${normalizePrefix(prefix)}-${buildReferenceToken(id, tokenLength)}`;

export const toAccountReference = (id: string): string =>
  toPrefixedReference("ACC", id, 8);

export const toOrderReference = (id: string): string =>
  toPrefixedReference("ORD", id);

export const toTransactionReference = (id: string): string =>
  toPrefixedReference("TXN", id);

export const toProductReference = (id: string): string =>
  toPrefixedReference("PRD", id);

export const toPaymentReference = (id: string): string =>
  toPrefixedReference("PAY", id);

export const toAddressReference = (id: string): string =>
  toPrefixedReference("ADR", id);
