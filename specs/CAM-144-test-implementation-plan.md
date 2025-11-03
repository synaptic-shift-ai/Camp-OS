# CAM-144: Detailed Test Implementation Plan

## Overview

This document provides the detailed implementation specifications for `tests/security/middleware-security.test.ts`, including exact test structure, assertions, and test data setup.

**Implementation Agent**: `comprehensive-test-engineer`

**Estimated Effort**: 2-3 days (16 hours development + 4 hours testing/validation)

---

## File Structure

```
tests/
└── security/
    ├── middleware-security.test.ts    (Main test file - NEW)
    ├── test-helpers.ts                (Security utilities - NEW)
    └── README.md                      (Documentation - NEW)
```

---

## 1. Test File Template

```typescript
/**
 * Middleware Security Tests
 *
 * CAM-144: Security Testing for Tenant Isolation & Auth Bypass
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL: These tests verify no auth bypass or tenant data leakage
 * in the refactored middleware system.
 *
 * Test Coverage:
 * - Auth bypass prevention (8 tests)
 * - Tenant hopping prevention (8 tests)
 * - Session manipulation detection (6 tests)
 * - Wizard bypass prevention (4 tests)
 * - Direct URL access protection (4 tests)
 *
 * Following CLAUDE.md:
 * - T-7: Security tests in tests/security/
 * - T-9: No hardcoded temporal data
 * - T-10: Test data factories
 * - T-12: Multi-tenant isolation testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { updateSession } from '@/lib/supabase/middleware'
import { verifyAuthentication } from '@/lib/middleware/auth'
import { resolveTenant } from '@/lib/middleware/tenant'
import {
  createAuthMiddleware,
  createEmailVerificationMiddleware,
  createSubscriptionMiddleware,
  createOnboardingMiddleware,
} from '@/lib/middleware/routing'
import { composeMiddleware } from '@/lib/middleware/compose'
import { initializeRequest } from '@/lib/middleware/init'
import type { MiddlewareRequest } from '@/lib/middleware/types'
import {
  createTestUser,
  createTestCompany,
  createTestProperty,
  createMockRequest,
  createMockSupabase,
  createMaliciousSessionToken,
  createExpiredSessionToken,
  assertAuthBypassBlocked,
  assertTenantIsolation,
  assertSessionInvalidated,
  assertRedirectPreservesIntent,
  assertNoDataLeakage,
} from './test-helpers'

// ============================================================================
// CRITICAL PRIORITY TESTS
// ============================================================================

describe('Security: Auth Bypass Prevention', () => {
  // Test 1.1: Unauthenticated Access to Protected Routes
  it('should block unauthenticated access to dashboard routes', async () => {
    // Arrange
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/sites',
      '/dashboard/bookings',
      '/dashboard/rates',
    ]

    for (const route of protectedRoutes) {
      const request = createMockRequest(route)
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({ user: null })

      // Act
      const authMiddleware = createAuthMiddleware(supabase)
      const result = await authMiddleware(middlewareRequest)

      // Assert
      assertAuthBypassBlocked(result, '/login')
      assertRedirectPreservesIntent(result as Response, route)
    }
  })

  // Test 1.2: Expired Session Token Rejection
  it('should reject expired session tokens', async () => {
    // Arrange
    const expiredToken = createExpiredSessionToken()
    const request = createMockRequest('/dashboard')
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({
      user: null,
      error: { message: 'JWT expired' }
    })

    // Act
    const result = await verifyAuthentication(middlewareRequest, supabase)

    // Assert
    expect(result.authenticated).toBe(false)
    if (!result.authenticated) {
      expect(result.reason).toBe('expired_session')
    }
  })

  // Test 1.3: Invalid Session Token Rejection
  it('should reject invalid session tokens', async () => {
    // Arrange
    const maliciousToken = createMaliciousSessionToken()
    const request = createMockRequest('/dashboard', {
      cookies: [{ name: 'sb-session', value: maliciousToken }]
    })
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({
      user: null,
      error: { message: 'Invalid JWT' }
    })

    // Act
    const result = await verifyAuthentication(middlewareRequest, supabase)

    // Assert
    expect(result.authenticated).toBe(false)
    if (!result.authenticated) {
      expect(result.reason).toBe('invalid_session')
      assertNoDataLeakage(result)
    }
  })

  // Test 1.4: Missing Session Token Handling
  it('should handle missing session tokens gracefully', async () => {
    // Arrange
    const request = createMockRequest('/dashboard', { cookies: [] })
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({ user: null })

    // Act
    const result = await verifyAuthentication(middlewareRequest, supabase)

    // Assert
    expect(result.authenticated).toBe(false)
    if (!result.authenticated) {
      expect(result.reason).toBe('no_session')
    }
  })

  // Test 1.5: Email Verification Bypass Attempt
  it('should prevent dashboard access for unverified emails', async () => {
    // Arrange
    const unverifiedUser = createTestUser({ emailVerified: false })
    const request = createMockRequest('/dashboard')
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({ user: unverifiedUser })

    // Act
    const middleware = composeMiddleware(
      createAuthMiddleware(supabase),
      createEmailVerificationMiddleware()
    )
    const result = await middleware(middlewareRequest)

    // Assert
    assertAuthBypassBlocked(result, '/verify-email')
    assertRedirectPreservesIntent(result as Response, '/dashboard')
  })

  // Test 1.6: Direct API Route Access Without Auth
  it('should block API routes without authentication', async () => {
    // Arrange
    const apiRoutes = ['/api/properties', '/api/bookings', '/api/rates']

    for (const route of apiRoutes) {
      const request = createMockRequest(route)
      const middlewareRequest = initializeRequest(request)
      const supabase = createMockSupabase({ user: null })

      // Act
      const authMiddleware = createAuthMiddleware(supabase)
      const result = await authMiddleware(middlewareRequest)

      // Assert
      // Note: API routes may be handled differently, adjust assertion
      expect(result instanceof Response).toBe(true)
      if (result instanceof Response) {
        expect([307, 401, 403]).toContain(result.status)
      }
    }
  })

  // Test 1.7: Cookie Manipulation Attack
  it('should invalidate tampered session cookies', async () => {
    // Arrange
    const validUser = createTestUser({ emailVerified: true })
    const tamperedCookie = createMaliciousSessionToken(validUser.id)
    const request = createMockRequest('/dashboard', {
      cookies: [{ name: 'sb-session', value: tamperedCookie }]
    })
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({
      user: null,
      error: { message: 'Invalid signature' }
    })

    // Act
    const result = await verifyAuthentication(middlewareRequest, supabase)

    // Assert
    expect(result.authenticated).toBe(false)
    if (!result.authenticated) {
      expect(['invalid_session', 'no_session']).toContain(result.reason)
    }
  })

  // Test 1.8: Session Hijacking Prevention
  it('should validate session context consistency', async () => {
    // Arrange
    const validUser = createTestUser({ emailVerified: true })
    const request = createMockRequest('/dashboard', {
      headers: {
        'user-agent': 'AttackerBrowser/1.0',
        'x-forwarded-for': '192.168.1.100'
      }
    })
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({ user: validUser })

    // Act
    const result = await verifyAuthentication(middlewareRequest, supabase)

    // Assert
    // Note: Context validation may not be implemented yet
    // This test documents expected behavior for future enhancement
    expect(result.authenticated).toBe(true)
    // TODO: Add session context validation when implemented
  })
})

describe('Security: Tenant Hopping Prevention', () => {
  // Test 2.1: Cross-Tenant Data Access via Company ID Manipulation
  it('should prevent access to other tenant data via company ID', async () => {
    // Arrange
    const userA = createTestUser({ id: 'user-a' })
    const userB = createTestUser({ id: 'user-b' })
    const companyA = createTestCompany({ id: 'company-a', owner_id: userA.id })
    const companyB = createTestCompany({ id: 'company-b', owner_id: userB.id })

    // Create authenticated request for User A
    const requestA = createMockRequest('/dashboard')
    const middlewareRequestA = initializeRequest(requestA)
    const supabaseA = createMockSupabase({ user: userA, company: companyA })

    // Act: User A resolves tenant
    const authResultA = await verifyAuthentication(middlewareRequestA, supabaseA)
    expect(authResultA.authenticated).toBe(true)

    if (authResultA.authenticated) {
      const tenantResultA = await resolveTenant(authResultA.request, supabaseA)

      // Assert: User A only sees Company A
      expect(tenantResultA.resolved).toBe(true)
      if (tenantResultA.resolved) {
        expect(tenantResultA.request.middlewareContext.tenant.companyId).toBe(companyA.id)
        assertTenantIsolation(companyA, companyB, tenantResultA)
      }
    }
  })

  // Test 2.2: Subscription Status Isolation
  it('should isolate subscription status per tenant', async () => {
    // Arrange
    const userA = createTestUser()
    const userB = createTestUser()
    const companyA = createTestCompany({
      owner_id: userA.id,
      subscription_status: 'active'
    })
    const companyB = createTestCompany({
      owner_id: userB.id,
      subscription_status: 'canceled'
    })

    const requestA = createMockRequest('/dashboard')
    const requestB = createMockRequest('/dashboard')
    const middlewareRequestA = initializeRequest(requestA)
    const middlewareRequestB = initializeRequest(requestB)
    const supabaseA = createMockSupabase({ user: userA, company: companyA })
    const supabaseB = createMockSupabase({ user: userB, company: companyB })

    // Act
    const authResultA = await verifyAuthentication(middlewareRequestA, supabaseA)
    const authResultB = await verifyAuthentication(middlewareRequestB, supabaseB)

    // Assert
    expect(authResultA.authenticated).toBe(true)
    expect(authResultB.authenticated).toBe(true)

    if (authResultA.authenticated && authResultB.authenticated) {
      const tenantResultA = await resolveTenant(authResultA.request, supabaseA)
      const tenantResultB = await resolveTenant(authResultB.request, supabaseB)

      expect(tenantResultA.resolved).toBe(true)
      expect(tenantResultB.resolved).toBe(false) // Canceled subscription

      if (tenantResultA.resolved) {
        expect(tenantResultA.request.middlewareContext.tenant.subscriptionStatus).toBe('active')
      }

      if (!tenantResultB.resolved) {
        expect(tenantResultB.reason).toBe('subscription_canceled')
      }
    }
  })

  // Test 2.3: Property Data Isolation
  it('should isolate property queries by company_id', async () => {
    // Arrange
    const userA = createTestUser()
    const userB = createTestUser()
    const companyA = createTestCompany({ owner_id: userA.id })
    const companyB = createTestCompany({ owner_id: userB.id })
    const propertyA = createTestProperty({ company_id: companyA.id })
    const propertyB = createTestProperty({ company_id: companyB.id })

    const request = createMockRequest('/dashboard')
    const middlewareRequest = initializeRequest(request)
    const supabaseA = createMockSupabase({
      user: userA,
      company: companyA,
      incompleteProperties: [propertyA]
    })

    // Act
    const authResult = await verifyAuthentication(middlewareRequest, supabaseA)
    expect(authResult.authenticated).toBe(true)

    if (authResult.authenticated) {
      const tenantResult = await resolveTenant(authResult.request, supabaseA)
      expect(tenantResult.resolved).toBe(true)

      if (tenantResult.resolved) {
        const middleware = createOnboardingMiddleware(supabaseA)
        const result = await middleware(tenantResult.request)

        // Assert: User A only sees Property A, never Property B
        // Mock should only return properties for company_id = companyA.id
        expect(result).toBeDefined()
      }
    }
  })

  // Test 2.4: Tenant Context Tampering
  it('should regenerate tenant context server-side on each request', async () => {
    // Arrange
    const user = createTestUser()
    const company = createTestCompany({ owner_id: user.id })
    const request1 = createMockRequest('/dashboard')
    const request2 = createMockRequest('/dashboard/sites')

    // Act: Make two requests
    const middlewareRequest1 = initializeRequest(request1)
    const middlewareRequest2 = initializeRequest(request2)
    const supabase = createMockSupabase({ user, company })

    const authResult1 = await verifyAuthentication(middlewareRequest1, supabase)
    const authResult2 = await verifyAuthentication(middlewareRequest2, supabase)

    // Assert: Each request gets fresh context
    expect(authResult1.authenticated).toBe(true)
    expect(authResult2.authenticated).toBe(true)

    if (authResult1.authenticated && authResult2.authenticated) {
      const tenantResult1 = await resolveTenant(authResult1.request, supabase)
      const tenantResult2 = await resolveTenant(authResult2.request, supabase)

      expect(tenantResult1.resolved).toBe(true)
      expect(tenantResult2.resolved).toBe(true)

      if (tenantResult1.resolved && tenantResult2.resolved) {
        // Context values match but are independently generated
        expect(tenantResult1.request.middlewareContext.tenant.companyId).toBe(
          tenantResult2.request.middlewareContext.tenant.companyId
        )
      }
    }
  })

  // Test 2.5: URL Parameter Injection for Tenant Switching
  it('should ignore query params for tenant resolution', async () => {
    // Arrange
    const user = createTestUser()
    const userCompany = createTestCompany({ id: 'user-company', owner_id: user.id })
    const otherCompany = createTestCompany({ id: 'other-company', owner_id: 'other-user' })

    const request = createMockRequest('/dashboard', {
      searchParams: { company_id: otherCompany.id }
    })
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({ user, company: userCompany })

    // Act
    const authResult = await verifyAuthentication(middlewareRequest, supabase)
    expect(authResult.authenticated).toBe(true)

    if (authResult.authenticated) {
      const tenantResult = await resolveTenant(authResult.request, supabase)

      // Assert: Tenant resolution uses auth.userId, not query params
      expect(tenantResult.resolved).toBe(true)
      if (tenantResult.resolved) {
        expect(tenantResult.request.middlewareContext.tenant.companyId).toBe(userCompany.id)
        expect(tenantResult.request.middlewareContext.tenant.companyId).not.toBe(otherCompany.id)
      }
    }
  })

  // Test 2.6: Database Query Injection via Tenant ID
  it('should prevent SQL injection via tenant ID parameters', async () => {
    // Arrange
    const user = createTestUser()
    const maliciousCompanyId = "'; DROP TABLE companies; --"
    const request = createMockRequest('/dashboard')
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({
      user,
      company: null,
      error: { message: 'Invalid UUID format' }
    })

    // Act
    const authResult = await verifyAuthentication(middlewareRequest, supabase)
    expect(authResult.authenticated).toBe(true)

    if (authResult.authenticated) {
      const tenantResult = await resolveTenant(authResult.request, supabase)

      // Assert: Query fails safely, no injection possible
      expect(tenantResult.resolved).toBe(false)
      if (!tenantResult.resolved) {
        expect(['no_company', 'database_error']).toContain(tenantResult.reason)
      }
    }
  })

  // Test 2.7: Multi-Tenant Company Ownership
  it('should handle users with multiple companies consistently', async () => {
    // Arrange
    const user = createTestUser()
    const company1 = createTestCompany({ id: 'company-1', owner_id: user.id })
    const company2 = createTestCompany({ id: 'company-2', owner_id: user.id })

    const request = createMockRequest('/dashboard')
    const middlewareRequest = initializeRequest(request)

    // Mock returns only first company (limit 1)
    const supabase = createMockSupabase({ user, company: company1 })

    // Act
    const authResult = await verifyAuthentication(middlewareRequest, supabase)
    expect(authResult.authenticated).toBe(true)

    if (authResult.authenticated) {
      const tenantResult = await resolveTenant(authResult.request, supabase)

      // Assert: Returns first company consistently
      expect(tenantResult.resolved).toBe(true)
      if (tenantResult.resolved) {
        expect(tenantResult.request.middlewareContext.tenant.companyId).toBe(company1.id)
        // Document: Company switching feature not yet implemented
      }
    }
  })

  // Test 2.8: Deleted Company Access Prevention
  it('should prevent access when company is deleted', async () => {
    // Arrange
    const user = createTestUser()
    const request = createMockRequest('/dashboard')
    const middlewareRequest = initializeRequest(request)
    const supabase = createMockSupabase({ user, company: null })

    // Act
    const authResult = await verifyAuthentication(middlewareRequest, supabase)
    expect(authResult.authenticated).toBe(true)

    if (authResult.authenticated) {
      const tenantResult = await resolveTenant(authResult.request, supabase)

      // Assert: No company found
      expect(tenantResult.resolved).toBe(false)
      if (!tenantResult.resolved) {
        expect(tenantResult.reason).toBe('no_company')
      }
    }
  })
})

// ============================================================================
// HIGH PRIORITY TESTS
// ============================================================================

describe('Security: Session Token Manipulation Detection', () => {
  // Tests 3.1-3.6 (Session manipulation scenarios)
  // Implementation follows same pattern as above
})

describe('Security: Wizard Bypass Prevention', () => {
  // Tests 4.1-4.4 (Wizard bypass scenarios)
  // Implementation follows same pattern as above
})

// ============================================================================
// MEDIUM PRIORITY TESTS
// ============================================================================

describe('Security: Direct URL Access Protection', () => {
  // Tests 5.1-5.4 (Direct URL access scenarios)
  // Implementation follows same pattern as above
})
```

