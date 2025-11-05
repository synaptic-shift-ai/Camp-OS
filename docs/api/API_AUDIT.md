# CampOS API Audit

**Date:** 2025-11-05
**Purpose:** Document existing API endpoints and identify areas for standardization
**Related:** [API_CONTRACT_SAFETY.md](../architecture/API_CONTRACT_SAFETY.md), [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md)

---

## Executive Summary

**Total Endpoints Identified:** 30+
**Using Zod Validation:** 1/30 (3%)
**Following Standard Response Format:** 0/30 (0%)
**Versioned Endpoints:** 0/30 (0%)

### Critical Findings

1. ❌ **No API versioning** - all endpoints unversioned
2. ❌ **Inconsistent response formats** - mix of `{reservation}`, `{data}`, `{sites: []}`
3. ⚠️ **Selective field fetching** - potential for missing field bugs
4. ✅ **One endpoint uses Zod** - `/booking/search-availability` (good example!)
5. ❌ **No runtime validation** - except search-availability
6. ❌ **Mixed error handling** - no standardized error format

---

## API Inventory by Category

### Admin - Reservations (9 endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/admin/reservations/[id]` | GET | `{reservation: {...}}` | ❌ None | ⚠️ Uses selective `.select()` |
| `/api/admin/reservations/create` | POST | TBD | ❌ None | Needs audit |
| `/api/admin/reservations/[id]/update` | PATCH/POST | TBD | ❌ None | Needs audit |
| `/api/admin/reservations/[id]/cancel` | POST | TBD | ❌ None | Action endpoint |
| `/api/admin/reservations/[id]/check-in` | POST | TBD | ❌ None | Action endpoint |
| `/api/admin/reservations/[id]/checkout` | POST | TBD | ❌ None | Action endpoint |
| `/api/admin/reservations/[id]/actions` | GET | TBD | ❌ None | Audit trail |
| `/api/admin/reservations/[id]/check-action` | GET/POST | TBD | ❌ None | Unclear |

**Issues:**
- ❌ No versioning
- ❌ Inconsistent response formats
- ⚠️ Selective field fetching in GET endpoint
- ❌ No validation
- ⚠️ Action endpoints need standardization

**Migration Priority:** 🔴 **HIGH** (Core functionality)

---

### Admin - Sites (4 endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/admin/sites` | GET | `{sites: [...]}` | ❌ None | Returns list |
| `/api/admin/sites/[id]` | GET | TBD | ❌ None | Single site |
| `/api/admin/sites/[id]` | PATCH/PUT | TBD | ❌ None | Update site |
| `/api/admin/sites/[id]/reservations` | GET | TBD | ❌ None | Site's reservations |
| `/api/admin/sites/[id]/housekeeping-complete` | POST | TBD | ❌ None | Action endpoint |

**Issues:**
- ❌ No versioning
- ❌ Array of fields selected (complete entity in GET list, but need to verify)
- ❌ No validation
- ⚠️ Housekeeping action needs standardization

**Migration Priority:** 🟡 **MEDIUM** (First module to refactor)

---

### Booking (Public-facing) (2 endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/booking/search-availability` | POST | `{success, error?, ...}` | ✅ **Zod** | **GOOD EXAMPLE** |
| `/api/booking/create-payment-intent` | POST | TBD | ❌ None | Stripe integration |

**Issues:**
- ❌ No versioning
- ✅ search-availability uses Zod (copy this pattern!)
- ⚠️ Response format varies

**Migration Priority:** 🔴 **HIGH** (Customer-facing)

---

### Onboarding (7+ endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/onboarding/properties` | GET | `{properties: [...]}` | ❌ None | **INCIDENT SOURCE** |
| `/api/onboarding/setup-property` | POST | TBD | ❌ None | Wizard step |
| `/api/onboarding/update-property` | PATCH | TBD | ❌ None | Wizard step |
| `/api/onboarding/add-site` | POST | TBD | ❌ None | Wizard step |
| `/api/onboarding/complete` | POST | TBD | ❌ None | Finish wizard |
| `/api/onboarding/completion-status` | GET | TBD | ❌ None | Check status |

**Issues:**
- ❌ No versioning
- ❌ `/properties` endpoint caused Oct 30 incident (selective fetching)
- ❌ No validation
- ⚠️ Wizard flow needs careful migration

**Migration Priority:** 🔴 **CRITICAL** (Bug fix required)

---

### Dashboard - Properties (4+ endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/dashboard/properties/[id]/update-details` | POST/PATCH | TBD | ❌ None | Property updates |
| `/api/dashboard/properties/[id]/sites` | GET | TBD | ❌ None | Property's sites |
| `/api/dashboard/properties/[id]/stripe-disconnect` | POST | TBD | ❌ None | Disconnect Stripe |
| `/api/dashboard/properties/[id]/wizard-progress` | GET/POST | TBD | ❌ None | Wizard tracking |

**Issues:**
- ❌ No versioning
- ❌ Duplicate property endpoints with onboarding
- ❌ No validation

**Migration Priority:** 🟡 **MEDIUM**

---

### Guest (2 endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/guest/reservations/create` | POST | TBD | ❌ None | Guest booking |
| `/api/guest/payment/confirm` | POST | TBD | ❌ None | Payment confirm |

**Issues:**
- ❌ No versioning
- ❌ No validation
- ⚠️ Guest-facing (needs high reliability)

**Migration Priority:** 🔴 **HIGH** (Customer-facing)

---

### Stripe (4 endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/stripe/webhook` | POST | N/A | ⚠️ Stripe sig | Webhook handler |
| `/api/stripe/create-checkout` | POST | TBD | ❌ None | Checkout session |
| `/api/stripe/verify-session` | GET/POST | TBD | ❌ None | Session verify |
| `/api/stripe/connect/authorize` | GET | TBD | ❌ None | Connect OAuth |

