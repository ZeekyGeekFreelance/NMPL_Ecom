# Phase 2 — Data Model & Database Design
## NMPL B2B E-Commerce Platform — Legacy Dealer Pay-Later

---

## 1. OVERVIEW OF CHANGES

| Category | Item | Type |
|---|---|---|
| Modified table | `User` | +1 column |
| Modified table | `DealerProfile` | +2 columns, +1 constraint, +1 index |
| Modified table | `Order` | +2 columns, +3 indexes |
| Modified table | `Invoice` | +6 columns, +1 FK, +4 indexes |
| New enum | `PAYMENT_METHOD_TYPE` | 7 values |
| New enum | `PAYMENT_SOURCE_TYPE` | 3 values |
| New enum | `PAYMENT_TXN_STATUS` | 4 values |
| New enum | `INVOICE_PAYMENT_STATUS` | 4 values |
| New enum | `CREDIT_EVENT_TYPE` | 4 values |
| New table | `PaymentTransaction` | Full payment record |
| New table | `DealerCreditLedger` | Running credit balance |
| New table | `PaymentAuditLog` | Immutable audit trail |

---

## 2. MODIFIED TABLES

### 2a. User

```sql
"mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE
```

**Purpose:** When `TRUE`, the sign-in response includes a `requiresPasswordChange` flag
and the client immediately redirects to the forced password-change page.
Set to `TRUE` when admin creates a legacy dealer with a temporary password.
Cleared to `FALSE` after the dealer successfully changes their password.

**Impact on existing data:** All existing rows default to `FALSE` — no behavioral change.

---

### 2b. DealerProfile

```sql
"payLaterEnabled"  BOOLEAN NOT NULL DEFAULT FALSE
"creditTermDays"   INTEGER NOT NULL DEFAULT 30
-- + CHECK: creditTermDays > 0
-- + INDEX: payLaterEnabled
```

**Purpose:**
- `payLaterEnabled`: The master switch. Only `LEGACY` dealers have this set to `TRUE`.
  Normal and newly-registered dealers always have `FALSE`.
- `creditTermDays`: Number of calendar days after delivery within which payment is due.
  Defaults to 30 (NET 30). Can be customized per dealer in the future.

**Business rule enforcement:**
```
payLaterEnabled = TRUE  → only if DealerProfile.status = 'LEGACY'
payLaterEnabled = FALSE → all other statuses (PENDING, APPROVED, REJECTED, SUSPENDED)
```

**Impact on existing data:** All existing rows default to `FALSE` / `30` — no change.

---

### 2c. Order

```sql
"isPayLater"      BOOLEAN      NOT NULL DEFAULT FALSE
"paymentDueDate"  TIMESTAMP(3)
-- + INDEX: isPayLater
-- + INDEX: paymentDueDate
-- + INDEX: (isPayLater, status, paymentDueDate)  ← compound for dashboard queries
```

**Purpose:**
- `isPayLater`: Immutable snapshot of `DealerProfile.payLaterEnabled` at order placement
  time. Decoupled from the dealer's current status — if a dealer is converted from LEGACY
  to APPROVED later, their already-placed pay-later orders remain correctly flagged.
- `paymentDueDate`: Set when the order reaches `DELIVERED` status:
  `paymentDueDate = deliveredAt + DealerProfile.creditTermDays days`
  `NULL` for all prepaid and non-pay-later orders.

**Impact on existing data:** All existing orders default to `isPayLater = FALSE`, `paymentDueDate = NULL`.

---

### 2d. Invoice

```sql
"paymentStatus"   INVOICE_PAYMENT_STATUS NOT NULL DEFAULT 'PAID'
"paymentTerms"    TEXT
"paymentDueDate"  TIMESTAMP(3)
"version"         INTEGER      NOT NULL DEFAULT 1
"isLatest"        BOOLEAN      NOT NULL DEFAULT TRUE
"supersededById"  TEXT         -- FK → Invoice.id (self-referential)
-- + INDEX: paymentStatus
-- + INDEX: paymentDueDate
-- + INDEX: (isLatest, paymentStatus)   ← outstanding dashboard
-- + INDEX: (orderId, isLatest)         ← latest invoice lookup
```

