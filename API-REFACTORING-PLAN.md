# API Refactoring Plan
**Status**: Targeted Implementation Plan
**Created**: 2025-11-05
**Based on**: campops-api-specifications.pdf v1.0

## Executive Summary

This document outlines the specific refactoring tasks required to align the current API implementation with the documented API specifications. The audit identified **7 critical gaps** that need addressing to achieve full spec compliance and prepare for the modular monolith architecture.

---

## Current State Analysis

### What's Working Well ✓

1. **Multi-tenant Isolation**: All APIs properly enforce tenant isolation via `property_id` or `company_id`
2. **Authentication**: JWT-based auth via Supabase is consistently implemented
3. **Input Validation**: Most endpoints use Zod schemas for validation
4. **Business Logic Separation**: Core logic extracted to `/lib/booking/` modules
5. **Error Handling**: Sentry integration for error tracking

### Current API Inventory (39 endpoints)

**Admin APIs** (13 endpoints)
- `/api/admin/reservations/[id]` - GET
- `/api/admin/reservations/[id]/cancel` - POST
- `/api/admin/reservations/[id]/check-in` - POST
- `/api/admin/reservations/[id]/checkout` - POST
- `/api/admin/reservations/[id]/update` - PATCH
- `/api/admin/reservations/[id]/actions` - GET
- `/api/admin/reservations/[id]/check-action` - POST
- `/api/admin/reservations/create` - POST
- `/api/admin/sites` - GET
- `/api/admin/sites/[id]` - GET
- `/api/admin/sites/[id]/reservations` - GET
- `/api/admin/sites/[id]/housekeeping-complete` - POST

**Guest/Public APIs** (5 endpoints)
- `/api/guest/reservations/create` - POST
- `/api/guest/payment/confirm` - POST
- `/api/booking/search-availability` - POST
- `/api/booking/create-payment-intent` - POST

**Dashboard/Internal** (13 endpoints)
- `/api/dashboard/properties/[id]/sites` - GET
- `/api/dashboard/properties/[id]/stripe-disconnect` - POST
- `/api/dashboard/properties/[id]/wizard-progress` - GET/POST
- `/api/dashboard/properties/[id]/update-details` - PATCH
- `/api/properties/[id]/settings` - GET/PATCH
- `/api/onboarding/*` (6 endpoints)

**Supporting APIs** (8 endpoints)
- `/api/stripe/*` - Webhook, checkout, connect
- `/api/webhooks/stripe` - POST
- `/api/tenant` - GET
- `/api/auth/verify-token` - POST
- `/api/upload/property-image` - POST
- `/api/cron/cleanup-expired-reservations` - POST

---

## Gap Analysis: Spec vs Implementation

### GAP #1: Non-Standard Response Format ⚠️ CRITICAL
**Severity**: HIGH
**Impact**: All endpoints
**Issue**: Current APIs return inconsistent response structures

**Current Pattern**:
```typescript
// Mixed patterns observed:
return NextResponse.json({ reservation })           // Pattern A
return NextResponse.json({ success: true, data })   // Pattern B
return NextResponse.json({ error: "message" })      // Pattern C
return NextResponse.json({ sites: [] })             // Pattern D
```

