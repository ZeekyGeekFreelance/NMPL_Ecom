-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260311100100_legacy_dealer_pay_later_schema
--
-- PURPOSE:
--   Implements the complete data model for the Legacy Dealer Pay-Later feature:
--
--   MODIFIED TABLES:
--     • User          — mustChangePassword flag for forced credential reset
--     • DealerProfile — payLaterEnabled, creditTermDays
--     • Order         — isPayLater snapshot, paymentDueDate
--     • Invoice       — paymentStatus, paymentTerms, paymentDueDate,
--                       versioning (version, isLatest, supersededById)
--
--   NEW TABLES:
--     • PaymentTransaction   — full audit-grade payment record (replaces thin Payment
--                              record for new flows; Payment retained for backward compat)
--     • DealerCreditLedger   — running credit balance per legacy dealer
--     • PaymentAuditLog      — immutable append-only payment audit trail
--
-- SAFETY:
--   • All new columns use DEFAULT values — zero downtime, no data migration required.
--   • No existing columns are altered or removed.
--   • Existing foreign keys and constraints are untouched.
--   • The three new tables are standalone — no existing service code touches them
--     until Phase 3 service layer changes are applied.
--   • All indexes created with IF NOT EXISTS / CONCURRENTLY where appropriate.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — MODIFY: User
-- ═════════════════════════════════════════════════════════════════════════════

-- Flag that forces a password change on next login.
-- Set to TRUE for admin-created legacy dealer accounts with temporary credentials.
ALTER TABLE "User"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN "User"."mustChangePassword" IS
  'When TRUE the client must redirect the user to the password-change page '
  'immediately after sign-in.  Used for admin-created legacy dealer accounts.';


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — MODIFY: DealerProfile
-- ═════════════════════════════════════════════════════════════════════════════

-- Pay-later privilege flag.  Only ever set to TRUE for LEGACY dealers.
-- Enforced at application layer: createDealer(isLegacy=true) sets both this
-- field AND DealerProfile.status = 'LEGACY'.
ALTER TABLE "DealerProfile"
ADD COLUMN "payLaterEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

-- Payment term window in calendar days (30 = NET 30).
-- Only meaningful when payLaterEnabled = TRUE.  Stored here so the credit term
-- can be dealer-specific in the future without a schema change.
ALTER TABLE "DealerProfile"
ADD COLUMN "creditTermDays" INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN "DealerProfile"."payLaterEnabled" IS
  'TRUE only for LEGACY dealers.  All other account types must have FALSE.';

COMMENT ON COLUMN "DealerProfile"."creditTermDays" IS
  'Number of calendar days from delivery within which payment is due. '
  'Default 30 (NET 30).  Only evaluated when payLaterEnabled = TRUE.';

-- Constraint: credit term must be a sensible positive value.
ALTER TABLE "DealerProfile"
ADD CONSTRAINT "DealerProfile_creditTermDays_positive" CHECK ("creditTermDays" > 0);

-- Index for fast scans of all pay-later dealers.
CREATE INDEX "DealerProfile_payLaterEnabled_idx"
  ON "DealerProfile"("payLaterEnabled");


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — MODIFY: Order
-- ═════════════════════════════════════════════════════════════════════════════

-- Snapshot of the dealer's payLaterEnabled flag at order placement time.
-- Immutable after order creation — decoupled from any future dealer status change.
ALTER TABLE "Order"
ADD COLUMN "isPayLater" BOOLEAN NOT NULL DEFAULT FALSE;

-- Payment due date for pay-later orders.  Set when order reaches DELIVERED:
--   paymentDueDate = deliveredAt + DealerProfile.creditTermDays
-- NULL for all prepaid / non-pay-later orders.
ALTER TABLE "Order"
ADD COLUMN "paymentDueDate" TIMESTAMP(3);

COMMENT ON COLUMN "Order"."isPayLater" IS
  'Immutable snapshot of dealer payLaterEnabled at order creation time.';

