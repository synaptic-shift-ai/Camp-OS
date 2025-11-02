# Implementation Guide: CAM-141 Unit Tests for Middleware

**Issue**: CAM-141 - Implement Unit Tests for Middleware Functions
**Parent**: CAM-129 - CRITICAL BUG - Middleware hardening
**Created**: 2025-11-01
**Priority**: URGENT
**Implementation Time**: 24 points (estimated for full completion)

---

## Quick Start

### Current Status ✅
- **types.ts**: 100% tested ✅
- **auth.ts**: 95% tested ✅
- **tenant.ts**: Blocked by CAM-137 ⏸️
- **wizard.ts**: Blocked by CAM-138 ⏸️
- **compose.ts**: Blocked by CAM-140 ⏸️

### Immediate Actions
1. Validate existing tests pass: `npm test lib/middleware`
2. Verify coverage meets target: `npm run test:coverage -- lib/middleware`
3. Update CAM-141 to reflect partial completion
4. Wait for CAM-137, CAM-138, CAM-140 before implementing remaining tests

---

## Implementation Checklist

### Phase 1: Validate Existing Work ✅

- [x] **Run existing tests**
  ```bash
  npm test lib/middleware/types.test.ts
  npm test lib/middleware/auth.test.ts
  ```
  **Expected**: All tests pass (16 in types.test.ts, 26 in auth.test.ts)

- [x] **Check coverage**
  ```bash
  npm run test:coverage -- lib/middleware
  ```
  **Expected**: types.ts 100%, auth.ts ≥90%

- [x] **Review test quality**
  - [x] All tests have descriptive names matching what they verify
  - [x] Strong assertions (toEqual, toBe) used throughout
  - [x] No hardcoded dates/times/IDs
  - [x] Parameterized tests for edge cases
  - [x] Tests grouped by function name
  - [x] Independent test factories (createMockUser, createMockRequest)

- [x] **Verify CLAUDE.md compliance**
  - [x] T-1: Colocated tests (*.test.ts next to source)
  - [x] T-3: Pure logic tests (no database)
  - [x] T-6: Comprehensive assertions
  - [x] T-9: Dynamic temporal data
  - [x] T-10: Test data factories
  - [x] T-11: Parameterized tests

### Phase 2: Update CAM-141 Issue (REQUIRED)

- [ ] **Update Linear issue status**
  - Mark types.ts tests as COMPLETE
  - Mark auth.ts tests as COMPLETE
  - Mark tenant.ts tests as BLOCKED (CAM-137)
  - Mark wizard.ts tests as BLOCKED (CAM-138)
  - Mark compose.ts tests as BLOCKED (CAM-140)

- [ ] **Update acceptance criteria**
  ```markdown
  Current Status:
  - [x] Unit tests for types.ts: 100% coverage ✅
  - [x] Unit tests for auth.ts: 95% coverage ✅
  - [ ] Unit tests for tenant.ts: BLOCKED by CAM-137 ⏸️
  - [ ] Unit tests for wizard.ts: BLOCKED by CAM-138 ⏸️
  - [ ] Unit tests for compose.ts: BLOCKED by CAM-140 ⏸️
  - [x] All tests use dynamic data generation ✅
  - [x] `npm test lib/middleware` passes ✅
  ```

- [x] **Post Linear comment**
  - Summary of completed work
  - Blocking dependencies
  - Coverage metrics
  - Next steps

### Phase 3: Wait for Dependencies ⏸️

**DO NOT PROCEED** with remaining unit tests until these issues complete:
- CAM-137: Refactor Tenant Middleware with Proper Separation
- CAM-138: Extract Wizard Access Logic with Separate Middleware
- CAM-140: Implement Middleware Composition Utility

**Why Wait**:
- Cannot write unit tests for code that doesn't exist
- Tests would need to be rewritten after refactors
- Following TDD: implementation first, then tests

---

## Implementation Patterns (For Future Unit Tests)

