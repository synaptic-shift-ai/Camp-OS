# CampOps Reconciled Execution Roadmap

**Version:** 2.0
**Created:** December 17, 2025
**Status:** RECONCILED - Accounts for all architecture documents
**Priority:** Stability FIRST, then consolidation, then features

---

## Executive Summary: Why This Document Exists

We discovered that the codebase has **THREE parallel booking implementations** causing confusion and 500 errors:

| Location | Status | Format Used |
|----------|--------|-------------|
| `src/lib/booking/` | OLD - Works | `CAMP-2025-A1B2C3` |
| `src/modules/BookingEngine/` | NEW - Broken | `RES-123456` |
| `src/modules/ReservationManagement/` | Duplicate - Should be merged | N/A |

The previous `EXECUTION_ROADMAP.md` focused on feature delivery but didn't account for:
- The `implementation-plan-modular-architecture.md` (7-phase migration plan)
- The post-incident `IMPLEMENTATION_ROADMAP.md` (safety improvements)
- The actual broken state of the domain layer

This document reconciles ALL planning documents into ONE logical execution order.

---

## Documents Reconciled

| Document | Focus | Incorporated As |
|----------|-------|-----------------|
| `EXECUTION_ROADMAP.md` | Feature delivery (60 days) | Phases 2-3 |
| `implementation-plan-modular-architecture.md` | 7-phase architecture migration | Phases 1, 4-5 |
| `docs/architecture/IMPLEMENTATION_ROADMAP.md` | Post-incident safety | Phase 3 |
| `campops-modular-architecture.pdf` | Design source | Reference |
| `campops-implementation-guide.pdf` | Migration patterns | Reference |

---

## Key Conflicts Resolved

### 1. When to Consolidate BookingEngine

| Document Said | Reality | Resolution |
|---------------|---------|------------|
| `EXECUTION_ROADMAP`: Phase 5 (Days 51-60) | API routes ALREADY use broken domain layer | Move to Phase 0-1 |
| `implementation-plan`: Phase 3A (after missing modules) | Can't wait - causing 500 errors NOW | Fix immediately |

### 2. What Gets Built First

| Document Said | Reality | Resolution |
|---------------|---------|------------|
| `EXECUTION_ROADMAP`: Features first | Features built on broken foundation | Fix foundation first |
| `implementation-plan`: Shared kernel first | Customer needs working product NOW | Minimal fix, then features |

### 3. ReservationManagement Module

| Document Said | Reality | Resolution |
|---------------|---------|------------|
| `implementation-plan`: Merge into BookingEngine | Still exists as separate module | Merge in Phase 1 |
| `EXECUTION_ROADMAP`: Not mentioned | Creating confusion | Address explicitly |

---

## Reconciled Phase Structure

```
Phase 0: EMERGENCY STABILIZATION (Days 1-3)     ← NEW - Not in original docs
    │
    └── Fix 500 errors, restore basic functionality

Phase 1: CODE CONSOLIDATION (Days 4-10)          ← From implementation-plan Phase 3A
    │
    └── Merge modules, eliminate parallel implementations

Phase 2: FEATURE COMPLETION (Days 11-25)         ← From EXECUTION_ROADMAP Phases 0-2
    │
    └── Check-in/out, payments, guest documents

Phase 3: SAFETY IMPROVEMENTS (Days 26-35)        ← From post-incident IMPLEMENTATION_ROADMAP
    │
    └── E2E tests, observability, loop detection

Phase 4: ARCHITECTURE MATURATION (Days 36-50)    ← From implementation-plan Phases 1-2
    │
    └── Shared kernel, missing modules, complete BookingEngine

Phase 5: DEPRECATION & CLEANUP (Days 51-60)      ← From implementation-plan Phase 3-4
    │
    └── Remove old code, finalize architecture
```

---

## Phase 0: EMERGENCY STABILIZATION (Days 1-3)

**Goal:** Fix 500 errors and restore basic functionality for customer testing.

**Priority:** CRITICAL - Customer cannot use the product without this.

### Day 1: Fix ConfirmationNumber Format Mismatch

