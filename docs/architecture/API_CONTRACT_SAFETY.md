# API Contract Safety Architecture

**Document Version**: 1.0
**Created**: 2025-10-30
**Status**: PROPOSED
**Incident Reference**: [ONBOARDING_CRISIS_HANDOFF.md](../reference/ONBOARDING_CRISIS_HANDOFF.md)

---

## Executive Summary

This document proposes a comprehensive API contract safety system to prevent silent failures caused by API response mismatches. The October 30 incident included a silent failure where the Properties API returned incomplete data, causing the wizard to hang indefinitely with no error message.

**Key Problems Addressed**:
1. API responses don't match frontend expectations (missing fields)
2. No runtime validation of API contracts
3. Silent failures - missing data causes infinite loading spinners
4. Type safety only at compile time, not runtime
5. No versioning strategy for API evolution
6. Difficult to debug API contract violations

**Solution Approach**:
- Runtime validation with Zod schemas
- Generated TypeScript types from database schema
- API response validation at boundaries
- Contract testing in CI/CD
- Versioned API contracts
- Comprehensive error handling with fallbacks
- OpenAPI spec generation for documentation

---

## Root Cause Analysis

### What Went Wrong

**The Incident**: Properties API used selective field fetching (`.select("id, name, company_id, onboarding_completed")`), but `PropertyContext` expected ALL fields including `slug`, `wizard_step_completed`, `wizard_progress`, etc.

**User Experience**:
```
1. User completes payment ✅
2. Redirects to wizard ✅
3. Wizard calls /api/onboarding/properties ✅
4. API returns partial data (missing fields) ❌
5. PropertyContext initialization fails silently ❌
6. Wizard shows infinite loading spinner ❌
7. No error message, no way to proceed ❌
```

**Technical Flow**:
```typescript
// API (incomplete data)
.select("id, name, company_id, onboarding_completed")

// Response
{
  properties: [{
    id: "123",
    name: "Pine Valley",
    company_id: "456",
    onboarding_completed: false
    // Missing: slug, wizard_step_completed, wizard_progress, etc.
  }]
}

// Frontend (expects all fields)
type Property = {
  id: string
  name: string
  slug: string                    // ← MISSING!
  wizard_step_completed: string   // ← MISSING!
  wizard_progress: number         // ← MISSING!
  // ... many more fields
}

// PropertyContext initialization
const property = properties[0]
const slug = property.slug  // undefined!
// Silent failure, no error thrown
```

**Why Silent Failure**:
- TypeScript types only checked at compile time
- Runtime data doesn't match type definitions
- No validation of API responses
- Frontend code didn't check for missing fields
- No error boundaries to catch initialization failures

---

## Architectural Weaknesses Identified

### 1. No Runtime Validation
**Problem**: TypeScript types are stripped at runtime

```typescript
// Compile time: TypeScript thinks this is safe
const response: PropertyResponse = await fetch("/api/properties").then(r => r.json())

// Runtime: Could be ANYTHING
// TypeScript won't catch missing fields
// No validation happens
```

**Why It's Fragile**:
- API can change without frontend knowing
- Database migrations can remove fields
- Selective SELECTs can omit fields
- No enforcement of contracts

### 2. Implicit Field Requirements
**Problem**: Frontend components implicitly depend on fields existing

```typescript
// PropertyContext.tsx - No explicit validation
const property = properties[0]

// Implicitly assumes these exist
property.slug           // Could be undefined
property.wizard_progress // Could be undefined

// No type guard, no null check, no error handling
```

**Why It's Fragile**:
- Easy to add new field dependencies
- No compile-time check that API provides field
- Silent failures when fields missing
- Difficult to trace which component needs which fields

### 3. Type-Database Mismatch
**Problem**: TypeScript types manually maintained, drift from database

```typescript
// types/property.ts - Manually written
export type Property = {
  id: string
  name: string
  slug: string
  // ... developer must keep this in sync with database
}

// database schema changes
ALTER TABLE properties DROP COLUMN slug;

// TypeScript types unchanged - silent failure
```

**Why It's Fragile**:
- No single source of truth
- Database migrations don't update types
- Easy to forget to update types
- No automated checking

