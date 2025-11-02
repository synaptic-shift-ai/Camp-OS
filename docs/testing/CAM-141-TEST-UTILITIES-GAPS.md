# Test Utilities Gap Analysis - CAM-141

**Issue**: CAM-141 - Implement Unit Tests for Middleware Functions
**Parent**: CAM-129 - CRITICAL BUG - Middleware hardening
**Created**: 2025-11-01
**Status**: Gap analysis for test infrastructure

---

## Executive Summary

This document identifies gaps in test utilities and infrastructure for comprehensive middleware testing. Current unit tests (types.test.ts, auth.test.ts) use inline factories successfully. However, integration tests (CAM-142) and E2E tests (CAM-144) will require shared utilities.

**Key Finding**: CAM-141 (unit tests) does NOT require new test utilities. Existing inline factories are sufficient and preferred for unit test independence.

**Critical Gap**: `tests/utils/middleware-helpers.ts` is needed for CAM-142 (integration tests) but NOT blocking CAM-141.

---

## Current Test Utilities Inventory

### ✅ Available and Working

#### 1. **Branded ID Constructors** (`lib/middleware/types.ts`)
```typescript
// Already implemented and tested
export function createUserId(id: string): UserId
export function createCompanyId(id: string): CompanyId
export function createPropertyId(id: string): PropertyId
export function createSessionId(id: string): SessionId
```

**Status**: ✅ COMPLETE
**Coverage**: 100% tested in `types.test.ts`
**Usage**: Used extensively in `auth.test.ts` for creating test data

#### 2. **Type Guards** (`lib/middleware/types.ts`)
```typescript
// Already implemented and tested
export function isAuthContext(ctx: unknown): ctx is AuthContext
export function isTenantContext(ctx: unknown): ctx is TenantContext
export function isWizardContext(ctx: unknown): ctx is WizardContext
export function isMiddlewareContext(ctx: unknown): ctx is MiddlewareContext
export function isAuthenticatedRequest(req: MiddlewareRequest): req is AuthenticatedRequest
export function isTenantResolvedRequest(req: MiddlewareRequest): req is TenantResolvedRequest
export function isWizardRequest(req: MiddlewareRequest): req is WizardRequest
```

**Status**: ✅ COMPLETE
**Coverage**: 100% tested in `types.test.ts`
**Usage**: Available for runtime validation in middleware and tests

#### 3. **Inline Test Factories** (Pattern from `auth.test.ts`)

**Pattern**: Each test file defines its own factories for independence

```typescript
// Example from auth.test.ts
function createMockRequest(pathname = '/dashboard'): MiddlewareRequest {
  return {
    middlewareContext: {
      sessionId: createSessionId('test-session-123'),
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
    user_metadata: { user_type: 'buyer' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User
}

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
  } as unknown as SupabaseClient
}
```

**Status**: ✅ WORKING PATTERN
**Location**: Inline in test files (not shared)
**Rationale**: Unit tests should be self-contained and not depend on external utilities

---

## Missing Test Utilities (NOT Blocking CAM-141)

### ❌ Gap 1: Middleware Request/Response Helpers

**File**: `tests/utils/middleware-helpers.ts` (NOT YET IMPLEMENTED)
**Priority**: MEDIUM (needed for CAM-142, not CAM-141)
**Blocking**: CAM-142 (Integration Tests), CAM-144 (E2E Tests)
**Estimated Effort**: 4-6 hours

**Needed Functions**:

```typescript
/**
 * Create mock Next.js request with middleware context
 * For integration tests that need realistic Next.js request objects
 */
export function mockNextRequest(options: {
  pathname: string
  searchParams?: Record<string, string>
  user?: User | null
  cookies?: Record<string, string>
}): MiddlewareRequest

/**
 * Extract redirect location from Next.js response
 * For asserting redirect behavior in integration tests
 */
export function getRedirectLocation(response: NextResponse): string | null

/**
 * Check if response is a redirect (3xx status)
 */
export function isRedirect(response: NextResponse): boolean

/**
 * Assert that response is NOT a redirect
 * Throws clear error if redirect detected
 */
export function assertNoRedirect(response: NextResponse): void

/**
 * Assert that response redirects to specific path
 * Throws clear error if redirect doesn't match
 */
export function assertRedirectTo(
  response: NextResponse,
  expectedPath: string
): void

/**
 * Create authenticated request with user context already added
 * For integration tests starting from authenticated state
 */
export function mockAuthenticatedRequest(options: {
  pathname: string
  user: User
  emailVerified?: boolean
  searchParams?: Record<string, string>
}): AuthenticatedRequest

/**
 * Spy on Supabase database queries
 * For performance and security tests validating query patterns
 */
export function createSupabaseSpy(): {
  spy: any
  queries: Array<{ table: string; operation: string }>
}

/**
 * Detect redirect loops by following chain of redirects
 * For integration tests validating loop prevention
 */
export async function detectRedirectLoop(
  initialRequest: MiddlewareRequest,
  maxIterations?: number
): Promise<{
  loopDetected: boolean
  redirectChain: string[]
}>
```