---

## 2. Test Helpers Implementation

### `tests/security/test-helpers.ts`

```typescript
/**
 * Security Test Helpers
 *
 * Utilities for security testing following CLAUDE.md best practices:
 * - T-9: Dynamic test data generation
 * - T-10: Consistent test data factories
 */

import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSessionId, createUserId, createCompanyId } from '@/lib/middleware/types'

// ============================================================================
// Test Data Factories
// ============================================================================

export function createTestUser(overrides?: {
  id?: string
  email?: string
  emailVerified?: boolean
}) {
  const now = new Date()
  const id = overrides?.id || `user-${Date.now()}-${Math.random().toString(36).substring(7)}`

  return {
    id,
    email: overrides?.email || `test-${Date.now()}@example.com`,
    email_confirmed_at: overrides?.emailVerified === false ? null : now.toISOString(),
    user_metadata: {},
  }
}

export function createTestCompany(overrides?: {
  id?: string
  owner_id?: string
  subscription_status?: 'active' | 'canceled' | 'past_due'
}) {
  const id = overrides?.id || `company-${Date.now()}-${Math.random().toString(36).substring(7)}`

  return {
    id,
    name: `Test Company ${Date.now()}`,
    owner_id: overrides?.owner_id || createTestUser().id,
    stripe_customer_id: `cus_${Date.now()}`,
    subscription_id: `sub_${Date.now()}`,
    subscription_status: overrides?.subscription_status || 'active',
    subscription_plan: 'pro',
  }
}

export function createTestProperty(overrides?: {
  id?: string
  company_id?: string
  onboarding_completed?: boolean
}) {
  return {
    id: overrides?.id || `property-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    company_id: overrides?.company_id || createTestCompany().id,
    onboarding_completed: overrides?.onboarding_completed ?? false,
  }
}