### 4. No API Versioning
**Problem**: API changes break existing clients with no mitigation

**Why It's Fragile**:
- Can't deploy backend changes independently
- Can't support multiple API versions
- Breaking changes require coordinated deploys
- No gradual rollout of API changes

### 5. No Contract Testing
**Problem**: No automated verification that API meets contract

**What's Missing**:
- No tests verifying API response shape
- No tests for required vs optional fields
- No tests for backward compatibility
- No contract-first development

---

## Proposed Architecture

### Design Principles

1. **Contract-First Development**: Define API contracts before implementation
2. **Runtime Validation**: Enforce contracts at runtime, not just compile time
3. **Single Source of Truth**: Database schema generates TypeScript types
4. **Fail-Fast**: Validation errors surface immediately, not silently
5. **Versioned APIs**: Support multiple API versions for gradual migration
6. **Type Safety**: Full type safety from database to frontend
7. **Observable**: Log contract violations for debugging
8. **Testable**: Automated contract testing in CI/CD

---

## Single Source of Truth: Database Schema → TypeScript

### Type Generation Strategy

```bash
# Generate TypeScript types from Supabase schema
npx supabase gen types typescript --project-id $PROJECT_ID > database/types.ts
```

```typescript
// database/types.ts (auto-generated)
export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          slug: string
          name: string
          company_id: string
          owner_id: string
          site_count: number | null
          onboarding_completed: boolean
          wizard_step_completed: string | null
          wizard_progress: number | null
          created_at: string
          updated_at: string
          // ... ALL database fields
        }
        Insert: {
          id?: string
          slug: string
          name: string
          // ... insertion requirements
        }
        Update: {
          id?: string
          slug?: string
          // ... update optionality
        }
      }
    }
  }
}
```

### Shared Type Definitions

```typescript
// types/api/property.ts

import type { Database } from "@/database/types"

// Extract database type (single source of truth)
export type Property = Database["public"]["Tables"]["properties"]["Row"]

// API response types
export type PropertyResponse = Property  // Return ALL fields

export type PropertyListResponse = {
  properties: Property[]
  total: number
  page: number
  per_page: number
}

// Create branded type for ID
export type PropertyId = Brand<string, "PropertyId">
```

---

## Runtime Validation with Zod

### Schema Definition

```typescript
// types/api/property.schema.ts

import { z } from "zod"

/**
 * Zod schema for Property.
 *
 * MUST match database schema exactly.
 * Run `npm run validate:schemas` to verify.
 */
export const PropertySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  company_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  site_count: z.number().int().positive().nullable(),
  onboarding_completed: z.boolean(),
  wizard_step_completed: z.string().nullable(),
  wizard_progress: z.number().min(0).max(100).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // ... ALL fields with validation rules
})

export const PropertyListResponseSchema = z.object({
  properties: z.array(PropertySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  per_page: z.number().int().positive()
})

// Type inference from schema (compile-time safety)
export type PropertySchemaType = z.infer<typeof PropertySchema>

// Compile-time check: PropertySchemaType matches Property
type ValidatePropertySchema = PropertySchemaType extends Property ? true : never
```

### API Response Validation

```typescript
// lib/api/validate.ts

import { z } from "zod"

export class ApiValidationError extends Error {
  constructor(
    public path: string,
    public errors: z.ZodError,
    public data: unknown
  ) {
    super(`API validation failed for ${path}`)
    this.name = "ApiValidationError"
  }
}

/**
 * Validate API response against schema.
 *
 * Throws ApiValidationError if validation fails.
 * Logs validation failures for observability.
 */
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  endpoint: string
): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    // Log validation failure with details
    console.error("[API Validation Failed]", {
      endpoint,
      errors: result.error.errors,
      receivedData: data,
      timestamp: new Date().toISOString()
    })

    // Send to monitoring system
    trackApiValidationFailure(endpoint, result.error, data)

    throw new ApiValidationError(endpoint, result.error, data)
  }

  return result.data
}

/**
 * Create a type-safe API client with automatic validation.
 */
export function createValidatedApiClient<TResponse>(
  endpoint: string,
  schema: z.ZodSchema<TResponse>
) {
  return {
    async get(params?: Record<string, string>): Promise<TResponse> {
      const url = new URL(endpoint, window.location.origin)
      if (params) {
        Object.entries(params).forEach(([key, value]) =>
          url.searchParams.set(key, value)
        )
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Runtime validation
      return validateApiResponse(schema, data, endpoint)
    },

    async post(body: unknown): Promise<TResponse> {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      return validateApiResponse(schema, data, endpoint)
    }
  }
}
```