**Why NOT in CAM-141**:
- Unit tests use inline mocks (createMockSupabase, createMockRequest)
- Unit tests don't need actual Next.js request/response objects
- Unit tests don't test redirect behavior (that's integration testing)

**When to Implement**:
- Before starting CAM-142 (Integration Tests)
- Reference implementation is documented in CAM-134 test plan

---

### ❌ Gap 2: Dynamic Date/Time Helpers

**File**: `tests/utils/date-helpers.ts` (OPTIONAL - inline generation works)
**Priority**: LOW (inline generation works well)
**Blocking**: Nothing (nice-to-have only)

**Current Approach** (from auth.test.ts):
```typescript
// ✅ Works perfectly inline
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString()
```

**Potential Shared Utilities** (if we want them):
```typescript
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function futureDays(days: number): string {
  return daysFromNow(days)
}

export function getNextDayOfWeek(dayOfWeek: number): string {
  const today = new Date()
  const currentDay = today.getDay()
  const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7
  return daysFromNow(daysUntil)
}
```

**Recommendation**: DO NOT implement unless tests become harder to read with inline calculations. Current inline approach is clear and self-documenting.

---

### ❌ Gap 3: Test Database Setup/Teardown

**File**: `tests/utils/db-helpers.ts` (NOT NEEDED FOR UNIT TESTS)
**Priority**: MEDIUM (needed for CAM-142, not CAM-141)
**Blocking**: CAM-142 (Integration Tests)
**Estimated Effort**: 6-8 hours

**Needed Functions** (for integration tests):
```typescript
/**
 * Setup Supabase local instance for integration tests
 */
export async function setupTestDatabase(): Promise<SupabaseClient>

/**
 * Clean up all test data after integration tests
 */
export async function cleanupTestData(): Promise<void>

/**
 * Create test user with verified email
 */
export async function createTestUser(overrides?: Partial<User>): Promise<User>

/**
 * Create test company with active subscription
 */
export async function createTestCompany(options: {
  owner_id: UserId
  subscription_status?: 'active' | 'canceled' | 'past_due'
}): Promise<Company>

/**
 * Create test property (campground location)
 */
export async function createTestProperty(options: {
  company_id: CompanyId
  owner_id: UserId
  onboarding_completed?: boolean
}): Promise<Property>

/**
 * Setup user with complete onboarding and active subscription
 */
export async function setupUserWithSubscription(): Promise<{
  user: User
  company: Company
  property: Property
}>

/**
 * Setup user in wizard access state (incomplete onboarding)
 */
export async function setupUserWithWizardAccess(): Promise<{
  user: User
  company: Company
  property: Property
}>
```

**Why NOT in CAM-141**:
- Unit tests mock Supabase client entirely
- Unit tests don't touch real database
- Database setup is integration test concern

**When to Implement**:
- Before starting CAM-142 (Integration Tests)
- May require Supabase local instance configuration

---

## Test Infrastructure Assessment

### ✅ Working Well (Keep Using)

1. **Inline Test Factories**
   - **Pattern**: Each test file defines its own mock factories
   - **Benefit**: Tests are self-contained and independent
   - **Example**: `createMockUser()`, `createMockRequest()` in auth.test.ts
   - **Recommendation**: Continue this pattern for all unit tests

2. **Dynamic Temporal Data**
   - **Pattern**: Inline date calculations using `Date.now()`
   - **Benefit**: Tests never break due to hardcoded dates
   - **Example**: `new Date(Date.now() - 30 * 60 * 1000).toISOString()`
   - **Recommendation**: Keep using inline, don't abstract unless necessary

3. **Parameterized Tests**
   - **Pattern**: `test.each()` for multiple scenarios
   - **Benefit**: Reduces duplication, tests edge cases
   - **Example**: Route matching tests in auth.test.ts
   - **Recommendation**: Use for all repeatable scenarios

4. **Type-Safe Mocks**
   - **Pattern**: Mock objects typed as `SupabaseClient`, `User`, etc.
   - **Benefit**: Catches type errors at compile time
   - **Example**: `createMockSupabase()` returns typed client
   - **Recommendation**: Always type mocks properly

### ❌ Needs Improvement (For CAM-142)