### Pattern 1: Test File Structure

Follow the structure from `auth.test.ts`:

```typescript
/**
 * [Middleware Name] Unit Tests
 *
 * CAM-XXX: [Issue Title]
 *
 * Following CLAUDE.md Testing Best Practices:
 * - T-1: Colocate unit tests with source file
 * - T-3: Pure logic unit tests (no database)
 * - T-6: Test entire structure in one assertion
 * - T-9: No hardcoded temporal data
 */

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { MiddlewareRequest, AuthenticatedRequest } from './types'
import { createUserId } from './types'
import { functionUnderTest, helperFunction } from './source-file'

// Test data factories
function createMockRequest(pathname = '/dashboard'): MiddlewareRequest {
  return {
    middlewareContext: {
      sessionId: createSessionId('test-session-' + Math.random()),
      pathname,
      searchParams: new URLSearchParams(),
    },
  } as MiddlewareRequest
}

function createMockUser(overrides?: Partial<User>): User {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),  // ✅ Dynamic!
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User
}

// Tests grouped by function
describe('functionUnderTest', () => {
  describe('success cases', () => {
    it('should handle valid input and return expected result', async () => {
      // Arrange
      const mockData = createMockUser()

      // Act
      const result = await functionUnderTest(mockData)

      // Assert
      expect(result).toEqual({
        field1: expectedValue1,
        field2: expectedValue2,
      })
    })
  })

  describe('failure cases', () => {
    it('should handle invalid input gracefully', async () => {
      // Arrange
      const invalidInput = null

      // Act
      const result = await functionUnderTest(invalidInput)

      // Assert
      expect(result).toEqual({ success: false, error: 'Expected error' })
    })
  })

  describe('edge cases', () => {
    it('should handle boundary condition correctly', () => {
      // Test edge cases
    })
  })
})

describe('helperFunction', () => {
  // Parameterized tests for multiple scenarios
  it.each([
    { input: '/dashboard', expected: true },
    { input: '/login', expected: false },
  ])('should return $expected for input $input', ({ input, expected }) => {
    expect(helperFunction(input)).toBe(expected)
  })
})
```

### Pattern 2: Test Data Factories

**DO**:
```typescript
// ✅ GOOD: Factory with defaults and overrides
function createMockCompany(overrides?: Partial<Company>): Company {
  return {
    id: createCompanyId('test-company-' + Math.random()),
    owner_id: createUserId('test-owner-' + Math.random()),
    subscription_status: 'active',
    created_at: new Date().toISOString(),  // Dynamic!
    ...overrides,
  } as Company
}

// Usage: Customize what you need
const company = createMockCompany({ subscription_status: 'canceled' })
```

**DON'T**:
```typescript
// ❌ BAD: Hardcoded data
const company = {
  id: 'fixed-id-123',
  created_at: '2025-06-01T00:00:00Z',  // Will break next year!
}
```

### Pattern 3: Dynamic Temporal Data

**DO**:
```typescript
// ✅ GOOD: Dynamic dates
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString()

// For user factories
email_confirmed_at: new Date().toISOString()  // Just now
```

**DON'T**:
```typescript
// ❌ BAD: Hardcoded dates
const sessionDate = '2025-06-01T00:00:00Z'
const expiry = '2025-12-31T23:59:59Z'
```

### Pattern 4: Comprehensive Assertions

**DO**:
```typescript
// ✅ GOOD: Test entire structure
expect(result).toEqual({
  authenticated: true,
  request: expect.objectContaining({
    middlewareContext: expect.objectContaining({
      sessionId: expect.any(String),
      pathname: '/dashboard',
      auth: {
        userId: mockUser.id,
        email: mockUser.email,
        emailVerified: true,
        emailConfirmedAt: mockUser.email_confirmed_at,
        userMetadata: mockUser.user_metadata,
      },
    }),
  }),
})
```

