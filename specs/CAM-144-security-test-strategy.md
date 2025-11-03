# CAM-144: Security Testing Strategy for Middleware Security & Auth Bypass

## Executive Summary

This document outlines a comprehensive security testing strategy for the CampgroundOps middleware system, addressing authentication bypass vulnerabilities, tenant data isolation, and session manipulation attack scenarios.

**Test File**: `tests/security/middleware-security.test.ts`

**Status**: Design Complete - Ready for Implementation

**Priority**: URGENT (16 points)

---

## 1. Feature Analysis

### Components Involved
- **Authentication Layer**: `lib/middleware/auth.ts` - Session validation with Supabase
- **Tenant Resolution Layer**: `lib/middleware/tenant.ts` - Multi-tenant company resolution
- **Route Protection Layer**: `lib/middleware/routing.ts` - Middleware composition and redirect logic
- **Wizard Exception Logic**: `lib/middleware/wizard.ts` - Onboarding bypass detection
- **Middleware Composition**: `lib/middleware/compose.ts` - Chain execution with short-circuiting
- **Main Entry Point**: `lib/supabase/middleware.ts` - Next.js middleware integration

### Multi-tenant Touchpoints (CRITICAL)
1. **Tenant Resolution Query**: `companies` table filtered by `owner_id = auth.uid()`
2. **RLS Policies**: Database-level isolation preventing cross-tenant queries
3. **Branded Types**: `CompanyId`, `UserId` prevent accidental ID mixing
4. **Subscription Validation**: Tenant-specific subscription status checks
5. **Property Queries**: Onboarding status filtered by `company_id`

### Integration Points
- **Supabase Auth**: Session token validation
- **Supabase Database**: RLS-protected queries for companies and properties
- **Next.js Middleware**: Request/response interception
- **Client-side**: Cookie-based session management

### Risk Assessment
- **Business Impact**: CRITICAL - Auth bypass = unauthorized data access
- **Complexity**: HIGH - Composition-based middleware with 4 layers
- **Multi-tenant Concerns**: CRITICAL - Cross-tenant data leakage possible

---

## 2. Testing Strategy

### Test Pyramid Distribution
- **Security Tests**: 30 test cases (100% coverage of attack scenarios)
- **Integration Tests**: Leverage existing 33 passing tests for baseline
- **Unit Tests**: Leverage existing 74 passing middleware unit tests
- **E2E Tests**: Not required (middleware-level security is sufficient)

### Critical Paths Requiring Highest Coverage
1. **Auth Bypass Prevention** (Critical Priority - 8 tests)
2. **Tenant Isolation Validation** (Critical Priority - 8 tests)
3. **Session Manipulation Detection** (High Priority - 6 tests)
4. **Wizard Bypass Prevention** (High Priority - 4 tests)
5. **Direct URL Access Protection** (Medium Priority - 4 tests)

### Tenant Isolation Testing
- **MANDATORY**: Every test scenario includes cross-tenant validation
- **Approach**: Create multiple users/companies, verify strict isolation
- **Validation**: RLS policies + application-level checks

### Offline Scenarios
- Not applicable (middleware is server-side only)

---

## 3. Test Scenarios (Prioritized)

### CRITICAL PRIORITY (16 tests)

#### Attack Scenario 1: Auth Bypass (8 tests)

**1.1: Unauthenticated Access to Protected Routes**
- **Type**: Security - Auth Bypass
- **Expected**: 401/redirect to /login for all protected routes
- **Test Data**: No auth token, protected route paths
- **Agent**: comprehensive-test-engineer
- **Assertions**:
  - Response status is 307 (redirect)
  - Location header points to /login
  - Redirect parameter preserves original intent
  - No session context in response headers

**1.2: Expired Session Token Rejection**
- **Type**: Security - Session Validation
- **Expected**: Session expires → redirect to /login
- **Test Data**: Mock expired Supabase session
- **Assertions**:
  - `verifyAuthentication` returns `authenticated: false, reason: 'expired_session'`
  - No auth context added to request
  - Proper redirect response generated