**Problem:** New domain layer rejects existing production confirmation numbers.

**Root Cause:**
```typescript
// ConfirmationNumber.ts - CURRENT (breaks existing data)
private static readonly FORMAT_REGEX = /^[A-Z]{3}-\d{6}$/
// Expects: RES-123456

// api.ts - PRODUCTION data format
return `CAMP-${year}-${random}`
// Generates: CAMP-2025-A1B2C3
```

**Solution:** Update regex to accept BOTH formats:
```typescript
private static readonly FORMAT_REGEX = /^([A-Z]{3}-\d{6}|CAMP-\d{4}-[A-Z0-9]{6})$/
```

**Files:**
- `src/modules/BookingEngine/domain/value-objects/ConfirmationNumber.ts`

**Tests:**
- [ ] OLD format (`CAMP-2025-A1B2C3`) accepted
- [ ] NEW format (`RES-123456`) accepted
- [ ] Invalid formats rejected

### Day 2: Fix Check-in Button Visibility

**Problem:** Button only visible when check-in date is exactly today.

**Solution:**
```typescript
// BEFORE (broken)
const isEligible = status === 'confirmed' && checkIn.getTime() === today.getTime()

// AFTER (working)
const isEligible = status === 'confirmed' && checkIn.getTime() <= today.getTime()
```

**Files:**
- `src/components/admin/check-in-button.tsx` (already fixed per session history)

### Day 3: Verify Check-out UI Works

**Status:** CheckOutButton and CheckOutDialog were created in previous session.

**Tasks:**
- [ ] Verify check-out button appears for `checked_in` reservations
- [ ] Test full check-in → check-out flow
- [ ] Fix any issues discovered

---

## Phase 1: CODE CONSOLIDATION (Days 4-10)

**Goal:** Eliminate parallel booking implementations.

**CRITICAL ISSUE DISCOVERED:** See `docs/ISSUE_DOMAIN_DATABASE_MISMATCH.md`

The BookingEngine domain layer has column name mismatches with the database schema that cause:
- 500 errors on read (looking for non-existent columns)
- Silent data loss on write (updates to wrong column names are ignored)
- Check-in/check-out appears to work but changes don't persist

This MUST be resolved as part of Phase 1 consolidation.

### Days 4-5: Fix Domain-Database Mismatches (NEW - BLOCKING)

**Before any module merging, fix the persistence layer:**

- [ ] Audit ALL `toPersistence()` methods against `src/contracts/db.ts`
- [ ] Audit ALL `fromPersistence()` methods against `src/contracts/db.ts`
- [ ] Fix Reservation.ts column name mappings (see ISSUE_DOMAIN_DATABASE_MISMATCH.md)
- [ ] Add schema validation tests for each entity
- [ ] Add round-trip persistence tests
- [ ] Run integration tests against real database

### Days 6-7: Merge ReservationManagement into BookingEngine

**Current State:**
```
src/modules/ReservationManagement/     ← TO BE DELETED
├── domain/
│   ├── Reservation.ts                 ← Duplicate
│   ├── DateRange.ts                   ← Move to BookingEngine
│   ├── GuestCount.ts                  ← Map to OccupancyInfo
│   ├── ReservationPricing.ts          ← Evaluate need
│   ├── events/                        ← Merge with BookingEngine events
│   └── __tests__/                     ← Merge tests
```

**Tasks:**
- [ ] Compare value objects, identify what to keep
- [ ] Move unique value objects to BookingEngine
- [ ] Merge events (remove duplicates)
- [ ] Update all imports across codebase
- [ ] Delete `src/modules/ReservationManagement/`
- [ ] Run tests, fix breakages

### Days 7-8: Decide Canonical Code Path

**Decision Required:** Which implementation should be canonical?

#### Option A: Keep `lib/booking` as Canonical (RECOMMENDED)

**Rationale:** Customer is actively testing. Stability over architecture purity.

**Approach:**
- Make v1 API routes use `lib/booking` directly for reads
- Use BookingEngine commands for writes (they work)
- Defer full migration to Phase 4-5

