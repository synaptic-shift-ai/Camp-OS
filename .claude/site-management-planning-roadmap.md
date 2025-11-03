# Site Management Planning Roadmap

**Created:** 2025-02-02
**Status:** Planning Required
**Related:** `.claude/site-status-transitions.md`

## Overview

This document captures the major features identified during the Phase 1/2A/2B implementation that require careful planning and architectural design before implementation. These features represent the core operational workflows for campground management.

---

## Features Requiring Planning

### 1. Check-in / Check-out Workflow ⭐ HIGHEST PRIORITY

**Business Importance:** Core operational workflow that drives site status transitions
**Dependencies:** Status transition rules must be finalized first
**Complexity:** High (2-3 days implementation)
**Estimated Planning Time:** 2 hours

#### Description
The check-in and check-out workflows are the primary operational activities that trigger site status changes. Without these workflows, status transitions must be done manually, increasing risk of errors and inconsistency.

#### Key Requirements
- **Check-in Flow:**
  - Transition: `reserved` or `booked` → `occupied`
  - Validate guest identity (reservation lookup)
  - Collect signatures/waivers if required
  - Record actual check-in time
  - Optionally collect payment balance
  - Mobile-friendly interface for front desk staff

- **Check-out Flow:**
  - Transition: `occupied` → `housekeeping`
  - Record actual check-out time
  - Validate no damage/issues
  - Auto-generate housekeeping task
  - Process final charges if applicable
  - Optionally collect guest feedback

#### Design Questions
1. **Interface:** Desktop-only or mobile-responsive for tablet use at front desk?
2. **Reservation Lookup:** Search by guest name, confirmation number, site number, or all three?
3. **Waivers:** Digital signature collection? PDF generation? Integration with DocuSign?
4. **Payment:** Integrate with existing Stripe payment flow or manual entry?
5. **Offline Support:** Must work without internet? (campgrounds often have spotty connectivity)
6. **Multi-day Checkout:** Handle "Stayed 3 nights, checking out early" scenarios?
7. **Late Checkout:** How to handle requested late checkouts?
8. **No-shows:** Auto-detect and transition `booked` → `available` after X hours?

#### Implementation Considerations
- **Security:** Who can perform check-in/out? Front desk only or owners too?
- **Audit Trail:** Record all check-in/out actions with user, timestamp, notes
- **Notification:** Email/SMS to guest on check-in confirmation?
- **Housekeeping Integration:** Does check-out automatically notify housekeeping staff?

#### Success Criteria
- Staff can check in guest in under 60 seconds
- Staff can check out guest in under 30 seconds
- Zero manual status changes needed for normal guest flow
- All check-in/out actions logged for auditing
- Works on tablet at front desk

---

### 2. Status Change Validation Logic ⭐ HIGH PRIORITY

**Business Importance:** Prevents invalid state transitions that could affect operations and revenue
**Dependencies:** Check-in/out workflow, status transition rules
**Complexity:** Medium (1-2 days implementation)
**Estimated Planning Time:** 1 hour

#### Description
Enforce business rules for status transitions to prevent invalid state changes. Currently, staff can change any status to any other status via the quick-change popover, which could cause operational issues.

#### Key Requirements
- **Block Invalid Transitions:**
  - Cannot change `occupied` → `available` without check-out workflow
  - Cannot change `reserved/booked/occupied` → `maintenance` if active reservation exists
  - Cannot skip `housekeeping` status after guest checkout

- **Require Workflows:**
  - `booked` → `occupied` must go through check-in workflow
  - `occupied` → `housekeeping` must go through check-out workflow

- **Override Permissions:**
  - Manager/owner can override certain rules (emergency maintenance)
  - All overrides logged with reason in audit trail

- **Active Reservation Protection:**
  - Warn before changing status if reservation exists
  - Require confirmation + reason for status change with active reservation

#### Design Questions
1. **Error Messages:** How to communicate blocked transitions to staff? Modal? Toast? Inline?
2. **Override UI:** Separate "Force Change" button? Reason text field required?
3. **Permission Levels:** Who can override? Owner only? Manager? Front desk supervisor?
4. **Soft vs Hard Blocks:** Some rules are warnings, others are hard blocks?
5. **Real-time Validation:** Validate on status badge click or after selection?

#### Implementation Considerations
- **API Validation:** Enforce rules in API, not just UI (security)
- **Sync Status with Reservations:** Listen to reservation changes and auto-update site status?
- **Testing:** Comprehensive test suite for all transition rules (see status-transitions.md matrix)
- **Performance:** Validation checks must be fast (< 100ms)

