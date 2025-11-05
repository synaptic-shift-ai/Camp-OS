# ADR-001: Explicit Wizard State Management in Middleware

**Status**: ACCEPTED
**Date**: 2025-10-30 (retroactive, incident-driven)
**Updated**: 2025-11-05
**Deciders**: Engineering Team
**Related Issues**: CAM-129, CAM-138, CAM-140, CAM-143
**Related Incident**: [Incident Summary 2025-10-30](../reference/INCIDENT_SUMMARY_2025_10_30.md)

---

## Context

On October 30, 2025, during a live investor demo, the conversion pipeline completely failed. New customers could not complete onboarding due to an infinite redirect loop between `/dashboard/sites?wizard=true` and `/onboarding`.

### The Critical Bug

A middleware refactor (commit `d078412`) removed wizard access exception logic, causing this flow:

1. User completes Stripe payment ✅
2. Webhook creates company and redirects to `/dashboard/sites?wizard=true` ✅
3. Middleware detects incomplete onboarding → redirects to `/onboarding` ❌
4. `/onboarding` page redirects to `/dashboard/sites?wizard=true` ❌
5. **INFINITE LOOP** (307 redirects) ❌

### Root Cause

The wizard IS the onboarding process. When a user has `onboarding_completed = false`, they MUST access the wizard to complete setup. Without explicit wizard state detection, the middleware cannot distinguish between:

- **Legitimate access**: User actively completing onboarding via wizard
- **Incomplete setup**: User trying to access dashboard without completing onboarding

This ambiguity caused the redirect loop.

---

## Decision

We will implement **explicit wizard state detection** in the middleware layer to prevent infinite redirect loops while maintaining proper onboarding enforcement.

### Implementation

#### 1. Wizard Detection Patterns

The middleware detects wizard access via two patterns:

```typescript
// Pattern 1: Query parameter (post-payment redirect)
/dashboard/sites?wizard=true

// Pattern 2: Onboarding route (direct access)
/onboarding/*
```

Both patterns indicate the user is **actively in the onboarding process** and should not be redirected.

#### 2. Middleware Architecture

**File**: `lib/middleware/wizard.ts`

```typescript
export function detectWizardAccess(request: MiddlewareRequest): WizardResult {
  const { pathname, searchParams } = request.middlewareContext

  // Pattern 1: Check for wizard query parameter
  const hasWizardParam = searchParams.get('wizard') === 'true'

  // Pattern 2: Check for onboarding route
  const isOnboardingRoute = pathname.startsWith('/onboarding')

  // Wizard exception applies if either pattern matches
  if (hasWizardParam || isOnboardingRoute) {
    return { isWizard: true, context: { inWizard: true } }
  }

  return { isWizard: false }
}
```

#### 3. Middleware Composition

**File**: `lib/supabase/middleware.ts`

The wizard detection is integrated into the middleware composition chain:

```typescript
const middleware = composeMiddleware(
  createAuthMiddleware(supabase),
  createEmailVerificationMiddleware(),
  createSubscriptionMiddleware(supabase),
  createOnboardingMiddleware(supabase)  // Respects wizard exceptions
)
```

The `createOnboardingMiddleware` checks wizard context before enforcing onboarding completion:

```typescript
// If in wizard mode, allow access
if (isInWizardMode(request)) {
  return request  // Continue without redirect
}

// Otherwise, enforce onboarding completion
if (!hasCompletedOnboarding) {
  return NextResponse.redirect('/onboarding')
}
```

#### 4. Circuit Breaker (Defense in Depth)

**File**: `lib/middleware/loop-detector.ts`

Even with wizard state detection, we add a circuit breaker as a safety net:

```typescript
// Detect >3 redirects in 5 seconds
if (RedirectLoopDetector.check(request, targetPath) === false) {
  // Break loop, allow access, fire critical alert
  console.error('🚨 CRITICAL: REDIRECT LOOP DETECTED')
  return request  // Allow access to break loop
}
```

This prevents infinite loops even if middleware logic has a bug.

---

## Consequences

### Positive

1. **Infinite loops prevented**: Explicit wizard state eliminates redirect ambiguity
2. **Testable logic**: Pure functions (`detectWizardAccess`) enable comprehensive unit testing
3. **Clear separation of concerns**: Wizard detection is isolated from route protection
4. **Defense in depth**: Circuit breaker catches loops even if wizard logic fails
5. **Incident prevention**: E2E tests (`tests/e2e/middleware-flows.spec.ts`) provide regression coverage

### Negative

1. **Additional complexity**: Middleware must track wizard state across requests
2. **Query parameter dependency**: System relies on `?wizard=true` being preserved through redirects
3. **Maintenance burden**: Future middleware changes must respect wizard exceptions

### Mitigations

1. **Comprehensive testing**:
   - Unit tests: `lib/middleware/wizard.test.ts` (14 tests)
   - Integration tests: `lib/middleware/routing.test.ts` (8 tests)
   - E2E tests: `tests/e2e/middleware-flows.spec.ts` (8 tests)

