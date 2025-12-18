# Issue: Domain Layer - Database Column Name Mismatches

**Created:** December 18, 2025
**Status:** BLOCKING - Must be resolved during Phase 1 consolidation
**Severity:** CRITICAL - Causes silent data loss and 500 errors
**Related To:** RECONCILED_EXECUTION_ROADMAP.md Phase 1

---

## Executive Summary

The BookingEngine domain layer was built with assumed column names that do not match the actual production database schema. This causes:

1. **500 errors on read** - `fromPersistence()` looks for columns that don't exist
2. **Silent data loss on write** - `toPersistence()` writes to non-existent columns, updates silently fail
3. **Check-in/check-out not persisting** - Status changes appear to work but aren't saved

---

## Root Cause

The domain layer was designed in isolation without validation against the actual database schema (`src/contracts/db.ts`). The assumption was that money columns would have `_cents` suffix to indicate units, but the production schema uses simpler names.

**Domain Layer Assumes:**
```typescript
total_amount_cents: number
paid_amount_cents: number
balance_paid_at_check_in_cents: number
refund_amount_cents: number
```

**Database Actually Has:**
```typescript
total_amount: number        // stored in cents, no suffix
paid_amount: number         // stored in cents, no suffix
balance_paid_at_checkin: number  // note: "checkin" not "check_in"
// refund_amount: DOES NOT EXIST
```

---

## Affected Files

### BookingEngine Module (PRIMARY - Must Fix)

| File | Method | Issue |
|------|--------|-------|
| `src/modules/BookingEngine/domain/Reservation.ts` | `toPersistence()` | Writes to wrong column names |
| `src/modules/BookingEngine/domain/Reservation.ts` | `fromPersistence()` | Reads from wrong column names (FIXED 2025-12-18) |
| `src/modules/BookingEngine/application/DTOs/ReservationDTO.ts` | `toReservationDTO()` | Reads `refund_amount_cents` from persistence |

### Financial Module (INVESTIGATE)

| File | Method | Issue |
|------|--------|-------|
| `src/modules/Financial/domain/aggregates/PaymentPlan.ts` | `fromPersistence()` | Uses `total_amount_cents` |
| `src/modules/Financial/domain/aggregates/PaymentPlan.ts` | `toPersistence()` | Uses `total_amount_cents` |

**Note:** PaymentPlan may be internal-only (no `payment_plans` table exists). Verify during refactor.

### Guest API Routes (INVESTIGATE)

These routes map between DB format and API response format. They may be correct but should be verified:

| File | Line | Code |
|------|------|------|
| `src/app/api/guest/reservations/create/route.ts` | 199 | `total_amount_cents: existingReservation.total_amount` |
| `src/app/api/guest/reservations/create/route.ts` | 423 | `total_amount_cents: reservation.total_amount` |
| `src/app/api/guest/payment/confirm/route.ts` | 282-283 | Maps to `_cents` for API response |

### UI Components (INVESTIGATE)

| File | Issue |
|------|-------|
| `src/app/book/[slug]/confirmation/page.tsx` | TypeScript types expect `_cents` suffix |

---

## Specific Column Mappings Required

### reservations table