#### Success Criteria
- Zero invalid status transitions possible via UI
- Staff see clear, helpful error messages for blocked transitions
- Managers can override with logged justification
- No performance impact on status change operations

---

### 3. Housekeeping Page & Workflow

**Business Importance:** Operational efficiency for cleaning staff
**Dependencies:** Status validation logic, task management system
**Complexity:** High (2-3 days implementation)
**Estimated Planning Time:** 1.5 hours

#### Description
A dedicated dashboard for housekeeping staff showing all sites needing cleaning, task assignment, completion tracking, and transition back to "Available" status.

#### Key Requirements
- **Dashboard View:**
  - List all sites with `housekeeping` status
  - Show priority (checkout time, next check-in time)
  - Display site type, location, special instructions

- **Task Assignment:**
  - Assign sites to specific housekeeping staff
  - Track task start time, completion time
  - Support task notes (damage, issues found, supplies needed)

- **Completion Workflow:**
  - Mark site as "Clean and inspected"
  - Optionally require supervisor approval before `housekeeping` → `available`
  - Record completion photos (optional)

- **Staff Management:**
  - List of housekeeping staff
  - Assign tasks by staff member
  - Track performance (avg time per site type)

#### Design Questions
1. **Mobile First:** Primary interface for staff on phones? Tablet? Desktop?
2. **Task Board:** Kanban board style (To Do, In Progress, Complete)? List view?
3. **Inspection:** Require supervisor inspection before marking available?
4. **Photos:** Allow upload of before/after photos for verification?
5. **Priority Algorithm:** Auto-prioritize based on next check-in time?
6. **Issue Reporting:** How to escalate maintenance issues found during cleaning?
7. **Supplies Tracking:** Integrate with inventory management?
8. **Time Tracking:** Track actual time spent per site for labor analysis?

#### Implementation Considerations
- **Real-time Updates:** Use WebSocket or polling to show live task assignments?
- **Offline Mode:** Must work offline for staff in areas with no connectivity?
- **Push Notifications:** Alert staff when new cleaning task assigned?
- **Integration:** Link to maintenance system if issues found?
- **Analytics:** Dashboard showing cleaning time trends, bottlenecks?

#### Success Criteria
- Housekeeping staff can see their assigned tasks on mobile device
- Average time from checkout to available reduced by 20%
- Zero sites missed or forgotten in housekeeping queue
- Supervisors can track completion in real-time

---

### 4. Maintenance Page & Workflow

**Business Importance:** Track repairs and ensure sites aren't booked while non-operational
**Dependencies:** Status validation logic, work order system
**Complexity:** High (2-3 days implementation)
**Estimated Planning Time:** 1.5 hours

#### Description
Similar to housekeeping page but focused on sites with `maintenance` status. Track work orders, parts, costs, and completion workflow.

#### Key Requirements
- **Dashboard View:**
  - List all sites with `maintenance` status
  - Show urgency level, issue type, assigned technician
  - Display estimated completion date

- **Work Order Management:**
  - Create work order when site changes to `maintenance`
  - Assign to maintenance staff or external contractor
  - Track issue description, photos, parts needed

- **Parts & Cost Tracking:**
  - Record parts used, labor hours
  - Calculate total repair cost
  - Optional: Integrate with accounting system

- **Completion Workflow:**
  - Mark work order as complete
  - Require final inspection before `maintenance` → `available`
  - Record completion notes and photos

#### Design Questions
1. **Work Order System:** Build custom or integrate with external system (ServiceM8, Jobber)?
2. **Issue Categories:** Predefined categories (plumbing, electrical, structural)?
3. **Urgency Levels:** How to prioritize urgent vs routine maintenance?
4. **Cost Tracking:** Track at site level, property level, both?
5. **External Vendors:** Support assigning work to contractors vs internal staff?
6. **Recurring Maintenance:** Support scheduled preventive maintenance tasks?
7. **Parts Inventory:** Integrate with inventory management system?
8. **Warranty Tracking:** Track warranty info for repairs?

#### Implementation Considerations
- **Multi-tenant:** Separate maintenance queues per property
- **Notifications:** Alert maintenance staff when new work order created
- **Photo Storage:** S3 or similar for before/after photos
- **Mobile App:** Dedicated mobile app for maintenance staff?
- **Analytics:** Track mean time to repair, cost trends by site type