**Purpose:**
- `paymentStatus`: What the invoice document shows. Transitions:
  - `PAID` — all prepaid orders; pay-later orders after payment recorded
  - `PAYMENT_DUE` — pay-later orders at DELIVERED, before payment deadline
  - `OVERDUE` — set by background job when `paymentDueDate < now` and not yet PAID
  - `SUPERSEDED` — old version after invoice regeneration
- `paymentTerms`: Printed on pay-later invoice PDFs: `"NET 30 DAYS"`
- `paymentDueDate`: Mirrored from `Order.paymentDueDate` for direct invoice queries
- `version / isLatest / supersededById`: Invoice versioning for regeneration after payment.
  When payment is recorded, the current invoice becomes `isLatest=FALSE, paymentStatus=SUPERSEDED`
  and a new invoice is created with `version=old+1, isLatest=TRUE, paymentStatus=PAID`.

**Impact on existing data:** All existing invoices default to `paymentStatus=PAID, version=1, isLatest=TRUE` — no behavioral change.

---

## 3. NEW TABLES

### 3a. PaymentTransaction

**Role:** The authoritative payment record for every real money movement.
Replaces the thin `Payment` model for new flows. The legacy `Payment` record
is still updated in parallel for backward compatibility with existing code.

```
PaymentTransaction
├── id                  UUID PK
├── orderId             FK → Order       (RESTRICT on delete)
├── invoiceId           FK → Invoice     (SET NULL on delete)
├── userId              FK → User        (payer/dealer, RESTRICT)
├── recordedByUserId    FK → User        (admin actor, SET NULL)
│
├── amount              FLOAT  CHECK > 0
├── paymentMethod       PAYMENT_METHOD_TYPE
├── paymentSource       PAYMENT_SOURCE_TYPE  DEFAULT ADMIN_MANUAL
│
├── ── Gateway fields ──────────────────────────────────────────
├── gatewayName         TEXT?
├── gatewayOrderId      TEXT?
├── gatewayPaymentId    TEXT?  UNIQUE (partial index, NOT NULL only)
├── gatewaySignature    TEXT?
├── gatewayPayload      JSONB?
│
├── ── Bank transfer fields ─────────────────────────────────────
├── utrNumber           TEXT?
├── bankName            TEXT?
├── transferDate        TIMESTAMP?
│
├── ── Cheque fields ───────────────────────────────────────────
├── chequeNumber        TEXT?
├── chequeDate          TIMESTAMP?
├── chequeClearingDate  TIMESTAMP?
│
├── paymentReceivedAt   TIMESTAMP  (cash date / gateway timestamp)
├── notes               TEXT?
├── status              PAYMENT_TXN_STATUS  DEFAULT PENDING
│
├── createdAt           TIMESTAMP
└── updatedAt           TIMESTAMP
```

**Key constraints:**
- `amount > 0` — prevents zero-value payment records
- `gatewayPaymentId UNIQUE WHERE NOT NULL` — idempotency: webhook retries cannot
  create duplicate records for the same gateway payment
- `orderId RESTRICT` — prevents order deletion while payment records exist

**Key indexes:**
- `(orderId, status)` — double-payment guard query
- `gatewayPaymentId` — O(1) idempotency lookup
- `(paymentMethod, paymentSource)` — payment type reports

---

### 3b. DealerCreditLedger

**Role:** Double-entry-style ledger tracking each legacy dealer's outstanding balance.
Append-only — rows are never updated or deleted.

```
DealerCreditLedger
├── id             UUID PK
├── dealerId       FK → User   (RESTRICT — ledger survives dealer deactivation)
├── orderId        TEXT?       (plain ref — no FK, survives order deletion)
├── paymentTxnId   TEXT?       (plain ref — no FK, survives payment deletion)
├── eventType      CREDIT_EVENT_TYPE
├── debitAmount    FLOAT  DEFAULT 0  CHECK >= 0
├── creditAmount   FLOAT  DEFAULT 0  CHECK >= 0
├── balanceAfter   FLOAT              (running balance AFTER this entry)
├── notes          TEXT?
└── createdAt      TIMESTAMP
```

**Business rules enforced by constraint:**
- Exactly one of `debitAmount` or `creditAmount` is non-zero per row
  (except `CREDIT_ADJUSTED` events which may have both zero with a note)

**Event → column mapping:**
| Event | debitAmount | creditAmount | Meaning |
|---|---|---|---|
| ORDER_DELIVERED | order.amount | 0 | Dealer owes money |
| PAYMENT_RECEIVED | 0 | payment.amount | Dealer paid |
| ORDER_CANCELLED | 0 | cancelled.amount | Reverse the debit |
| CREDIT_ADJUSTED | varies | varies | Manual correction |

