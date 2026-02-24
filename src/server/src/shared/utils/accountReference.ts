const ACCOUNT_REFERENCE_PREFIX = "ACC";
const ACCOUNT_REFERENCE_TOKEN_LENGTH = 8;

const normalizeIdentifier = (value: string): string =>
  (value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const hashIdentifier = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
};

const buildToken = (userId: string): string => {
  const normalized = normalizeIdentifier(userId);
  if (!normalized) {
    return "UNKNOWN";
  }

  const hashToken = hashIdentifier(normalized)
    .toString(36)
    .toUpperCase()
    .padStart(ACCOUNT_REFERENCE_TOKEN_LENGTH, "0")
    .slice(-ACCOUNT_REFERENCE_TOKEN_LENGTH);

  const checksum = normalized.slice(-2).padStart(2, "0");
  return `${hashToken}${checksum}`;
};

export const toAccountReference = (userId: string): string =>
  `${ACCOUNT_REFERENCE_PREFIX}-${buildToken(userId)}`;
