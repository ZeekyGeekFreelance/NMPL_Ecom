"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAddressReference = exports.toShipmentReference = exports.toPaymentReference = exports.toProductReference = exports.toTransactionReference = exports.toOrderReference = exports.toAccountReference = exports.toPrefixedReference = void 0;
const DEFAULT_REFERENCE_PREFIX = "REF";
const DEFAULT_TOKEN_LENGTH = 8;
const normalizeIdentifier = (value) => (value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const normalizePrefix = (prefix) => {
    const normalized = (prefix || "").replace(/[^A-Za-z]/g, "").toUpperCase();
    return normalized || DEFAULT_REFERENCE_PREFIX;
};
const hashIdentifier = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
};
const buildReferenceToken = (id, tokenLength = DEFAULT_TOKEN_LENGTH) => {
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
const toPrefixedReference = (prefix, id, tokenLength = DEFAULT_TOKEN_LENGTH) => `${normalizePrefix(prefix)}-${buildReferenceToken(id, tokenLength)}`;
exports.toPrefixedReference = toPrefixedReference;
const toAccountReference = (id) => (0, exports.toPrefixedReference)("ACC", id, 8);
exports.toAccountReference = toAccountReference;
const toOrderReference = (id) => (0, exports.toPrefixedReference)("ORD", id);
exports.toOrderReference = toOrderReference;
const toTransactionReference = (id) => (0, exports.toPrefixedReference)("TXN", id);
exports.toTransactionReference = toTransactionReference;
const toProductReference = (id) => (0, exports.toPrefixedReference)("PRD", id);
exports.toProductReference = toProductReference;
const toPaymentReference = (id) => (0, exports.toPrefixedReference)("PAY", id);
exports.toPaymentReference = toPaymentReference;
const toShipmentReference = (id) => (0, exports.toPrefixedReference)("SHP", id);
exports.toShipmentReference = toShipmentReference;
const toAddressReference = (id) => (0, exports.toPrefixedReference)("ADR", id);
exports.toAddressReference = toAddressReference;