**Outstanding balance query:**
```sql
SELECT SUM("debitAmount") - SUM("creditAmount") AS "outstandingBalance"
FROM "DealerCreditLedger"
WHERE "dealerId" = $1;
```

Or equivalently, read the `balanceAfter` from the latest row:
```sql
SELECT "balanceAfter"
FROM "DealerCreditLedger"
WHERE "dealerId" = $1
ORDER BY "createdAt" DESC
LIMIT 1;
```

---

### 3c. PaymentAuditLog

**Role:** Immutable append-only audit trail for every payment-related action.
Rows are **never updated or deleted**. Required for compliance, dispute resolution,
and security auditing.

```
PaymentAuditLog
├── id             UUID PK
├── orderId        TEXT          (plain ref — no FK, survives order deletion)
├── invoiceId      TEXT?
├── paymentTxnId   FK → PaymentTransaction  (SET NULL on delete)
├── actorUserId    FK → User               (RESTRICT)
├── actorRole      TEXT
├── action         TEXT          (structured label — see action catalogue below)
├── previousStatus TEXT?
├── nextStatus     TEXT?
├── metadata       JSONB?
└── createdAt      TIMESTAMP
```

**Action catalogue:**
| Action | When written |
|---|---|
| `ADMIN_MARKED_CASH` | Admin records cash payment |
| `ADMIN_MARKED_BANK_TRANSFER` | Admin records bank transfer |
| `ADMIN_MARKED_CHEQUE` | Admin records cheque payment |
| `GATEWAY_PAYMENT_CONFIRMED` | Gateway webhook confirms payment |
| `PAY_LATER_ORDER_CONFIRMED` | Admin confirms pay-later order for delivery (no payment required) |
| `INVOICE_REGENERATED` | Invoice superseded after payment recorded |
| `PAYMENT_BOUNCED` | Cheque bounce recorded |
| `PAYMENT_REVERSED` | Gateway refund or admin reversal |
| `CREDIT_LEDGER_UPDATED` | DealerCreditLedger entry written |
| `DOUBLE_PAYMENT_BLOCKED` | Attempt to record payment on already-paid order |
| `OVERDUE_FLAGGED` | Background job flagged invoice as OVERDUE |
| `FORCED_PASSWORD_CHANGE_SET` | mustChangePassword set on new legacy dealer account |

---

## 4. ENTITY RELATIONSHIP MAP

```
User ──────────────────────────────────────────────────────────────────────┐
 │                                                                          │
 ├── DealerProfile (1:1)                                                   │
 │     payLaterEnabled → drives isPayLater snapshot on Order               │
 │     creditTermDays  → drives paymentDueDate on Order at DELIVERED       │
 │                                                                          │
 ├── Order (1:N)                                                           │
 │     isPayLater      → snapshot of DealerProfile.payLaterEnabled        │
 │     paymentDueDate  → set at DELIVERED                                  │
 │     │                                                                    │
 │     ├── Transaction (1:1)        lifecycle state machine                │
 │     ├── OrderReservation (1:1)   stock hold                             │
 │     ├── Payment (1:1)            legacy thin record                     │
 │     ├── Invoice (1:1)            ────────────────────────────────┐      │
 │     │     paymentStatus          PAID / PAYMENT_DUE / OVERDUE   │      │
 │     │     version + isLatest     versioning chain                │      │
 │     │     supersededById ────────► newer Invoice                 │      │
 │     │                             (self-referential 1:1)         │      │
 │     │                                                             │      │
 │     └── PaymentTransaction (1:N) ──────────────────────────────►│      │
 │           orderId FK                                              │      │
 │           invoiceId FK ──────────────────────────────────────────┘      │
 │           userId FK (payer) ──────────────────────────────────────────► │
 │           recordedByUserId FK (admin) ─────────────────────────────────►│
 │           │                                                              │
 │           └── PaymentAuditLog (1:N)                                     │
 │                 paymentTxnId FK                                         │
 │                 actorUserId FK ─────────────────────────────────────────┘
 │
 └── DealerCreditLedger (1:N)
       dealerId FK
       orderId (plain ref)
       paymentTxnId (plain ref)
       debitAmount / creditAmount / balanceAfter
```