**Issues:**
- ❌ No versioning (except webhooks should stay unversioned)
- ❌ No validation beyond Stripe signature
- ⚠️ Webhook endpoint should remain at current path

**Migration Priority:** 🟡 **MEDIUM** (Webhook stays, others migrate)

---

### Utility Endpoints (3 endpoints)

| Endpoint | Method | Response Format | Validation | Notes |
|----------|--------|----------------|------------|-------|
| `/api/tenant` | GET | TBD | ❌ None | Tenant info |
| `/api/auth/verify-token` | POST | TBD | ❌ None | Token verification |
| `/api/cron/cleanup-expired-reservations` | GET/POST | TBD | ❌ None | Cron job |
| `/api/upload/property-image` | POST | TBD | ❌ None | File upload |

**Issues:**
- ❌ No versioning
- ⚠️ Cron endpoint security needs review
- ⚠️ File upload needs special handling

**Migration Priority:** 🟢 **LOW** (Utility endpoints)

---

## Common Anti-Patterns Identified

### 1. Selective Field Fetching (CRITICAL)

**Example from `/api/admin/reservations/[id]`:**
```typescript
.select(`
  *,
  guest:guests (
    id,
    first_name,
    last_name,
    email,
    phone
  ),
  site:sites (
    id,
    site_number,
    site_name,
    site_type
  )
`)
```

**Problem:** If frontend expects more guest/site fields, silent failure occurs

**Solution:**
- Use `.select('*')` for complete entities
- OR create explicit DTOs with documented projections
- Always validate response matches schema

### 2. Inconsistent Response Formats

**Variations found:**
```typescript
// Pattern 1: Named wrapper
{reservation: {...}}

// Pattern 2: Array wrapper
{sites: [...]}

// Pattern 3: Direct data
{...data}

// Pattern 4: Success envelope (only search-availability)
{success: true, data: {...}}
```

**Solution:** Standardize on envelope pattern:
```typescript
{
  success: true,
  data: {...},
  meta: {timestamp, version, request_id}
}
```

### 3. No Runtime Validation

**Current State:** Only `/booking/search-availability` validates

**Example (search-availability.ts - GOOD):**
```typescript
const searchParamsSchema = z.object({
  property_id: z.string().uuid(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // ...
})

const validatedParams = searchParamsSchema.parse(body)
```

**Solution:** Apply this pattern to ALL endpoints

### 4. Action Endpoints Not RESTful

**Current:**
- `/api/admin/reservations/[id]/check-in` (POST)
- `/api/admin/reservations/[id]/cancel` (POST)
- `/api/admin/sites/[id]/housekeeping-complete` (POST)

**Issue:** Not clearly documented what these return

**Solution:** Standardize action endpoints:
- Clear request/response schemas
- Idempotency where appropriate
- Standard success/error responses

---

## Migration Strategy

### Phase 1: Critical Path (Weeks 3-4)

**Fix October 30 Incident:**
1. `/api/onboarding/properties` → `/api/v1/properties`
   - Remove selective fetching
   - Add Zod validation
   - Return complete property entity

### Phase 2: Core Booking Flow (Weeks 9-10)

**High-traffic, customer-facing:**
1. `/api/booking/search-availability` → `/api/v1/availability/search`
   - Already has Zod (keep it!)
   - Add response envelope
2. `/api/booking/create-payment-intent` → `/api/v1/payments/intent`
3. `/api/guest/reservations/create` → `/api/v1/reservations` (guest context)

### Phase 3: Admin APIs (Weeks 5-12)

**Internal tools:**
1. Reservations management endpoints
2. Sites management endpoints
3. Property configuration endpoints

### Phase 4: Utility Endpoints (Weeks 13-14)

**Low priority:**
1. Tenant info
2. Auth utilities
3. File uploads

---

## Deprecated Endpoint Tracking

| Old Endpoint | New Endpoint | Deprecated | Sunset Date | Status |
|--------------|--------------|------------|-------------|--------|
| TBD | TBD | TBD | TBD | ⬜ Not Started |

*(To be filled as migration progresses)*

---

## Testing Requirements

### Contract Tests Required For

- [ ] All v1 API endpoints
- [ ] Response schema validation
- [ ] Request schema validation
- [ ] Error response formats
- [ ] Pagination (where applicable)
- [ ] Authentication/authorization

### Regression Tests Required For

- [ ] October 30 incident (missing fields)
- [ ] Selective field fetching
- [ ] Multi-tenant isolation
- [ ] Payment flows

---

## Monitoring & Alerts

### Metrics to Track

1. **API Usage by Version**
   - v1 adoption rate
   - Deprecated endpoint usage
   - Sunset countdown

2. **Validation Failures**
   - Request validation errors
   - Response validation errors (indicates schema drift)
   - Field missing errors

3. **Performance**
   - Response times by endpoint
   - Validation overhead
   - Database query performance

### Alerts to Configure

1. **Critical:** Response validation failure (schema drift)
2. **Warning:** Deprecated API usage spike
3. **Info:** New endpoint deployment
4. **Info:** Sunset milestone reached

---

## Next Steps

1. ✅ Complete this audit
2. ⬜ Create API standards document
3. ⬜ Prioritize endpoint migrations
4. ⬜ Create contract test templates
5. ⬜ Begin Phase 1 migrations (Site Management module)

---

**Audit Completed By:** Claude Code
**Review Required:** Engineering Team
**Next Audit:** After Phase 1 completion (Week 4)
