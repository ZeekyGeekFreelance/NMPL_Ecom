"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAccountReference = void 0;
const ACCOUNT_REFERENCE_PREFIX = "ACC";
const ACCOUNT_REFERENCE_TOKEN_LENGTH = 8;
const normalizeIdentifier = (value) => (value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const hashIdentifier = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
};
const buildToken = (userId) => {
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
const toAccountReference = (userId) => `${ACCOUNT_REFERENCE_PREFIX}-${buildToken(userId)}`;
exports.toAccountReference = toAccountReference;
