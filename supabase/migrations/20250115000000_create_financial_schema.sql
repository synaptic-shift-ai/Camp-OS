-- NOTE: Made idempotent for branch creation support
/**
 * Financial Module Database Migration
 *
 * Phase 3: Weeks 11-12
 * Creates tables for Financial module following DDD patterns.
 *
 * Tables:
 * - financial_invoices: Billing documents (created first - referenced by others)
 * - financial_transactions: All money movements
 * - financial_payment_plans: Installment schedules
 * - financial_security_deposits: Security deposit tracking
 *
 * Security: Row-Level Security (RLS) enforced for multi-tenant isolation
 */

-- ============================================================================
-- Create financial_invoices table FIRST (referenced by financial_transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Invoice identification
  invoice_number VARCHAR(50) NOT NULL UNIQUE,

  -- Amounts (all in cents)
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),

  -- Line items (stored as JSONB)
  line_items JSONB NOT NULL,

  -- Payment plan details
  is_installment BOOLEAN DEFAULT FALSE NOT NULL,
  installment_number INTEGER,
  installment_total INTEGER,

  -- Due date & status
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',

  -- Tax
  tax_rate NUMERIC(5,2) NOT NULL,

  -- Lifecycle dates
  issued_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_invoice_status CHECK (
    status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled')
  ),
  CONSTRAINT total_equals_subtotal_plus_tax CHECK (
    total_cents = subtotal_cents + tax_cents
  ),
  CONSTRAINT installment_fields_consistent CHECK (
    (is_installment = FALSE AND installment_number IS NULL AND installment_total IS NULL) OR
    (is_installment = TRUE AND installment_number IS NOT NULL AND installment_total IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_invoices_property ON financial_invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_reservation ON financial_invoices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_number ON financial_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_status ON financial_invoices(status);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_due_date ON financial_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_created_at ON financial_invoices(created_at);

-- ============================================================================
-- Create financial_transactions table (now financial_invoices exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES financial_invoices(id) ON DELETE SET NULL,

  -- Transaction details
  type VARCHAR(50) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_transaction_type CHECK (
    type IN ('payment', 'refund', 'deposit', 'deposit_release', 'deposit_deduction', 'expense', 'platform_fee', 'payout')
  ),
  CONSTRAINT valid_transaction_status CHECK (
    status IN ('pending', 'completed', 'failed', 'cancelled')
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_property ON financial_transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_reservation ON financial_transactions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_invoice ON financial_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON financial_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_processed_at ON financial_transactions(processed_at);

-- ============================================================================
-- Create financial_payment_plans table
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_payment_plans (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_payment_plan_status CHECK (
    status IN ('active', 'completed', 'cancelled', 'defaulted')
  ),
  CONSTRAINT unique_reservation_payment_plan UNIQUE(reservation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_payment_plans_property ON financial_payment_plans(property_id);
CREATE INDEX IF NOT EXISTS idx_financial_payment_plans_reservation ON financial_payment_plans(reservation_id);
CREATE INDEX IF NOT EXISTS idx_financial_payment_plans_status ON financial_payment_plans(status);

-- ============================================================================
-- Create financial_security_deposits table
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_security_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Amounts (all in cents)
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

  -- Deductions (stored as JSONB array)
  deductions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT valid_deposit_status CHECK (
    status IN ('held', 'partially_released', 'fully_released', 'forfeited')
  ),
  CONSTRAINT unique_reservation_deposit UNIQUE(reservation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_security_deposits_property ON financial_security_deposits(property_id);
CREATE INDEX IF NOT EXISTS idx_financial_security_deposits_reservation ON financial_security_deposits(reservation_id);
CREATE INDEX IF NOT EXISTS idx_financial_security_deposits_status ON financial_security_deposits(status);

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_security_deposits ENABLE ROW LEVEL SECURITY;

-- financial_transactions policies
DROP POLICY IF EXISTS "Users can view transactions for their properties" ON financial_transactions;
CREATE POLICY "Users can view transactions for their properties"
  ON financial_transactions FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert transactions for their properties" ON financial_transactions;
CREATE POLICY "Users can insert transactions for their properties"
  ON financial_transactions FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update transactions for their properties" ON financial_transactions;
CREATE POLICY "Users can update transactions for their properties"
  ON financial_transactions FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

-- financial_invoices policies
DROP POLICY IF EXISTS "Users can view invoices for their properties" ON financial_invoices;
CREATE POLICY "Users can view invoices for their properties"
  ON financial_invoices FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert invoices for their properties" ON financial_invoices;
CREATE POLICY "Users can insert invoices for their properties"
  ON financial_invoices FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update invoices for their properties" ON financial_invoices;
CREATE POLICY "Users can update invoices for their properties"
  ON financial_invoices FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

-- financial_payment_plans policies
DROP POLICY IF EXISTS "Users can view payment plans for their properties" ON financial_payment_plans;
CREATE POLICY "Users can view payment plans for their properties"
  ON financial_payment_plans FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert payment plans for their properties" ON financial_payment_plans;
CREATE POLICY "Users can insert payment plans for their properties"
  ON financial_payment_plans FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update payment plans for their properties" ON financial_payment_plans;
CREATE POLICY "Users can update payment plans for their properties"
  ON financial_payment_plans FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

-- financial_security_deposits policies
DROP POLICY IF EXISTS "Users can view deposits for their properties" ON financial_security_deposits;
CREATE POLICY "Users can view deposits for their properties"
  ON financial_security_deposits FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert deposits for their properties" ON financial_security_deposits;
CREATE POLICY "Users can insert deposits for their properties"
  ON financial_security_deposits FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update deposits for their properties" ON financial_security_deposits;
CREATE POLICY "Users can update deposits for their properties"
  ON financial_security_deposits FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT id FROM companies WHERE owner_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE financial_transactions IS 'All financial transactions (payments, refunds, deposits, expenses, fees, payouts)';
COMMENT ON TABLE financial_invoices IS 'Billing documents for reservations with line items and tax calculation';
COMMENT ON TABLE financial_payment_plans IS 'Installment payment schedules for long-term reservations';
COMMENT ON TABLE financial_security_deposits IS 'Security deposit tracking with deductions and release workflow';

COMMENT ON COLUMN financial_transactions.amount_cents IS 'Transaction amount in cents (integer to avoid floating-point errors)';
COMMENT ON COLUMN financial_invoices.line_items IS 'Invoice line items stored as JSONB array';
COMMENT ON COLUMN financial_invoices.tax_rate IS 'Tax rate as percentage (e.g., 7.5 for 7.5%)';
COMMENT ON COLUMN financial_payment_plans.invoice_ids IS 'Array of invoice IDs for this payment plan (JSONB)';
COMMENT ON COLUMN financial_security_deposits.deductions IS 'Array of deduction records (JSONB)';
