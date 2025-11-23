# TypeScript Error Remediation Plan

**Document Status:** Active
**Created:** 2025-11-16
**Total Errors:** 1,461
**Priority:** P0 (Blocking Vercel deployments)

---

## Executive Summary

### Error Statistics

| Error Code | Count | Percentage | Description |
|------------|-------|------------|-------------|
| TS2307 | 749 | 51.3% | Cannot find module |
| TS7006 | 188 | 12.9% | Parameter implicitly has 'any' type |
| TS2554 | 161 | 11.0% | Expected N arguments, but got M |
| TS2345 | 130 | 8.9% | Argument not assignable to parameter |
| TS2339 | 65 | 4.5% | Property does not exist on type |
| TS2532 | 47 | 3.2% | Object is possibly 'undefined' |
| TS2724 | 22 | 1.5% | Module has no exported member |
| TS2379 | 22 | 1.5% | Duplicate property name |
| TS2344 | 3 | 0.2% | Type does not satisfy constraint (Next.js params) |
| Others | 74 | 5.0% | Various type errors |

### Root Cause Analysis

**PRIMARY ISSUE: Path Mapping Mismatch**

The project has a fundamental architectural conflict:

```
tsconfig.json:
  "paths": { "@/*": ["./src/*"] }

Actual file structure:
  lib/          (70 files)      <- Legacy code at ROOT level
  components/   (127 files)     <- Legacy code at ROOT level
  src/          (195 files)     <- New DDD modules
```

**Current State:**
- TypeScript resolves `@/` to `./src/*`
- 99% of imports use `@/lib/...` and `@/components/...`
- These files exist at ROOT level (not in `src/`)
- Result: 749 "Cannot find module" errors

**SECONDARY ISSUE: Next.js 15 Breaking Change**

Next.js 15.1.x changed route params from synchronous to asynchronous:

```typescript
// OLD (Next.js 14):
export async function GET(request, { params }: { params: { id: string } }) { ... }

// NEW (Next.js 15.1+):
export async function GET(request, { params }: { params: Promise<{ id: string }> }) { ... }
```

This affects 3 API route files.

---

## Affected Files Analysis

### Top 30 Files by Error Count

| File | Errors | Primary Issue |
|------|--------|---------------|
| tests/integration/guest-site-integration.test.ts | 45 | Missing imports + type errors |
| tests/integration/guest-property-integration.test.ts | 38 | Missing imports + type errors |
| app/ (multiple route.ts files) | 37 | Missing imports |
| lib/dashboard/queries.ts | 35 | Implicit 'any' types |
| components/dashboard/setup-wizard/site-form.tsx | 28 | Missing imports + any types |
| app/api/v1/sites/[id]/route.ts | 25 | Missing imports + params |
| app/dashboard/analytics/page.tsx | 23 | Missing imports + any types |
| app/api/v1/properties/[propertyId]/route.ts | 20 | Missing imports + params |
| components/dashboard/settings/booking-rules-settings.tsx | 19 | Missing imports + any types |
| components/checkout-client.tsx | 17 | Missing imports |
| app/api/v1/properties/[propertyId]/sites/route.ts | 17 | Missing imports |
| components/site-details-client.tsx | 16 | Missing imports |
| components/dashboard/sites/sites-grid.tsx | 16 | Missing imports + any types |
| components/campground-search.tsx | 16 | Missing imports |
| app/dashboard/reservations/new/page.tsx | 16 | Missing imports |
| app/api/v1/properties/[propertyId]/reservations/route.ts | 16 | Missing imports |
| app/api/v1/guests/[id]/route.ts | 16 | Missing imports + params |

### Most Common Missing Modules

| Import Path | Occurrences | Actual Location |
|-------------|-------------|-----------------|
| @/lib/supabase/server | 68 | lib/supabase/server.ts (ROOT) |
| @/components/ui/button | 68 | components/ui/button.tsx (ROOT) |
| @/lib/utils | 54 | lib/utils.ts (ROOT) |
| @/components/ui/card | 46 | components/ui/card.tsx (ROOT) |
| @/lib/supabase/service-role | 33 | lib/supabase/service-role.ts (ROOT) |
| @/components/ui/badge | 31 | components/ui/badge.tsx (ROOT) |
| @/components/ui/alert | 30 | components/ui/alert.tsx (ROOT) |
| @/lib/booking/types | 24 | lib/booking/types.ts (ROOT) |
| @/src/contracts/db | 7 | src/contracts/db.ts (CORRECT) |
| @/src/contracts/booking | 5 | src/contracts/booking.ts (CORRECT) |

