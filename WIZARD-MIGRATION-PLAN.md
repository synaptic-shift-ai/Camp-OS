# Wizard & Dashboard Migration Plan

## Problem Statement
The onboarding wizard and dashboard components are using a mix of old deprecated APIs and new v1 APIs. This causes:
1. Response format mismatches (`{ data }` vs `{ success, data: { items } }`)
2. Failed API calls causing loading states
3. React hydration errors (#418) as a symptom of stuck loading states

## Current State Audit

### Old APIs Still In Use (MUST MIGRATE)

| File | Line | Old API | New API | Status |
|------|------|---------|---------|--------|
| `property-context.tsx` | 87 | Response parsing broken | Fix response handling | **CRITICAL** |
| `review-launch-step.tsx` | 64 | `/api/onboarding/completion-status` | `/api/v1/properties?include=completion_status` | Needs v1 endpoint |
| `sites-setup-step.tsx` | 33 | `/api/admin/sites` (GET list) | `/api/v1/properties/[propertyId]/sites` | Ready |
| `sites-setup-step.tsx` | 70 | `/api/admin/sites/[id]` (DELETE) | `/api/v1/sites/[siteId]` | **MISSING** |
| `site-form.tsx` | 130 | `/api/admin/sites/[id]` (PUT) | `/api/v1/sites/[siteId]` | **MISSING** |
| `delete-site-dialog.tsx` | 47 | `/api/admin/sites/[id]` (DELETE) | `/api/v1/sites/[siteId]` | **MISSING** |
| `sites-grid.tsx` | 103 | `/api/admin/sites/[id]` (DELETE) | `/api/v1/sites/[siteId]` | **MISSING** |
| `check-in-dialog.tsx` | 64 | `/api/admin/reservations/[id]/check-in` | `/api/v1/reservations/[id]/check-in` | Needs v1 endpoint |
| `booking-rules-settings.tsx` | 124 | `/api/properties/[id]/settings` | `/api/v1/properties/[id]/settings` | Needs v1 endpoint |
| `deposit-settings.tsx` | 122 | `/api/properties/[id]/settings` | `/api/v1/properties/[id]/settings` | Needs v1 endpoint |
| `pricing-settings.tsx` | 112 | `/api/properties/[id]/settings` | `/api/v1/properties/[id]/settings` | Needs v1 endpoint |
| `rate-discounts-settings.tsx` | 79 | `/api/properties/[id]/settings` | `/api/v1/properties/[id]/settings` | Needs v1 endpoint |
| `property-details-step.tsx` | 92 | `/api/upload/property-image` | Keep (utility endpoint) | OK |

### v1 Endpoints That Exist
- `GET/POST /api/v1/properties` ✅
- `GET/PUT/DELETE /api/v1/properties/[propertyId]` ✅
- `GET/POST /api/v1/properties/[propertyId]/sites` ✅
- `POST /api/v1/properties/[propertyId]/sites/bulk` ✅
- `POST /api/v1/properties/[propertyId]/complete-onboarding` ✅
- `PATCH /api/v1/properties/[propertyId]/wizard-progress` ✅
- `GET/PUT /api/v1/properties/[propertyId]/stripe-account` ✅
- `GET /api/v1/sites/[siteId]/availability` ✅

### v1 Endpoints MISSING (Need to Create)
1. **`/api/v1/sites/[siteId]`** - GET, PUT, DELETE for individual site operations
2. **`/api/v1/properties/[propertyId]/settings`** - GET, PUT for property settings
3. **`/api/v1/properties/[propertyId]/completion-status`** - GET completion status (or add to properties endpoint)
4. **`/api/v1/reservations/[id]/check-in`** - POST for check-in operation

---

## Migration Tasks (Priority Order)

### Phase 1: CRITICAL - Fix Hydration Error (30 min)
These are blocking customer onboarding RIGHT NOW.

#### Task 1.1: Fix property-context.tsx response handling
**File:** `src/components/property-context.tsx`
**Problem:** Expects `result.data` but v1 API returns `result.data.items`
**Fix:** Already written but not deployed - verify and commit

#### Task 1.2: Fix SetupCheckGate hydration mismatch
**File:** `src/components/dashboard/setup-check-gate.tsx`
**Problem:** Conditional wrapper causes DOM structure mismatch
**Fix:** Render banner separately, don't wrap children conditionally

### Phase 2: Create Missing v1 Endpoints (1-2 hours)

#### Task 2.1: Create `/api/v1/sites/[siteId]/route.ts`
```
GET - Fetch single site
PUT - Update site
DELETE - Delete site
```

#### Task 2.2: Create `/api/v1/properties/[propertyId]/settings/route.ts`
```
GET - Fetch property settings
PUT - Update property settings
```

#### Task 2.3: Create `/api/v1/properties/[propertyId]/completion-status/route.ts`
```
GET - Fetch completion status for review-launch step
```

### Phase 3: Migrate Wizard Components (1 hour)

#### Task 3.1: Migrate sites-setup-step.tsx
- Change `GET /api/admin/sites` → `GET /api/v1/properties/${propertyId}/sites`
- Change `DELETE /api/admin/sites/${id}` → `DELETE /api/v1/sites/${siteId}`
- Update response parsing for v1 format

#### Task 3.2: Migrate site-form.tsx
- Change `PUT /api/admin/sites/${id}` → `PUT /api/v1/sites/${siteId}`
- Update response parsing for v1 format

#### Task 3.3: Migrate review-launch-step.tsx
- Change `GET /api/onboarding/completion-status` → `GET /api/v1/properties/${propertyId}/completion-status`
- Update response parsing for v1 format

### Phase 4: Migrate Dashboard Components (1 hour)

#### Task 4.1: Migrate delete-site-dialog.tsx
- Change `DELETE /api/admin/sites/${id}` → `DELETE /api/v1/sites/${siteId}`

#### Task 4.2: Migrate sites-grid.tsx
- Change `DELETE /api/admin/sites/${id}` → `DELETE /api/v1/sites/${siteId}`

#### Task 4.3: Migrate settings components
- `booking-rules-settings.tsx`
- `deposit-settings.tsx`
- `pricing-settings.tsx`
- `rate-discounts-settings.tsx`
All need: `PUT /api/properties/${id}/settings` → `PUT /api/v1/properties/${id}/settings`

#### Task 4.4: Migrate check-in-dialog.tsx (if v1 endpoint created)

### Phase 5: Cleanup (30 min)

#### Task 5.1: Mark old endpoints for deprecation removal
Add TODO comments or tracking for sunset dates

#### Task 5.2: Test full wizard flow
- New user registration
- Property creation
- Site setup
- Stripe connect
- Review & launch

---

## Execution Order (For Immediate Fix)

### RIGHT NOW (Customer Waiting):
1. ✅ Fix `property-context.tsx` (already done, needs commit)
2. 🔄 Fix `setup-check-gate.tsx` hydration issue
3. 🔄 Create `/api/v1/sites/[siteId]` endpoint
4. 🔄 Migrate `sites-setup-step.tsx`
5. 🔄 Create `/api/v1/properties/[propertyId]/completion-status`
6. 🔄 Migrate `review-launch-step.tsx`
7. 🔄 Commit & push
8. 🔄 Test on production

### LATER (Full cleanup):
- Migrate all settings components
- Migrate check-in dialog
- Remove deprecated endpoints after sunset date
