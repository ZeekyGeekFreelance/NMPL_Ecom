-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260311100000_legacy_dealer_pay_later_enums
--
-- PURPOSE:
--   Create all new enum types required by the Legacy Dealer Pay-Later feature.
--   PostgreSQL requires enum types to be created (and the transaction committed)
--   BEFORE any column definitions or DML that reference those new types can run.
--   This is why enums live in their own migration, separate from the DDL below.
--
-- SAFETY:
--   All statements are CREATE TYPE ... IF NOT EXISTS (PostgreSQL 14+) so the
--   migration is safe to re-run or apply in any order without breaking existing
--   enum definitions.  No existing tables are modified here.
-- ─────────────────────────────────────────────────────────────────────────────

-- Payment method — covers every offline and online method supported.
CREATE TYPE "PAYMENT_METHOD_TYPE" AS ENUM (
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'UPI',
  'NET_BANKING',
  'CARD',
  'WALLET'
);

-- Who or what produced the PaymentTransaction record.
CREATE TYPE "PAYMENT_SOURCE_TYPE" AS ENUM (
  'ADMIN_MANUAL',
  'GATEWAY',
  'MOCK_GATEWAY'
);

-- Lifecycle of a single PaymentTransaction row.
CREATE TYPE "PAYMENT_TXN_STATUS" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'BOUNCED',
  'REVERSED'
);

-- Payment state rendered on invoice documents.
CREATE TYPE "INVOICE_PAYMENT_STATUS" AS ENUM (
  'PAID',
  'PAYMENT_DUE',
  'OVERDUE',
  'SUPERSEDED'
);

-- Event categories for the dealer credit ledger.
CREATE TYPE "CREDIT_EVENT_TYPE" AS ENUM (
  'ORDER_DELIVERED',
  'PAYMENT_RECEIVED',
  'ORDER_CANCELLED',
  'CREDIT_ADJUSTED'
);