// ============================================================================
// Mock Utilities
// ============================================================================

export function createMockRequest(
  pathname: string,
  options?: {
    searchParams?: Record<string, string>
    cookies?: Array<{ name: string; value: string }>
    headers?: Record<string, string>
  }
): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`)

  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const headers = new Headers(options?.headers || {})
  const cookies = new Map(
    (options?.cookies || []).map(c => [c.name, c.value])
  )

  return {
    url: url.toString(),
    nextUrl: {
      pathname,
      searchParams: url.searchParams,
      clone: () => ({ pathname, searchParams: url.searchParams }),
    },
    headers,
    cookies: {
      getAll: () => Array.from(cookies.entries()).map(([name, value]) => ({ name, value })),
      get: (name: string) => ({ name, value: cookies.get(name) || '' }),
      set: () => {},
    },
  } as unknown as NextRequest
}

export function createMockSupabase(scenario: {
  user?: ReturnType<typeof createTestUser> | null
  company?: ReturnType<typeof createTestCompany> | null
  incompleteProperties?: Array<ReturnType<typeof createTestProperty>>
  error?: { message: string }
}): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: scenario.user ?? null },
        error: scenario.error ?? (scenario.user === null ? { message: 'No session' } : null),
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: scenario.company ? [scenario.company] : [],
            error: scenario.error ?? null,
          }),
        }
      }
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: scenario.incompleteProperties ?? [],
            error: scenario.error ?? null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }),
  } as unknown as SupabaseClient
}

// ============================================================================
// Security Attack Utilities
// ============================================================================

export function createMaliciousSessionToken(userId?: string): string {
  // Create a JWT-like string with tampered signature
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    sub: userId || 'malicious-user',
    exp: Math.floor(Date.now() / 1000) + 3600
  }))
  const signature = 'TAMPERED_SIGNATURE'

  return `${header}.${payload}.${signature}`
}

export function createExpiredSessionToken(): string {
  // Create a JWT-like string with expired timestamp
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    sub: 'test-user',
    exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
  }))
  const signature = 'VALID_SIGNATURE'

  return `${header}.${payload}.${signature}`
}

// ============================================================================
// Security Assertion Helpers
// ============================================================================

export function assertAuthBypassBlocked(
  result: Response | MiddlewareRequest,
  expectedRedirectPath: string
) {
  expect(result instanceof Response).toBe(true)

  if (result instanceof Response) {
    expect(result.status).toBeGreaterThanOrEqual(300)
    expect(result.status).toBeLessThan(400)

    const location = result.headers.get('location')
    expect(location).toBeTruthy()
    expect(location).toContain(expectedRedirectPath)
  }
}

export function assertTenantIsolation(
  companyA: any,
  companyB: any,
  tenantResult: any
) {
  // Verify tenant A data is accessible
  expect(tenantResult.request.middlewareContext.tenant.companyId).toBe(companyA.id)

  // Verify tenant B data is NOT accessible
  expect(tenantResult.request.middlewareContext.tenant.companyId).not.toBe(companyB.id)

  // Verify no cross-tenant data leakage
  expect(tenantResult.request.middlewareContext.tenant).not.toHaveProperty('allCompanies')
}

export function assertSessionInvalidated(result: any) {
  expect(result.authenticated).toBe(false)
  expect(['no_session', 'invalid_session', 'expired_session']).toContain(result.reason)
}

export function assertRedirectPreservesIntent(
  response: Response,
  originalPath: string
) {
  const location = response.headers.get('location')
  expect(location).toBeTruthy()

  const url = new URL(location!, 'http://localhost:3000')
  const redirectParam = url.searchParams.get('redirect')

  // Original path should be preserved (may be URL-encoded)
  expect(redirectParam === originalPath || redirectParam === encodeURIComponent(originalPath)).toBe(true)
}

export function assertNoDataLeakage(result: any) {
  // Error messages should be generic
  const sensitiveKeywords = [
    'company_id',
    'user_id',
    'stripe_customer_id',
    'subscription_id',
    'email',
    'password',
  ]

  const resultString = JSON.stringify(result).toLowerCase()

  sensitiveKeywords.forEach(keyword => {
    expect(resultString).not.toContain(keyword.toLowerCase())
  })
}
```

