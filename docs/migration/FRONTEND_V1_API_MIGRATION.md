# Frontend Migration to v1 Properties API

**Week 6 - Phase 2: Frontend Migration Analysis**
**Created**: 2025-11-05
**Status**: Analysis Complete, Migration Pending

---

## Overview

This document catalogs all frontend components currently using deprecated Property-related endpoints and provides a detailed migration plan to the new v1 Properties API.

### Migration Context

- **Current State**: Frontend uses legacy `/api/onboarding/*` and `/api/dashboard/properties/*` endpoints
- **Target State**: Migrate to standardized `/api/v1/properties/*` endpoints with consistent response envelopes
- **Reason**: Oct 30 bug (missing `onboarding_completed` field) was caused by endpoint inconsistencies
- **Benefit**: Standardized API contracts prevent field regression, improve maintainability

---

## Deprecated Endpoints Inventory

### 1. Property Context Provider

**File**: `components/property-context.tsx`

**Current Implementation** (Line 76):
```typescript
const response = await fetch("/api/onboarding/properties")
const data = await response.json()
setProperties(data.properties || [])
```

**Current Response Format**:
```json
{
  "properties": [
    { "id": "...", "name": "...", ... }
  ]
}
```

**Migration Required**:
- **New Endpoint**: `GET /api/v1/properties`
- **New Response Format**:
```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "...", "onboarding_completed": true, ... }
  ]
}
```

**Code Changes**:
```typescript
// BEFORE
const response = await fetch("/api/onboarding/properties")
const data = await response.json()
setProperties(data.properties || [])

// AFTER
const response = await fetch("/api/v1/properties")
const data = await response.json()
if (data.success) {
  setProperties(data.data || [])
}
```

**Impact**: HIGH - Central property state management used throughout application

---

### 2. Bulk Site Upload Dialog

**File**: `components/dashboard/sites/bulk-upload-dialog.tsx`

**Current Implementation** (Line 138):
```typescript
const response = await fetch(`/api/dashboard/properties/${propertyId}/sites`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(parseResult.data),
})

const result = await response.json()
const count = result.count || result.sites?.length || (Array.isArray(result) ? result.length : 1)
```

**Current Response Format**:
```json
{
  "success": true,
  "sites": [...],
  "count": 10
}
```

**Migration Required**:
- **New Endpoint**: `POST /api/v1/properties/{id}/sites/bulk`
- **New Response Format**:
```json
{
  "success": true,
  "data": {
    "sites": [...],
    "count": 10
  }
}
```

**Code Changes**:
```typescript
// BEFORE
const response = await fetch(`/api/dashboard/properties/${propertyId}/sites`, {
  method: 'POST',
  body: JSON.stringify(parseResult.data),
})
const result = await response.json()
const count = result.count || result.sites?.length

// AFTER
const response = await fetch(`/api/v1/properties/${propertyId}/sites/bulk`, {
  method: 'POST',
  body: JSON.stringify(parseResult.data),
})
const result = await response.json()
const count = result.success ? result.data.count : 0
```

**Impact**: MEDIUM - Bulk import feature, not critical path

---

### 3. Wizard Container - Progress Tracking

**File**: `components/dashboard/setup-wizard/wizard-container.tsx`

**Current Implementation #1** (Line 92):
```typescript
await fetch(`/api/onboarding/complete`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ propertyId: selectedProperty.id }),
})
```

**Current Implementation #2** (Line 117):
```typescript
await fetch(`/api/dashboard/properties/${selectedProperty.id}/wizard-progress`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ step: currentStep, completed: true }),
})
```

**Migration Required**:

**Endpoint #1: Complete Onboarding**
- **Old**: `POST /api/onboarding/complete`
- **New**: `POST /api/v1/properties/{id}/complete-onboarding`

**Endpoint #2: Update Wizard Progress**
- **Old**: `POST /api/dashboard/properties/{id}/wizard-progress`
- **New**: `PATCH /api/v1/properties/{id}/wizard-progress`

**Code Changes**:
```typescript
// BEFORE (onboarding completion)
await fetch(`/api/onboarding/complete`, {
  method: "POST",
  body: JSON.stringify({ propertyId: selectedProperty.id }),
})

// AFTER
await fetch(`/api/v1/properties/${selectedProperty.id}/complete-onboarding`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
})

// BEFORE (wizard progress)
await fetch(`/api/dashboard/properties/${selectedProperty.id}/wizard-progress`, {
  method: "POST",
  body: JSON.stringify({ step: currentStep, completed: true }),
})

// AFTER
await fetch(`/api/v1/properties/${selectedProperty.id}/wizard-progress`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ step: currentStep, completed: true }),
})
```

**Impact**: HIGH - Critical wizard flow completion

---

### 4. Property Details Step

**File**: `components/dashboard/setup-wizard/property-details-step.tsx`