#### Success Criteria
- All maintenance issues tracked with work orders
- Average time from maintenance to available reduced by 15%
- Full cost tracking for maintenance activities
- No sites accidentally booked while under repair

---

### 5. Create Reservation from Calendar

**Business Importance:** Streamlines booking process for front desk staff
**Dependencies:** Calendar integration (completed), reservation form validation
**Complexity:** Medium (1-2 days implementation)
**Estimated Planning Time:** 1 hour

#### Description
Allow staff to click on empty date range in site calendar to create new reservation directly, with site and dates pre-populated.

#### Key Requirements
- **Date Selection:**
  - Click and drag on calendar to select date range
  - Or click single date and specify duration

- **Reservation Form:**
  - Pre-populate: site ID, check-in date, check-out date
  - Collect: guest name, contact info, guest count
  - Calculate: pricing based on date range and site rates

- **Validation:**
  - Prevent overlapping reservations
  - Enforce minimum stay requirements
  - Check maximum advance booking window

- **Status Transition:**
  - Create reservation with `reserved` or `booked` status
  - Optionally change site status to match reservation

#### Design Questions
1. **Payment Collection:** Require payment immediately or allow reservation without payment?
2. **Guest Lookup:** Search existing guest records vs create new?
3. **Confirmation:** Auto-send confirmation email to guest?
4. **Pricing Display:** Show breakdown (base rate, fees, taxes, total)?
5. **Deposit:** Support deposit payment vs full payment?
6. **Multiple Sites:** Allow adding multiple sites in one reservation?
7. **Special Requests:** Field for guest special requests/notes?

#### Implementation Considerations
- **Conflict Detection:** Real-time check for overlapping reservations
- **Race Conditions:** Handle two staff booking same site simultaneously
- **Price Calculation:** Reuse existing pricing engine
- **Integration:** Use existing reservation creation API endpoint
- **UX:** Modal dialog vs slide-out panel vs separate page?

#### Success Criteria
- Staff can create reservation in under 2 minutes
- Zero double-booking incidents
- Automatic price calculation matches manual calculation
- Guests receive confirmation email within 1 minute

---

## Planning Session Recommendations

### Pre-Planning Preparation (1 hour)
1. Review `.claude/site-status-transitions.md` in full
2. Answer 4 business validation questions in status-transitions.md
3. Gather current operational workflows documentation (if exists)
4. Identify key stakeholders for each feature
5. Prepare list of existing pain points in current workflows

### Planning Session Structure (2-3 hours)

#### Session 1: Core Workflows (90 minutes)
**Focus:** Check-in/Check-out + Status Validation

**Attendees:** Product owner, operations manager, front desk supervisor

**Agenda:**
1. Review current check-in/out process (15 min)
2. Walk through proposed check-in workflow (20 min)
3. Walk through proposed check-out workflow (20 min)
4. Discuss status validation rules (15 min)
5. Identify edge cases and exceptions (15 min)
6. Prioritize features (must-have vs nice-to-have) (5 min)

**Deliverables:**
- Finalized check-in workflow diagram
- Finalized check-out workflow diagram
- Status validation rule confirmations
- List of edge cases to handle

#### Session 2: Staff Workflows (90 minutes)
**Focus:** Housekeeping + Maintenance

**Attendees:** Product owner, housekeeping supervisor, maintenance manager

**Agenda:**
1. Review current housekeeping process (15 min)
2. Review current maintenance process (15 min)
3. Walk through proposed housekeeping dashboard (20 min)
4. Walk through proposed maintenance dashboard (20 min)
5. Discuss integration points (10 min)
6. Identify mobile requirements (10 min)

**Deliverables:**
- Housekeeping workflow diagram
- Maintenance workflow diagram
- Mobile requirements list
- Integration requirements list

#### Session 3: Reservation Management (60 minutes)
**Focus:** Create Reservation from Calendar

**Attendees:** Product owner, front desk supervisor, revenue manager

**Agenda:**
1. Review current reservation creation process (10 min)
2. Walk through proposed calendar creation flow (15 min)
3. Discuss pricing and payment (15 min)
4. Identify validation requirements (10 min)
5. Review guest communication (10 min)

**Deliverables:**
- Calendar reservation creation flow diagram
- Pricing calculation requirements
- Payment integration requirements

---

## Implementation Phases

### Phase 2: Core Operations (Priority 1)
**Estimated Time:** 2 weeks

1. **Week 1:**
   - Implement check-in workflow
   - Implement check-out workflow
   - Update status transitions to use workflows