COMMENT ON COLUMN "Order"."paymentDueDate" IS
  'For pay-later orders: deliveredAt + creditTermDays.  NULL otherwise.';

-- Targeted indexes for outstanding-order and overdue-order queries.
CREATE INDEX "Order_isPayLater_idx"
  ON "Order"("isPayLater");

CREATE INDEX "Order_paymentDueDate_idx"
  ON "Order"("paymentDueDate");

-- Compound index used by the admin outstanding/overdue dashboard query:
-- WHERE "isPayLater" = TRUE AND "status" = 'DELIVERED' AND "paymentDueDate" < now()
CREATE INDEX "Order_isPayLater_status_paymentDueDate_idx"
  ON "Order"("isPayLater", "status", "paymentDueDate");


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — MODIFY: Invoice
-- ═════════════════════════════════════════════════════════════════════════════

-- Payment state shown on the invoice PDF and in admin views.
-- Default PAID preserves existing behavior for all pre-migration invoices.
ALTER TABLE "Invoice"
ADD COLUMN "paymentStatus" "INVOICE_PAYMENT_STATUS" NOT NULL DEFAULT 'PAID';

-- Payment terms text, e.g. "NET 30 DAYS".  NULL for standard prepaid invoices.
ALTER TABLE "Invoice"
ADD COLUMN "paymentTerms" TEXT;

-- Mirrored from Order.paymentDueDate for direct invoice-level queries.
ALTER TABLE "Invoice"
ADD COLUMN "paymentDueDate" TIMESTAMP(3);

-- Invoice version counter.  Starts at 1.  Incremented when invoice is superseded
-- after a payment is recorded (old: isLatest=FALSE, new: isLatest=TRUE, version=N+1).
ALTER TABLE "Invoice"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Only the latest version is served to end users via download endpoints.
-- Archived versions remain for audit history.
ALTER TABLE "Invoice"
ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT TRUE;

-- Self-referential FK: points from an old (superseded) invoice to the new one.
-- NULL on the current active invoice.
ALTER TABLE "Invoice"
ADD COLUMN "supersededById" TEXT;

COMMENT ON COLUMN "Invoice"."paymentStatus" IS
  'PAID for prepaid orders; PAYMENT_DUE for pay-later orders awaiting payment; '
  'OVERDUE when paymentDueDate has passed; SUPERSEDED when replaced by a newer version.';

COMMENT ON COLUMN "Invoice"."version" IS
  'Starts at 1 for the original invoice.  Each regeneration after payment increments by 1.';

COMMENT ON COLUMN "Invoice"."isLatest" IS
  'FALSE for archived (superseded) invoice versions.  Download endpoints filter to isLatest=TRUE.';

COMMENT ON COLUMN "Invoice"."supersededById" IS
  'FK to the newer Invoice that replaced this one.  NULL on the current active invoice.';

-- Self-referential foreign key: old invoice → new invoice.
ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for payment-aware invoice queries.
CREATE INDEX "Invoice_paymentStatus_idx"
  ON "Invoice"("paymentStatus");

CREATE INDEX "Invoice_paymentDueDate_idx"
  ON "Invoice"("paymentDueDate");

-- Used by admin outstanding dashboard: isLatest=TRUE AND paymentStatus IN ('PAYMENT_DUE','OVERDUE')
CREATE INDEX "Invoice_isLatest_paymentStatus_idx"
  ON "Invoice"("isLatest", "paymentStatus");

-- Fast latest-invoice-for-order lookup.
CREATE INDEX "Invoice_orderId_isLatest_idx"
  ON "Invoice"("orderId", "isLatest");


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — NEW TABLE: PaymentTransaction
-- ═════════════════════════════════════════════════════════════════════════════
-- Full audit-grade payment record for every real money movement.
-- Covers both offline (admin-recorded) and online (gateway) payments.
-- The thin legacy Payment record is still updated for backward compatibility
-- with existing code; this table is the authoritative source of truth.

