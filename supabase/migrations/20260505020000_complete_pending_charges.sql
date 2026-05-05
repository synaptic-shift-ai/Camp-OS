-- Complete all pending charge-type transactions that were stuck before CC05-01-19 fix.
-- These charges have status='pending' because the old code never called charge.complete().
-- The balance API filters on status='completed', making these charges invisible
-- and causing manual-payment-dialog to show "Fully Paid" when a balance actually exists.
-- This is a one-time migration — subsequent charges are completed correctly by the webhook.
UPDATE financial_transactions
SET status = 'completed',
    processed_at = COALESCE(processed_at, created_at),
    updated_at = NOW()
WHERE type = 'charge'
  AND status = 'pending'
  AND is_voided = false;
