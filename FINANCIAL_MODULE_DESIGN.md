# Financial Module Design Document
**Phase 3: Weeks 11-12**
**Created:** 2025-01-15
**Status:** Design Complete - Ready for Implementation

---

## Business Requirements Summary

### Invoice Generation
- **Nightly reservations:** Generate invoice at check-in
- **Long-term stays (monthly/seasonal):** Generate invoices just-in-time at user-defined intervals (configured in Settings)
- **Invoice numbering:** `INV-{PropertyCode}-{YY}-{SequenceNumber}` (e.g., `INV-YY-25-00001`)
  - Per-property sequence counter
  - Follows same pattern as confirmation numbers
- **Tax support:** Property-level tax rate configured in Settings

### Payment Plans & Installments
- **Scope:** Long-term stays (monthly or greater, including Seasonals)
- **Generation:** Just-in-time (create next invoice when payment period arrives, not all upfront)
- **Automation:** Configurable intervals in Settings

### Late Fees & Refunds
- **Late fees:** Configurable in Settings (amount, percentage, grace period)
- **Refunds:** Follow cancellation policy rules configured in Settings
- **Refund methods:** Stripe auto-refund, manual refund (cash/check), store credit

### Transaction Tracking
✅ **In Scope for Phase 3:**
1. Reservation payments (guest → property)
2. Refunds (property → guest)
3. Security deposits (hold & release)
4. Property expenses (utilities, maintenance)
5. Platform transaction fees (Camp-OS charges per transaction over monthly limit)
6. Owner payouts (if platform takes commission)

❌ **Out of Scope (Later Phase):**
- Financial reporting dashboards (separate Reporting Module)