**DON'T**:
```typescript
// ❌ BAD: Separate assertions
expect(result.authenticated).toBe(true)
expect(result.request.middlewareContext.auth.userId).toBe(mockUser.id)
expect(result.request.middlewareContext.auth.email).toBe(mockUser.email)
// ... many separate assertions (harder to maintain)
```

### Pattern 5: Parameterized Tests

**DO**:
```typescript
// ✅ GOOD: Parameterized for multiple cases
it.each([
  { pathname: '/dashboard', expected: true },
  { pathname: '/dashboard/sites', expected: true },
  { pathname: '/login', expected: false },
  { pathname: '/onboarding', expected: false },
])('should return $expected for pathname $pathname', ({ pathname, expected }) => {
  expect(requiresEmailVerification(pathname)).toBe(expected)
})
```

**DON'T**:
```typescript
// ❌ BAD: Duplicate tests
it('should return true for /dashboard', () => {
  expect(requiresEmailVerification('/dashboard')).toBe(true)
})

it('should return true for /dashboard/sites', () => {
  expect(requiresEmailVerification('/dashboard/sites')).toBe(true)
})

it('should return false for /login', () => {
  expect(requiresEmailVerification('/login')).toBe(false)
})
// ... many duplicate tests
```

### Pattern 6: Mocking Supabase

**DO**:
```typescript
// ✅ GOOD: Typed mock with flexible responses
function createMockSupabase(
  user: User | null,
  error: Error | null = null
): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
    },
    from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockDataForTable(table),
        error: null,
      }),
    })),
  } as unknown as SupabaseClient
}
```

**DON'T**:
```typescript
// ❌ BAD: Untyped mock
const supabase = {
  auth: {
    getUser: () => ({ data: { user: {} } })  // Untyped, no error handling
  }
}
```

---

## Future Implementation: tenant.test.ts (After CAM-137)

### What to Test

Based on expected tenant middleware implementation:

```typescript
/**
 * Tenant Middleware Unit Tests
 *
 * CAM-137: Refactor Tenant Middleware with Proper Separation
 *
 * Following CLAUDE.md Testing Best Practices
 */

import { describe, it, expect, vi } from 'vitest'
import type { AuthenticatedRequest, TenantResolvedRequest } from './types'
import { createUserId, createCompanyId } from './types'
import { verifyTenant, requiresSubscription } from './tenant'

// Test data factories
function createMockCompany(overrides?: Partial<Company>): Company {
  return {
    id: createCompanyId('test-company-' + Math.random()),
    owner_id: createUserId('test-owner-' + Math.random()),
    subscription_status: 'active',
    subscription_plan: 'professional',
    stripe_customer_id: 'cus_test_' + Math.random(),
    created_at: new Date().toISOString(),
    ...overrides,
  } as Company
}

describe('verifyTenant', () => {
  describe('successful tenant verification', () => {
    it('should create tenant context for user with active subscription', async () => {
      const mockUser = createMockUser()
      const mockCompany = createMockCompany({ owner_id: mockUser.id })
      const mockSupabase = createMockSupabase(mockUser, null, mockCompany)
      const request = createMockAuthenticatedRequest(mockUser)

      const result = await verifyTenant(request, mockSupabase)

      expect(result).toEqual({
        tenantResolved: true,
        request: expect.objectContaining({
          middlewareContext: expect.objectContaining({
            tenant: {
              companyId: mockCompany.id,
              subscriptionStatus: 'active',
              subscriptionPlan: 'professional',
              stripeCustomerId: mockCompany.stripe_customer_id,
            },
          }),
        }),
      })
    })

    it('should handle company with canceled subscription', async () => {
      const mockUser = createMockUser()
      const mockCompany = createMockCompany({
        owner_id: mockUser.id,
        subscription_status: 'canceled',
      })
      const mockSupabase = createMockSupabase(mockUser, null, mockCompany)
      const request = createMockAuthenticatedRequest(mockUser)

      const result = await verifyTenant(request, mockSupabase)

      expect(result.tenantResolved).toBe(true)
      expect(result.request.middlewareContext.tenant.subscriptionStatus).toBe('canceled')
    })
  })

  describe('failed tenant verification', () => {
    it('should return no_company when user has no company', async () => {
      const mockUser = createMockUser()
      const mockSupabase = createMockSupabase(mockUser, null, null)  // No company
      const request = createMockAuthenticatedRequest(mockUser)

      const result = await verifyTenant(request, mockSupabase)

      expect(result).toEqual({
        tenantResolved: false,
        reason: 'no_company',
      })
    })

    it('should handle database error gracefully', async () => {
      const mockUser = createMockUser()
      const dbError = new Error('Database connection failed')
      const mockSupabase = createMockSupabaseWithError(dbError)
      const request = createMockAuthenticatedRequest(mockUser)

      const result = await verifyTenant(request, mockSupabase)

      expect(result).toEqual({
        tenantResolved: false,
        reason: 'db_error',
      })
    })
  })

  describe('edge cases', () => {
    it('should handle user with multiple companies (use first)', async () => {
      // Test edge case of multiple companies
    })

    it('should preserve existing middleware context', async () => {
      // Test context accumulation
    })
  })
})

describe('requiresSubscription', () => {
  it.each([
    { pathname: '/dashboard', expected: true },
    { pathname: '/dashboard/sites', expected: true },
    { pathname: '/onboarding', expected: true },
    { pathname: '/choose-plan', expected: false },
    { pathname: '/payment', expected: false },
  ])('should return $expected for pathname $pathname', ({ pathname, expected }) => {
    expect(requiresSubscription(pathname)).toBe(expected)
  })
})
```

