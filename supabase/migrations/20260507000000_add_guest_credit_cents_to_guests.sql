-- Adds property-scoped guest credit balance (in cents).
-- This supports refunds handled as guest credit (no external refund).

alter table public.guests
add column if not exists guest_credit_cents integer not null default 0;