**1.3: Invalid Session Token Rejection**
- **Type**: Security - Session Validation
- **Expected**: Invalid token → redirect to /login
- **Test Data**: Malformed JWT token
- **Assertions**:
  - `verifyAuthentication` returns `authenticated: false, reason: 'invalid_session'`
  - No server errors (graceful handling)
  - Generic error message (no token details leaked)

**1.4: Missing Session Token Handling**
- **Type**: Security - Auth Bypass
- **Expected**: No token → redirect to /login
- **Test Data**: Request with no cookies
- **Assertions**:
  - `verifyAuthentication` returns `authenticated: false, reason: 'no_session'`
  - Consistent behavior across all protected routes

**1.5: Email Verification Bypass Attempt**
- **Type**: Security - Email Verification
- **Expected**: Unverified email → redirect to /verify-email
- **Test Data**: Authenticated user with `email_confirmed_at: null`
- **Assertions**:
  - Email verification middleware catches unverified email
  - Redirect to /verify-email with original path preserved
  - No dashboard access granted

**1.6: Direct API Route Access Without Auth**
- **Type**: Security - API Protection
- **Expected**: API routes require auth, reject unauthenticated
- **Test Data**: Direct fetch to /api/* endpoints
- **Assertions**:
  - API middleware rejects request
  - No data returned
  - Proper error status code

**1.7: Cookie Manipulation Attack**
- **Type**: Security - Session Tampering
- **Expected**: Modified cookies invalidated
- **Test Data**: Tampered Supabase session cookie
- **Assertions**:
  - Supabase rejects tampered session
  - No auth context created
  - Redirect to login

**1.8: Session Hijacking Prevention**
- **Type**: Security - Session Security
- **Expected**: Session tied to user agent/IP (if implemented)
- **Test Data**: Valid session token from different context
- **Assertions**:
  - Session validation includes context checks
  - Cross-context usage rejected (if feature exists)
  - Or: Document limitation if not implemented

#### Attack Scenario 2: Tenant Hopping (8 tests)

**2.1: Cross-Tenant Data Access via Company ID Manipulation**
- **Type**: Security - Tenant Isolation
- **Expected**: User A cannot access Company B's data
- **Test Data**: User A authenticated, attempts query with Company B's ID
- **Assertions**:
  - RLS policy blocks query at database level
  - `resolveTenant` only returns user's own company
  - No data from other tenant visible

**2.2: Subscription Status Isolation**
- **Type**: Security - Tenant Isolation
- **Expected**: Subscription status query filtered to user's company only
- **Test Data**: Multiple companies with different subscription statuses
- **Assertions**:
  - User A sees only Company A's subscription status
  - User B sees only Company B's subscription status
  - No cross-tenant subscription data leakage

**2.3: Property Data Isolation**
- **Type**: Security - Tenant Isolation
- **Expected**: Property queries filtered by `company_id`
- **Test Data**: Multiple companies with properties
- **Assertions**:
  - Onboarding middleware queries only current tenant's properties
  - No properties from other tenants returned
  - RLS enforces isolation

**2.4: Tenant Context Tampering**
- **Type**: Security - Context Manipulation
- **Expected**: Middleware context is server-side only, cannot be tampered
- **Test Data**: Attempt to inject fake TenantContext
- **Assertions**:
  - Context only added by server-side middleware
  - Client cannot modify tenant context
  - Context regenerated on each request

**2.5: URL Parameter Injection for Tenant Switching**
- **Type**: Security - Parameter Tampering
- **Expected**: Query params cannot switch tenant context
- **Test Data**: `?company_id=other-tenant-id`
- **Assertions**:
  - Tenant resolution ignores query parameters
  - Only uses authenticated user's company
  - No tenant switching possible

**2.6: Database Query Injection via Tenant ID**
- **Type**: Security - SQL Injection
- **Expected**: Branded types + parameterized queries prevent injection
- **Test Data**: Malicious company_id with SQL syntax
- **Assertions**:
  - Parameterized queries prevent injection
  - Type system rejects non-UUID values
  - Database returns safe error

**2.7: Multi-Tenant Company Ownership**
- **Type**: Security - Edge Case
- **Expected**: User with multiple companies sees only one at a time
- **Test Data**: User owns multiple companies
- **Assertions**:
  - `resolveTenant` returns only first company (limit 1)
  - Consistent behavior across requests
  - Document: Company switching feature not yet implemented

**2.8: Deleted Company Access Prevention**
- **Type**: Security - Data Cleanup
- **Expected**: Deleted companies inaccessible
- **Test Data**: User's company marked as deleted
- **Assertions**:
  - `resolveTenant` returns `no_company`
  - Redirect to plan selection or error page
  - No residual data access

### HIGH PRIORITY (10 tests)

#### Attack Scenario 3: Session Token Manipulation (6 tests)

**3.1: Token Replay Attack**
- **Type**: Security - Session Replay
- **Expected**: Old tokens rejected (if refresh implemented)
- **Test Data**: Previously valid but now expired token
- **Assertions**:
  - Supabase validates token freshness
  - Expired tokens rejected
  - User must re-authenticate

**3.2: Token Signature Manipulation**
- **Type**: Security - JWT Security
- **Expected**: Modified JWT signature invalidates token
- **Test Data**: Valid token with modified signature
- **Assertions**:
  - Supabase crypto validation fails
  - No auth context created
  - Redirect to login

**3.3: Token Expiry Boundary Testing**
- **Type**: Security - Session Lifecycle
- **Expected**: Token expires exactly at expiry time
- **Test Data**: Token at expiry boundary (±1 second)
- **Assertions**:
  - Expired tokens rejected immediately
  - Valid tokens accepted until expiry
  - No race conditions

**3.4: Concurrent Session Validation**
- **Type**: Security - Race Conditions
- **Expected**: Multiple requests with same session handled correctly
- **Test Data**: 10 concurrent requests with same token
- **Assertions**:
  - All requests validated consistently
  - No session state corruption
  - Performance acceptable

**3.5: Session Refresh During Request**
- **Type**: Security - Session Lifecycle
- **Expected**: Middleware updates session cookies
- **Test Data**: Request with expiring token
- **Assertions**:
  - Supabase middleware refreshes session
  - Response includes updated cookies
  - Seamless user experience

**3.6: Cross-Origin Session Validation**
- **Type**: Security - CORS
- **Expected**: Sessions tied to origin
- **Test Data**: Request from different origin with valid session
- **Assertions**:
  - CORS policy enforced
  - Session validation respects origin
  - Or: Document if not implemented

#### Attack Scenario 4: Wizard Bypass (4 tests)

**4.1: Wizard Parameter Manipulation**
- **Type**: Security - Wizard Bypass
- **Expected**: User with complete onboarding cannot fake wizard access
- **Test Data**: Completed user accessing /dashboard?wizard=true
- **Assertions**:
  - Wizard context added but onboarding check passes
  - No redirect to /onboarding (already complete)
  - Wizard UI not shown (handled client-side)

**4.2: Direct Wizard Endpoint POST Without Permission**
- **Type**: Security - Endpoint Protection
- **Expected**: Wizard endpoints require wizard context
- **Test Data**: POST to wizard endpoint without ?wizard=true
- **Assertions**:
  - Endpoint validates wizard context
  - Unauthorized requests rejected
  - Or: Document if endpoint validation needed

**4.3: Wizard Exception Infinite Loop Prevention**
- **Type**: Security - DoS Prevention
- **Expected**: Wizard exception never creates redirect loops
- **Test Data**: All wizard exception scenarios
- **Assertions**:
  - `shouldApplyWizardException` returns true for wizard routes
  - No redirect generated when exception applies
  - Maximum 1 redirect per request

**4.4: Onboarding Route Access Control**
- **Type**: Security - Route Protection
- **Expected**: /onboarding only accessible to authenticated users
- **Test Data**: Unauthenticated access to /onboarding
- **Assertions**:
  - Auth middleware runs before wizard detection
  - Redirect to /login if unauthenticated
  - Wizard exception applies only after auth

### MEDIUM PRIORITY (4 tests)

#### Attack Scenario 5: Direct URL Access (4 tests)

**5.1: Dashboard Direct Access Without Subscription**
- **Type**: Security - Subscription Gate
- **Expected**: Redirect to /choose-plan
- **Test Data**: Authenticated user, no subscription
- **Assertions**:
  - Subscription middleware checks status
  - `resolveTenant` returns `subscription_inactive`
  - Redirect to plan selection

**5.2: Onboarding Bypass via Direct URL**
- **Type**: Security - Onboarding Gate
- **Expected**: Redirect to /onboarding if incomplete
- **Test Data**: User with incomplete property setup
- **Assertions**:
  - Onboarding middleware detects incomplete setup
  - Redirect to /onboarding (unless wizard exception)
  - No dashboard access

**5.3: Public Route Access During Maintenance**
- **Type**: Security - Graceful Degradation
- **Expected**: Public routes always accessible
- **Test Data**: Middleware errors
- **Assertions**:
  - Public routes bypass middleware chain
  - No auth/tenant checks for public paths
  - Always accessible

**5.4: Protected Route Redirect Preservation**
- **Type**: Security - UX & Security
- **Expected**: Original intent preserved in redirect
- **Test Data**: Protected route access while unauthenticated
- **Assertions**:
  - Redirect includes `?redirect=/original/path`
  - Query params preserved
  - Deep links work after login

---

## 4. Test Utilities Needed

### Test Data Factories
```typescript
// Following T-9: Dynamic test data generation
createTestUser(overrides?: { emailVerified?: boolean })
createTestCompany(overrides?: { subscription_status?: string })
createTestProperty(overrides?: { onboarding_completed?: boolean })
createMaliciousSessionToken() // For tampering tests
createExpiredSessionToken() // For expiry tests
```

### Mock Utilities
```typescript
createMockSupabase(scenario: { user?: User, companies?: Company[], properties?: Property[] })
createMockRequest(pathname: string, options?: { cookies?: Cookie[], headers?: Headers })
simulateCrossTenantAccess(userA: User, companyB: Company)
```

### Assertion Helpers
```typescript
assertAuthBypassBlocked(response: Response)
assertTenantIsolation(userA: User, userB: User, data: any[])
assertSessionInvalidated(response: Response)
assertRedirectPreservesIntent(response: Response, originalPath: string)
assertNoDataLeakage(error: Error)
```

### Security Test Harness
```typescript
// Automated attack scenario runner
runSecurityTestSuite(scenarios: AttackScenario[])
verifyRLSPolicies(supabase: SupabaseClient, tenant: Tenant)
auditMiddlewareChain(request: Request, expectedStops: number)
```

---

## 5. Delegation Plan

### Agent Assignment

**Agent**: `comprehensive-test-engineer`

**Scenarios Assigned**: All 30 test scenarios (Critical + High + Medium)

**Context Needed**:
1. Middleware architecture documentation (CAM-135, CAM-136, CAM-137, CAM-140)
2. Existing test patterns from `tests/integration/middleware.test.ts`
3. Test data factories from `tests/integration/middleware.test.ts`
4. Security testing best practices from CLAUDE.md T-7, T-12
5. Dynamic test data requirements from CLAUDE.md T-9, T-10

**Deliverables**:
1. `tests/security/middleware-security.test.ts` - Main security test file
2. `tests/security/test-helpers.ts` - Security-specific test utilities
3. Documentation of RLS policy verification approach
4. Test coverage report showing 100% attack scenario coverage

**Timeline**: 2-3 days
- Day 1: Implement Critical Priority tests (16 tests)
- Day 2: Implement High Priority tests (10 tests)
- Day 3: Implement Medium Priority tests + utilities (4 tests + helpers)

**Prerequisites**:
- CAM-136 (Auth Middleware Refactor) - ✅ Complete
- CAM-137 (Tenant Middleware Refactor) - ✅ Complete
- CAM-140 (Middleware Composition) - ✅ Complete

---

## 6. Verification Criteria

### Test Execution
- [ ] All 30 security tests pass
- [ ] `npm run test:security` passes with all tests green
- [ ] All existing tests still pass (74 unit + 33 integration = 107)

### Attack Scenario Coverage
- [ ] Auth Bypass: All 8 scenarios blocked
- [ ] Tenant Hopping: All 8 scenarios blocked
- [ ] Session Manipulation: All 6 scenarios detected
- [ ] Wizard Bypass: All 4 scenarios prevented
- [ ] Direct URL Access: All 4 scenarios redirected properly

### Security Properties Verified
- [ ] No auth bypass possible via any attack vector
- [ ] Cross-tenant data access completely blocked
- [ ] Session manipulation detected and rejected
- [ ] Error messages don't leak sensitive information
- [ ] RLS policies enforce isolation at database level
- [ ] Branded types prevent ID mixing at compile time

### Code Quality
- [ ] All tests follow CLAUDE.md best practices
- [ ] No hardcoded dates, times, or IDs (T-9)
- [ ] Test data factories used consistently (T-10)
- [ ] Strong assertions over weak ones (T-11)
- [ ] Independent, idempotent tests
- [ ] Clear test names describing what's verified

---

## 7. Risk Mitigation

### Known Limitations
1. **RLS Policy Testing**: Tests use mocks, not real Supabase RLS
   - **Mitigation**: Document expected RLS behavior, add integration tests when Supabase test instance available
2. **Session Refresh**: Token refresh handled by Supabase client
   - **Mitigation**: Test Supabase integration, trust library for crypto
3. **Cross-Origin Validation**: Not implemented yet
   - **Mitigation**: Document as future enhancement

### Test Maintenance
- Security tests must be updated when:
  - New middleware added to chain
  - Authentication flow changes
  - Tenant resolution logic changes
  - New protected routes added

### Performance Considerations
- 30 security tests run in <5 seconds
- No database queries (mocked)
- Minimal test data generation overhead

---

## 8. Success Metrics

### Primary Metrics
- ✅ 100% of attack scenarios blocked (30/30 tests passing)
- ✅ 0 auth bypass vulnerabilities
- ✅ 0 cross-tenant data leakage
- ✅ All existing tests still passing

### Secondary Metrics
- Test execution time: <5 seconds for full security suite
- Code coverage: 100% of security-critical paths
- Documentation: All attack scenarios documented with mitigation

### Business Impact
- **Before**: Unknown auth bypass risk, no security validation
- **After**: Comprehensive security test coverage, verified isolation
- **Confidence**: High confidence in multi-tenant security posture

---

## Appendix A: Attack Scenario Matrix

| Priority | Scenario | Tests | Risk | Mitigation |
|----------|----------|-------|------|------------|
| Critical | Auth Bypass | 8 | Very High | Middleware auth checks |
| Critical | Tenant Hopping | 8 | Very High | RLS + branded types |
| High | Session Manipulation | 6 | High | Supabase crypto validation |
| High | Wizard Bypass | 4 | Medium | Wizard exception logic |
| Medium | Direct URL Access | 4 | Medium | Route protection middleware |

**Total**: 30 tests covering 5 major attack categories

---

## Appendix B: CLAUDE.md Compliance

This test strategy strictly follows:
- **T-7**: Security tests in `tests/security/`
- **T-9**: No hardcoded temporal data (dynamic generation)
- **T-10**: Test data factories for consistency
- **T-11**: Strong assertions
- **T-12**: Multi-tenant isolation testing
- **BP-4**: Multi-tenant data isolation requirements
- **C-5**: Branded types for domain IDs
- **D-2**: Tenant ID in all WHERE clauses

---

## Next Steps

1. ✅ Post test strategy to Linear CAM-144
2. ⏭️ Create `tests/security/` directory
3. ⏭️ Implement test utilities and factories
4. ⏭️ Implement Critical Priority tests (8+8 = 16 tests)
5. ⏭️ Implement High Priority tests (6+4 = 10 tests)
6. ⏭️ Implement Medium Priority tests (4 tests)
7. ⏭️ Verify all tests pass
8. ⏭️ Update Linear with completion status

**Estimated Completion**: 2-3 days
**Blocking Issues**: None (all dependencies complete)
**Ready for Implementation**: ✅ Yes