**Estimated Effort**: 6 hours
**Coverage Target**: ≥90%
**Prerequisites**: CAM-137 implementation complete

---

## Future Implementation: wizard.test.ts (After CAM-138)

### What to Test

Based on expected wizard middleware implementation:

```typescript
/**
 * Wizard Middleware Unit Tests
 *
 * CAM-138: Extract Wizard Access Logic with Separate Middleware
 *
 * CRITICAL: Regression prevention for Oct 30, 2025 incident
 *
 * Following CLAUDE.md Testing Best Practices
 */

import { describe, it, expect } from 'vitest'
import type { MiddlewareRequest, WizardRequest } from './types'
import { detectWizardException, createWizardContext } from './wizard'

describe('detectWizardException', () => {
  describe('wizard exception detected', () => {
    it('should detect wizard=true query parameter', () => {
      const request = createMockRequest('/dashboard')
      request.middlewareContext.searchParams.set('wizard', 'true')

      const result = detectWizardException(request)

      expect(result).toBe(true)
    })

    it('should detect /onboarding pathname', () => {
      const request = createMockRequest('/onboarding')

      const result = detectWizardException(request)

      expect(result).toBe(true)
    })

    it('should detect nested onboarding paths', () => {
      const request = createMockRequest('/onboarding/wizard')

      const result = detectWizardException(request)

      expect(result).toBe(true)
    })

    it('should detect wizard param with nested dashboard path', () => {
      const request = createMockRequest('/dashboard/sites')
      request.middlewareContext.searchParams.set('wizard', 'true')

      const result = detectWizardException(request)

      expect(result).toBe(true)
    })
  })

  describe('no wizard exception', () => {
    it('should NOT detect wizard=false', () => {
      const request = createMockRequest('/dashboard')
      request.middlewareContext.searchParams.set('wizard', 'false')

      const result = detectWizardException(request)

      expect(result).toBe(false)
    })

    it('should NOT detect dashboard without wizard param', () => {
      const request = createMockRequest('/dashboard')

      const result = detectWizardException(request)

      expect(result).toBe(false)
    })

    it('should NOT detect unrelated paths', () => {
      const request = createMockRequest('/login')

      const result = detectWizardException(request)

      expect(result).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle case-insensitive wizard param', () => {
      const request = createMockRequest('/dashboard')
      request.middlewareContext.searchParams.set('wizard', 'TRUE')

      const result = detectWizardException(request)

      // Decide: should 'TRUE' be treated as true? Document decision
      expect(result).toBe(true)  // or false, document why
    })

    it('should handle wizard param with extra whitespace', () => {
      const request = createMockRequest('/dashboard')
      request.middlewareContext.searchParams.set('wizard', ' true ')

      const result = detectWizardException(request)

      expect(result).toBe(false)  // Strict matching recommended
    })
  })
})

describe('createWizardContext', () => {
  it('should create wizard context from query parameter', () => {
    const request = createMockRequest('/dashboard')
    request.middlewareContext.searchParams.set('wizard', 'true')

    const context = createWizardContext(request)

    expect(context).toEqual({
      inWizard: true,
      wizardQueryParam: 'true',
    })
  })

  it('should create wizard context from pathname', () => {
    const request = createMockRequest('/onboarding')

    const context = createWizardContext(request)

    expect(context).toEqual({
      inWizard: true,
      wizardQueryParam: 'path-based',
    })
  })
})

// CRITICAL REGRESSION TEST for Oct 30 incident
describe('REGRESSION: Oct 30, 2025 Incident', () => {
  it('should allow wizard access with incomplete onboarding', () => {
    // This test prevents the exact scenario that broke on Oct 30

    const request = createMockRequest('/dashboard')
    request.middlewareContext.searchParams.set('wizard', 'true')

    const wizardDetected = detectWizardException(request)

    // CRITICAL: Wizard exception MUST be detected
    expect(wizardDetected).toBe(true)

    // This would have prevented the Oct 30 incident where wizard
    // access was broken by middleware changes
  })
})
```

