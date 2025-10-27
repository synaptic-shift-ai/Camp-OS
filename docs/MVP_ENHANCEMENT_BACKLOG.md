# MVP Enhancement Backlog

**Purpose**: Capture discovered functionality gaps and enhancements to address AFTER onboarding workflow is complete.
**Status**: Backlog items for Week 2-3 implementation
**Last Updated**: 2025-01-27

---

## High Priority (Week 2 - After Onboarding Complete)

### 1. Booking URL Infrastructure
**Status**: Documented in `BOOKING_URL_IMPLEMENTATION.md`
**Effort**: ~8 hours
**Blocker**: No - onboarding can complete without this
**Description**: Create property-specific booking URLs (`/book/[slug]`) to make "Share Your Booking Page" functional
**Deliverables**:
- [ ] Database migration for `booking_page_slug` column
- [ ] URL generation utilities
- [ ] Dynamic `/book/[slug]` route
- [ ] Update completion page to show real URL

### 2. Booking Portal Branding
**Status**: Documented in `BOOKING_PORTAL_CONFIGURATION_GAP.md`
**Effort**: ~6 hours (MVP defaults)
**Blocker**: No - can ship with generic branding
**Description**: Replace "CampOS" branding with property-specific branding on booking pages
**Deliverables**:
- [ ] Property name instead of "CampOS"
- [ ] Property description/tagline
- [ ] Default check-in/out times
- [ ] Default cancellation policy

---

## Medium Priority (v1.1 - Week 3+)

### 3. Booking Page Customization Dashboard
**Status**: Documented in `BOOKING_PORTAL_CONFIGURATION_GAP.md` (Option 3)
**Effort**: ~9 hours
**Description**: Dashboard settings page for operators to customize their booking page post-onboarding
**Deliverables**:
- [ ] Settings → Booking Page section
- [ ] Logo upload
- [ ] Hero image upload
- [ ] Brand color picker
- [ ] Policy editor
- [ ] Preview feature

### 4. Advanced Property Configuration
**Description**: Additional onboarding customization (if operators request it)
**Deliverables**:
- [ ] Office hours
- [ ] Directions/GPS
- [ ] Area map
- [ ] FAQ section
- [ ] House rules

---

## Implementation Strategy

**Rule**: Only work on backlog items AFTER current feature is complete and tested.

**Priority Order**:
1. Complete onboarding wizard (4 pages + APIs) ← **CURRENT FOCUS**
2. Test end-to-end onboarding flow
3. Then address High Priority items (#1, #2)
4. Then Medium Priority items (#3, #4)

---

## Notes

- All gaps discovered during onboarding development are documented here
- Don't implement until onboarding is DONE
- Focus prevents scope creep and ensures MVP ships on time