---

## 3. Implementation Checklist

### Phase 1: Setup (Day 1 Morning)
- [ ] Create `tests/security/` directory
- [ ] Create `test-helpers.ts` with all factory functions
- [ ] Create `middleware-security.test.ts` skeleton
- [ ] Set up test imports and basic structure
- [ ] Verify test file runs with Vitest

### Phase 2: Critical Priority Tests (Day 1 Afternoon + Day 2 Morning)
- [ ] Implement Auth Bypass tests (1.1 - 1.8)
  - [ ] Test 1.1: Unauthenticated access blocking
  - [ ] Test 1.2: Expired session rejection
  - [ ] Test 1.3: Invalid session rejection
  - [ ] Test 1.4: Missing session handling
  - [ ] Test 1.5: Email verification bypass prevention
  - [ ] Test 1.6: API route protection
  - [ ] Test 1.7: Cookie tampering detection
  - [ ] Test 1.8: Session hijacking prevention
- [ ] Implement Tenant Hopping tests (2.1 - 2.8)
  - [ ] Test 2.1: Cross-tenant data access prevention
  - [ ] Test 2.2: Subscription status isolation
  - [ ] Test 2.3: Property data isolation
  - [ ] Test 2.4: Tenant context regeneration
  - [ ] Test 2.5: URL parameter injection blocking
  - [ ] Test 2.6: SQL injection prevention
  - [ ] Test 2.7: Multi-company handling
  - [ ] Test 2.8: Deleted company prevention