**Estimated Effort**: 6 hours
**Coverage Target**: ≥90%
**Prerequisites**: CAM-138 implementation complete
**CRITICAL**: Must include Oct 30 regression test

---

## Future Implementation: compose.test.ts (After CAM-140)

### What to Test

Based on expected composition utility implementation:

```typescript
/**
 * Middleware Composition Utility Unit Tests
 *
 * CAM-140: Implement Middleware Composition Utility
 *
 * Following CLAUDE.md Testing Best Practices
 */

import { describe, it, expect, vi } from 'vitest'
import type { MiddlewareFunction, MiddlewareRequest } from './types'
import { NextResponse } from 'next/server'
import { compose } from './compose'

// Mock middleware functions for testing
function createPassThroughMiddleware(name: string): MiddlewareFunction {
  return vi.fn(async (request: MiddlewareRequest) => {
    // Add marker to context to track execution
    ;(request as any).executionOrder = [
      ...((request as any).executionOrder || []),
      name,
    ]
    return request
  })
}

function createRedirectMiddleware(targetPath: string): MiddlewareFunction {
  return vi.fn(async (request: MiddlewareRequest) => {
    const url = new URL(targetPath, 'http://localhost')
    return NextResponse.redirect(url)
  })
}

describe('compose', () => {
  describe('middleware chaining', () => {
    it('should execute middleware in order', async () => {
      const middleware1 = createPassThroughMiddleware('first')
      const middleware2 = createPassThroughMiddleware('second')
      const middleware3 = createPassThroughMiddleware('third')

      const composed = compose(middleware1, middleware2, middleware3)
      const request = createMockRequest('/dashboard')
      ;(request as any).executionOrder = []

      await composed(request)

      expect((request as any).executionOrder).toEqual(['first', 'second', 'third'])
    })

    it('should stop chain if middleware returns response', async () => {
      const middleware1 = createPassThroughMiddleware('first')
      const middleware2 = createRedirectMiddleware('/login')  // Stops here
      const middleware3 = createPassThroughMiddleware('third')  // Never runs

      const composed = compose(middleware1, middleware2, middleware3)
      const request = createMockRequest('/dashboard')

      const result = await composed(request)

      expect(middleware1).toHaveBeenCalled()
      expect(middleware2).toHaveBeenCalled()
      expect(middleware3).not.toHaveBeenCalled()
      expect(result).toBeInstanceOf(NextResponse)
    })

    it('should accumulate context through chain', async () => {
      const addAuthMiddleware: MiddlewareFunction = async (req) => {
        ;(req as any).middlewareContext.auth = { userId: 'test-user' }
        return req
      }

      const addTenantMiddleware: MiddlewareFunction = async (req) => {
        ;(req as any).middlewareContext.tenant = { companyId: 'test-company' }
        return req
      }

      const composed = compose(addAuthMiddleware, addTenantMiddleware)
      const request = createMockRequest('/dashboard')

      const result = await composed(request)

      expect((result as any).middlewareContext.auth).toBeDefined()
      expect((result as any).middlewareContext.tenant).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should propagate errors from middleware', async () => {
      const errorMiddleware: MiddlewareFunction = async () => {
        throw new Error('Middleware error')
      }

      const composed = compose(errorMiddleware)
      const request = createMockRequest('/dashboard')

      await expect(composed(request)).rejects.toThrow('Middleware error')
    })
  })

  describe('edge cases', () => {
    it('should handle empty middleware chain', async () => {
      const composed = compose()
      const request = createMockRequest('/dashboard')

      const result = await composed(request)

      expect(result).toBe(request)  // Request passed through
    })

    it('should handle single middleware', async () => {
      const middleware = createPassThroughMiddleware('only')

      const composed = compose(middleware)
      const request = createMockRequest('/dashboard')

      await composed(request)

      expect(middleware).toHaveBeenCalledWith(request)
    })
  })
})
```