### Backend API Implementation

```typescript
// app/api/onboarding/properties/route.ts

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PropertyListResponseSchema } from "@/types/api/property.schema"
import type { Property } from "@/types/api/property"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // CRITICAL: Select ALL fields (using *)
    // Previous incident: Selective select caused missing fields
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("*")  // Type-safe: returns Property[]
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })

    if (propertiesError) {
      console.error("[Properties API] Error:", propertiesError)
      return NextResponse.json(
        { error: "Failed to fetch properties" },
        { status: 500 }
      )
    }

    // Build response
    const response = {
      properties: properties || [],
      total: properties?.length || 0,
      page: 1,
      per_page: 100
    }

    // SERVER-SIDE VALIDATION
    // Ensures we're returning valid data
    try {
      PropertyListResponseSchema.parse(response)
    } catch (validationError) {
      // This should NEVER happen (indicates database schema mismatch)
      console.error("[CRITICAL] API response failed validation:", {
        error: validationError,
        response
      })

      // Alert engineering team
      alertInvalidApiResponse("/api/onboarding/properties", validationError, response)

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error("[Properties API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

### Frontend Usage

```typescript
// hooks/useProperties.ts

import { useQuery } from "@tanstack/react-query"
import { createValidatedApiClient } from "@/lib/api/validate"
import { PropertyListResponseSchema } from "@/types/api/property.schema"
import type { PropertyListResponse } from "@/types/api/property"

const propertiesApi = createValidatedApiClient<PropertyListResponse>(
  "/api/onboarding/properties",
  PropertyListResponseSchema
)

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.get(),
    // Built-in error handling for validation failures
    retry: (failureCount, error) => {
      // Don't retry validation errors (indicates API contract bug)
      if (error instanceof ApiValidationError) {
        return false
      }
      return failureCount < 3
    }
  })
}

// Usage in component
function OnboardingWizard() {
  const { data, error, isLoading } = useProperties()

  if (error) {
    // Show user-friendly error
    if (error instanceof ApiValidationError) {
      return <ApiContractError error={error} />
    }

    return <GenericError error={error} />
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  // Type-safe access to properties
  const properties = data.properties  // Property[] (all fields guaranteed)

  return <PropertyWizard properties={properties} />
}
```

---

## Error Boundaries for API Failures

```typescript
// components/error-boundaries/api-error-boundary.tsx

import { Component, type ReactNode } from "react"
import { ApiValidationError } from "@/lib/api/validate"

type Props = {
  children: ReactNode
  fallback?: (error: Error) => ReactNode
}

type State = {
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ApiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo })

    // Log to monitoring
    console.error("[ApiErrorBoundary] Caught error:", {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack
    })

    // Special handling for API validation errors
    if (error instanceof ApiValidationError) {
      alertApiContractViolation(error)
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error)
      }

      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-md p-8 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-2xl font-bold text-red-900 mb-4">
              Something went wrong
            </h2>

            {this.state.error instanceof ApiValidationError ? (
              <>
                <p className="text-red-800 mb-4">
                  We're experiencing technical difficulties loading your data.
                  Our team has been notified.
                </p>
                <details className="text-sm text-red-700">
                  <summary className="cursor-pointer font-medium mb-2">
                    Technical Details
                  </summary>
                  <pre className="bg-red-100 p-2 rounded overflow-auto">
                    {JSON.stringify(this.state.error.errors, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="text-red-800">
                An unexpected error occurred. Please try refreshing the page.
              </p>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.location.href = "/support"}
                className="px-4 py-2 bg-white border border-red-600 text-red-600 rounded hover:bg-red-50"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Usage
<ApiErrorBoundary>
  <OnboardingWizard />
</ApiErrorBoundary>
```

---

## API Versioning Strategy

### Version Header Approach

```typescript
// middleware.ts - Add API version header

export async function middleware(request: NextRequest) {
  // Add API version to all API responses
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next()
    response.headers.set("X-API-Version", "1.0")
    return response
  }

  // ... other middleware logic
}

// Versioned API routes
// app/api/v1/properties/route.ts
// app/api/v2/properties/route.ts

// Frontend specifies version
const response = await fetch("/api/v1/properties", {
  headers: {
    "Accept": "application/json",
    "X-API-Version": "1.0"
  }
})
```

### Deprecation Strategy

```typescript
// lib/api/deprecation.ts

/**
 * Mark API endpoint as deprecated.
 *
 * Logs usage for monitoring, adds deprecation headers.
 */
export function deprecated(
  sunset_date: string,
  replacement: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // Log deprecation usage
      console.warn("[API Deprecation]", {
        endpoint: propertyKey,
        sunset_date,
        replacement,
        timestamp: new Date().toISOString()
      })

      // Track in monitoring
      trackDeprecatedApiUsage(propertyKey, replacement)

      const result = await originalMethod.apply(this, args)

      // Add deprecation headers
      if (result instanceof NextResponse) {
        result.headers.set("Deprecation", "true")
        result.headers.set("Sunset", sunset_date)
        result.headers.set("Link", `<${replacement}>; rel="alternate"`)
      }

      return result
    }

    return descriptor
  }
}