**Current Implementation** (Line 111):
```typescript
const response = await fetch(`/api/dashboard/properties/${property.id}/update-details`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...data,
    hero_image_url: heroImage,
  }),
})
```

**Migration Required**:
- **Old**: `POST /api/dashboard/properties/{id}/update-details`
- **New**: `PATCH /api/v1/properties/{id}` (REST standard)

**Code Changes**:
```typescript
// BEFORE
const response = await fetch(`/api/dashboard/properties/${property.id}/update-details`, {
  method: "POST",
  body: JSON.stringify({ ...data, hero_image_url: heroImage }),
})

// AFTER
const response = await fetch(`/api/v1/properties/${property.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...data, hero_image_url: heroImage }),
})

// Handle v1 response envelope
const result = await response.json()
if (!result.success) {
  throw new Error(result.error?.message || "Failed to update property")
}
```

**Impact**: HIGH - Wizard step 1, critical for onboarding

---

### 5. Site Form

**File**: `components/dashboard/setup-wizard/site-form.tsx`

**Current Implementation** (Line 145):
```typescript
const response = await fetch(`/api/dashboard/properties/${propertyId}/sites`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(apiData),
})

const result = await response.json()
onSave(result.sites[0])
```

**Note**: Also uses `PATCH /api/admin/sites/${site.id}` (Line 130) - this may be acceptable depending on API design

**Migration Required**:
- **Old**: `POST /api/dashboard/properties/{id}/sites`
- **New**: `POST /api/v1/properties/{id}/sites`

**Code Changes**:
```typescript
// BEFORE
const response = await fetch(`/api/dashboard/properties/${propertyId}/sites`, {
  method: "POST",
  body: JSON.stringify(apiData),
})
const result = await response.json()
onSave(result.sites[0])

// AFTER
const response = await fetch(`/api/v1/properties/${propertyId}/sites`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(apiData),
})
const result = await response.json()
if (result.success) {
  onSave(result.data) // Assuming v1 returns single site in data
}
```

**Impact**: HIGH - Wizard step 2, critical for onboarding

---

### 6. Stripe Connect Step

**File**: `components/dashboard/setup-wizard/stripe-connect-step.tsx`

**Current Implementation** (Lines 66, 85, 162):
```typescript
// Called 3 times in this component
const response = await fetch("/api/onboarding/completion-status")
const data = await response.json()
setProperties(data.properties || [])
```

**Current Implementation #2** (Line 153):
```typescript
const response = await fetch(`/api/dashboard/properties/${propertyId}/stripe-disconnect`, {
  method: "POST",
})
```

**Migration Required**:

**Endpoint #1: Completion Status**
- **Old**: `GET /api/onboarding/completion-status`
- **New**: `GET /api/v1/properties?include=completion_status`

**Endpoint #2: Stripe Disconnect**
- **Old**: `POST /api/dashboard/properties/{id}/stripe-disconnect`
- **New**: `DELETE /api/v1/properties/{id}/stripe-account` (REST standard)

**Code Changes**:
```typescript
// BEFORE (completion status)
const response = await fetch("/api/onboarding/completion-status")
const data = await response.json()
setProperties(data.properties || [])

// AFTER
const response = await fetch("/api/v1/properties?include=completion_status")
const data = await response.json()
if (data.success) {
  setProperties(data.data || [])
}

// BEFORE (stripe disconnect)
const response = await fetch(`/api/dashboard/properties/${propertyId}/stripe-disconnect`, {
  method: "POST",
})