**Estimated Effort**: 4 hours
**Coverage Target**: ≥90%
**Prerequisites**: CAM-140 implementation complete

---

## Quality Checklist (Use Before Submitting Tests)

Before marking any unit test file as complete, verify:

### Code Quality
- [ ] All tests have descriptive names matching what they verify
- [ ] Tests grouped under `describe(functionName, () => ...)`
- [ ] Test structure: describe(function) > describe(scenario type) > it(specific test)
- [ ] No commented-out code
- [ ] No console.log() statements (unless testing logging)

### Test Quality
- [ ] Strong assertions (`toEqual`, `toBe`, not `toBeTruthy`, `toBeGreaterThan`)
- [ ] Comprehensive assertions (test entire structure, not individual fields)
- [ ] Parameterized tests for multiple similar scenarios (`test.each`)
- [ ] Independent tests (no shared state between tests)
- [ ] Tests can fail for real defects (no trivial assertions like `expect(true).toBe(true)`)

### Time Invariance
- [ ] No hardcoded dates (`'2025-06-01'`, `'2024-12-31'`, etc.)
- [ ] No hardcoded timestamps
- [ ] All dates use `Date.now()` or `new Date().toISOString()`
- [ ] Session timestamps use relative time (30 min ago, 1 hour from now)
- [ ] No hardcoded UUIDs that may become invalid

### Test Data
- [ ] Test factories with defaults + overrides pattern
- [ ] Factories use branded types (`createUserId`, `createCompanyId`)
- [ ] Mock objects properly typed (`as SupabaseClient`, `as User`)
- [ ] Random values where IDs need to be unique (`Math.random()`)

### CLAUDE.md Compliance
- [ ] T-1: Colocated unit tests (`*.test.ts` next to source)
- [ ] T-3: Pure logic tests (no database, no external dependencies)
- [ ] T-6: Test entire structure in one assertion
- [ ] T-9: No hardcoded temporal data
- [ ] T-10: Test data factories used
- [ ] T-11: Parameterized tests for edge cases

### Coverage
- [ ] Coverage ≥90% for the file under test
- [ ] All exported functions have tests
- [ ] All branches covered (if/else, switch cases)
- [ ] Error paths tested (not just happy paths)
- [ ] Edge cases tested (null, undefined, empty, boundary conditions)