2. **Week 2:**
   - Implement status validation logic
   - Add override permissions
   - Create audit logging
   - Comprehensive testing

**Success Metrics:**
- 90% of status changes go through workflows (not manual)
- Zero invalid status transitions detected
- Staff satisfaction score > 4/5

### Phase 3: Staff Workflows (Priority 2)
**Estimated Time:** 2-3 weeks

1. **Week 1:**
   - Design and implement housekeeping dashboard
   - Implement task assignment
   - Build mobile-responsive UI

2. **Week 2:**
   - Design and implement maintenance dashboard
   - Implement work order system
   - Build mobile-responsive UI

3. **Week 3:**
   - Integration testing
   - Staff training
   - Analytics dashboards

**Success Metrics:**
- 20% reduction in time from checkout to available
- 15% reduction in time from maintenance to available
- Staff adoption rate > 80%

### Phase 4: Enhanced Booking (Priority 3)
**Estimated Time:** 1 week

1. **Week 1:**
   - Implement calendar-based reservation creation
   - Add validation and conflict detection
   - Test with front desk staff
   - Deploy to production

**Success Metrics:**
- 30% of reservations created via calendar (vs traditional form)
- Zero double-bookings from calendar creation
- Average reservation creation time < 2 minutes

---

## Questions for Business Validation

### General Questions
1. What is the typical daily volume of each operation?
   - Check-ins per day: ___
   - Check-outs per day: ___
   - Status changes per day: ___
   - Maintenance issues per week: ___

2. What are the peak times for each operation?
   - Check-in: ___ (e.g., 2pm-5pm)
   - Check-out: ___ (e.g., 10am-11am)
   - Housekeeping: ___ (e.g., 11am-3pm)

3. What percentage of operations are performed:
   - At desktop computer: ___%
   - On tablet: ___%
   - On smartphone: ___%

### Check-in/Check-out Specific
1. What triggers the transition from `reserved` to `booked`?
   - [ ] Full payment received
   - [ ] 24 hours before check-in
   - [ ] Manual staff confirmation
   - [ ] Other: _______________

2. Can housekeeping be skipped for same-guest extensions?
   - [ ] Yes, always allowed
   - [ ] Yes, with guest consent
   - [ ] No, always required
   - [ ] Depends on duration (< 7 days skip, > 7 days required)

3. What is the protocol for late checkouts?
   - [ ] Automatically approve if next check-in > 4 hours away
   - [ ] Require manager approval
   - [ ] Charge late fee
   - [ ] Not allowed

4. What happens if guest doesn't show up?
   - [ ] Auto-change to available after 2 hours
   - [ ] Manual check by staff before changing
   - [ ] Keep as booked for 24 hours
   - [ ] Other: _______________

### Housekeeping Specific
1. Is supervisor inspection required before marking available?
   - [ ] Always required
   - [ ] Required for deep cleaning only
   - [ ] Optional (staff discretion)
   - [ ] Never required

2. What is acceptable cleaning time per site type?
   - Tent site: ___ minutes
   - RV site: ___ minutes
   - Cabin: ___ minutes
   - Glamping: ___ minutes

### Maintenance Specific
1. When should "unavailable" be used vs "maintenance"?
   - Unavailable for: _______________
   - Maintenance for: _______________

2. How urgent is urgent maintenance?
   - [ ] Guest must be relocated immediately
   - [ ] Can wait until scheduled checkout
   - [ ] Depends on issue severity
   - [ ] Other: _______________

3. What maintenance issues are most common?
   1. _______________
   2. _______________
   3. _______________

---

## Related Documentation

- `.claude/site-status-transitions.md` - Comprehensive status transition rules and matrix
- `CLAUDE.md` - Best practices and testing guidelines
- `.claude/testing-guidelines.md` - Test data generation patterns

---

## Next Steps

1. **Immediate:**
   - [ ] Apply database migration for reserved/booked statuses
   - [ ] Test Phase 1 changes in production-like environment
   - [ ] Review this planning roadmap with product owner

2. **This Week:**
   - [ ] Schedule Planning Session 1 (Core Workflows)
   - [ ] Gather operational workflow documentation
   - [ ] Answer business validation questions

3. **Next Week:**
   - [ ] Schedule Planning Sessions 2 & 3
   - [ ] Create detailed implementation plans based on session outcomes
   - [ ] Begin Phase 2 implementation (Check-in/Check-out)

---

**Last Updated:** 2025-02-02
**Status:** Awaiting planning session scheduling
**Owner:** Product Owner / Operations Manager