2. **Documentation**:
   - Inline comments in critical sections
   - This ADR for architectural context
   - Incident summary for historical reference

3. **Monitoring**:
   - Loop detector logs redirect patterns
   - Structured logging with correlation IDs
   - (Future) Real-time monitoring dashboard

---

## Alternatives Considered

### Alternative 1: Remove Onboarding Checks

**Approach**: Allow dashboard access even with incomplete onboarding.

**Rejected**: This defeats the purpose of enforced onboarding. Users would see empty dashboards without properties configured.

### Alternative 2: Session-Based Wizard State

**Approach**: Store wizard state in user session/cookies instead of query parameters.

**Rejected**:
- More complex implementation
- Session management across redirects is error-prone
- Query parameters are stateless and easier to debug

### Alternative 3: Separate Wizard Route

**Approach**: Create `/wizard` route instead of using dashboard with `?wizard=true`.

**Rejected**:
- Requires significant frontend refactor
- Breaks existing Stripe redirect flow
- Query parameter approach is simpler

---

## Test Coverage

### Unit Tests (14 tests)
**File**: `lib/middleware/wizard.test.ts`

- Wizard query parameter detection
- Onboarding route detection
- Wizard exception application
- Safe path validation
- Edge cases (case sensitivity, malformed params)

### Integration Tests (8 tests)
**File**: `lib/middleware/routing.test.ts`

- Onboarding middleware with wizard exceptions
- Middleware composition with wizard context
- Redirect prevention when in wizard mode

### E2E Tests (8 tests)
**File**: `tests/e2e/middleware-flows.spec.ts`

- **REGRESSION TEST**: New user signup → wizard → dashboard flow
- Redirect to onboarding when accessing dashboard without wizard param
- Wizard access with incomplete setup
- Existing user dashboard access (no wizard)
- Session persistence across refreshes

**CRITICAL**: These E2E tests would have caught the October 30 incident.

---

## Related Files

### Core Implementation
- `lib/middleware/wizard.ts` - Wizard detection logic
- `lib/middleware/routing.ts` - Onboarding middleware with wizard exceptions
- `lib/supabase/middleware.ts` - Middleware composition
- `lib/middleware/loop-detector.ts` - Circuit breaker

### Tests
- `lib/middleware/wizard.test.ts` - Unit tests
- `lib/middleware/routing.test.ts` - Integration tests
- `tests/e2e/middleware-flows.spec.ts` - E2E tests

### Documentation
- `docs/reference/INCIDENT_SUMMARY_2025_10_30.md` - Incident details
- `docs/architecture/MIDDLEWARE_ARCHITECTURE.md` - Middleware design
- `docs/architecture/IMPLEMENTATION_ROADMAP.md` - Post-incident roadmap

---

## Critical Warnings

### ⚠️ DO NOT REMOVE

The wizard exception logic in `lib/middleware/wizard.ts` is **CRITICAL** to the conversion pipeline. Removing it will cause infinite redirect loops and prevent new customers from onboarding.

### ⚠️ TESTS REQUIRED

Any changes to the following files MUST include corresponding test updates:

- `lib/middleware/wizard.ts`
- `lib/middleware/routing.ts` (onboarding middleware)
- `lib/supabase/middleware.ts`

Run this test suite before deploying middleware changes:

```bash
# Unit tests
npm test lib/middleware/wizard.test.ts
npm test lib/middleware/routing.test.ts

# E2E regression tests
npm run test:e2e tests/e2e/middleware-flows.spec.ts
```

### ⚠️ MANUAL TESTING REQUIRED

Before deploying changes to middleware or webhook handling:

1. Test signup flow: Create account → Pay → Wizard access
2. Test redirect behavior: Access dashboard without wizard param
3. Test onboarding completion: Complete wizard → Access dashboard
4. Monitor logs for redirect loops (look for 307 status codes)

---

## Success Metrics

### Incident Prevention
- ✅ Zero infinite redirect loops since fix deployed (Nov 5, 2025)
- ✅ E2E tests pass 100% in CI/CD
- ✅ Loop detector: Zero circuit breaker activations

### Test Coverage
- ✅ 14 unit tests for wizard detection
- ✅ 8 integration tests for middleware composition
- ✅ 8 E2E tests for user flows
- ✅ 100% coverage of wizard.ts critical paths

### Monitoring
- ✅ Structured logging with correlation IDs
- ✅ Loop detector alerts on redirect patterns
- ⏳ Real-time dashboard (Phase 3 - planned)

---

## Decision Review

This decision should be reviewed if:

1. Next.js changes middleware execution model
2. Onboarding flow changes significantly (e.g., multi-step wizard → single page)
3. Alternative state management (e.g., server components) becomes viable
4. Redirect loop detection proves insufficient

**Next Review**: Q1 2026 or after major framework upgrade

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/) - Commit format
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware) - Middleware docs
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html) - Resilience pattern
- [ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record) - ADR format

---

**Approved By**: Engineering Team
**Implementation Date**: 2025-10-30 (emergency fix)
**Documentation Date**: 2025-11-05
**Status**: ACCEPTED and DEPLOYED