// Usage
export class PropertiesApiV1 {
  @deprecated("2026-01-01", "/api/v2/properties")
  async GET() {
    // Old implementation
  }
}
```

---

## Contract Testing

### Schema Validation Tests

```typescript
// tests/contract/property-api.test.ts

describe("Property API Contract", () => {
  describe("GET /api/onboarding/properties", () => {
    it("should return data matching PropertyListResponseSchema", async () => {
      const { user, company } = await setupUserWithCompany()
      await createProperty(company.id)

      const response = await fetch("/api/onboarding/properties", {
        headers: { Authorization: `Bearer ${user.token}` }
      })

      expect(response.status).toBe(200)

      const data = await response.json()

      // CRITICAL: Validate response against schema
      expect(() => {
        PropertyListResponseSchema.parse(data)
      }).not.toThrow()
    })

    it("should include ALL required fields", async () => {
      const { user, company } = await setupUserWithCompany()
      await createProperty(company.id)

      const response = await fetch("/api/onboarding/properties", {
        headers: { Authorization: `Bearer ${user.token}` }
      })

      const data = await response.json()

      // Verify specific critical fields
      expect(data.properties[0]).toHaveProperty("id")
      expect(data.properties[0]).toHaveProperty("slug")
      expect(data.properties[0]).toHaveProperty("wizard_step_completed")
      expect(data.properties[0]).toHaveProperty("wizard_progress")

      // Verify ALL database fields present
      const dbFields = [
        "id", "slug", "name", "company_id", "owner_id",
        "site_count", "onboarding_completed",
        "wizard_step_completed", "wizard_progress",
        "created_at", "updated_at"
      ]

      dbFields.forEach(field => {
        expect(data.properties[0]).toHaveProperty(field)
      })
    })

    it("should NOT omit fields when using .select()", async () => {
      // Regression test for Oct 30 incident
      const { user, company } = await setupUserWithCompany()
      const property = await createProperty(company.id)

      const response = await fetch("/api/onboarding/properties", {
        headers: { Authorization: `Bearer ${user.token}` }
      })

      const data = await response.json()

      // These fields were MISSING in the incident
      expect(data.properties[0].slug).toBeDefined()
      expect(data.properties[0].wizard_step_completed).toBeDefined()
      expect(data.properties[0].wizard_progress).toBeDefined()
    })
  })
})
```

### Backward Compatibility Tests

```typescript
describe("API Backward Compatibility", () => {
  it("should not remove fields in non-major version", async () => {
    // Load baseline schema from v1.0
    const baselineSchema = await loadSchemaVersion("1.0")
    const currentSchema = PropertyListResponseSchema

    // Verify current schema is superset of baseline
    const baselineFields = Object.keys(baselineSchema.shape)
    const currentFields = Object.keys(currentSchema.shape)

    baselineFields.forEach(field => {
      expect(currentFields).toContain(field)
    })
  })
})
```

---

## OpenAPI Specification

### Auto-Generated API Docs

```typescript
// lib/api/openapi.ts