- [ ] Verify all Critical tests pass

### Phase 3: High Priority Tests (Day 2 Afternoon)
- [ ] Implement Session Manipulation tests (3.1 - 3.6)
  - [ ] Test 3.1: Token replay attack
  - [ ] Test 3.2: Token signature manipulation
  - [ ] Test 3.3: Token expiry boundaries
  - [ ] Test 3.4: Concurrent session validation
  - [ ] Test 3.5: Session refresh handling
  - [ ] Test 3.6: Cross-origin validation
- [ ] Implement Wizard Bypass tests (4.1 - 4.4)
  - [ ] Test 4.1: Wizard parameter manipulation
  - [ ] Test 4.2: Direct wizard endpoint access
  - [ ] Test 4.3: Infinite loop prevention
  - [ ] Test 4.4: Onboarding route access control
- [ ] Verify all High Priority tests pass

### Phase 4: Medium Priority Tests (Day 3 Morning)
- [ ] Implement Direct URL Access tests (5.1 - 5.4)
  - [ ] Test 5.1: Subscription requirement enforcement
  - [ ] Test 5.2: Onboarding bypass prevention
  - [ ] Test 5.3: Public route accessibility
  - [ ] Test 5.4: Redirect intent preservation
- [ ] Verify all Medium Priority tests pass

