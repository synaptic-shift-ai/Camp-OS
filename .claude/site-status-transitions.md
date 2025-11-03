# Site Status Transition Rules

**Created:** 2025-02-02
**Status:** Draft - Requires business validation

## Overview

This document defines the business rules for site status transitions in CampOps. These rules ensure data integrity and prevent invalid state changes that could affect operations.

---

## Status Definitions

### Pre-Check-in States
- **available**: Site is ready for new bookings, clean and operational
- **reserved**: Guest has placed a reservation, pending confirmation or full payment
- **booked**: Reservation confirmed and paid, guest scheduled to check in

### Active States
- **occupied**: Guest is currently checked in and staying at the site

### Post-Checkout States
- **housekeeping**: Site needs cleaning after checkout before becoming available

### Maintenance States
- **maintenance**: Site requires repairs or maintenance work
- **unavailable**: Site is blocked from booking (owner discretion, seasonal closure, etc.)

---

## Valid Transition Paths

### Normal Guest Flow (Happy Path)
```
available → reserved → booked → occupied → housekeeping → available
```

### Alternative Paths

#### Cancellation Before Check-in
```
reserved → available
booked → available
```

#### Direct Booking (Skip Reserved)
```
available → booked → occupied → housekeeping → available
```

#### No-Show
```
booked → available (after check-in time passes)
```

#### Early Checkout
```
occupied → housekeeping → available
```

#### Maintenance Needs
```
available → maintenance → available
occupied → maintenance (emergency only, requires guest relocation)
housekeeping → maintenance → housekeeping → available
```

#### Owner Blocking
```
available → unavailable → available
[any status] → unavailable (owner override)
```

---

## Transition Rules & Validations

### Rule 1: No Active Reservation Interference
**Status Changes Blocked:**
- Cannot change from `reserved`, `booked`, or `occupied` to `available` without completing check-out workflow
- Cannot change to `maintenance` or `unavailable` if active reservation exists (unless override granted)

**Rationale:** Protects guest bookings and prevents data inconsistency

---

### Rule 2: Check-in Workflow Required
**Status Changes Requiring Workflow:**
- `booked → occupied` must go through check-in process
  - Validates guest identity
  - Collects signatures/waivers if required
  - Records actual check-in time

**Rationale:** Ensures compliance and accurate occupancy tracking

---

### Rule 3: Check-out Workflow Required
**Status Changes Requiring Workflow:**
- `occupied → housekeeping` must go through check-out process
  - Records actual check-out time
  - Validates no damage/issues
  - Generates housekeeping task
  - Processes final charges if applicable

**Rationale:** Ensures proper hand-off to housekeeping and financial reconciliation

---

### Rule 4: Housekeeping Must Complete
**Status Changes Blocked:**
- Cannot change from `housekeeping` directly to `reserved`, `booked`, or `occupied`
- Must transition: `housekeeping → available` first

**Rationale:** Ensures site is clean before next guest

---

### Rule 5: Maintenance Completion
**Status Changes Requiring Validation:**
- `maintenance → available` requires:
  - Maintenance work order marked complete
  - Final inspection passed (optional, configurable)

**Rationale:** Ensures site is fully operational before accepting bookings

---

### Rule 6: Override Permissions
**Status Changes Requiring Manager/Owner Override:**
- `occupied → maintenance` (emergency only)
- `[any status with reservation] → unavailable`
- Skipping housekeeping: `occupied → available` (emergency only)

**Rationale:** Provides flexibility for emergencies while maintaining audit trail

---

## Status Change Matrix

| From \ To      | available | reserved | booked | occupied | housekeeping | maintenance | unavailable |
|----------------|-----------|----------|--------|----------|--------------|-------------|-------------|
| **available**  | ✓         | ✓        | ✓      | ❌        | ❌            | ✓           | ✓           |
| **reserved**   | ✓         | ✓        | ✓      | ❌        | ❌            | ⚠️           | ⚠️           |
| **booked**     | ✓         | ✓        | ✓      | ✓ (W)    | ❌            | ⚠️           | ⚠️           |
| **occupied**   | ❌         | ❌        | ❌      | ✓        | ✓ (W)        | ⚠️ (O)      | ❌           |
| **housekeeping**| ✓        | ❌        | ❌      | ❌        | ✓            | ✓           | ❌           |
| **maintenance**| ✓         | ❌        | ❌      | ❌        | ❌            | ✓           | ✓           |
| **unavailable**| ✓         | ✓        | ✓      | ❌        | ❌            | ✓           | ✓           |

**Legend:**
- ✓ = Allowed, no special requirements
- ✓ (W) = Allowed, requires workflow completion
- ⚠️ = Allowed with warning (active reservation exists)
- ⚠️ (O) = Requires owner/manager override
- ❌ = Blocked (invalid transition)

---

## Implementation Notes

### Phase 1 (Current)
- **Status:** All statuses available in UI
- **Validation:** None enforced (manual dashboard changes allowed)
- **Risk:** Staff can make invalid transitions

### Phase 2 (Next - Check-in/Check-out)
- **Status:** Implement check-in and check-out workflows
- **Validation:** Enforce transitions through workflows
- **Changes:**
  - `booked → occupied` only via check-in
  - `occupied → housekeeping` only via check-out

### Phase 3 (Future - Full Enforcement)
- **Status:** Enforce all transition rules
- **Validation:** Block invalid transitions in UI and API
- **Changes:**
  - Show warnings for transitions with active reservations
  - Require override permissions for emergency transitions
  - Audit log all manual status changes

---

## Future Enhancements

### Auto-Transitions
Consider automating these transitions:
1. **No-Show Detection**: `booked → available` after 2 hours past check-in time
2. **Housekeeping Completion**: `housekeeping → available` when task marked complete
3. **Reservation Confirmation**: `reserved → booked` when payment clears

### Integration Points
1. **Housekeeping System**: Auto-create tasks on `occupied → housekeeping`
2. **Maintenance System**: Track work orders, prevent premature status changes
3. **Reservation System**: Sync status with reservation state
4. **Analytics**: Track time in each status for operational insights

---

## Questions for Business Validation

1. **Reserved vs Booked**: What triggers the transition from reserved to booked?
   - Payment received?
   - 24 hours before check-in?
   - Manual confirmation by staff?

2. **Housekeeping Skip**: Under what circumstances can we skip housekeeping?
   - Same guest extending stay?
   - Emergency situations only?
   - Never allowed?

3. **Maintenance Urgency**: How to handle urgent maintenance during occupancy?
   - Guest relocation protocol?
   - Partial refund policy?
   - Communication workflow?

4. **Unavailable Use Cases**: When should staff use "unavailable" vs "maintenance"?
   - Seasonal closures?
   - Owner personal use?
   - Awaiting parts/repairs?

---

## Related Documentation

- `CLAUDE.md` - Multi-tenant security requirements
- `.claude/testing-guidelines.md` - Testing status transition logic
- `Code Improvement.md` - Branded types for status enum (future)

---

**Next Steps:**
1. Review with product owner and operations team
2. Validate against real-world campground workflows
3. Implement Phase 2 check-in/check-out workflows
4. Create integration tests for transition validation