import { z } from "zod"
import { generateOpenApi } from "@/lib/zod-to-openapi"

/**
 * Generate OpenAPI 3.0 specification from Zod schemas.
 *
 * This provides:
 * 1. API documentation
 * 2. Client SDK generation
 * 3. Contract validation
 * 4. API testing tools
 */
export function generateOpenApiSpec() {
  return {
    openapi: "3.0.0",
    info: {
      title: "CampgroundOps API",
      version: "1.0.0",
      description: "Multi-tenant campground management platform API"
    },
    servers: [
      { url: "https://campgroundops.com/api", description: "Production" },
      { url: "http://localhost:3000/api", description: "Development" }
    ],
    paths: {
      "/onboarding/properties": {
        get: {
          summary: "Get user's properties for onboarding",
          tags: ["Onboarding"],
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "List of properties",
              content: {
                "application/json": {
                  schema: zodToOpenApi(PropertyListResponseSchema)
                }
              }
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
      // ... other endpoints
    },
    components: {
      schemas: {
        Property: zodToOpenApi(PropertySchema),
        PropertyListResponse: zodToOpenApi(PropertyListResponseSchema)
      },
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  }
}

// Serve OpenAPI spec
// app/api/openapi.json/route.ts
export async function GET() {
  const spec = generateOpenApiSpec()
  return NextResponse.json(spec)
}
```

---

## Monitoring & Alerts

### API Contract Violation Alerts

```typescript
// monitoring/api-alerts.ts

export const API_CONTRACT_ALERTS = {
  VALIDATION_FAILURE: {
    condition: "api_validation_failures > 0",
    severity: "critical",
    notification: ["#engineering", "on-call"],
    action: "API contract violated - investigate immediately"
  },

  MISSING_REQUIRED_FIELD: {
    condition: "missing_field_errors > 0",
    severity: "critical",
    notification: ["#engineering"],
    action: "Backend returning incomplete data - check .select() calls"
  },

  TYPE_MISMATCH: {
    condition: "type_mismatch_errors > 0",
    severity: "warning",
    notification: ["#engineering"],
    action: "Database schema may have changed without type update"
  },

  DEPRECATED_API_USAGE: {
    condition: "deprecated_api_calls > 100/hour",
    severity: "info",
    notification: ["#engineering"],
    action: "Client still using deprecated API - consider sunset timeline"
  }
}
```

---

## Migration Strategy

### Phase 1: Add Runtime Validation (Low Risk)
1. Install Zod: `npm install zod`
2. Create Zod schemas for critical APIs
3. Add validation in API routes (server-side only)
4. Log validation failures, don't fail requests yet
5. Monitor for issues

### Phase 2: Generate Types from Database (Medium Risk)
1. Set up Supabase type generation
2. Replace manual types with generated types
3. Run validation, fix type mismatches
4. Update all imports

### Phase 3: Frontend Validation (Medium Risk)
1. Create validated API clients
2. Gradually migrate endpoints to use validation
3. Add error boundaries
4. Deploy and monitor

### Phase 4: Enforce Contracts (High Risk)
1. Enable strict validation (fail requests)
2. Add contract tests to CI/CD
3. Generate OpenAPI spec
4. Document API contracts

---

## Success Criteria

- [ ] Zero silent failures from missing API fields
- [ ] 100% of critical APIs have Zod schemas
- [ ] Contract tests in CI/CD pipeline
- [ ] API validation errors trigger alerts
- [ ] OpenAPI spec auto-generated from schemas
- [ ] Error boundaries catch API failures gracefully
- [ ] Type generation automated in build process
- [ ] Zero manual type definitions for API responses

---

**Next Steps**:
1. Create Zod schemas for all API endpoints
2. Set up automated type generation
3. Add contract tests to CI/CD
4. Implement error boundaries
5. Generate OpenAPI documentation