// AFTER
const response = await fetch(`/api/v1/properties/${propertyId}/stripe-account`, {
  method: "DELETE",
})
const result = await response.json()
if (!result.success) {
  throw new Error(result.error?.message || "Failed to disconnect Stripe")
}
```

**Impact**: MEDIUM - Stripe connection is optional, can be done later

---

## Migration Summary

### Components to Update (6 Total)

| Component | File | Endpoints | Priority | Complexity |
|-----------|------|-----------|----------|------------|
| Property Context | `property-context.tsx` | 1 | **CRITICAL** | Low |
| Bulk Upload Dialog | `sites/bulk-upload-dialog.tsx` | 1 | Medium | Low |
| Wizard Container | `wizard-container.tsx` | 2 | **CRITICAL** | Medium |
| Property Details Step | `property-details-step.tsx` | 1 | **CRITICAL** | Low |
| Site Form | `site-form.tsx` | 1 | **CRITICAL** | Low |
| Stripe Connect Step | `stripe-connect-step.tsx` | 2 | Medium | Medium |

**Total Deprecated Endpoints**: 9 unique endpoints

---

## Migration Strategy

### Phase 1: Backend API Creation (Required First)

Before frontend migration can proceed, the following v1 endpoints must be implemented:

1. ✅ `GET /api/v1/properties` - **EXISTS** (already implemented)
2. ⏳ `POST /api/v1/properties/{id}/sites` - Create single site
3. ⏳ `POST /api/v1/properties/{id}/sites/bulk` - Bulk site creation
4. ⏳ `PATCH /api/v1/properties/{id}` - Update property details
5. ⏳ `PATCH /api/v1/properties/{id}/wizard-progress` - Update wizard progress
6. ⏳ `POST /api/v1/properties/{id}/complete-onboarding` - Mark onboarding complete
7. ⏳ `DELETE /api/v1/properties/{id}/stripe-account` - Disconnect Stripe

### Phase 2: Frontend Migration (Sequential)

**Order of Migration** (based on dependency analysis):

1. **Property Context** (FIRST - Foundation)
   - All other components depend on this
   - Test: Verify property list loads correctly

2. **Property Details Step** (Wizard Step 1)
   - Test: Verify property update works

3. **Site Form** (Wizard Step 2)
   - Test: Verify site creation works

4. **Wizard Container** (Wizard Orchestration)
   - Test: Verify wizard completion and progress tracking

5. **Stripe Connect Step** (Wizard Step 4)
   - Test: Verify completion status and Stripe disconnect

6. **Bulk Upload Dialog** (Optional Feature)
   - Test: Verify CSV import works

### Phase 3: Deprecation Headers & Monitoring

Add to old endpoints:
```typescript
// In each deprecated endpoint
res.setHeader('Deprecation', 'true')
res.setHeader('Sunset', '2025-12-31') // 2 months from now
res.setHeader('Link', '</api/v1/properties>; rel="alternate"')
```

Add monitoring:
```typescript
// Log deprecated endpoint usage
logger.warn('Deprecated endpoint called', {
  endpoint: req.url,
  user: req.user?.id,
  timestamp: new Date().toISOString()
})
```

### Phase 4: Remove Old Endpoints (After Migration Complete)

Once all frontend components migrated and tested:
- Remove `/api/onboarding/properties`
- Remove `/api/onboarding/complete`
- Remove `/api/onboarding/completion-status`
- Remove `/api/dashboard/properties/{id}/*` endpoints

---

## Response Envelope Standard

All v1 endpoints MUST use this response format:

### Success Response
```typescript
{
  success: true,
  data: T // The actual data (object, array, etc.)
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    code: string,      // Machine-readable error code
    message: string,   // Human-readable error message
    details?: any      // Optional additional context
  }
}
```

### Example Implementation
```typescript
// Success
return res.status(200).json({
  success: true,
  data: properties
})

// Error
return res.status(400).json({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Property name is required',
    details: { field: 'name' }
  }
})
```

---

## Testing Strategy

### Unit Tests
For each migrated component:
1. Mock fetch to return v1 response envelope
2. Verify component correctly extracts `data` from `{ success: true, data: ... }`
3. Verify error handling for `{ success: false, error: ... }`

### Integration Tests
1. Create E2E test that exercises complete wizard flow using v1 endpoints
2. Verify onboarding_completed field is present in all responses
3. Verify no deprecated endpoints are called

### Monitoring
1. Add console warnings for deprecated endpoint usage during development
2. Track API endpoint usage in production analytics
3. Set up alerts if deprecated endpoints still called after migration deadline

---

## Success Criteria

- [ ] All 6 components migrated to v1 endpoints
- [ ] All 9 deprecated endpoints replaced
- [ ] E2E tests pass with v1 endpoints
- [ ] Contract tests validate all response envelopes
- [ ] No console warnings for deprecated endpoint usage
- [ ] Deprecation headers added to old endpoints
- [ ] Migration tested in staging environment
- [ ] Documentation updated with v1 API examples

---

## Risks & Mitigation

### Risk 1: Backend v1 Endpoints Not Yet Implemented
**Impact**: High - Blocks entire frontend migration
**Mitigation**: Prioritize backend API implementation in parallel with this analysis

### Risk 2: Breaking Changes in Response Format
**Impact**: Medium - Could break existing functionality
**Mitigation**:
- Add comprehensive contract tests for v1 endpoints
- Test migration in staging before production
- Keep deprecated endpoints active during transition period

### Risk 3: TypeScript Type Mismatches
**Impact**: Low - Compile-time errors
**Mitigation**: Update TypeScript interfaces to match v1 response envelopes

---

## Related Documentation

- [TESTING_STRATEGY_DURING_REFACTORING.md](../architecture/TESTING_STRATEGY_DURING_REFACTORING.md)
- [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) - Week 6 Goals
- [tests/e2e/README.md](../../tests/e2e/README.md) - E2E test documentation
- [tests/e2e/onboarding-wizard-complete.spec.ts](../../tests/e2e/onboarding-wizard-complete.spec.ts) - Wizard E2E tests

---

**Document Owner**: Engineering Team
**Last Updated**: 2025-11-05
**Next Review**: After backend v1 endpoint implementation