**Key Observation:** Only imports with `@/src/...` work correctly. All `@/lib/...` and `@/components/...` fail.

---

## Remediation Options

### Option 1: Update tsconfig Path Mapping (RECOMMENDED)

**Approach:** Change `tsconfig.json` to map `@/*` to root instead of `./src/*`

**Pros:**
- Minimal code changes (only imports using `@/src/...`)
- Matches existing import patterns in 99% of files
- Low risk of introducing bugs
- Can be completed in 1-2 hours
- Aligns with standard Next.js conventions

**Cons:**
- Deviates from intended DDD structure (src/ as primary)
- May complicate future migration to full src/ structure
- Need to update ~12 imports from `@/src/...` to `@/...`

**Implementation:**
1. Update `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```

2. Update imports using `@/src/`:
   ```bash
   # Find all @/src/ imports
   grep -r "from '@/src/" --include="*.ts" --include="*.tsx"

   # Replace with @/
   @/src/contracts/db → @/contracts/db
   @/src/contracts/booking → @/contracts/booking
   @/src/modules/... → @/modules/...
   @/src/shared/... → @/shared/...
   ```

3. Fix Next.js 15 async params (3 files)
4. Fix implicit 'any' types in critical files
5. Verify build: `npm run type-check`

**Estimated Time:** 2-3 hours

---

### Option 2: Move Files to src/ Directory

**Approach:** Move `lib/` and `components/` into `src/` to match path mapping

**Pros:**
- Aligns with intended DDD architecture
- All code in one directory (`src/`)
- Future-proof structure
- No import path changes needed in most files

**Cons:**
- HIGH RISK: Moving 197 files (70 lib + 127 components)
- May break git history/blame
- Requires updating relative imports within moved files
- Risk of breaking production if missed references
- Likely to cause merge conflicts with other branches
- Estimated 8-12 hours of work + testing

**Implementation:**
1. Move files:
   ```bash
   mv lib src/lib
   mv components src/components
   ```

2. Update internal relative imports (files referencing siblings)
3. Update any hardcoded paths in configs
4. Fix Next.js 15 async params
5. Fix implicit 'any' types
6. Extensive testing required

**Estimated Time:** 8-12 hours + testing

---

### Option 3: Dual Path Mapping (Hybrid)

**Approach:** Add multiple path mappings to support both structures

**Pros:**
- No code movement required
- No import changes required
- Supports gradual migration
- Zero risk of breaking existing code

**Cons:**
- Confusing for developers (which path to use?)
- Doesn't solve the architectural issue
- Technical debt remains
- May cause issues with some bundlers/tools