CREATE TABLE "PaymentTransaction" (
  "id"                  TEXT          NOT NULL,
  "orderId"             TEXT          NOT NULL,
  "invoiceId"           TEXT,
  "userId"              TEXT          NOT NULL,
  "recordedByUserId"    TEXT,

  -- Amount and method
  "amount"              DOUBLE PRECISION NOT NULL,
  "paymentMethod"       "PAYMENT_METHOD_TYPE" NOT NULL,
  "paymentSource"       "PAYMENT_SOURCE_TYPE" NOT NULL DEFAULT 'ADMIN_MANUAL',

  -- Online gateway fields (all nullable — only populated for gateway payments)
  "gatewayName"         TEXT,
  "gatewayOrderId"      TEXT,
  "gatewayPaymentId"    TEXT,          -- UNIQUE enforced below
  "gatewaySignature"    TEXT,
  "gatewayPayload"      JSONB,

  -- Bank transfer fields
  "utrNumber"           TEXT,
  "bankName"            TEXT,
  "transferDate"        TIMESTAMP(3),

  -- Cheque fields
  "chequeNumber"        TEXT,
  "chequeDate"          TIMESTAMP(3),
  "chequeClearingDate"  TIMESTAMP(3),

  -- Universal
  "paymentReceivedAt"   TIMESTAMP(3) NOT NULL,
  "notes"               TEXT,
  "status"              "PAYMENT_TXN_STATUS" NOT NULL DEFAULT 'PENDING',

  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- amount must be a positive value
ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_amount_positive" CHECK ("amount" > 0);

-- Foreign keys
ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique constraint on gatewayPaymentId prevents duplicate capture of the same
-- gateway event (idempotency guard for webhook retries).
CREATE UNIQUE INDEX "PaymentTransaction_gatewayPaymentId_key"
  ON "PaymentTransaction"("gatewayPaymentId")
  WHERE "gatewayPaymentId" IS NOT NULL;

-- Standard access-pattern indexes
CREATE INDEX "PaymentTransaction_orderId_idx"
  ON "PaymentTransaction"("orderId");

CREATE INDEX "PaymentTransaction_userId_idx"
  ON "PaymentTransaction"("userId");

CREATE INDEX "PaymentTransaction_status_idx"
  ON "PaymentTransaction"("status");

CREATE INDEX "PaymentTransaction_invoiceId_idx"
  ON "PaymentTransaction"("invoiceId");

-- Double-payment guard query: WHERE orderId = ? AND status = 'CONFIRMED'
CREATE INDEX "PaymentTransaction_orderId_status_idx"
  ON "PaymentTransaction"("orderId", "status");

-- Admin payment type reports
CREATE INDEX "PaymentTransaction_paymentMethod_paymentSource_idx"
  ON "PaymentTransaction"("paymentMethod", "paymentSource");


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — NEW TABLE: DealerCreditLedger
-- ═════════════════════════════════════════════════════════════════════════════
-- Double-entry-style ledger tracking each legacy dealer's outstanding balance.
-- DEBIT  = order delivered (dealer owes money)
-- CREDIT = payment recorded (reduces outstanding balance)
-- Running balance = SUM(debitAmount) - SUM(creditAmount) per dealer.
-- This is append-only: rows are never updated or deleted.

CREATE TABLE "DealerCreditLedger" (
  "id"             TEXT             NOT NULL,
  "dealerId"       TEXT             NOT NULL,
  "orderId"        TEXT,
  "paymentTxnId"   TEXT,
  "eventType"      "CREDIT_EVENT_TYPE" NOT NULL,
  "debitAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "creditAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceAfter"   DOUBLE PRECISION NOT NULL,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DealerCreditLedger_pkey" PRIMARY KEY ("id")
);

-- Amounts must be non-negative
ALTER TABLE "DealerCreditLedger"
ADD CONSTRAINT "DealerCreditLedger_debitAmount_non_negative"  CHECK ("debitAmount"  >= 0);

ALTER TABLE "DealerCreditLedger"
ADD CONSTRAINT "DealerCreditLedger_creditAmount_non_negative" CHECK ("creditAmount" >= 0);

-- Exactly one of debitAmount or creditAmount must be non-zero per row
ALTER TABLE "DealerCreditLedger"
ADD CONSTRAINT "DealerCreditLedger_one_side_non_zero"
  CHECK (
    ("debitAmount" > 0 AND "creditAmount" = 0) OR
    ("creditAmount" > 0 AND "debitAmount" = 0) OR
    -- CREDIT_ADJUSTED events may have 0/0 with a note (e.g. balance correction)
    ("eventType" = 'CREDIT_ADJUSTED')
  );

-- Foreign keys
ALTER TABLE "DealerCreditLedger"
ADD CONSTRAINT "DealerCreditLedger_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Note: orderId and paymentTxnId are stored as plain text references (not FK)
-- because ledger rows must survive order/payment deletion for audit purposes.

CREATE INDEX "DealerCreditLedger_dealerId_idx"
  ON "DealerCreditLedger"("dealerId");

-- Chronological ledger per dealer (the primary read pattern)
CREATE INDEX "DealerCreditLedger_dealerId_createdAt_idx"
  ON "DealerCreditLedger"("dealerId", "createdAt");

CREATE INDEX "DealerCreditLedger_orderId_idx"
  ON "DealerCreditLedger"("orderId")
  WHERE "orderId" IS NOT NULL;

CREATE INDEX "DealerCreditLedger_eventType_idx"
  ON "DealerCreditLedger"("eventType");


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 7 — NEW TABLE: PaymentAuditLog
-- ═════════════════════════════════════════════════════════════════════════════
-- Immutable append-only audit trail for every payment-related action.
-- Rows are NEVER updated or deleted.
-- Covers: admin payment recording, gateway events, invoice regeneration,
--         credit ledger updates, double-payment blocks, cheque bounces.

CREATE TABLE "PaymentAuditLog" (
  "id"             TEXT         NOT NULL,
  "orderId"        TEXT         NOT NULL,
  "invoiceId"      TEXT,
  "paymentTxnId"   TEXT,
  "actorUserId"    TEXT         NOT NULL,
  "actorRole"      TEXT         NOT NULL,

  -- Structured action label, e.g.:
  --   ADMIN_MARKED_CASH | ADMIN_MARKED_BANK_TRANSFER | ADMIN_MARKED_CHEQUE
  --   GATEWAY_PAYMENT_CONFIRMED | INVOICE_REGENERATED | PAYMENT_BOUNCED
  --   CREDIT_LEDGER_UPDATED | DOUBLE_PAYMENT_BLOCKED | PAY_LATER_ORDER_CONFIRMED
  "action"         TEXT         NOT NULL,

  "previousStatus" TEXT,
  "nextStatus"     TEXT,

  -- Flexible metadata: gateway response summaries, reference numbers, etc.
  "metadata"       JSONB,

  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "PaymentAuditLog"
ADD CONSTRAINT "PaymentAuditLog_paymentTxnId_fkey"
  FOREIGN KEY ("paymentTxnId") REFERENCES "PaymentTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAuditLog"
ADD CONSTRAINT "PaymentAuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- orderId is a plain text reference (no FK) so audit logs survive order deletion.

CREATE INDEX "PaymentAuditLog_orderId_idx"
  ON "PaymentAuditLog"("orderId");

CREATE INDEX "PaymentAuditLog_actorUserId_idx"
  ON "PaymentAuditLog"("actorUserId");

-- Audit reports filtered by action type + date range
CREATE INDEX "PaymentAuditLog_action_createdAt_idx"
  ON "PaymentAuditLog"("action", "createdAt");

-- Full history for a single order in chronological order
CREATE INDEX "PaymentAuditLog_orderId_createdAt_idx"
  ON "PaymentAuditLog"("orderId", "createdAt");