1. **No Shared Middleware Helpers**
   - **Gap**: Integration tests will duplicate request/response mocking
   - **Impact**: CAM-142 blocked without `tests/utils/middleware-helpers.ts`
   - **Action**: Implement before CAM-142 starts

2. **No Database Test Utilities**
   - **Gap**: Integration tests will need manual DB setup/teardown
   - **Impact**: CAM-142 will be harder to write without helpers
   - **Action**: Implement `tests/utils/db-helpers.ts` for CAM-142

3. **No Shared Assertion Helpers**
   - **Gap**: Integration tests will duplicate redirect assertions
   - **Impact**: Less readable integration tests
   - **Action**: Include in `middleware-helpers.ts`

---

## Recommendations

### For CAM-141 (Unit Tests) - Current Issue

**NO ACTION NEEDED** on test utilities:
- ✅ Unit tests use inline factories successfully
- ✅ Existing patterns in auth.test.ts are excellent
- ✅ Type guards and branded IDs from types.ts are sufficient
- ✅ Time-invariant testing achieved with inline date generation

**What to Do**:
1. Continue using inline factories for remaining unit tests (tenant.test.ts, wizard.test.ts, compose.test.ts)
2. Follow auth.test.ts patterns exactly
3. DO NOT create shared utilities for unit tests (keep them independent)

### For CAM-142 (Integration Tests) - Future Issue

**REQUIRED BEFORE CAM-142 STARTS**:
1. Implement `tests/utils/middleware-helpers.ts`
   - Mock Next.js request/response factories
   - Redirect assertion helpers
   - Supabase query spies
   - Redirect loop detection
2. Implement `tests/utils/db-helpers.ts`
   - Supabase local setup/teardown
   - Test data factories (user, company, property)
   - Complete scenario builders (wizard access, subscription)
3. Document utility usage with examples
4. Test utilities themselves (meta-testing)

**Estimated Effort**: 10-14 hours total
**Priority**: MEDIUM (not blocking CAM-141)
**Blocking**: CAM-142 cannot start without these utilities

### For CAM-143 (Security Tests) - Future Issue

**REQUIRED BEFORE CAM-143 STARTS**:
- Same utilities as CAM-142 (middleware-helpers.ts, db-helpers.ts)
- Additional security-specific helpers:
  - Multi-tenant data isolation validators
  - Cross-tenant query detectors
  - Authorization boundary testers

### For CAM-144 (E2E Tests) - Future Issue

**REQUIRED BEFORE CAM-144 STARTS**:
- Playwright page object models
- E2E test data factories
- Middleware assertion helpers for browser context
- Login/authentication helpers for E2E

---

## Implementation Priority

### Priority 1: COMPLETE (For CAM-141) ✅
- [x] Branded ID constructors (types.ts)
- [x] Type guards (types.ts)
- [x] Inline test factories pattern (auth.test.ts demonstrates)

### Priority 2: BEFORE CAM-142 STARTS (Medium Priority)
- [ ] `tests/utils/middleware-helpers.ts` - Request/response mocking
- [ ] `tests/utils/db-helpers.ts` - Database setup/teardown
- [ ] Documentation and examples for utilities

### Priority 3: BEFORE CAM-143 STARTS (Medium Priority)
- [ ] Security-specific test helpers
- [ ] Tenant isolation validators
- [ ] Cross-tenant query detectors

### Priority 4: BEFORE CAM-144 STARTS (Lower Priority)
- [ ] E2E test utilities
- [ ] Playwright page objects
- [ ] Browser-based middleware assertions

---

## Success Criteria

### For CAM-141 (Current) ✅
- [x] Unit tests use inline factories (no shared utilities needed)
- [x] Time-invariant testing achieved
- [x] Type-safe mocks used throughout
- [x] Patterns established for future unit tests

### For Future Issues (CAM-142+)
- [ ] Middleware helpers implemented and tested
- [ ] Database helpers implemented and tested
- [ ] Integration tests can start without utility blockers
- [ ] Security tests have isolation validators
- [ ] E2E tests have page objects and helpers

---

## Related Documentation

- [CAM-141 Test Architecture](./CAM-141-TEST-ARCHITECTURE.md) - Main test strategy
- [CAM-134 Test Plan](../../tests/middleware/TEST_PLAN.md) - Comprehensive testing strategy
- [CLAUDE.md](../../CLAUDE.md) - Testing best practices (T-1 through T-11)
- [auth.test.ts](../../lib/middleware/auth.test.ts) - Reference implementation

---

**Document Owner**: Test Architect (Claude Code)
**Status**: Gap analysis complete
**Action Required**: NONE for CAM-141, implement utilities before CAM-142
**Last Updated**: 2025-11-01