**Implementation:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/lib/*": ["./lib/*"],
      "@/components/*": ["./components/*"],
      "@/src/*": ["./src/*"],
      "@/modules/*": ["./src/modules/*"],
      "@/contracts/*": ["./src/contracts/*"]
    }
  }
}
```

**Estimated Time:** 1 hour

---

## Recommended Approach

**RECOMMENDATION: Option 1 (Update tsconfig Path Mapping)**

**Rationale:**
1. Fastest path to unblock deployments (2-3 hours)
2. Lowest risk of introducing regressions
3. Matches existing codebase conventions (99% of imports)
4. Can migrate to Option 2 later in a dedicated refactor
5. Project is already in a "modular monolith" architecture, not pure DDD

**Migration can happen later:** The team can plan a proper migration to full `src/` structure in a future sprint when:
- All active feature branches are merged
- Team has dedicated time for testing
- Can coordinate with all contributors

---

## Step-by-Step Remediation Plan

### Phase 1: Fix Path Mapping (Priority: P0)

**Time Estimate:** 1 hour

1. **Update tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```

2. **Find and replace @/src/ imports** (12 occurrences)
   ```bash
   # Files affected:
   - lib/dashboard/queries.ts (2 imports)
   - app/api/v1/guests/[id]/route.ts (5 imports)
   - app/api/v1/properties/[propertyId]/guests/route.ts (5 imports)
   - tests/integration/middleware*.test.ts (multiple)
   ```

   Replace:
   - `@/src/contracts/db` → `@/contracts/db`
   - `@/src/contracts/booking` → `@/contracts/booking`
   - `@/src/modules/` → `@/modules/`
   - `@/src/shared/` → `@/shared/`
   - `@/src/types/` → `@/types/`

3. **Verify:**
   ```bash
   npm run type-check 2>&1 | grep "error TS2307" | wc -l
   # Should be 0
   ```

---

### Phase 2: Fix Next.js 15 Async Params (Priority: P0)

**Time Estimate:** 30 minutes

**Files to Update (3 total):**
1. `app/api/v1/guests/[id]/route.ts`
2. `app/api/v1/guests/[id]/stripe/route.ts`
3. `app/api/v1/properties/[propertyId]/guests/route.ts`

**Change Pattern:**
```typescript
// BEFORE:
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guestId = params.id
  // ...
}

// AFTER:
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // Await the params promise
  const guestId = id
  // ...
}
```

**Verify:**
```bash
npm run type-check 2>&1 | grep "error TS2344" | wc -l
# Should be 0
```

---

### Phase 3: Fix Implicit 'any' Types (Priority: P1)

**Time Estimate:** 1-2 hours

**High-Value Files** (biggest impact):
1. `lib/dashboard/queries.ts` (35 errors)
2. `components/dashboard/setup-wizard/site-form.tsx` (20 errors)
3. `app/dashboard/analytics/page.tsx` (15 errors)
4. `components/dashboard/sites/sites-grid.tsx` (8 errors)

**Common Patterns:**

```typescript
// Pattern 1: Event handlers
// BEFORE:
const handleClick = (e) => { ... }

// AFTER:
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }

// Pattern 2: Array methods
// BEFORE:
data.map(item => { ... })

// AFTER:
data.map((item: SiteType) => { ... })

// Pattern 3: Supabase query results
// BEFORE:
const processData = (data) => { ... }

// AFTER:
const processData = (data: Database['public']['Tables']['sites']['Row'][]) => { ... }
```

**Verify:**
```bash
npm run type-check 2>&1 | grep "error TS7006" | wc -l
# Target: < 50
```

---

### Phase 4: Fix Argument Type Mismatches (Priority: P1)

**Time Estimate:** 2-3 hours

**Focus Areas:**
1. Test files (integration tests with mock repositories)
2. Repository method signatures
3. API route handlers

**Common Issues:**

```typescript
// Issue: Mock repository missing methods from interface
// BEFORE:
class MockGuestRepository {
  async findById(id: string) { ... }
}

// AFTER:
class MockGuestRepository implements IGuestRepository {
  async findById(id: string) { ... }
  async findByStripeCustomerId(id: string) { ... }
  async exists(id: string) { ... }
}
```

**Files to Update:**
- `tests/integration/guest-site-integration.test.ts` (45 errors)
- `tests/integration/guest-property-integration.test.ts` (38 errors)
- `src/modules/*/domain/__tests__/*.test.ts`

**Verify:**
```bash
npm run type-check 2>&1 | grep "error TS2345\|error TS2554" | wc -l
# Target: 0
```

---

### Phase 5: Fix Miscellaneous Type Errors (Priority: P2)

**Time Estimate:** 1-2 hours

**Categories:**
1. **TS2532 (possibly undefined)** - 47 errors
   - Add null checks or use optional chaining
   - Add type guards

2. **TS2339 (property does not exist)** - 65 errors
   - Fix type definitions
   - Add missing properties to interfaces

3. **TS2724 (no exported member)** - 22 errors
   - Fix import statements
   - Export missing types

**Verify:**
```bash
npm run type-check
# Target: 0 errors
```

---

## Validation Checklist

After each phase:

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run test:run` passes
- [ ] `npm run build` succeeds
- [ ] Manual testing of key workflows:
  - [ ] Guest booking flow
  - [ ] Dashboard property creation
  - [ ] Reservation management
  - [ ] Analytics dashboard

---

## Risk Assessment

### Low Risk (Phases 1-2)
- **Impact:** Fixes 752 errors (51.5%)
- **Risk:** Very Low
- **Reason:** Only import path changes, no logic changes
- **Rollback:** Simple revert of tsconfig.json

### Medium Risk (Phases 3-4)
- **Impact:** Fixes ~500 errors (34.2%)
- **Risk:** Medium
- **Reason:** Type signature changes may reveal hidden bugs
- **Mitigation:**
  - Comprehensive test suite exists
  - Type errors often catch real bugs
  - Changes are additive (adding types, not removing)

### Low Risk (Phase 5)
- **Impact:** Fixes ~209 errors (14.3%)
- **Risk:** Low-Medium
- **Reason:** Mostly defensive programming (null checks)
- **Mitigation:** Existing RLS and validation layers

---

## Timeline Estimate

| Phase | Time | Completion | Cumulative Errors Fixed |
|-------|------|------------|-------------------------|
| Phase 1: Path Mapping | 1 hour | 1 hour | ~749 (51.3%) |
| Phase 2: Next.js Params | 30 min | 1.5 hours | ~752 (51.5%) |
| Phase 3: Implicit Any | 2 hours | 3.5 hours | ~940 (64.3%) |
| Phase 4: Type Mismatches | 3 hours | 6.5 hours | ~1,231 (84.3%) |
| Phase 5: Miscellaneous | 2 hours | 8.5 hours | ~1,461 (100%) |
| **Total** | **8.5 hours** | | **1,461 errors** |

**Critical Path to Unblock Deployments:**
- Phases 1-2 only: 1.5 hours → 752 errors fixed (51.5%)
- Remaining errors won't block builds (mostly strict mode warnings)

---

## Success Metrics

### Minimum Success Criteria (Unblock Deployments)
- [ ] `npm run build` succeeds
- [ ] Zero TS2307 errors (cannot find module)
- [ ] Zero TS2344 errors (Next.js params)
- [ ] Vercel deployment succeeds

### Full Success Criteria
- [ ] Zero TypeScript errors
- [ ] All tests passing
- [ ] No degradation in type safety
- [ ] Developer experience improved (faster IntelliSense)

---

## Post-Remediation Actions

1. **Update CLAUDE.md**
   - Document new path mapping convention
   - Add guidelines for future imports

2. **Add Pre-commit Hook**
   ```bash
   # Already exists in Husky, but ensure enabled:
   npm run type-check
   ```

3. **Document Architecture Decision**
   - Add ADR (Architecture Decision Record) explaining:
     - Why @/* maps to root
     - Future migration plan to src/
     - Rationale for hybrid structure during transition

4. **Team Communication**
   - Notify team of import path convention
   - Update onboarding documentation
   - Add examples to contribution guide

---

## Future Migration Path (Optional)

**When to Consider Full src/ Migration:**

Triggers:
- All feature branches merged to main
- Team has 2-3 day sprint dedicated to refactor
- Risk of breaking changes is acceptable
- Want to enforce strict DDD boundaries

**Migration Steps:**
1. Create migration branch
2. Move lib/ → src/lib/
3. Move components/ → src/components/
4. Update tsconfig back to `"@/*": ["./src/*"]`
5. Update any relative imports
6. Comprehensive E2E testing
7. Gradual rollout with feature flag

**Estimated Effort:** 2-3 days + 1 week monitoring

---

## Appendix A: Command Reference

### Analyze Errors
```bash
# Generate fresh error log
npm run type-check 2>&1 | tee type-errors.txt

# Count by error code
grep -oE "error TS[0-9]+" type-errors.txt | sort | uniq -c | sort -rn

# Find most problematic files
grep "error TS" type-errors.txt | sed 's/(.*//' | sort | uniq -c | sort -rn

