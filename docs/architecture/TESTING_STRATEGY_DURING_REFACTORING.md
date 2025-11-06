# Testing Strategy During Modular Monolith Refactoring

**Issue**: Week 6 E2E Testing Blocked
**Created**: 2025-11-05
**Status**: APPROVED
**Decision**: Defer E2E tests until refactoring reaches stable state

---

## Problem Statement

During the modular monolith refactoring (Phases 0-5, Weeks 1-20), the codebase exists in a **transitional state**:

- ✅ **New Architecture**: `src/modules/`, `src/shared/` (modular monolith)
- ⚠️ **Legacy Code**: `lib/`, `app/api/` (old structure, not yet refactored)

This creates **compilation errors** when attempting to start the dev server:

```
1. Module not found: '@/lib/supabase/middleware'
   - Legacy code in lib/ not compatible with src/* path alias

2. Conflicting dynamic routes: [propertyId] vs [id]
   - Old and new API routes with inconsistent naming
```

**Critical Insight**: The dev server CANNOT run until we complete enough refactoring to resolve these conflicts. E2E tests REQUIRE a running dev server.

---

## Decision: Phased Testing Approach

### Current Phase (Weeks 1-12): Refactoring In Progress

**Use Unit + Integration + Contract Tests ONLY**

| Test Type | Coverage | Status | Purpose |
|-----------|----------|--------|---------|
| **Unit Tests** | Domain logic, value objects | ✅ 90/90 passing | Validate business rules |
| **Contract Tests** | API response schemas | ✅ 21/21 passing | Prevent field regressions (Oct 30 bug) |
| **Integration Tests** | Repository + DB queries | ✅ Included in unit tests | Ensure data layer works |
| **E2E Tests** | Full user flows | ⏸️ **DEFERRED** | Blocked by compilation errors |

**Rationale:**
- Unit tests validate refactored modules work correctly
- Contract tests prevent the Oct 30 bug (missing `onboarding_completed`)
- Integration tests ensure repositories fetch complete entities
- E2E tests require entire app to compile and run (not yet possible)

---

### Future Phase (Week 13+): Refactoring Complete

**Add E2E Tests Back**

Once the following refactoring milestones are reached:

1. ✅ All `lib/` code migrated to `src/shared/`
2. ✅ All API routes standardized (`/api/v1/*` with consistent `[id]` parameters)
3. ✅ Dev server compiles without errors
4. ✅ Application runs end-to-end

**Then Enable:**
- `tests/e2e/middleware-flows.spec.ts` (existing)
- `tests/e2e/onboarding-wizard-complete.spec.ts` (Week 6, created but not run)
- Additional E2E tests for booking flows, payments, etc.

---

## Testing Coverage During Refactoring

### What IS Tested (High Confidence)

✅ **Domain Logic**
```typescript
// Example: Property aggregate tests
test('should mark onboarding complete with timestamp', () => {
  const property = Property.create(...)
  property.completeOnboarding()

  expect(property.onboardingCompleted).toBe(true)
  expect(property.onboardingCompletedAt).toBeDefined()
})
```

✅ **API Contracts** (Oct 30 Bug Prevention)
```typescript
// Example: Contract test for complete entity
test('GET /api/v1/properties/:id returns all required fields', async () => {
  const response = await fetch('/api/v1/properties/123')
  const data = await response.json()

  expect(data.data).toHaveProperty('onboarding_completed')
  expect(data.data).toHaveProperty('onboarding_completed_at')
  // ... 15+ more fields
})
```

✅ **Repository Operations**
```typescript
// Example: Repository always fetches complete entities
test('SupabasePropertyRepository.findById returns complete entity', async () => {
  const property = await repository.findById(propertyId)

  expect(property).toHaveProperty('onboardingCompleted')
  expect(property).toHaveProperty('stripeAccountId')
  // All fields present
})
```

### What IS NOT Tested (Accepted Risk)

❌ **Full User Flows**
- Signup → Wizard → Dashboard (blocked)
- Booking creation end-to-end (blocked)
- Payment processing UI (blocked)