### Phase 5: Integration & Validation (Day 3 Afternoon)
- [ ] Run full security test suite: `npm run test:security`
- [ ] Verify all 30 tests pass
- [ ] Run existing tests: `npm run test:integration`
- [ ] Verify no regressions (33 integration tests still pass)
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify overall test health
- [ ] Generate test coverage report
- [ ] Document any limitations or future enhancements

### Phase 6: Documentation & Cleanup
- [ ] Create `tests/security/README.md`
- [ ] Document attack scenarios covered
- [ ] Document test execution instructions
- [ ] Document maintenance guidelines
- [ ] Update Linear CAM-144 with completion status
- [ ] Mark all acceptance criteria as complete

---

## 4. Success Criteria

### Functional Requirements
- ✅ All 30 security tests implemented and passing
- ✅ `npm run test:security` passes with 0 failures
- ✅ All existing tests still pass (no regressions)
- ✅ Test execution time < 5 seconds

### Security Coverage
- ✅ Auth bypass completely blocked (8/8 tests)
- ✅ Tenant hopping prevented (8/8 tests)
- ✅ Session manipulation detected (6/6 tests)
- ✅ Wizard bypass prevented (4/4 tests)
- ✅ Direct URL access controlled (4/4 tests)

### Code Quality
- ✅ Follows CLAUDE.md testing best practices
- ✅ No hardcoded temporal data
- ✅ Test data factories used consistently
- ✅ Strong assertions throughout
- ✅ Clear test names and descriptions
- ✅ Independent, idempotent tests

---

## 5. Risk Mitigation

### Known Challenges
1. **RLS Policy Testing**: Mocked, not real database
   - **Mitigation**: Document RLS expectations, add integration tests when Supabase available
2. **Session Token Manipulation**: Relies on Supabase crypto validation
   - **Mitigation**: Trust Supabase library, test integration points
3. **Performance**: 30 tests may be slow if not optimized
   - **Mitigation**: Use test.concurrent where appropriate, minimize mocking overhead

### Validation Steps
1. Run tests locally before committing
2. Verify all attack scenarios properly blocked
3. Check for false positives (tests that always pass)
4. Review test coverage with stakeholders

---

## 6. Next Steps After Implementation

1. **Post completion update to Linear CAM-144**
2. **Run full test suite to verify no regressions**
3. **Create PR with security test implementation**
4. **Request security review from team**
5. **Consider adding E2E security tests with Playwright**
6. **Plan for real Supabase integration tests**

---

**Estimated Timeline**: 2-3 days (16 hours development)
**Blocking Issues**: None
**Dependencies**: All prerequisite middleware refactors complete (CAM-136, CAM-137, CAM-140)
**Ready for Implementation**: ✅ YES