### Module Boundaries & Ownership
**CRITICAL ARCHITECTURAL DECISION:**
- **Financial Module is SOURCE OF TRUTH for all money tracking**
- **BookingEngine Reservation aggregate:**
  - Remove `paidAmount` field (Financial owns this)
  - Remove `paymentStatus` field (derive from Financial)
  - Keep `totalAmount` (pricing is BookingEngine's responsibility)
  - Query Financial module to get balance due
- **Event-driven synchronization:**
  - BookingEngine publishes `PaymentReceived`, `ReservationCancelled` events
  - Financial subscribes and creates Transaction/Invoice records

### Data Migration Strategy
- Clone current instance
- Apply all migrations to isolated new instance
- Clean cutover (no dual-write period needed)

---

## Domain Model

### Bounded Context: Financial
**Responsibilities:**
- Track all financial transactions (payments, refunds, fees, deposits, expenses)
- Generate and manage invoices for reservations
- Calculate balances due and payment status
- Enforce payment plan schedules
- Process refunds following cancellation policies
- Track platform transaction fees and property expenses

**NOT Responsible For:**
- Pricing calculations (BookingEngine owns nightly rates, discounts)
- Reservation lifecycle (BookingEngine owns booking workflow)
- Reporting/analytics (separate Reporting Module)

---

## Aggregates

### 1. Transaction (Aggregate Root)
**Purpose:** Record of any money movement in/out of the system

**Properties:**
```typescript
{
  id: string (UUID)
  propertyId: string
  reservationId: string | null  // Null for property expenses
  invoiceId: string | null      // Link to invoice if part of payment plan

  // Transaction details
  type: TransactionType  // payment | refund | deposit | deposit_release | expense | platform_fee | payout
  amountCents: number
  currency: string  // Default 'USD'

  // Payment method
  paymentMethod: PaymentMethod  // credit_card | debit_card | cash | check | bank_transfer | stripe
  stripePaymentIntentId: string | null
  stripeRefundId: string | null

  // Status & metadata
  status: TransactionStatus  // pending | completed | failed | cancelled
  processedAt: Date | null
  failureReason: string | null
  notes: string | null

  // Reconciliation
  reconciledAt: Date | null
  reconciledBy: string | null

  // Audit
  createdAt: Date
  createdBy: string  // User ID or 'system'
  updatedAt: Date
}
```

**Business Rules:**
- Amount must be non-negative (use `type` to indicate direction)
- Refund must reference original payment transaction
- Deposit release must reference deposit transaction
- Cannot modify completed transactions (create reversal instead)
- Stripe transactions must have valid Stripe ID

**Domain Events:**
- `TransactionRecorded`
- `TransactionCompleted`
- `TransactionFailed`
- `RefundProcessed`
- `DepositReleased`

---

### 2. Invoice (Aggregate Root)
**Purpose:** Billing document for reservation payment (especially installment plans)

**Properties:**
```typescript
{
  id: string (UUID)
  propertyId: string
  reservationId: string

  // Invoice identification
  invoiceNumber: InvoiceNumber  // Value object: INV-YY-25-00001

  // Amounts (all in cents)
  subtotalCents: number        // Before tax
  taxCents: number             // Calculated from property tax rate
  totalCents: number           // subtotal + tax
  paidCents: number            // How much paid against this invoice
  balanceCents: number         // total - paid

  // Invoice line items (embedded value objects, not separate aggregate)
  lineItems: InvoiceLineItem[]

  // Payment plan details
  isInstallment: boolean
  installmentNumber: number | null  // e.g., "2 of 6"
  installmentTotal: number | null

  // Due date & status
  dueDate: Date
  status: InvoiceStatus  // draft | issued | paid | overdue | cancelled

  // Tax
  taxRate: number  // Percentage (e.g., 7.5 for 7.5%)

  // Dates
  issuedAt: Date | null
  paidAt: Date | null
  cancelledAt: Date | null

  // Audit
  createdAt: Date
  updatedAt: Date
}
```

**Business Rules:**
- Invoice number must be unique per property
- Cannot modify issued invoice (create credit note instead)
- Total = subtotal + tax (must always balance)
- Balance = total - paid (derived, not stored)
- Overdue if dueDate < today && status != paid
- Installment invoices must have installmentNumber and installmentTotal

**Domain Events:**
- `InvoiceGenerated`
- `InvoiceIssued`
- `InvoicePaymentReceived`
- `InvoicePaid` (when fully paid)
- `InvoiceOverdue`
- `InvoiceCancelled`

**Value Object: InvoiceLineItem**
```typescript
{
  description: string       // e.g., "Night 1-5 @ $50/night"
  quantity: number          // e.g., 5 nights
  unitPriceCents: number    // e.g., 5000 ($50.00)
  totalCents: number        // quantity * unitPrice
}
```

---

### 3. PaymentPlan (Aggregate Root)
**Purpose:** Manages installment schedule for long-term reservations

**Properties:**
```typescript
{
  id: string (UUID)
  propertyId: string
  reservationId: string

  // Plan details
  totalAmountCents: number
  numberOfInstallments: number
  installmentIntervalDays: number  // e.g., 30 for monthly

  // Schedule
  startDate: Date
  invoiceIds: string[]  // Ordered list of invoice IDs

  // Status
  status: PaymentPlanStatus  // active | completed | cancelled | defaulted

  // Audit
  createdAt: Date
  updatedAt: Date
}
```

**Business Rules:**
- Must have at least 2 installments
- Total of all invoice amounts must equal plan total
- Cannot cancel plan if any invoice is paid
- Mark as defaulted if payment is >30 days overdue (configurable)

**Domain Events:**
- `PaymentPlanCreated`
- `PaymentPlanInstallmentDue`
- `PaymentPlanCompleted`
- `PaymentPlanDefaulted`

---

### 4. SecurityDeposit (Aggregate Root)
**Purpose:** Track security deposit hold, deductions, and release

**Properties:**
```typescript
{
  id: string (UUID)
  propertyId: string
  reservationId: string

  // Amounts
  depositAmountCents: number
  deductionsCents: number
  releasedAmountCents: number

  // Status
  status: DepositStatus  // held | partially_released | fully_released | forfeited

  // Stripe
  stripePaymentIntentId: string | null

  // Lifecycle
  heldAt: Date
  releasedAt: Date | null
  forfeitedAt: Date | null
  deductions: DepositDeduction[]  // Value object array

  // Audit
  createdAt: Date
  updatedAt: Date
}
```

**Value Object: DepositDeduction**
```typescript
{
  amountCents: number
  reason: string
  deductedAt: Date
  deductedBy: string  // User ID
}
```

**Business Rules:**
- Cannot release more than deposited - deductions
- Cannot deduct from released deposit
- Deductions must have reason

**Domain Events:**
- `SecurityDepositHeld`
- `SecurityDepositDeducted`
- `SecurityDepositReleased`
- `SecurityDepositForfeited`

---

## Value Objects

### 1. MoneyAmount
**Reuse from BookingEngine:** `src/modules/BookingEngine/domain/value-objects/MoneyAmount.ts`

Already has:
- Integer cents storage
- Business rules (non-negative, max value, integer-only)
- Operations (add, subtract, multiply)
- Formatting and comparison

### 2. InvoiceNumber
```typescript
class InvoiceNumber extends ValueObject {
  private constructor(
    public readonly propertyCode: string,
    public readonly year: string,
    public readonly sequence: number
  ) {}

  static create(propertyCode: string, year: string, sequence: number): InvoiceNumber
  static parse(invoiceNumberString: string): InvoiceNumber  // Parse "INV-YY-25-00001"

  get value(): string  // Returns "INV-YY-25-00001"
}
```

### 3. PaymentMethod
```typescript
enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  CASH = 'cash',
  CHECK = 'check',
  BANK_TRANSFER = 'bank_transfer',
  STRIPE = 'stripe',
  STORE_CREDIT = 'store_credit'
}
```

### 4. TransactionType
```typescript
enum TransactionType {
  PAYMENT = 'payment',               // Guest pays for reservation
  REFUND = 'refund',                 // Property refunds guest
  DEPOSIT = 'deposit',               // Security deposit held
  DEPOSIT_RELEASE = 'deposit_release', // Deposit returned
  DEPOSIT_DEDUCTION = 'deposit_deduction', // Deduction from deposit
  EXPENSE = 'expense',               // Property expense (utilities, etc.)
  PLATFORM_FEE = 'platform_fee',     // Camp-OS transaction fee
  PAYOUT = 'payout'                  // Platform pays property owner
}
```

---

## Domain Events

### Published by Financial Module

```typescript
// Transaction events
class TransactionRecorded extends DomainEvent {
  constructor(
    public transactionId: string,
    public propertyId: string,
    public reservationId: string | null,
    public type: TransactionType,
    public amountCents: number,
    public paymentMethod: PaymentMethod
  )
}

class TransactionCompleted extends DomainEvent {
  constructor(
    public transactionId: string,
    public stripePaymentIntentId: string | null
  )
}

class RefundProcessed extends DomainEvent {
  constructor(
    public transactionId: string,
    public originalTransactionId: string,
    public amountCents: number,
    public stripeRefundId: string | null
  )
}

// Invoice events
class InvoiceGenerated extends DomainEvent {
  constructor(
    public invoiceId: string,
    public invoiceNumber: string,
    public reservationId: string,
    public totalCents: number,
    public dueDate: Date
  )
}

class InvoicePaymentReceived extends DomainEvent {
  constructor(
    public invoiceId: string,
    public transactionId: string,
    public amountCents: number
  )
}

class InvoicePaid extends DomainEvent {
  constructor(
    public invoiceId: string,
    public paidAt: Date
  )
}

class InvoiceOverdue extends DomainEvent {
  constructor(
    public invoiceId: string,
    public balanceCents: number,
    public daysPastDue: number
  )
}

// Payment plan events
class PaymentPlanCreated extends DomainEvent {
  constructor(
    public paymentPlanId: string,
    public reservationId: string,
    public numberOfInstallments: number
  )
}

class PaymentPlanInstallmentDue extends DomainEvent {
  constructor(
    public paymentPlanId: string,
    public invoiceId: string,
    public installmentNumber: number,
    public dueDate: Date
  )
}

// Deposit events
class SecurityDepositHeld extends DomainEvent {
  constructor(
    public depositId: string,
    public reservationId: string,
    public amountCents: number,
    public stripePaymentIntentId: string | null
  )
}

class SecurityDepositReleased extends DomainEvent {
  constructor(
    public depositId: string,
    public releasedAmountCents: number,
    public deductionsCents: number
  )
}
```

### Subscribed Events (from other modules)

```typescript
// From BookingEngine
- ReservationConfirmed → Generate invoice(s)
- ReservationCancelled → Process refund (if applicable)
- GuestCheckedIn → Mark invoice as issued (for nightly reservations)
- GuestCheckedOut → Release security deposit (if applicable)
- PaymentReceived → Record transaction (MIGRATE THIS TO FINANCIAL)
```

---

## Application Layer (CQRS)

### Commands

```typescript
// Transaction commands
RecordPaymentCommand
ProcessRefundCommand
RecordExpenseCommand
RecordPlatformFeeCommand

// Invoice commands
GenerateInvoiceCommand
IssueInvoiceCommand
CancelInvoiceCommand
ApplyPaymentToInvoiceCommand

// Payment plan commands
CreatePaymentPlanCommand
GenerateNextInstallmentCommand

// Deposit commands
HoldSecurityDepositCommand
DeductFromDepositCommand
ReleaseSecurityDepositCommand
```

### Queries

```typescript
GetTransactionQuery
GetTransactionsByReservationQuery
GetTransactionsByPropertyQuery

GetInvoiceQuery
GetInvoicesByReservationQuery
GetOverdueInvoicesQuery

GetPaymentPlanQuery

GetSecurityDepositQuery

GetReservationBalanceQuery  // Returns total owed, paid, balance
GetPropertyRevenueQuery     // Date range revenue summary
```

---

## Infrastructure Layer

### Repositories

```typescript
interface ITransactionRepository {
  findById(id: string): Promise<Transaction | null>
  findByReservation(reservationId: string): Promise<Transaction[]>
  findByProperty(propertyId: string, filters?: TransactionFilters): Promise<Transaction[]>
  save(transaction: Transaction): Promise<void>
  nextTransactionNumber(): Promise<number>
}

interface IInvoiceRepository {
  findById(id: string): Promise<Invoice | null>
  findByInvoiceNumber(invoiceNumber: InvoiceNumber): Promise<Invoice | null>
  findByReservation(reservationId: string): Promise<Invoice[]>
  findOverdueInvoices(propertyId: string): Promise<Invoice[]>
  save(invoice: Invoice): Promise<void>
  nextInvoiceSequence(propertyId: string, year: string): Promise<number>
}

interface IPaymentPlanRepository {
  findById(id: string): Promise<PaymentPlan | null>
  findByReservation(reservationId: string): Promise<PaymentPlan | null>
  save(paymentPlan: PaymentPlan): Promise<void>
}

interface ISecurityDepositRepository {
  findById(id: string): Promise<SecurityDeposit | null>
  findByReservation(reservationId: string): Promise<SecurityDeposit | null>
  save(deposit: SecurityDeposit): Promise<void>
}
```

### External Services

```typescript
interface IPaymentProcessor {
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>
  capturePayment(paymentIntentId: string): Promise<void>
  processRefund(paymentIntentId: string, amountCents: number): Promise<RefundResult>
  holdDeposit(params: HoldDepositParams): Promise<PaymentIntentResult>
  releaseDeposit(paymentIntentId: string): Promise<void>
}

// Implementation: StripePaymentProcessor (uses lib/stripe/tenant-client.ts)
```

---

## Database Schema

### `financial.transactions` table
```sql
CREATE TABLE financial.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES financial.invoices(id) ON DELETE SET NULL,

  -- Transaction details
  type VARCHAR(50) NOT NULL,  -- payment, refund, deposit, etc.
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) DEFAULT 'USD',

  -- Payment method
  payment_method VARCHAR(50) NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  stripe_refund_id VARCHAR(255),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  notes TEXT,

  -- Reconciliation
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID REFERENCES auth.users(id),

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  CONSTRAINT valid_type CHECK (type IN ('payment', 'refund', 'deposit', 'deposit_release', 'deposit_deduction', 'expense', 'platform_fee', 'payout')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_transactions_property ON financial.transactions(property_id);
CREATE INDEX idx_transactions_reservation ON financial.transactions(reservation_id);
CREATE INDEX idx_transactions_invoice ON financial.transactions(invoice_id);
CREATE INDEX idx_transactions_type ON financial.transactions(type);
CREATE INDEX idx_transactions_status ON financial.transactions(status);
CREATE INDEX idx_transactions_processed_at ON financial.transactions(processed_at);
```

### `financial.invoices` table
```sql
CREATE TABLE financial.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Invoice identification
  invoice_number VARCHAR(50) NOT NULL UNIQUE,  -- INV-YY-25-00001

  -- Amounts (cents)
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),

  -- Line items (JSONB)
  line_items JSONB NOT NULL,

  -- Payment plan
  is_installment BOOLEAN DEFAULT FALSE,
  installment_number INTEGER,
  installment_total INTEGER,

  -- Due date & status
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',

  -- Tax
  tax_rate NUMERIC(5,2) NOT NULL,  -- e.g., 7.50 for 7.5%

  -- Dates
  issued_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled')),
  CONSTRAINT total_equals_subtotal_plus_tax CHECK (total_cents = subtotal_cents + tax_cents)
);

CREATE INDEX idx_invoices_property ON financial.invoices(property_id);
CREATE INDEX idx_invoices_reservation ON financial.invoices(reservation_id);
CREATE INDEX idx_invoices_number ON financial.invoices(invoice_number);
CREATE INDEX idx_invoices_status ON financial.invoices(status);
CREATE INDEX idx_invoices_due_date ON financial.invoices(due_date);
```

### `financial.payment_plans` table
```sql
CREATE TABLE financial.payment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Plan details
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  number_of_installments INTEGER NOT NULL CHECK (number_of_installments >= 2),
  installment_interval_days INTEGER NOT NULL CHECK (installment_interval_days > 0),

  -- Schedule
  start_date DATE NOT NULL,
  invoice_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'cancelled', 'defaulted')),
  CONSTRAINT unique_reservation_payment_plan UNIQUE(reservation_id)
);

CREATE INDEX idx_payment_plans_property ON financial.payment_plans(property_id);
CREATE INDEX idx_payment_plans_reservation ON financial.payment_plans(reservation_id);
CREATE INDEX idx_payment_plans_status ON financial.payment_plans(status);
```

### `financial.security_deposits` table
```sql
CREATE TABLE financial.security_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Amounts
  deposit_amount_cents INTEGER NOT NULL CHECK (deposit_amount_cents > 0),
  deductions_cents INTEGER NOT NULL DEFAULT 0 CHECK (deductions_cents >= 0),
  released_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (released_amount_cents >= 0),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'held',

  -- Stripe
  stripe_payment_intent_id VARCHAR(255),

  -- Lifecycle
  held_at TIMESTAMP WITH TIME ZONE NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE,
  forfeited_at TIMESTAMP WITH TIME ZONE,

  -- Deductions (JSONB array)
  deductions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('held', 'partially_released', 'fully_released', 'forfeited')),
  CONSTRAINT unique_reservation_deposit UNIQUE(reservation_id)
);

CREATE INDEX idx_deposits_property ON financial.security_deposits(property_id);
CREATE INDEX idx_deposits_reservation ON financial.security_deposits(reservation_id);
CREATE INDEX idx_deposits_status ON financial.security_deposits(status);
```

---

## API Endpoints (v1)

### Transaction APIs
```
POST   /api/v1/financial/transactions                    - Record transaction
GET    /api/v1/financial/transactions/:id                - Get transaction details
GET    /api/v1/financial/reservations/:id/transactions   - Get all transactions for reservation
GET    /api/v1/financial/properties/:id/transactions     - Get property transactions (filtered)
```

### Invoice APIs
```
POST   /api/v1/financial/invoices                        - Generate invoice
GET    /api/v1/financial/invoices/:id                    - Get invoice details
GET    /api/v1/financial/invoices/:id/pdf                - Download invoice PDF
GET    /api/v1/financial/reservations/:id/invoices       - Get invoices for reservation
PATCH  /api/v1/financial/invoices/:id/issue              - Mark invoice as issued
PATCH  /api/v1/financial/invoices/:id/cancel             - Cancel invoice
```

### Payment Plan APIs
```
POST   /api/v1/financial/payment-plans                   - Create payment plan
GET    /api/v1/financial/payment-plans/:id               - Get payment plan details
GET    /api/v1/financial/reservations/:id/payment-plan   - Get payment plan for reservation
POST   /api/v1/financial/payment-plans/:id/next-invoice  - Generate next installment invoice
```

### Security Deposit APIs
```
POST   /api/v1/financial/deposits                        - Hold security deposit
GET    /api/v1/financial/deposits/:id                    - Get deposit details
PATCH  /api/v1/financial/deposits/:id/deduct             - Deduct from deposit
PATCH  /api/v1/financial/deposits/:id/release            - Release deposit
```

### Balance/Summary APIs
```
GET    /api/v1/financial/reservations/:id/balance        - Get reservation balance (total/paid/due)
GET    /api/v1/financial/properties/:id/revenue          - Property revenue summary (date range)
```

---

## Migration Strategy

### Phase 1: Setup Financial Schema
1. Create `financial` schema in database
2. Create all Financial module tables
3. Add RLS policies for multi-tenant isolation

### Phase 2: Build Financial Module
1. Domain layer (aggregates, value objects, events)
2. Application layer (commands, queries)
3. Infrastructure layer (repositories, Stripe integration)
4. API endpoints

### Phase 3: Migrate BookingEngine Integration
1. Remove `paidAmount` and `paymentStatus` from Reservation aggregate
2. Update BookingEngine to query Financial for balance
3. Financial subscribes to `ReservationConfirmed` → Generate invoice
4. Financial subscribes to `ReservationCancelled` → Process refund

### Phase 4: Data Migration
1. Clone production instance
2. Migrate existing `payments` table data to `financial.transactions`
3. Generate invoices for existing reservations
4. Verify data integrity
5. Deploy to new instance

### Phase 5: Deprecate Old Code
1. Remove old `app/api/guest/payment/confirm/route.ts`
2. Remove old `payments` table
3. Update all references to use Financial module APIs

---

## Event-Driven Integration

### BookingEngine → Financial

```typescript
// When reservation is confirmed
eventBus.subscribe(ReservationConfirmed, async (event) => {
  // Generate invoice (or payment plan for long-term stays)
  if (isLongTermStay(reservation)) {
    await createPaymentPlanCommandHandler.execute({
      reservationId: event.reservationId,
      numberOfInstallments: calculateInstallments(reservation),
      intervalDays: getIntervalFromSettings(property)
    })
  } else {
    await generateInvoiceCommandHandler.execute({
      reservationId: event.reservationId,
      dueDate: reservation.checkInDate
    })
  }
})

// When guest checks in
eventBus.subscribe(GuestCheckedIn, async (event) => {
  // Mark invoice as issued
  const invoices = await invoiceRepository.findByReservation(event.reservationId)
  if (invoices.length > 0) {
    invoices[0].issue()
    await invoiceRepository.save(invoices[0])
  }
})

// When reservation is cancelled
eventBus.subscribe(ReservationCancelled, async (event) => {
  // Process refund based on cancellation policy
  const refundAmount = calculateRefundFromPolicy(event.refundAmountCents)
  await processRefundCommandHandler.execute({
    reservationId: event.reservationId,
    amountCents: refundAmount,
    reason: event.reason
  })
})
```

### Financial → BookingEngine

```typescript
// When invoice is paid
eventBus.subscribe(InvoicePaid, async (event) => {
  // Check if all invoices for reservation are paid
  const invoices = await invoiceRepository.findByReservation(event.reservationId)
  const allPaid = invoices.every(inv => inv.status === 'paid')

  if (allPaid) {
    // Notify BookingEngine that reservation is fully paid
    // (BookingEngine can update confirmation status, send emails, etc.)
    eventBus.publish(new ReservationFullyPaidEvent(event.reservationId))
  }
})

// When payment is overdue
eventBus.subscribe(InvoiceOverdue, async (event) => {
  // Notify BookingEngine to trigger late fee or cancellation workflow
  eventBus.publish(new PaymentOverdueEvent(event.invoiceId, event.daysPastDue))
})
```

---

## Testing Strategy

### Unit Tests (Domain Layer)
- Transaction aggregate business rules
- Invoice calculation logic (subtotal, tax, total)
- PaymentPlan installment scheduling
- SecurityDeposit deduction validation
- Value object creation and validation

### Integration Tests
- Event subscription handlers
- Repository operations with database
- Stripe integration (mocked)
- API endpoint validation

### E2E Tests
- Complete payment flow: Reservation → Invoice → Payment → Transaction
- Payment plan flow: Create plan → Generate invoices over time → Track payments
- Refund flow: Cancel reservation → Process refund → Update balances
- Deposit flow: Hold deposit → Deduct for damages → Release remaining

---

## Success Criteria (Week 11-12 Deliverables)

✅ **Domain Layer:**
- [ ] Transaction, Invoice, PaymentPlan, SecurityDeposit aggregates
- [ ] All value objects (InvoiceNumber, PaymentMethod, TransactionType)
- [ ] Domain events published
- [ ] Unit tests (90%+ coverage)

✅ **Application Layer:**
- [ ] All command handlers implemented
- [ ] All query handlers implemented
- [ ] Event subscriptions configured

✅ **Infrastructure Layer:**
- [ ] All repositories implemented
- [ ] Stripe integration using tenant-aware client
- [ ] Database migrations

✅ **API Layer:**
- [ ] v1 endpoints with Zod validation
- [ ] Standard response envelopes
- [ ] Multi-tenant isolation enforced
- [ ] Integration tests

✅ **Migration:**
- [ ] BookingEngine updated to use Financial module
- [ ] Old payment code deprecated
- [ ] Data migration script tested

✅ **Documentation:**
- [ ] API documentation
- [ ] Event catalog updated
- [ ] Architecture diagrams

---

## Next Steps

1. **Review this design document** - Confirm all business requirements are captured correctly
2. **Start TDD implementation** - Begin with domain layer (Transaction aggregate first)
3. **Iterate through layers** - Domain → Application → Infrastructure → API
4. **Integration testing** - Verify event-driven communication works
5. **Data migration** - Prepare migration scripts for existing data

**Estimated effort:** ~1200 lines of code (per implementation plan)
**Target completion:** End of Week 12

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Next Review:** After user approval