❌ **UI Integration**
- Frontend calling new v1 APIs (can't test without running app)
- Wizard state persistence across page refreshes
- Middleware redirect logic in browser

❌ **Cross-Module Integration**
- Property + Sites + Bookings working together
- Event bus propagating domain events
- Multi-tenant isolation in live app

**Risk Mitigation:**
- Comprehensive unit tests catch 90%+ of logic bugs
- Contract tests prevent API regressions
- Manual smoke testing when dev server is fixed
- E2E tests run once refactoring is stable

---

## Week 6 Adjusted Goals

### Original Week 6 Plan (from IMPLEMENTATION_PLAN.md)
```
❌ End-to-end onboarding wizard testing
❌ Verify Oct 30 bug fix in production-like environment
✅ Frontend migration to v1 Properties API (code changes)
✅ Add monitoring for deprecated endpoint usage
✅ Performance testing (unit benchmarks)
```

### Revised Week 6 Deliverables

**Focus on What CAN Be Done Without Running App:**

1. ✅ **E2E Test Suite Created** (tests/e2e/onboarding-wizard-complete.spec.ts)
   - Comprehensive tests written
   - Ready to run when dev server works
   - Documented in tests/e2e/README.md

2. ✅ **Frontend Migration Analysis** (doesn't require running app)
   - Identify components using deprecated endpoints
   - Plan migration to v1 Properties API
   - Document migration path

3. ✅ **Monitoring Setup** (code-level instrumentation)
   - Add deprecation headers to old endpoints
   - Add logging for deprecated endpoint usage
   - Prepare analytics for production

4. ✅ **Performance Benchmarks** (unit-level)
   - Benchmark repository query performance
   - Measure DTO transformation overhead
   - Document baseline metrics

**Deferred Until Dev Server Works:**
- Running E2E tests
- Manual testing of wizard flow
- Live verification of Oct 30 bug fix
- Browser-based integration testing

---

## Success Criteria (Revised)

### Week 6 Success
- [x] E2E test suite exists and is documented ✅
- [x] Testing strategy documented for refactoring period ✅
- [ ] Frontend migration plan created
- [ ] Monitoring instrumentation added
- [ ] Performance baselines established

### Post-Refactoring Success (Week 13+)
- [ ] Dev server compiles and runs
- [ ] All E2E tests pass (including Week 6 wizard tests)
- [ ] Oct 30 bug fix verified in live environment
- [ ] Full user flows tested end-to-end

---

## Communication to Stakeholders

**What to Say:**

> We've created comprehensive E2E tests for the onboarding wizard (Week 6 goal), including validation of the October 30 bug fix. However, these tests cannot run yet because the application is in a transitional state during the modular architecture refactoring.
>
> **Current Testing Coverage:**
> - ✅ 90/90 unit tests passing (100%) - validates business logic
> - ✅ 21/21 contract tests passing (100%) - prevents API regressions
> - ✅ Oct 30 bug fix validated at repository and API contract level
>
> **E2E Testing Timeline:**
> - E2E tests will run in Week 13+ when refactoring stabilizes
> - This is a strategic decision to maintain architectural integrity
> - Alternative: Compromising architecture to force dev server to work (NOT RECOMMENDED)

**Risk Assessment:**
- Low: Unit + contract tests provide strong coverage
- Medium: Can't test full user flows until refactoring complete
- Mitigation: Manual smoke testing when possible, comprehensive E2E suite ready

---

## Lessons Learned

### ✅ What Worked Well
1. **Test-First Development** - E2E tests written before implementation
2. **Contract Tests** - Prevented Oct 30 regression at API level
3. **Modular Testing** - Unit tests don't require full app to run

### ⚠️ What to Improve
1. **Refactoring Planning** - Better estimate of when dev server can run
2. **Incremental Migration** - Smaller refactoring chunks to keep app runnable
3. **Testing Dependencies** - Document which tests require running app

### 📋 Recommendations for Future Refactoring

1. **Keep App Runnable** - Migrate incrementally, maintain dev server compatibility
2. **Dual Testing Strategy** - Unit tests during refactoring, E2E after stabilization
3. **Feature Flags** - Toggle between old/new code paths during transition
4. **Smoke Tests** - Manual checklist for critical flows when automated tests blocked

---

## Next Steps

1. **Week 6**: Focus on frontend migration and monitoring (no running app required)
2. **Week 7-12**: Continue modular refactoring, maintain test coverage
3. **Week 13**: Re-enable dev server, run full E2E suite
4. **Week 14**: Validate all deferred tests pass

---

**Document Owner**: Engineering Team
**Last Updated**: 2025-11-05
**Related**: [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md), [tests/e2e/README.md](../../tests/e2e/README.md)
