# Quick Fix Guide - TypeScript Errors

**For detailed analysis, see:** [TYPE_ERROR_REMEDIATION_PLAN.md](./TYPE_ERROR_REMEDIATION_PLAN.md)

---

## TL;DR - Fastest Path to Fix Deployments

**Problem:** 1,461 TypeScript errors blocking Vercel deployments

**Root Cause:** `tsconfig.json` maps `@/*` to `./src/*`, but 99% of code is in root `lib/` and `components/` directories

**Solution:** Update path mapping + fix 3 Next.js route handlers = **1.5 hours** to fix 51.5% of errors

---

## Quick Start (Automated)

### Step 1: Analyze Current State (5 min)

```bash
./scripts/analyze-type-errors.sh
```

This generates a report showing:
- Total error count
- Error breakdown by type
- Most problematic files
- Most common missing modules

### Step 2: Fix Path Mapping (30 min)

```bash
./scripts/fix-phase1-path-mapping.sh
```

This script:
1. ✅ Backs up `tsconfig.json`
2. ✅ Updates `@/*` mapping from `./src/*` to `./*`
3. ⚠️ Lists files with `@/src/` imports (you need to manually fix these)

**Manual step required:**
Replace in listed files:
- `@/src/contracts/db` → `@/contracts/db`
- `@/src/contracts/booking` → `@/contracts/booking`
- `@/src/modules/` → `@/modules/`
- `@/src/shared/` → `@/shared/`

**Result:** Fixes ~749 errors (51.3%)

### Step 3: Fix Next.js Async Params (30 min)

```bash
./scripts/fix-phase2-nextjs-params.sh
```

This script identifies 3 files that need updates.

**Manual changes required:**

```typescript
// BEFORE:
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guestId = params.id
}

// AFTER:
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guestId = id
}
```

**Files to update:**
1. `app/api/v1/guests/[id]/route.ts`
2. `app/api/v1/guests/[id]/stripe/route.ts`
3. `app/api/v1/properties/[propertyId]/guests/route.ts`

**Result:** Fixes 3 errors, unblocks Next.js builds

### Step 4: Verify

```bash
npm run type-check
npm run build
```

**Expected outcome:**
- ✅ TS2307 errors: 0 (was 749)
- ✅ TS2344 errors: 0 (was 3)
- ✅ `npm run build` succeeds
- ⚠️ ~709 errors remain (type safety, not blocking)

---

## Manual Fix (If Scripts Don't Work)

### Fix 1: Update tsconfig.json

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]  // Changed from ["./src/*"]
    }
  }
}
```

### Fix 2: Update @/src/ imports

**Find files:**
```bash
grep -r "from '@/src/" --include="*.ts" --include="*.tsx" app/ lib/ components/ src/
```

**Replace:**
```bash
# Option 1: sed (macOS)
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|@/src/contracts|@/contracts|g"
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|@/src/modules|@/modules|g"
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|@/src/shared|@/shared|g"

# Option 2: Manual find & replace in VS Code
# Cmd+Shift+F → Search: @/src/ → Replace: @/
```

### Fix 3: Update Next.js params (3 files)

See [Step 3](#step-3-fix-nextjs-async-params-30-min) above

---

## After Quick Fix (Optional - Improve Type Safety)

If you want to continue fixing remaining errors:

### Phase 3: Fix Implicit 'any' Types (2 hours)

**High-value targets:**
- `lib/dashboard/queries.ts` (35 errors)
- `components/dashboard/setup-wizard/site-form.tsx` (20 errors)
- `app/dashboard/analytics/page.tsx` (15 errors)

**Common patterns:**
```typescript
// Event handlers
(e) => {...}  →  (e: React.MouseEvent<HTMLButtonElement>) => {...}

// Array methods
.map(item => {...})  →  .map((item: SiteType) => {...})

// Function params
function process(data) {...}  →  function process(data: TableRow[]) {...}
```

### Phase 4: Fix Type Mismatches (3 hours)

Focus on test files:
- `tests/integration/guest-site-integration.test.ts`
- `tests/integration/guest-property-integration.test.ts`

**Common issue:** Mock repositories missing interface methods

### Phase 5: Miscellaneous (2 hours)

- Add null checks for `TS2532` errors
- Fix missing properties for `TS2339` errors
- Export missing types for `TS2724` errors

---

## Verification Commands

```bash
# Check specific error types
npm run type-check 2>&1 | grep "error TS2307" | wc -l  # Cannot find module
npm run type-check 2>&1 | grep "error TS2344" | wc -l  # Next.js params
npm run type-check 2>&1 | grep "error TS7006" | wc -l  # Implicit any

# Full quality checks
npm run check         # Type-check + lint
npm run check:full    # Generate DB types + check + build
npm run test:run      # All tests
npm run build         # Production build
```

---

## Rollback

If something goes wrong:

```bash
# Restore tsconfig.json
cp tsconfig.json.backup.[timestamp] tsconfig.json

# Or git reset
git checkout tsconfig.json
```

---

## Success Criteria

### Minimum (Unblock Deployments)
- [ ] `npm run build` succeeds
- [ ] TS2307 errors = 0
- [ ] TS2344 errors = 0
- [ ] Vercel deployment works

### Full (100% Type Safe)
- [ ] `npm run type-check` shows 0 errors
- [ ] All tests pass
- [ ] No new type errors introduced

---

## Timeline

| Task | Time | Errors Fixed | Cumulative |
|------|------|--------------|------------|
| **Quick Fix (Phases 1-2)** | **1.5 hrs** | **752** | **51.5%** |
| Phase 3: Implicit any | 2 hrs | 188 | 64.3% |
| Phase 4: Type mismatches | 3 hrs | 291 | 84.3% |
| Phase 5: Miscellaneous | 2 hrs | 230 | 100% |
| **Total** | **8.5 hrs** | **1,461** | **100%** |

---

## Getting Help

**If you get stuck:**

1. Check the full plan: [TYPE_ERROR_REMEDIATION_PLAN.md](./TYPE_ERROR_REMEDIATION_PLAN.md)
2. Analyze errors: `./scripts/analyze-type-errors.sh`
3. Check specific error codes in Appendix B of the full plan
4. Create an issue with the error log

**Common issues:**

- **"Cannot find module after tsconfig change"**
  → You still have `@/src/` imports. Run: `grep -r "@/src/" app/ lib/`

- **"Build still failing"**
  → Check for other config files (jest.config, vitest.config) that might have path mappings

- **"Tests failing"**
  → Likely test-specific imports. Check `tests/` directory for `@/src/` usage

---

**Last Updated:** 2025-11-16
**Status:** Ready for execution
**Next Action:** Run `./scripts/analyze-type-errors.sh`