**Spec Requirement** (from API Specification 2.2):
```typescript
// Success response
{
  "success": true,
  "data": { /* resource data */ },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_abc123xyz"
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {} // optional
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Recommendation**: Create `lib/api/response.ts` utility module

---

### GAP #2: Missing API Versioning ⚠️ CRITICAL
**Severity**: HIGH
**Impact**: All endpoints
**Issue**: APIs are not versioned

**Current**: `/api/admin/reservations/[id]`
**Spec**: `/v1/reservations/[id]`

**Spec Requirement** (from API Specification 3.1):
- Base URL pattern: `/v1/{resource}`
- All APIs should be under `/v1/` namespace
- Prepare for future v2 migration

**Recommendation**:
- Phase 1: Add v1 routes while maintaining current routes (dual support)
- Phase 2: Deprecate old routes with 301 redirects
- Phase 3: Remove old routes after deprecation period

---

### GAP #3: Inconsistent Error Codes
**Severity**: MEDIUM
**Impact**: Error handling, client integration
**Issue**: Error responses use generic HTTP status without structured error codes

**Current Pattern**:
```typescript
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
return NextResponse.json({ error: "Property not found" }, { status: 404 })
```

**Spec Requirement** (from API Specification 2.3):
Standardized error codes with consistent structure:
- `AUTH_001`: Invalid or expired token
- `AUTH_002`: Insufficient permissions
- `RES_001`: Reservation not found
- `RES_002`: Site not available
- `RES_003`: Invalid dates
- `SITE_001`: Site not found
- etc.

**Recommendation**: Create error code constants in `lib/api/errors.ts`

---

### GAP #4: Missing Endpoints per Spec
**Severity**: MEDIUM
**Impact**: Feature completeness
**Issue**: Several endpoints defined in spec are not implemented

**Missing Endpoints** (from API Specification 4.x):

1. **Company Management** (4.1) - MISSING ENTIRELY
   - `GET /v1/companies/[id]` - Get company details
   - `PATCH /v1/companies/[id]` - Update company
   - `GET /v1/companies/[id]/properties` - List properties
   - `POST /v1/companies/[id]/properties` - Create property

2. **Properties** (4.2) - PARTIAL
   - ✓ `GET /v1/properties/[id]/settings` - EXISTS
   - ✓ `PATCH /v1/properties/[id]/settings` - EXISTS
   - ✗ `GET /v1/properties/[id]` - Get property details (MISSING)
   - ✗ `PATCH /v1/properties/[id]` - Update property (MISSING)
   - ✗ `DELETE /v1/properties/[id]` - Delete property (MISSING)

3. **Sites** (4.3) - PARTIAL
   - ✓ `GET /v1/properties/[propertyId]/sites` - List sites (admin only)
   - ✗ `POST /v1/properties/[propertyId]/sites` - Create site (MISSING)
   - ✗ `GET /v1/sites/[id]` - Get site details (MISSING)
   - ✗ `PATCH /v1/sites/[id]` - Update site (MISSING)
   - ✗ `DELETE /v1/sites/[id]` - Delete site (MISSING)

4. **Guests** (4.4) - MISSING ENTIRELY
   - `GET /v1/properties/[propertyId]/guests` - List guests
   - `GET /v1/guests/[id]` - Get guest details
   - `PATCH /v1/guests/[id]` - Update guest
   - `DELETE /v1/guests/[id]` - Delete guest

5. **Financial** (4.6) - MISSING ENTIRELY
   - `GET /v1/properties/[propertyId]/payments` - List payments
   - `GET /v1/payments/[id]` - Get payment details
   - `POST /v1/payments/[id]/refund` - Process refund
   - `GET /v1/properties/[propertyId]/revenue` - Revenue reports

6. **Staff Management** (4.7) - MISSING ENTIRELY
   - `GET /v1/properties/[propertyId]/staff` - List staff
   - `POST /v1/properties/[propertyId]/staff` - Invite staff
   - `PATCH /v1/staff/[id]` - Update staff member
   - `DELETE /v1/staff/[id]` - Remove staff

**Recommendation**: Prioritize by business value and implement incrementally

---

### GAP #5: Incomplete Pagination Support
**Severity**: MEDIUM
**Impact**: Performance, scalability
**Issue**: List endpoints don't support pagination

**Current**:
```typescript
// Returns all results
const { data: sites } = await supabase.from('sites').select('*')
return NextResponse.json({ sites })
```

**Spec Requirement** (from API Specification 2.4):
```typescript
// Request
GET /v1/properties/123/reservations?page=1&limit=25

// Response
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 150,
      "totalPages": 6
    },
    "timestamp": "...",
    "requestId": "..."
  }
}
```

**Affected Endpoints**:
- `GET /api/admin/sites` - Returns all sites
- `GET /api/admin/sites/[id]/reservations` - Returns all reservations
- Future guest lists, payment lists, etc.

**Recommendation**: Create `lib/api/pagination.ts` utility

---

### GAP #6: Missing Filter/Sort/Search Capabilities
**Severity**: LOW
**Impact**: API usability
**Issue**: List endpoints don't support query parameters for filtering

**Spec Requirement** (from API Specification 2.5):
- Filter: `?status=confirmed&payment_status=paid`
- Sort: `?sort_by=check_in_date&sort_order=asc`
- Search: `?search=guest_name`
- Date ranges: `?check_in_after=2025-01-01&check_in_before=2025-12-31`

**Currently**: Only `/api/booking/search-availability` has filtering

**Recommendation**: Implement query builder in `lib/api/query-builder.ts`

---

### GAP #7: Missing Rate Limiting Headers
**Severity**: LOW
**Impact**: API governance, DoS protection
**Issue**: No rate limiting metadata in responses

**Spec Requirement** (from API Specification 2.6):
```typescript
// Response headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