| Domain Property | Incorrect Persistence Key | Correct Database Column |
|-----------------|---------------------------|------------------------|
| `totalAmount.amountInCents` | `total_amount_cents` | `total_amount` |
| `paidAmount.amountInCents` | `paid_amount_cents` | `paid_amount` |
| `balancePaidAtCheckIn?.amountInCents` | `balance_paid_at_check_in_cents` | `balance_paid_at_checkin` |
| `refundAmount?.amountInCents` | `refund_amount_cents` | N/A (column doesn't exist) |

---

## Why Tests Didn't Catch This

1. **Unit tests use mocked data** - Tests for `Reservation.create()` and `Reservation.reconstitute()` use pre-constructed value objects, never touching `fromPersistence()` or `toPersistence()`

2. **No integration tests against real schema** - The repository tests likely mock Supabase responses rather than using actual database queries

3. **`fromPersistence()` was never tested** - The test file had tests for `reconstitute()` (takes value objects) but not `fromPersistence()` (takes raw DB rows)

4. **Silent failures** - Supabase doesn't error when you try to update non-existent columns; it just ignores them

---

## Testing Strategy for Refactor

### 1. Add Schema Validation Tests

Create tests that validate persistence methods against the generated DB types:

```typescript
// Example: Validate toPersistence keys match DB schema
import type { Database } from '@/contracts/db'

type ReservationRow = Database['public']['Tables']['reservations']['Row']
type ReservationInsert = Database['public']['Tables']['reservations']['Insert']

test('toPersistence returns valid database column names', () => {
  const reservation = createTestReservation()
  const persistence = reservation.toPersistence()

  // Get all keys from persistence
  const persistenceKeys = Object.keys(persistence)

  // Get all valid column names from DB type
  const validColumns: (keyof ReservationRow)[] = [
    'id', 'property_id', 'site_id', 'guest_id', 'confirmation_number',
    'check_in_date', 'check_out_date', 'num_adults', 'num_children',
    'num_pets', 'num_vehicles', 'total_amount', 'paid_amount', 'status',
    'payment_status', 'special_requests', 'notes', 'source',
    'checked_in_at', 'checked_in_by', 'balance_paid_at_checkin',
    'check_in_notes', 'checked_out_at', 'checked_out_by', 'has_damages',
    'check_out_notes', 'cancelled_at', 'cancellation_reason',
    'created_at', 'updated_at'
    // NOTE: refund_amount is NOT a valid column
  ]

  // Every key in persistence must be a valid column
  for (const key of persistenceKeys) {
    expect(validColumns).toContain(key)
  }
})
```

### 2. Add Round-Trip Tests

Test that data survives a write-then-read cycle:

```typescript
test('reservation survives persistence round-trip', () => {
  const original = createTestReservation()
  const persistence = original.toPersistence()
  const reconstituted = Reservation.fromPersistence(persistence)

  expect(reconstituted.totalAmount.amountInCents).toBe(original.totalAmount.amountInCents)
  expect(reconstituted.paidAmount.amountInCents).toBe(original.paidAmount.amountInCents)
  expect(reconstituted.status).toBe(original.status)
  // ... etc
})
```

### 3. Integration Tests with Real Database

Add integration tests in `tests/integration/` that:
- Create a reservation via the API
- Verify it was saved correctly by querying the DB directly
- Perform check-in
- Verify the status update persisted

---

## Refactor Checklist

During Phase 1 consolidation, for EVERY domain entity that persists to database:

- [ ] Compare `toPersistence()` output keys against `src/contracts/db.ts` types
- [ ] Compare `fromPersistence()` input expectations against actual DB column names
- [ ] Add schema validation test
- [ ] Add round-trip test
- [ ] Verify DTOs don't reference non-existent persistence keys
- [ ] Run integration test against real database

### Entities to Audit

1. **BookingEngine**
   - [ ] Reservation
   - [ ] (any other entities)

2. **Financial**
   - [ ] PaymentPlan (verify if actually persisted)
   - [ ] (any other entities)

3. **ReservationManagement** (before merging)
   - [ ] Reservation (duplicate - will be removed)
   - [ ] DateRange
   - [ ] GuestCount
   - [ ] (any other entities)

4. **Any other modules with persistence**
   - [ ] Audit all `toPersistence()` and `fromPersistence()` methods

---

## Immediate Mitigation (If Needed Before Refactor)

If customer needs to check-in guests before refactor is complete:

**Option A:** Revert check-in API to use `lib/booking/check-in.ts` (working code)

**Option B:** Quick-fix the column names in Reservation.ts (bandaid, but unblocks)

---

## References

- `src/contracts/db.ts` - Generated database types (source of truth)
- `RECONCILED_EXECUTION_ROADMAP.md` - Overall migration plan
- `src/modules/BookingEngine/domain/Reservation.ts` - Primary affected file
- `src/lib/booking/` - Working production code to reference

---

## Lessons Learned

1. **Always validate domain layer against generated DB types** - Don't assume column names
2. **Test `fromPersistence()` AND `toPersistence()` explicitly** - Not just business logic
3. **Silent Supabase failures are dangerous** - Updates to non-existent columns don't error
4. **Integration tests are essential** - Unit tests with mocks can miss schema mismatches