**Pros:**
- Minimal changes
- Stable, tested code
- Lower risk during customer testing

**Cons:**
- Two code paths temporarily
- Defers architectural cleanup

#### Option B: Make BookingEngine Canonical Now

**Approach:**
- Fix all BookingEngine issues
- Migrate all routes to use BookingEngine
- Deprecate `lib/booking` immediately

**Pros:**
- Clean architecture sooner
- Single code path

**Cons:**
- More changes during customer testing
- Higher risk
- More time needed

### Days 9-10: Implement Chosen Approach

If Option A:
- Create thin adapter for v1 API reads
- Document the temporary dual-path

If Option B:
- Fix remaining BookingEngine issues
- Update all API routes
- More extensive testing needed

---

## Phase 2: FEATURE COMPLETION (Days 11-25)

**Goal:** Complete customer-requested features.

*Imported from original EXECUTION_ROADMAP.md Phases 0-2*

### Days 11-15: Check-in/Check-out Enhancements

- [ ] Fix check-in dialog payment flow (cash/check support)
- [ ] Add arrivals dashboard widget
- [ ] Guest verification fields
- [ ] Arrival slip generation
- [ ] Departure checklist

### Days 16-20: Payment Management

- [ ] Manual payment entry (cash, check, offline card)
- [ ] Payment history view
- [ ] Receipt generation
- [ ] Refund processing
- [ ] Basic financial reports

### Days 21-25: Guest Documentation

- [ ] Document schema and storage
- [ ] Document upload component
- [ ] Template system (if time permits)
- [ ] E-signature (if time permits)

---

## Phase 3: SAFETY IMPROVEMENTS (Days 26-35)

**Goal:** Add safeguards from October 30 incident learnings.

*Imported from docs/architecture/IMPLEMENTATION_ROADMAP.md*

### Days 26-28: E2E Tests for Critical Paths

- [ ] Conversion pipeline test (checkout → webhook → wizard → dashboard)
- [ ] Check-in/check-out flow test
- [ ] Payment flow test

### Days 29-31: Observability Improvements

- [ ] Structured logging with correlation IDs
- [ ] Sentry integration improvements
- [ ] Critical path alerts

### Days 32-35: Redirect Loop Detection

- [ ] Implement RedirectLoopDetector
- [ ] Add to middleware
- [ ] Test with various scenarios

---

## Phase 4: ARCHITECTURE MATURATION (Days 36-50)

**Goal:** Complete modular architecture per design documents.

*Imported from implementation-plan-modular-architecture.md Phases 1-2*

### Days 36-40: Complete Shared Kernel

- [ ] Logger infrastructure (`ILogger`, `Logger`, `ConsoleLogger`)
- [ ] Event Store table migration
- [ ] `SupabaseEventStoreRepository`
- [ ] `PersistentEventBus`

### Days 41-45: Missing Core Modules (If Needed)

- [ ] CompanyManagement module (subscription management)
- [ ] StaffManagement module (RBAC)

*Note: Only build if feature work requires these*

### Days 46-50: Complete BookingEngine

NOW safe to make BookingEngine fully canonical:

- [ ] Add missing commands (ExtendReservation, RenewReservation, ModifyReservation)
- [ ] Add domain services (AvailabilityService, PricingCalculator)
- [ ] Migrate remaining API routes from `lib/booking`
- [ ] Complete test coverage

---

## Phase 5: DEPRECATION & CLEANUP (Days 51-60)

**Goal:** Remove old code paths, finalize architecture.

### Days 51-55: Final Migration

- [ ] Update ALL API routes to use BookingEngine
- [ ] Remove `lib/booking` adapters
- [ ] Update frontend to use v1 API consistently

### Days 56-58: Remove Old Code

- [ ] Delete `src/lib/booking/` directory
- [ ] Remove any remaining adapter layers
- [ ] Clean up unused types

### Days 59-60: Documentation

- [ ] Update CLAUDE.md with new architecture
- [ ] Document API contracts
- [ ] Write migration guide for any breaking changes

---

## Deprecation Timeline