**Recommendation**: Implement rate limiter middleware using Upstash Redis or similar

---

## Refactoring Strategy

### Phase 1: Foundation (Week 1) - NON-BREAKING
**Goal**: Establish standardized response utilities without breaking existing clients

**Tasks**:
1. Create `lib/api/response.ts` - Standard response builders
2. Create `lib/api/errors.ts` - Error code constants
3. Create `lib/api/types.ts` - TypeScript types for API contracts
4. Add unit tests for new utilities

**Deliverables**:
- New utilities available but not yet enforced
- 100% test coverage on utilities
- Documentation for developers

---

### Phase 2: Versioning Setup (Week 2) - NON-BREAKING
**Goal**: Introduce v1 namespace while maintaining backward compatibility

**Tasks**:
1. Create `app/api/v1/` directory structure
2. Implement v1 routes alongside existing routes
3. Add middleware for version detection
4. Update internal services to use v1 endpoints

**Migration Pattern**:
```
/api/admin/reservations/[id]        ← Keep (deprecated)
/api/v1/reservations/[id]           ← New (recommended)
```

**Deliverables**:
- All existing APIs available under `/api/v1/*`
- Old routes continue to work
- Deprecation warnings logged

---

### Phase 3: Response Standardization (Weeks 3-4) - BREAKING
**Goal**: Migrate all v1 endpoints to standard response format

**Tasks**:
1. Update all v1 endpoints to use `lib/api/response.ts`
2. Replace ad-hoc errors with standard error codes
3. Add `meta` field to all responses
4. Add request ID tracking

**Before**:
```typescript
return NextResponse.json({ reservation })
```

**After**:
```typescript
import { success } from '@/lib/api/response'
return success({ reservation }, request)
```

**Deliverables**:
- All v1 endpoints use standard format
- Error codes documented
- Client SDK updated (if exists)

---

### Phase 4: Missing Endpoints (Weeks 5-8) - FEATURE
**Goal**: Implement missing spec-defined endpoints

**Priority 1** (Business Critical):
- Company Management APIs
- Property CRUD operations
- Site CRUD operations

**Priority 2** (High Value):
- Guest Management APIs
- Payment history APIs

**Priority 3** (Nice to Have):
- Staff Management APIs
- Advanced reporting APIs

**Deliverables**:
- 15+ new endpoints implemented
- Full CRUD support for core resources
- OpenAPI spec generated

---

### Phase 5: Pagination & Filtering (Weeks 9-10) - ENHANCEMENT
**Goal**: Add pagination, filtering, sorting to list endpoints

**Tasks**:
1. Create `lib/api/pagination.ts`
2. Create `lib/api/query-builder.ts`
3. Update all list endpoints
4. Add integration tests

**Deliverables**:
- All list endpoints support pagination
- Consistent query parameter interface
- Performance benchmarks documented

---

### Phase 6: Cleanup & Deprecation (Week 11-12) - BREAKING
**Goal**: Deprecate old non-versioned routes

**Tasks**:
1. Add 301 redirects from old routes to v1
2. Send deprecation notices to stakeholders
3. Update all documentation
4. Set sunset date for old routes

**Grace Period**: 90 days before removal

**Deliverables**:
- Migration guide published
- All redirects in place
- Monitoring for old route usage

---

## Implementation Utilities

### 1. Standard Response Builder
**File**: `lib/api/response.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export type ApiSuccessResponse<T> = {
  success: true
  data: T
  meta: {
    timestamp: string
    requestId: string
    pagination?: PaginationMeta
  }
}

export type ApiErrorResponse = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: {
    timestamp: string
    requestId: string
  }
}

export function success<T>(
  data: T,
  request?: NextRequest,
  pagination?: PaginationMeta
): NextResponse<ApiSuccessResponse<T>> {
  const requestId = request?.headers.get('x-request-id') || randomUUID()

  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      ...(pagination && { pagination }),
    },
  })
}

export function error(
  code: string,
  message: string,
  status: number,
  request?: NextRequest,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const requestId = request?.headers.get('x-request-id') || randomUUID()

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    },
    { status }
  )
}
```