### Documentation
- [ ] File header with issue reference and CLAUDE.md checklist
- [ ] Complex test logic has explanatory comments
- [ ] Regression tests clearly marked (e.g., Oct 30 incident)

---

## Troubleshooting

### Tests Failing?

1. **Check for hardcoded dates**:
   ```bash
   grep -r "2025-" lib/middleware/*.test.ts
   grep -r "2024-" lib/middleware/*.test.ts
   ```
   If you find any, replace with dynamic generation.

2. **Check test isolation**:
   - Run tests individually: `npm test lib/middleware/auth.test.ts -t "specific test name"`
   - If individual tests pass but suite fails, you have shared state

3. **Check mock setup**:
   - Ensure `vi.fn()` is used for all mock functions
   - Verify mock return values match expected types
   - Check that mocks are reset between tests (Vitest does this automatically)

### Coverage Not Meeting Target?

1. **Identify uncovered lines**:
   ```bash
   npm run test:coverage -- lib/middleware/auth.ts
   ```

2. **Common uncovered areas**:
   - Error handling branches (add error test cases)
   - Edge cases (null, undefined, empty arrays)
   - Default parameters (test with and without params)

3. **Check coverage report**:
   - Open `coverage/index.html` in browser
   - Find highlighted uncovered lines
   - Add tests for those lines

### TypeScript Errors in Tests?

1. **Check branded type usage**:
   ```typescript
   // ❌ Wrong
   const userId: UserId = 'some-id'

   // ✅ Correct
   const userId = createUserId('some-id')
   ```

2. **Check mock typing**:
   ```typescript
   // ❌ Wrong
   const supabase = { auth: { getUser: () => {} } }

   // ✅ Correct
   const supabase = { auth: { getUser: vi.fn() } } as unknown as SupabaseClient
   ```

---

## Success Criteria

### Per Test File

Each test file is complete when:
- [ ] All exported functions have tests
- [ ] Coverage ≥90%
- [ ] All tests pass: `npm test lib/middleware/[filename].test.ts`
- [ ] Quality checklist verified
- [ ] CLAUDE.md compliance verified
- [ ] No hardcoded temporal data
- [ ] Strong assertions throughout

### Overall CAM-141

CAM-141 is complete when:
- [ ] All implemented middleware has unit tests (currently: types.ts ✅, auth.ts ✅)
- [ ] All pending middleware tests blocked by dependencies (tenant, wizard, compose)
- [ ] Test coverage ≥90% for all tested middleware
- [ ] All tests pass: `npm test lib/middleware`
- [ ] Test patterns documented for future middleware
- [ ] CAM-141 Linear issue updated with status

---

## Timeline and Effort

### Completed (0 hours additional)
- ✅ types.test.ts - COMPLETE
- ✅ auth.test.ts - COMPLETE

### Pending (Blocked by Dependencies)
- ⏸️ tenant.test.ts - 6 hours (after CAM-137)
- ⏸️ wizard.test.ts - 6 hours (after CAM-138)
- ⏸️ compose.test.ts - 4 hours (after CAM-140)

### Total Remaining: 16 hours (blocked)

---

## Related Documentation

- [CAM-141 Test Architecture](./CAM-141-TEST-ARCHITECTURE.md) - Main test strategy
- [CAM-141 Test Utilities Gaps](./CAM-141-TEST-UTILITIES-GAPS.md) - Utility analysis
- [CAM-134 Test Plan](../../tests/middleware/TEST_PLAN.md) - Comprehensive testing strategy
- [CLAUDE.md](../../CLAUDE.md) - Testing best practices
- [auth.test.ts](../../lib/middleware/auth.test.ts) - Reference implementation
- [types.test.ts](../../lib/middleware/types.test.ts) - Reference implementation

---

**Document Owner**: Test Architect (Claude Code)
**Status**: Implementation guide complete
**Last Updated**: 2025-11-01