# Find missing modules
grep "error TS2307" type-errors.txt | grep -oE "'@/[^']+'" | sort | uniq -c | sort -rn
```

### Fix Specific Error Types
```bash
# Find all @/src/ imports (need replacement)
grep -r "from '@/src/" --include="*.ts" --include="*.tsx" app/ lib/ components/ src/

# Find Next.js route handlers with params
grep -r "{ params }" --include="route.ts" app/api/

# Find implicit any in event handlers
grep -r "= (e) =>" --include="*.tsx" components/
```

### Verification
```bash
# Full quality check
npm run check:full

# Individual checks
npm run type-check
npm run lint
npm run test:run
npm run build
```

---

## Appendix B: Error Code Reference

| Code | Description | Common Cause | Fix Strategy |
|------|-------------|--------------|--------------|
| TS2307 | Cannot find module | Wrong path mapping | Update tsconfig or move files |
| TS7006 | Implicit any | Missing type annotations | Add explicit types |
| TS2554 | Wrong argument count | Function signature mismatch | Update call sites or signature |
| TS2345 | Type not assignable | Type incompatibility | Fix type definitions |
| TS2339 | Property doesn't exist | Missing property in type | Add to interface or type guard |
| TS2532 | Possibly undefined | Null safety | Add null check or non-null assertion |
| TS2344 | Type constraint violation | Generic constraint failed | Fix generic parameters |
| TS2724 | No exported member | Import non-existent export | Fix import or export |

---

**Document Prepared By:** Claude Code Analysis
**Review Status:** Pending Team Review
**Next Action:** Approve recommended approach and begin Phase 1
