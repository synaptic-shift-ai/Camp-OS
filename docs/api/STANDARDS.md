# CampOS API Standards

**Version:** 1.0
**Status:** ✅ APPROVED
**Effective Date:** 2025-11-05
**Last Updated:** 2025-11-05

---

## Purpose

This document defines the standards for ALL CampOS APIs. These standards ensure:
- Consistent developer experience
- Runtime contract safety
- Backward compatibility support
- Clear API evolution path
- Debuggability and observability

**All new APIs MUST follow these standards. All existing APIs will be migrated to compliance.**

---

## Table of Contents

1. [Versioning Strategy](#versioning-strategy)
2. [URL Structure](#url-structure)
3. [Request Format](#request-format)
4. [Response Format](#response-format)
5. [Error Handling](#error-handling)
6. [Validation](#validation)
7. [Authentication](#authentication)
8. [Rate Limiting](#rate-limiting)
9. [Pagination](#pagination)
10. [Field Selection](#field-selection)
11. [Deprecation Policy](#deprecation-policy)

---

## Versioning Strategy

### Version in URL Path

**✅ REQUIRED:** All APIs MUST include version in the URL path.

```typescript
// ✅ CORRECT
GET /api/v1/properties
GET /api/v1/reservations/123

// ❌ WRONG
GET /api/properties
GET /api/reservations/123
```

### Version Header

**✅ REQUIRED:** All responses MUST include `X-API-Version` header.

```typescript
response.headers.set("X-API-Version", "1.0")
```

### Version Format

- Use `v1`, `v2`, etc. in URL path
- Use `1.0`, `2.0` in headers and metadata
- Major versions only in URL (`v1` not `v1.2`)
- Minor versions documented but not in URL

### Breaking Changes

**Breaking changes require a new major version:**
- Removing fields from responses
- Changing field types
- Removing endpoints
- Changing authentication requirements
- Changing response format

**Non-breaking changes allowed in same version:**
- Adding new fields to responses
- Adding new optional parameters
- Adding new endpoints
- Bug fixes

---

## URL Structure

### Pattern

```
/api/{version}/{module}/{resource}[/{id}][/{action}]
```

### Examples

```typescript
// Resource operations
GET    /api/v1/properties           // List
POST   /api/v1/properties           // Create
GET    /api/v1/properties/:id       // Get one
PATCH  /api/v1/properties/:id       // Update
DELETE /api/v1/properties/:id       // Delete

// Sub-resources
GET    /api/v1/properties/:id/sites
POST   /api/v1/properties/:id/sites

// Actions (when not CRUD)
POST   /api/v1/reservations/:id/check-in
POST   /api/v1/reservations/:id/cancel
POST   /api/v1/payments/:id/refund
```

### URL Naming Rules

1. **Lowercase:** All URLs in lowercase
2. **Hyphens:** Use hyphens for multi-word resources (`check-in`, not `checkIn`)
3. **Plural nouns:** Resource names plural (`properties`, not `property`)
4. **No verbs:** Use HTTP methods, not verbs in URL (❌ `/getProperty`)
5. **No file extensions:** No `.json` or `.xml`

---

## Request Format

### Content Type

```typescript
Content-Type: application/json
```

### Request Body Schema

**✅ REQUIRED:** All request bodies MUST be validated with Zod schemas.

```typescript
import { z } from "zod"

const CreateSiteRequestSchema = z.object({
  property_id: z.string().uuid(),
  site_number: z.string().min(1).max(50),
  site_type: z.enum(['tent', 'rv', 'cabin', 'glamping']),
  base_price: z.number().int().positive(),
  // ... all required fields
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const validated = CreateSiteRequestSchema.parse(body) // Throws if invalid

  // ... process validated data
}
```

### Query Parameters

- Use for filtering, sorting, pagination
- Document all parameters
- Validate with Zod

```typescript
// Example: GET /api/v1/sites?property_id=123&status=available&page=2
const QueryParamsSchema = z.object({
  property_id: z.string().uuid().optional(),
  status: z.enum(['available', 'reserved', 'maintenance']).optional(),
  page: z.number().int().positive().default(1),
  per_page: z.number().int().positive().max(100).default(20)
})
```

---

## Response Format

### Standard Success Response

**✅ REQUIRED:** All successful responses MUST use this envelope:

```typescript
{
  "success": true,
  "data": {
    // The actual response data
    "id": "123",
    "name": "Property Name",
    // ... all fields
  },
  "meta": {
    "timestamp": "2025-11-05T10:30:00.000Z",
    "version": "1.0",
    "request_id": "req_abc123"  // Optional
  }
}
```

### List Response

**✅ REQUIRED:** List endpoints MUST include pagination metadata:

```typescript
{
  "success": true,
  "data": {
    "items": [
      // Array of items
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8
    }
  },
  "meta": {
    "timestamp": "2025-11-05T10:30:00.000Z",
    "version": "1.0"
  }
}
```

### Response Validation

**✅ REQUIRED:** All responses MUST be validated server-side before sending.

```typescript
import { createSuccessResponse } from "@/lib/api/validate"
import { SiteResponseSchema } from "@/types/api/v1/schemas/sites"

export async function GET(request: NextRequest) {
  const site = await getSite(id)

  // Validate response matches schema
  SiteResponseSchema.parse(site) // Throws if invalid

  return NextResponse.json(createSuccessResponse(site, "1.0"))
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PATCH, PUT |
| 201 | Successful POST (created) |
| 204 | Successful DELETE (no content) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no/invalid auth) |
| 403 | Forbidden (authenticated but not authorized) |
| 404 | Not found |
| 409 | Conflict (duplicate, constraint violation) |
| 422 | Unprocessable entity (business logic error) |
| 429 | Too many requests (rate limited) |
| 500 | Internal server error |
| 503 | Service unavailable |

---

## Error Handling

### Standard Error Response

**✅ REQUIRED:** All error responses MUST use this envelope:

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid site number provided",
    "details": {
      "field": "site_number",
      "constraint": "must be between 1 and 50 characters"
    }
  },
  "meta": {
    "timestamp": "2025-11-05T10:30:00.000Z",
    "version": "1.0",
    "request_id": "req_abc123"
  }
}
```

### Error Codes

**Standard error codes (use these consistently):**

```typescript
// Validation errors (400)
"VALIDATION_ERROR"         // General validation failure
"MISSING_REQUIRED_FIELD"   // Required field missing
"INVALID_FORMAT"           // Wrong format (email, date, etc.)
"INVALID_VALUE"            // Value out of range/not in enum

// Authentication/Authorization (401, 403)
"UNAUTHORIZED"             // No authentication
"INVALID_TOKEN"            // Token invalid/expired
"FORBIDDEN"                // Not allowed to access

// Not Found (404)
"RESOURCE_NOT_FOUND"       // Resource doesn't exist
"ENDPOINT_NOT_FOUND"       // Wrong URL

// Conflict (409)
"DUPLICATE_RESOURCE"       // Already exists
"CONSTRAINT_VIOLATION"     // Database constraint

// Business Logic (422)
"BUSINESS_RULE_VIOLATION"  // Business rule failed
"INSUFFICIENT_FUNDS"       // Payment-specific
"UNAVAILABLE"              // Reservation conflict, etc.

// Rate Limiting (429)
"RATE_LIMIT_EXCEEDED"      // Too many requests

// Server Errors (500)
"INTERNAL_ERROR"           // Unexpected server error
"DATABASE_ERROR"           // Database operation failed
"EXTERNAL_SERVICE_ERROR"   // Third-party service failed
```

### Error Handling Example

```typescript
import { createErrorResponse } from "@/lib/api/validate"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = RequestSchema.parse(body)

    // ... process request

  } catch (error) {
    // Validation error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          "VALIDATION_ERROR",
          "Request validation failed",
          error.errors
        ),
        { status: 400 }
      )
    }

    // Business logic error
    if (error instanceof BusinessRuleError) {
      return NextResponse.json(
        createErrorResponse(
          "BUSINESS_RULE_VIOLATION",
          error.message,
          { rule: error.ruleName }
        ),
        { status: 422 }
      )
    }

    // Unexpected error
    console.error("Unexpected error:", error)
    return NextResponse.json(
      createErrorResponse(
        "INTERNAL_ERROR",
        "An unexpected error occurred"
      ),
      { status: 500 }
    )
  }
}
```

---

## Validation

### Runtime Validation Required

**✅ REQUIRED:** ALL APIs must validate:
1. Request body (if present)
2. Query parameters
3. Path parameters
4. Response data (server-side)

### Zod Schemas

**✅ REQUIRED:** Use Zod for all validation.

**Schema Location:**
```
src/types/api/v1/schemas/
├── common.ts           // Shared schemas
├── properties.ts       // Property schemas
├── sites.ts            // Site schemas
├── reservations.ts     // Reservation schemas
└── ...
```

**Schema Example:**
```typescript
// src/types/api/v1/schemas/sites.ts

import { z } from "zod"
import { UuidSchema, CurrencyAmountSchema } from "./common"

export const SiteSchema = z.object({
  id: UuidSchema,
  property_id: UuidSchema,
  site_number: z.string().min(1).max(50),
  site_type: z.enum(['tent', 'rv', 'cabin', 'glamping', 'yurt']),
  base_price: CurrencyAmountSchema,
  status: z.enum(['available', 'reserved', 'maintenance']),
  // ... ALL fields with validation rules
})

export const CreateSiteRequestSchema = SiteSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
})

export const SiteResponseSchema = createSuccessResponseSchema(SiteSchema)
export const SiteListResponseSchema = createListResponseSchema(SiteSchema)
```

---

## Authentication

### Bearer Token

**✅ REQUIRED:** Use Bearer token authentication for all authenticated endpoints.

```typescript
Authorization: Bearer {token}
```

### Authentication Middleware

```typescript
// All authenticated endpoints use middleware
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      createErrorResponse("UNAUTHORIZED", "Authentication required"),
      { status: 401 }
    )
  }

  // ... authenticated request handling
}
```

### Multi-Tenancy

**✅ REQUIRED:** All requests must be scoped to tenant (company).

```typescript
// Get user's company
const { data: company } = await supabase
  .from("companies")
  .select("id")
  .eq("owner_id", user.id)
  .single()

// All queries filtered by company
const { data: properties } = await supabase
  .from("properties")
  .select("*")
  .eq("company_id", company.id)  // ← Tenant isolation
```

---

## Rate Limiting

**📋 PLANNED:** Rate limiting to be implemented in Phase 2.

**Planned Limits:**
- Authenticated requests: 1000 requests/hour per user
- Public endpoints: 100 requests/hour per IP
- Webhook endpoints: No limit (Stripe signature verified)

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1636588800
```

---

## Pagination

### Query Parameters

```typescript
?page=1&per_page=20&sort_by=created_at&sort_order=desc
```

### Response Format

```typescript
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8
    }
  },
  "meta": {...}
}
```

### Defaults

- `page`: 1
- `per_page`: 20
- `max per_page`: 100
- Default sort: varies by resource (usually `created_at desc`)

---

## Field Selection

### Complete Entities Required

**✅ REQUIRED:** Return complete entities by default.

```typescript
// ✅ CORRECT - Return all fields
const { data: properties } = await supabase
  .from('properties')
  .select('*')

// ❌ WRONG - Selective fetching (caused Oct 30 incident)
const { data: properties } = await supabase
  .from('properties')
  .select('id, name, company_id')  // Missing fields!
```

### Explicit DTOs for Projections

**If you need a subset of fields, create an explicit DTO:**

```typescript
// Create a documented DTO type
export type PropertyListItemDTO = {
  id: string
  name: string
  site_count: number
  // Only fields needed for list view
}

// Create explicit Zod schema
export const PropertyListItemSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  site_count: z.number().int().nonnegative()
})

// Document why fields are limited
/**
 * GET /api/v1/properties (list view)
 *
 * Returns minimal property data for list performance.
 * Use GET /api/v1/properties/:id for complete property.
 */
```

---

## Deprecation Policy

### Deprecation Timeline

1. **Announce:** Deprecation communicated 6 months before sunset
2. **Warning:** Deprecation headers added immediately
3. **Monitor:** Track usage for 6 months
4. **Sunset:** Remove deprecated endpoint

### Deprecation Headers

```typescript
// Add to deprecated endpoints
response.headers.set("Deprecation", "true")
response.headers.set("Sunset", "2026-06-01")  // 6 months
response.headers.set("Link", `</api/v2/properties>; rel="alternate"`)
```

### Deprecation Tracking

| Endpoint | Deprecated | Replacement | Sunset | Status |
|----------|------------|-------------|--------|--------|
| `/api/onboarding/properties` | 2025-12-01 | `/api/v1/properties` | 2026-06-01 | ⚠️ Deprecated |

---

## Implementation Checklist

Use this checklist when creating/migrating any API endpoint:

### Required for ALL APIs

- [ ] **Versioning**
  - [ ] URL includes `/api/v1/`
  - [ ] Response includes `X-API-Version` header

- [ ] **Response Format**
  - [ ] Success responses use standard envelope
  - [ ] Error responses use standard envelope
  - [ ] List endpoints include pagination
  - [ ] HTTP status codes correct

- [ ] **Validation**
  - [ ] Zod schema created for request
  - [ ] Zod schema created for response
  - [ ] Request body validated
  - [ ] Query parameters validated
  - [ ] Response validated (server-side)

- [ ] **Error Handling**
  - [ ] Standard error codes used
  - [ ] Helpful error messages
  - [ ] Details provided where appropriate
  - [ ] All errors caught and formatted

- [ ] **Authentication**
  - [ ] Bearer token required (if authenticated)
  - [ ] User verification implemented
  - [ ] Tenant isolation enforced

- [ ] **Field Selection**
  - [ ] Returns complete entity OR
  - [ ] Uses explicit documented DTO

- [ ] **Testing**
  - [ ] Contract tests verify schema
  - [ ] Integration tests pass
  - [ ] Error cases tested
  - [ ] Multi-tenancy tested

- [ ] **Documentation**
  - [ ] Endpoint purpose documented
  - [ ] Request/response examples provided
  - [ ] Error codes documented
  - [ ] OpenAPI spec updated

---

## Examples

### Complete Example: Create Site

```typescript
// src/types/api/v1/schemas/sites.ts
import { z } from "zod"
import { UuidSchema, CurrencyAmountSchema, createSuccessResponseSchema } from "./common"

export const CreateSiteRequestSchema = z.object({
  property_id: UuidSchema,
  site_number: z.string().min(1).max(50),
  site_type: z.enum(['tent', 'rv', 'cabin', 'glamping']),
  base_price: CurrencyAmountSchema,
  max_occupancy: z.number().int().positive()
})

export const SiteSchema = CreateSiteRequestSchema.extend({
  id: UuidSchema,
  status: z.enum(['available', 'reserved', 'maintenance']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

export const SiteResponseSchema = createSuccessResponseSchema(SiteSchema)

// app/api/v1/sites/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { CreateSiteRequestSchema, SiteResponseSchema } from "@/types/api/v1/schemas/sites"
import { createSuccessResponse, createErrorResponse } from "@/lib/api/validate"
import { z } from "zod"

/**
 * POST /api/v1/sites
 *
 * Create a new site for a property.
 *
 * @body {CreateSiteRequest} Site details
 * @returns {SiteResponse} Created site with all fields
 *
 * @example
 * POST /api/v1/sites
 * {
 *   "property_id": "123",
 *   "site_number": "A-1",
 *   "site_type": "rv",
 *   "base_price": 6500,
 *   "max_occupancy": 6
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse("UNAUTHORIZED", "Authentication required"),
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validated = CreateSiteRequestSchema.parse(body)

    // Verify property belongs to user's company (tenant isolation)
    const { data: property } = await supabase
      .from('properties')
      .select('company_id')
      .eq('id', validated.property_id)
      .single()

    if (!property) {
      return NextResponse.json(
        createErrorResponse("RESOURCE_NOT_FOUND", "Property not found"),
        { status: 404 }
      )
    }

    // Create site
    const { data: site, error } = await supabase
      .from('sites')
      .insert({
        ...validated,
        status: 'available'
      })
      .select('*')  // ← Return complete entity
      .single()

    if (error) {
      console.error("Site creation error:", error)
      return NextResponse.json(
        createErrorResponse("DATABASE_ERROR", "Failed to create site"),
        { status: 500 }
      )
    }

    // Validate response
    SiteResponseSchema.parse(createSuccessResponse(site, "1.0"))

    // Return success
    const response = NextResponse.json(
      createSuccessResponse(site, "1.0"),
      { status: 201 }
    )

    response.headers.set("X-API-Version", "1.0")

    return response

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          "VALIDATION_ERROR",
          "Request validation failed",
          error.errors
        ),
        { status: 400 }
      )
    }

    console.error("Unexpected error:", error)
    return NextResponse.json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
      { status: 500 }
    )
  }
}
```

---

## Related Documents

- [API_CONTRACT_SAFETY.md](../architecture/API_CONTRACT_SAFETY.md) - Root cause analysis
- [API_AUDIT.md](./API_AUDIT.md) - Current API inventory
- [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) - Migration timeline

---

**Version History:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-05 | Initial standards document |

---

**Questions or Clarifications?**

Contact the engineering team or file an issue in the repository.