| Code Path | Now | Phase 1 | Phase 4 | Phase 5 |
|-----------|-----|---------|---------|---------|
| `lib/booking/` | Primary | Canonical (temp) | Being replaced | REMOVED |
| `modules/ReservationManagement/` | Duplicate | REMOVED | - | - |
| `modules/BookingEngine/` | Broken | Fixed | Canonical | Canonical |

---

## Dependencies

```
Phase 0 ──┬── Phase 1 ──┬── Phase 2 ──┬── Phase 3 ──┬── Phase 4 ──── Phase 5
          │             │             │             │
          │             │             └─────────────┴── Can run in parallel
          │             │                               after Phase 1
          │             │
          │             └── Blocks feature work until complete
          │
          └── CRITICAL: Blocks everything
```

**Critical Path:** Phase 0 → Phase 1 → (Phases 2-3 parallel) → Phase 4 → Phase 5

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| ConfirmationNumber fix breaks something | CRITICAL | Test both formats extensively |
| Customer loses data during migration | HIGH | Additive migrations only |
| Check-in/check-out breaks | HIGH | E2E tests before deploying |
| API breaking changes | MEDIUM | Version APIs, deprecation notices |

### Rollback Strategy

- **Phase 0:** Revert single file changes
- **Phase 1:** Restore ReservationManagement from git if needed
- **Phase 2-3:** Feature flags for new features
- **Phase 4-5:** Keep old code until new code proven

---

## Success Metrics

### Phase 0 Complete When:
- [ ] Zero 500 errors on reservation retrieval
- [ ] Check-in button visible for all valid scenarios
- [ ] Check-out functionality works
- [ ] Customer confirms basic flow works

### Phase 1 Complete When:
- [ ] Only ONE booking module exists (BookingEngine)
- [ ] All tests pass
- [ ] No import errors
- [ ] Clear canonical code path documented

### Phase 2 Complete When:
- [ ] Customer confirms check-in/check-out works
- [ ] Cash/check payments can be recorded
- [ ] Payment history visible

### Phase 3 Complete When:
- [ ] E2E tests pass in CI
- [ ] Logs have correlation IDs
- [ ] Redirect loops are detected

### Phase 4-5 Complete When:
- [ ] Full modular architecture per design docs
- [ ] No legacy `lib/booking` code
- [ ] Documentation complete

---

## Immediate Next Steps

1. **Review this document** - Does this ordering make sense?
2. **Approve Phase 0 approach** - Fix ConfirmationNumber regex
3. **Decide Option A vs B for Phase 1** - Keep lib/booking or migrate now?
4. **Begin execution** - Start with Day 1 tasks

---

## Appendix: Files to Modify

### Phase 0 Critical Files

1. `src/modules/BookingEngine/domain/value-objects/ConfirmationNumber.ts`
   - Update FORMAT_REGEX to accept both formats

2. `src/components/admin/check-in-button.tsx`
   - Already fixed per session (verify)

3. `src/components/admin/check-out-button.tsx`
   - Already created per session (verify)

### Phase 1 Files to Fix (Domain-Database Mismatches)

**See:** `docs/ISSUE_DOMAIN_DATABASE_MISMATCH.md` for complete details.

| File | Issue |
|------|-------|
| `src/modules/BookingEngine/domain/Reservation.ts` | `toPersistence()` and `fromPersistence()` use wrong column names |
| `src/modules/BookingEngine/application/DTOs/ReservationDTO.ts` | References non-existent `refund_amount_cents` |
| `src/modules/Financial/domain/aggregates/PaymentPlan.ts` | Uses `_cents` suffix - verify if persisted |

### Phase 1 Files to Delete

- `src/modules/ReservationManagement/` (entire directory after merge)

### Phase 5 Files to Delete

- `src/lib/booking/` (entire directory after migration)

---

## Supplemental Documentation

- `docs/ISSUE_DOMAIN_DATABASE_MISMATCH.md` - Critical persistence layer issues discovered 2025-12-18

---

**Document Status:** READY FOR REVIEW
**Supersedes:** EXECUTION_ROADMAP.md (root)
**Next Step:** Review and approve, then begin Phase 0