---

### 2. Error Code Constants
**File**: `lib/api/errors.ts`

```typescript
export const ErrorCodes = {
  // Authentication & Authorization (AUTH_xxx)
  AUTH_001: { code: 'AUTH_001', message: 'Invalid or expired token', status: 401 },
  AUTH_002: { code: 'AUTH_002', message: 'Insufficient permissions', status: 403 },
  AUTH_003: { code: 'AUTH_003', message: 'Account not found', status: 404 },

  // Reservations (RES_xxx)
  RES_001: { code: 'RES_001', message: 'Reservation not found', status: 404 },
  RES_002: { code: 'RES_002', message: 'Site not available for selected dates', status: 409 },
  RES_003: { code: 'RES_003', message: 'Invalid date range', status: 400 },
  RES_004: { code: 'RES_004', message: 'Cannot modify confirmed reservation', status: 409 },
  RES_005: { code: 'RES_005', message: 'Checkout time expired', status: 410 },

  // Sites (SITE_xxx)
  SITE_001: { code: 'SITE_001', message: 'Site not found', status: 404 },
  SITE_002: { code: 'SITE_002', message: 'Site capacity exceeded', status: 400 },
  SITE_003: { code: 'SITE_003', message: 'Site not available', status: 409 },

  // Properties (PROP_xxx)
  PROP_001: { code: 'PROP_001', message: 'Property not found', status: 404 },
  PROP_002: { code: 'PROP_002', message: 'Property not accepting bookings', status: 403 },

  // Payments (PAY_xxx)
  PAY_001: { code: 'PAY_001', message: 'Payment failed', status: 402 },
  PAY_002: { code: 'PAY_002', message: 'Refund failed', status: 500 },
  PAY_003: { code: 'PAY_003', message: 'Invalid payment method', status: 400 },

  // Validation (VAL_xxx)
  VAL_001: { code: 'VAL_001', message: 'Invalid request data', status: 400 },
  VAL_002: { code: 'VAL_002', message: 'Required field missing', status: 400 },

  // System (SYS_xxx)
  SYS_001: { code: 'SYS_001', message: 'Internal server error', status: 500 },
  SYS_002: { code: 'SYS_002', message: 'Service unavailable', status: 503 },
} as const

export type ErrorCode = keyof typeof ErrorCodes
```

---

### 3. Pagination Utility
**File**: `lib/api/pagination.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type PaginationParams = {
  page?: number
  limit?: number
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export async function paginate<T>(
  query: ReturnType<SupabaseClient['from']>,
  params: PaginationParams = {}
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 25))
  const offset = (page - 1) * limit

  // Get total count
  const { count } = await query.select('*', { count: 'exact', head: true })
  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  // Get paginated data
  const { data, error } = await query
    .select('*')
    .range(offset, offset + limit - 1)

  if (error) throw error

  return {
    data: data as T[],
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  }
}
```

---

## Migration Checklist

### Pre-Migration
- [ ] Review refactoring plan with team
- [ ] Set up feature flags for gradual rollout
- [ ] Create monitoring dashboards for API metrics
- [ ] Document breaking changes
- [ ] Notify API consumers of upcoming changes

### Phase 1: Foundation
- [ ] Create `lib/api/response.ts`
- [ ] Create `lib/api/errors.ts`
- [ ] Create `lib/api/types.ts`
- [ ] Add unit tests (100% coverage target)
- [ ] Code review and approval

### Phase 2: Versioning
- [ ] Create `app/api/v1/` structure
- [ ] Implement version detection middleware
- [ ] Migrate first endpoint as POC
- [ ] Document migration pattern
- [ ] Roll out to remaining endpoints

### Phase 3: Standardization
- [ ] Update all v1 endpoints to use response utilities
- [ ] Replace error strings with error codes
- [ ] Add request ID tracking
- [ ] Update integration tests
- [ ] Generate OpenAPI spec