---

## 5. MIGRATION STRATEGY

### Migration files produced

| File | Contents |
|---|---|
| `20260311100000_legacy_dealer_pay_later_enums/migration.sql` | All 5 new `CREATE TYPE ... AS ENUM` statements |
| `20260311100100_legacy_dealer_pay_later_schema/migration.sql` | All column additions, new tables, constraints, indexes |

### Why two files?

PostgreSQL requires enum type creation to be committed in its own transaction
before any DML or DDL that *references* those types can execute. The project
already uses this pattern (see `20260306113000_add_dealer_role_upgrade`).

### Deployment sequence

```
Step 1: prisma migrate deploy
        → 20260311100000 runs: 5 new enum types created and committed
        → 20260311100100 runs: all columns, tables, constraints, indexes added

Step 2: prisma generate
        → Regenerate Prisma Client with new types and models

Step 3: Deploy server (Phase 3 service changes)
        → New endpoints go live; existing flows untouched
```

### Zero-downtime guarantee

Every new column has a `NOT NULL DEFAULT` or is nullable:
- `User.mustChangePassword` — DEFAULT FALSE
- `DealerProfile.payLaterEnabled` — DEFAULT FALSE
- `DealerProfile.creditTermDays` — DEFAULT 30
- `Order.isPayLater` — DEFAULT FALSE
- `Order.paymentDueDate` — nullable
- `Invoice.paymentStatus` — DEFAULT 'PAID'
- `Invoice.version` — DEFAULT 1
- `Invoice.isLatest` — DEFAULT TRUE
- `Invoice.*` new columns — nullable or defaulted

No existing column is altered or removed. No existing data requires transformation.
All existing service code continues to function without modification until Phase 3.

### Rollback plan

```sql
-- If rollback is required (before Phase 3 service code ships):

-- Remove new tables
DROP TABLE IF EXISTS "PaymentAuditLog";
DROP TABLE IF EXISTS "DealerCreditLedger";
DROP TABLE IF EXISTS "PaymentTransaction";

-- Remove Invoice additions
ALTER TABLE "Invoice"
  DROP COLUMN IF EXISTS "paymentStatus",
  DROP COLUMN IF EXISTS "paymentTerms",
  DROP COLUMN IF EXISTS "paymentDueDate",
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "isLatest",
  DROP COLUMN IF EXISTS "supersededById";

-- Remove Order additions
ALTER TABLE "Order"
  DROP COLUMN IF EXISTS "isPayLater",
  DROP COLUMN IF EXISTS "paymentDueDate";

-- Remove DealerProfile additions
ALTER TABLE "DealerProfile"
  DROP COLUMN IF EXISTS "payLaterEnabled",
  DROP COLUMN IF EXISTS "creditTermDays";

-- Remove User additions
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "mustChangePassword";

-- Drop new enum types
DROP TYPE IF EXISTS "CREDIT_EVENT_TYPE";
DROP TYPE IF EXISTS "INVOICE_PAYMENT_STATUS";
DROP TYPE IF EXISTS "PAYMENT_TXN_STATUS";
DROP TYPE IF EXISTS "PAYMENT_SOURCE_TYPE";
DROP TYPE IF EXISTS "PAYMENT_METHOD_TYPE";
```

---

## 6. BUSINESS RULE ENFORCEMENT POINTS

| Rule | Where enforced |
|---|---|
| `payLaterEnabled = TRUE` only for LEGACY dealers | `UserService.createDealer()` — application layer |
| `isPayLater` snapshot set at order placement | `OrderService.createOrderFromCart()` |
| `paymentDueDate` set only at DELIVERED | `TransactionService.updateTransactionStatus()` |
| No payment on non-DELIVERED pay-later orders | `PaymentService.recordManualPayment()` status guard |
| Double-payment blocked | `PaymentTransaction (orderId, status='CONFIRMED')` unique check |
| Gateway duplicate blocked | `PaymentTransaction.gatewayPaymentId UNIQUE` constraint |
| Invoice download serves only isLatest=TRUE | `InvoiceService.downloadInvoice()` filter |
| Audit log written for every payment action | `PaymentService` — all mutation paths |
| Credit ledger written at DELIVERED + at payment | `TransactionService` + `PaymentService` |
| OVERDUE flag set by background job | Scheduled worker, not by user-facing API |
