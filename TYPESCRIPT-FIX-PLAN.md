# Complete TypeScript Error Remediation Plan
## 390 Errors → 0 Errors | Estimated: 18-22 hours

---

## Executive Summary

**Goal**: Fix all 390 TypeScript errors to eliminate type debt
**Timeline**: 3 days (Wed-Fri), deploy Monday
**Strategy**: Systematic root-cause fixes, cascading from foundation up

---

## Phase 1: Database Schema Foundation (2-3 hours)
**Fixes: ~150 errors (TS2339: Property does not exist)**

### 1.1 Analyze Migration Files (30 min)
Find all migration SQL files and extract complete schema for each table.

**Tables to analyze**:
- sites: Need site_name, base_price, weekend_price, hookups, amenities, description
- payments: ENTIRE TABLE missing from Database type
- invoices, transactions, security_deposits: Verify completeness

### 1.2 Update src/contracts/db.ts (2 hours)
Complete the Database interface with ALL fields from migrations.

**Critical additions**:
```typescript
sites: {
  Row: {
    // Add ALL missing fields
    site_name: string | null
    base_price: number
    weekend_price: number | null
    hookups: { water: boolean; electric: boolean; sewer: boolean } | null
    amenities: string[] | null
    description: string | null
    // ... etc
  }
}

payments: {  // ENTIRE TABLE MISSING
  Row: {
    id: string
    reservation_id: string
    amount_cents: number
    payment_method: string
    // ... complete schema
  }
}
```

### 1.3 Verify (5 min)
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Should drop: 390 → ~240
```

**Milestone**: ✅ Database types complete

---

## Phase 2: Error Code Definitions (30 min)
**Fixes: ~25 errors**

### 2.1 Add Missing ErrorCodes to src/lib/api/errors.ts

Missing codes:
- VALIDATION_001, VALIDATION_002, VALIDATION_003
- RESOURCE_001, RESOURCE_004
- SERVER_001
- DUPLICATE_RESOURCE

### 2.2 Verify
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Should be: ~240 → ~215
```

**Milestone**: ✅ All error codes defined

---

## Phase 3: Repository Type Signatures (2 hours)
**Fixes: ~30 errors (SupabaseContext vs SupabaseClient)**

### 3.1 Fix Repository Constructors
Update all repository constructors to accept both types:
```typescript
constructor(private supabase: SupabaseClient | SupabaseContext)
```

### 3.2 Fix Constructor Argument Mismatches
Review each TS2554 error and fix argument count/types.

**Milestone**: ✅ Repository layer type-safe

---

## Phase 4: DTO Signature Fixes (3-4 hours)
**Fixes: ~60 errors**

### 4.1 Common Patterns to Fix

**GetSiteDto**: Expects object not string
```typescript
// Before: execute(siteId)
// After:  execute({ siteId })
```

**UpdateSiteDto**: Missing 'updates' wrapper
**ListSitesDto**: Missing 'filters' property

### 4.2 Systematic Fix
Go through each query/command handler and align call sites with DTO interfaces.

**Milestone**: ✅ DTOs type-safe

---

## Phase 5: Enum Mismatches (1 hour)
**Fixes: ~20 errors**

### 5.1 Add Missing Enum Values

**SiteType**: Add 'other' (it's in schema but not type)
**PropertyType**: Add missing values or use type assertions
**PropertyStatus**: Same as PropertyType

**Milestone**: ✅ Enums aligned with schema

---

## Phase 6: API Routes - null vs undefined (1-2 hours)
**Fixes: ~30 errors (exactOptionalPropertyTypes)**

### 6.1 Convert undefined to null
Pattern:
```typescript
specialRequests: validatedRequest.specialRequests ?? null
notes: validatedRequest.notes ?? null
```

Batch fix common fields across all API routes.

**Milestone**: ✅ API routes type-safe

---

## Phase 7: Test Null Checks (2-3 hours)
**Fixes: ~60 errors**

### 7.1 Add Optional Chaining
```typescript
// Before: site.hookups.water
// After:  site.hookups?.water
```

### 7.2 Add Null Guards
For complex test logic, add proper null checks.

### 7.3 Fix readonly Array Issues
Spread readonly arrays to mutable where needed.

**Milestone**: ✅ Tests type-safe

---

## Phase 8: Cleanup (1-2 hours)
**Fixes: ~15 errors**

### 8.1 Install Missing Packages
```bash
npm install --save-dev @types/uuid
```

### 8.2 Fix Remaining Issues
- Spread type errors
- Abstract class implementations
- Conflicting declarations
- Misc edge cases

**Milestone**: ✅ 0 errors

---

## Verification (30 min)

```bash
# 1. Type check
npx tsc --noEmit  # MUST be 0 errors

# 2. Build
npm run build  # MUST succeed

# 3. Tests
npm run test:run  # All pass

# 4. Lint
npm run lint  # Clean
```

---

## Timeline

**Wednesday (8h)**: Phases 1-3 + partial 4
**Thursday (8h)**: Complete 4, phases 5-7
**Friday (6h)**: Phase 8 + verification + buffer
**Weekend**: Integration testing, polish
**Monday**: Deploy 🚀

Total: ~22 hours work, 5 days buffer

---

## Execution Notes

1. **Commit after each phase** - Create restore points
2. **Verify error count drops** - Track progress
3. **Run tests frequently** - Catch regressions
4. **Document blockers** - Don't get stuck >30min

---

## Ready to Start?

Phase 1 (Database Schema) is the foundation. Once that's fixed, ~150 errors disappear immediately. Let's begin there.