### Phase 4: New Endpoints
- [ ] Implement Company Management APIs
- [ ] Implement Property CRUD APIs
- [ ] Implement Site CRUD APIs
- [ ] Implement Guest Management APIs
- [ ] Implement Financial APIs
- [ ] Write API documentation

### Phase 5: Pagination
- [ ] Implement pagination utility
- [ ] Update list endpoints
- [ ] Add query parameter validation
- [ ] Performance testing
- [ ] Update documentation

### Phase 6: Cleanup
- [ ] Add deprecation warnings to old routes
- [ ] Implement 301 redirects
- [ ] Send migration notices
- [ ] Monitor old route usage
- [ ] Remove old routes after grace period

---

## Success Metrics

### Technical Metrics
- **Response Format Compliance**: 100% of v1 endpoints use standard format
- **Error Code Coverage**: 100% of errors use documented error codes
- **Test Coverage**: >80% for all API routes
- **API Response Time**: <200ms p95 (no regression)
- **Breaking Changes**: Zero for existing clients during migration

### Business Metrics
- **API Adoption**: >90% of requests use v1 endpoints within 60 days
- **Developer Satisfaction**: Survey score >4/5
- **Support Tickets**: <10% increase during migration
- **Documentation**: 100% of endpoints documented in OpenAPI spec

---

## Risk Mitigation

### Risk: Breaking Changes Impact Production
**Mitigation**:
- Phase 2 maintains backward compatibility
- Use feature flags for gradual rollout
- Extensive integration testing before release
- Monitoring and alerting on error rates

### Risk: Performance Regression
**Mitigation**:
- Benchmark before/after for each phase
- Load testing on staging environment
- Database query optimization as needed
- Caching strategy for list endpoints

### Risk: Client Integration Issues
**Mitigation**:
- Provide migration guide with code examples
- Offer 90-day deprecation period
- Maintain dual support during transition
- Direct communication with API consumers

### Risk: Incomplete Specification
**Mitigation**:
- Collaborate with product team on missing endpoints
- Prioritize by business value
- Implement incrementally with feedback loops
- Update spec as requirements evolve

---

## Next Steps

1. **Review & Approval**: Share this plan with engineering team and stakeholders
2. **Timeline Commitment**: Allocate resources for 12-week implementation
3. **Spike Work**: Validate Phase 1 utilities with POC endpoint
4. **Documentation**: Set up OpenAPI spec generation pipeline
5. **Kick-off**: Begin Phase 1 implementation

---

## Appendix A: Endpoint Mapping

### Current → Spec Mapping

| Current Endpoint | Spec Endpoint | Status | Notes |
|-----------------|---------------|--------|-------|
| `/api/admin/reservations/[id]` | `/v1/reservations/[id]` | Partial | Needs standard response |
| `/api/admin/reservations/create` | `/v1/reservations` | Partial | POST to collection route |
| `/api/admin/sites` | `/v1/properties/[id]/sites` | Partial | Needs property scoping |
| `/api/guest/reservations/create` | `/v1/reservations` | Partial | Same endpoint, different auth |
| `/api/booking/search-availability` | `/v1/sites/availability` | Partial | Needs refactor |
| N/A | `/v1/companies/[id]` | Missing | Phase 4 |
| N/A | `/v1/guests/[id]` | Missing | Phase 4 |
| N/A | `/v1/payments` | Missing | Phase 4 |

---

## Appendix B: Response Format Examples

### Before (Current)
```typescript
// ❌ Inconsistent patterns
GET /api/admin/reservations/123
{
  "reservation": { "id": "123", ... }
}

GET /api/admin/sites
{
  "sites": [...]
}

ERROR
{
  "error": "Not found"
}
```

### After (Spec-Compliant)
```typescript
// ✅ Consistent standard format
GET /v1/reservations/123
{
  "success": true,
  "data": {
    "reservation": { "id": "123", ... }
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}

GET /v1/properties/456/sites?page=1&limit=25
{
  "success": true,
  "data": {
    "sites": [...]
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_xyz789",
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 150,
      "totalPages": 6
    }
  }
}

ERROR
{
  "success": false,
  "error": {
    "code": "RES_001",
    "message": "Reservation not found"
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_def456"
  }
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-05
**Owner**: Engineering Team
**Status**: Ready for Review
