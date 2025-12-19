# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ CRITICAL: Customer Testing Phase (Active)

**Status**: First customer actively testing in production
**Priority**: Stability, quality, and attention to detail

### Non-Negotiable Requirements During This Phase

1. **READ THIS ENTIRE FILE** before making any changes
2. **NO references to Claude, Anthropic, or AI** in commits, code comments, or user-facing content
3. **Test every change** before committing - `npm run check` minimum
4. **No experimental changes** - only implement exactly what's requested
5. **Verify fixes work** - don't assume, confirm
6. **Document breaking changes** in commit messages

### Quality Checklist (Before Every Commit)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Changes tested manually in browser
- [ ] Commit message follows Conventional Commits
- [ ] NO Claude/Anthropic/AI references in commit

---

## Project Overview

Camp-OS is a campground management SaaS platform built with Next.js 16, Supabase (PostgreSQL), Stripe, and TypeScript. The application handles reservations, payments, property management, and guest operations for campground owners.

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Supabase, Stripe, TailwindCSS, Shadcn/UI
**Testing**: Vitest, Testing Library, Playwright
**Architecture**: Modular monolith (migration complete for core modules)

---

## ⚠️ Development Request Classification (REQUIRED)

**Before writing ANY code**, classify the request type and route to the correct architecture.

### Step 1: Identify Request Type

Ask yourself (or the user if unclear):

| Type | Description | Examples |
|------|-------------|----------|
| **🐛 Bug Fix** | Existing functionality broken | "Payments failing", "Wrong date displayed" |
| **✨ Enhancement** | Improve existing feature | "Add sorting to reservations list", "Improve error messages" |
| **🆕 New Feature** | Entirely new functionality | "Add staff management", "Add reporting dashboard" |
| **♻️ Refactor** | Restructure without behavior change | "Move to modules", "Improve types" |

### Step 2: Route to Correct Location

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Where does this code go?                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Is this a NEW API endpoint or NEW domain logic?                        │
│      YES → src/modules/{ModuleName}/  (see M-1 through M-5)             │
│      NO  ↓                                                               │
│                                                                          │
│  Is this a bug fix in existing code?                                    │
│      YES → Fix where the bug lives (don't migrate as part of fix)       │
│      NO  ↓                                                               │
│                                                                          │
│  Is this enhancing an existing module feature?                          │
│      YES → Enhance in src/modules/{ModuleName}/                         │
│      NO  ↓                                                               │
│                                                                          │
│  Is this a UI component?                                                │
│      YES → components/ or app/ (Next.js conventions)                    │
│      NO  ↓                                                               │
│                                                                          │
│  Is this shared utility used by 2+ modules?                             │
│      YES → src/shared/ or lib/ (see O-1)                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 3: Verify Module Ownership

For module work, identify which module owns this functionality:

| Domain Area | Module | Key Entities |
|-------------|--------|--------------|
| Reservations, availability, check-in/out | `BookingEngine` | Reservation |
| Company/tenant management, subscriptions | `CompanyManagement` | Company |
| Invoices, payments, refunds, deposits | `Financial` | Invoice, Transaction, PaymentPlan |
| Guest profiles, contact info | `GuestManagement` | Guest |
| Property settings, configuration | `PropertyManagement` | Property |
| Sites, pricing, amenities | `SiteManagement` | Site |
| Staff roles, permissions (RBAC) | `StaffManagement` | PropertyStaff |

**If unclear which module**: Ask the user before proceeding.

### ⛔ Anti-Patterns to Avoid

- **R-1 (MUST NOT)** Add new code to `lib/booking/` — this is legacy, scheduled for deletion
- **R-2 (MUST NOT)** Create new files in `lib/` for domain logic — use `src/modules/`
- **R-3 (MUST NOT)** Put business logic in API routes — routes should only: validate, call handlers, format responses
- **R-4 (MUST NOT)** Skip the module structure for "quick fixes" — tech debt compounds
- **R-5 (MUST NOT)** Create a new module without discussing with user first (M-5)

### Questions to Ask User (When Unclear)

If the request is ambiguous, ask:

1. "Is this fixing broken functionality or adding new capability?"
2. "Which existing feature does this relate to?" (helps identify module)
3. "Should this work for all properties, or is it property-specific?" (tenant scope)
4. "Is this user-facing or internal/admin only?" (helps with risk classification)

---

## Commands

### Development
```bash
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm start                # Serve production build
npm run gen:db           # Generate Supabase types to src/contracts/db.ts
```

### Testing
```bash
npm test                         # Watch mode (Vitest)
npm run test:run                 # Run all tests once
npm test -- path/to/file.test.ts # Run specific test file
npm run test:coverage            # Coverage report
npm run test:integration         # Integration tests only
npm run test:e2e                 # Playwright E2E tests
npm run test:e2e:ui              # E2E with UI
npm run test:email               # Preview email templates
```

### Quality Checks
```bash
npm run lint                   # ESLint
npm run type-check             # TypeScript check
npm run check                  # Lint + type-check
npm run check:full             # Generate DB types + check + build
```

---

## Implementation Best Practices

### 0 — Purpose
These rules ensure maintainability, safety, and developer velocity.
**MUST** rules are non-negotiable; **SHOULD** rules are strongly recommended.

---

### 1 — Before Coding

- **BP-1 (MUST)** Ask the user clarifying questions for ambiguous requirements
- **BP-2 (SHOULD)** Draft and confirm an approach for complex work before implementing
- **BP-3 (SHOULD)** If ≥2 approaches exist, list clear pros/cons for each
- **BP-4 (MUST)** Always enforce multi-tenant isolation in database queries (see Multi-Tenant section)

---

### 2 — While Coding

- **C-1 (MUST)** Follow TDD for CRITICAL/HIGH risk code: scaffold stub → write failing test → implement → refactor
- **C-2 (MUST)** Name functions using existing domain vocabulary for consistency (e.g., `reservation`, `site`, `guest`, not generic terms)
- **C-3 (SHOULD NOT)** Introduce classes when small testable functions suffice
- **C-4 (SHOULD)** Prefer simple, composable, testable functions over complex monoliths
- **C-5 (MUST)** Use branded `type`s for domain IDs:
  ```typescript
  type UserId = Brand<string, 'UserId'>     // ✅ Good
  type UserId = string                      // ❌ Bad
  ```
- **C-6 (MUST)** Use `import type { ... }` for type-only imports
- **C-7 (SHOULD NOT)** Add comments except for critical caveats; rely on self-explanatory code
- **C-8 (SHOULD)** Default to `type`; use `interface` only when more readable or interface merging is required
- **C-9 (SHOULD NOT)** Extract a new function unless:
  - It will be reused elsewhere
  - It's the only way to unit-test otherwise untestable logic
  - It drastically improves readability of an opaque block

---

### 3 — Testing

- **T-1 (MUST)** Colocate unit tests as `*.test.ts` in same directory as source file
- **T-2 (MUST)** For API route changes, add/extend integration tests in `tests/integration/`
- **T-3 (MUST)** ALWAYS separate pure-logic unit tests from DB-touching integration tests
- **T-4 (SHOULD)** Prefer integration tests over heavy mocking
- **T-5 (SHOULD)** Unit-test complex algorithms thoroughly
- **T-6 (SHOULD)** Test entire structure in one assertion if possible:
  ```typescript
  expect(result).toEqual([value])  // ✅ Good

  expect(result).toHaveLength(1)   // ❌ Bad
  expect(result[0]).toBe(value)    // ❌ Bad
  ```
- **T-7 (MUST)** Parameterize test inputs; never embed unexplained literals (e.g., `42`, `"foo"`)
- **T-8 (MUST)** Ensure test description states exactly what the final `expect` verifies
- **T-9 (SHOULD)** Use strong assertions over weaker ones:
  ```typescript
  expect(x).toEqual(1)                  // ✅ Good
  expect(x).toBeGreaterThanOrEqual(1)  // ❌ Bad (unless boundary is the point)
  ```
- **T-10 (SHOULD)** Test edge cases, realistic input, unexpected input, and value boundaries
- **T-11 (SHOULD NOT)** Test conditions that are caught by the type checker
- **T-12 (MUST)** Group unit tests under `describe(functionName, () => ...)`
- **T-13 (SHOULD)** Use `expect.any(...)` for non-deterministic values (e.g., generated IDs, timestamps)

---

### 4 — Database

- **D-1 (MUST)** Type Supabase helpers as `SupabaseClient | SupabaseClient['from']` to support both direct and transaction usage
- **D-2 (MUST)** Always include tenant isolation filter (`company_id` or `property_id`) in WHERE clauses
- **D-3 (MUST)** Rely on Row-Level Security (RLS) policies as defense-in-depth, but never skip explicit tenant filters in application code
- **D-4 (SHOULD)** Override incorrect generated types if needed (document in code comments why)

---

### 5 — Code Organization

- **O-1 (MUST)** Place shared code in `lib/` only if used by ≥2 modules
- **O-2 (MUST)** New domain logic goes in `src/modules/` — NOT in `lib/`
- **O-3 (SHOULD)** Follow existing directory structure:
  - `src/modules/` - **Domain modules (DDD architecture)** ← NEW CODE GOES HERE
  - `src/shared/` - Cross-cutting infrastructure (logging, events, container)
  - `lib/middleware/` - Request middleware
  - `lib/email/` - Email templates and sending
  - `lib/api/` - API response helpers
  - `lib/supabase/` - Database client utilities
  - `components/` - UI components
  - `app/api/` - API routes (thin layer calling module handlers)
  - ~~`lib/booking/`~~ - **⚠️ LEGACY - Do not add new code here (R-1)**

---

### 6 — Tooling Gates

- **G-1 (MUST)** `npm run lint` passes
- **G-2 (MUST)** `npm run type-check` passes
- **G-3 (SHOULD)** `npm run test:run` passes before pushing

---

### 7 — Git

- **GH-1 (MUST)** Use Conventional Commits format: https://www.conventionalcommits.org/en/v1.0.0
  ```
  feat(booking): add refund validation
  fix(auth): resolve tenant isolation bug
  test(payment): add edge cases for negative amounts
  ```
- **GH-2 (MUST)** ⛔ **NEVER** include ANY of the following in commit messages:
  - References to Claude, Anthropic, or any AI assistant
  - "Generated with" footers or signatures
  - "Co-Authored-By" lines referencing AI
  - Links to claude.ai or anthropic.com
  - Emojis like 🤖 that suggest AI generation

  **Why**: This is a customer-facing product. AI attribution in git history is unprofessional.

- **GH-3 (MUST)** Husky pre-commit enforces `npm run type-check`
- **GH-4 (MUST)** Verify the commit succeeded and review the commit message before considering work complete

---

## Architecture

### Multi-Tenant SaaS Model
The application enforces strict **tenant isolation** at multiple layers:
- **Companies** are the top-level tenant (subscription holder)
- **Properties** belong to companies (campgrounds)
- **Sites** belong to properties (individual campsites)
- **Reservations** are scoped to properties
- **Row-Level Security (RLS)** enforced in Supabase

**CRITICAL (BP-4)**: Always include tenant context (`company_id` or `property_id`) in database queries:

```typescript
// ✅ CORRECT - Tenant isolated
const { data } = await supabase
  .from('reservations')
  .select('*')
  .eq('property_id', propertyId)  // Tenant filter

// ❌ WRONG - Missing tenant filter (security issue)
const { data } = await supabase
  .from('reservations')
  .select('*')
```

See `lib/middleware/tenant.ts` for the tenant resolution system.

### Middleware Composition System
Located in `lib/middleware/`, this system provides:
- **Composable middleware** via `compose.ts` - chain multiple middleware functions
- **Tenant resolution** (`tenant.ts`) - resolve company/property context
- **Authentication** (`auth.ts`) - verify user session
- **Loop detection** (`loop-detector.ts`) - prevent redirect loops
- **Structured logging** (`logger.ts`) - correlation IDs, tenant context

Middleware functions follow a **single responsibility** pattern (C-4). Each middleware adds context to `request.middlewareContext` and returns a result type (e.g., `TenantResult`, `AuthResult`) without handling redirects directly.

### Booking System Architecture

> ⚠️ **LEGACY NOTICE**: The `lib/booking/` code is being phased out. New booking functionality should be added to `src/modules/BookingEngine/`. See "Development Request Classification" section.

**Current architecture (`src/modules/BookingEngine/`):**
- `domain/Reservation.ts` - Aggregate root with business logic
- `domain/policies/` - Confirmation policies (payment rules)
- `domain/services/` - AvailabilityService, PricingCalculator
- `application/commands/` - Write operations (create, modify, cancel, etc.)
- `application/queries/` - Read operations
- `infrastructure/` - Supabase repository implementation

**Legacy code (`lib/booking/`) — DO NOT ADD NEW CODE HERE:**
- `reservation.ts`, `pricing.ts`, `availability.ts`, `check-in.ts`, `actions.ts`
- Will be deleted after API consolidation (Phase 4)

The booking system uses explicit success/error return types instead of throwing exceptions.

### API Routes Structure

API routes follow Next.js App Router conventions in `app/api/`:
- **`v1/`** - Versioned API using module handlers ← **NEW ENDPOINTS GO HERE**
- **`guest/`** - Public APIs for guest booking (no auth required)
- **`admin/`** - Property manager APIs (auth required)
- **`webhooks/`** - External service webhooks (Stripe)

**Route Implementation Pattern (R-3):**
```typescript
// app/api/v1/{resource}/route.ts
export async function POST(request: NextRequest) {
  // 1. Auth check
  // 2. Tenant isolation (BP-4)
  // 3. Validate request body with Zod schema
  // 4. Call module command handler
  // 5. Return DTO response
}
```

Routes should be thin — business logic lives in module handlers, not routes.

All API routes enforce **multi-tenant isolation** (BP-4, D-2) and return consistent response structures.

### Database Layer
- **Generated types** in `src/contracts/db.ts` (run `npm run gen:db` after schema changes)
- **Direct Supabase client** usage (no ORM)
- **Row-Level Security (RLS)** policies enforce tenant isolation (D-3)
- **Service role client** (`lib/supabase/service-role.ts`) used for admin operations that bypass RLS

### Modular Architecture (DDD)

**Location:** `src/modules/`

**M-1 (MUST)** All domain modules MUST follow this exact structure:

```
src/modules/{ModuleName}/
├── domain/
│   ├── {Entity}.ts              # Aggregate root entity
│   ├── I{Entity}Repository.ts   # Repository interface
│   ├── events/
│   │   ├── {Event}Event.ts      # Domain events
│   │   └── index.ts             # Barrel export
│   ├── value-objects/
│   │   └── {ValueObject}.ts     # Value objects
│   └── __tests__/
│       └── {Entity}.test.ts     # Domain unit tests
├── application/
│   ├── commands/
│   │   └── {Action}Command.ts   # Write operations
│   ├── queries/
│   │   └── {Query}Query.ts      # Read operations
│   └── DTOs/
│       └── {Entity}DTO.ts       # Data transfer objects
├── infrastructure/
│   ├── Supabase{Entity}Repository.ts  # Repository implementation
│   └── __tests__/
│       └── Supabase{Entity}Repository.test.ts
└── index.ts                     # Barrel export (REQUIRED)
```

**M-2 (MUST)** Every module MUST have a barrel export (`index.ts`):

```typescript
// src/modules/{ModuleName}/index.ts

// Domain
export * from './domain/{Entity}'
export * from './domain/I{Entity}Repository'
export * from './domain/events'
export type * from './domain/value-objects/{ValueObject}'

// Application
export * from './application/commands/{Action}Command'
export * from './application/queries/{Query}Query'
export type * from './application/DTOs/{Entity}DTO'

// Infrastructure (only repository implementations)
export { Supabase{Entity}Repository } from './infrastructure/Supabase{Entity}Repository'
```

**M-3 (MUST)** Do NOT create variations of this structure:
- No `domain/aggregates/` - put aggregates directly in `domain/`
- No `domain/repositories/` - repository interfaces go in `domain/` root
- No ad-hoc `__tests__/` placement - tests go in designated locations only
- No extra folders without updating this spec first

**M-4 (MUST)** Domain persistence methods MUST match database schema exactly:
- `toPersistence()` output keys must match `src/contracts/db.ts` column names
- `fromPersistence()` input must handle actual database column names
- Add schema validation tests for any entity with persistence methods

**M-5 (MUST)** Before creating a new module:
1. Verify it doesn't duplicate existing module functionality
2. Use the module generator (when available): `npm run generate:module {ModuleName}`
3. If generator unavailable, copy structure from a conforming module exactly

**Existing Modules:**
- `BookingEngine` - Reservations, availability, check-in/out, confirmation policies
- `CompanyManagement` - Company/tenant management, subscriptions
- `Financial` - Invoices, payments, transactions, security deposits
- `GuestManagement` - Guest profiles, contact info
- `PropertyManagement` - Property settings, configuration
- `SiteManagement` - Campsite definitions, pricing, availability
- `StaffManagement` - Property staff, roles, permissions (RBAC)

**Reference:** `docs/implementation-plan-modular-architecture.md`

---

## Test-Driven Development (TDD) Methodology

### ⚠️ Classification Required Before Implementation (C-1)

When implementing features, **classify risk level** and **ask user for TDD confirmation** before proceeding.

### Risk Classification (Auto-detect from file path)

#### 🔴 CRITICAL (100% coverage, TDD REQUIRED)
**Patterns**: `**/payment/**`, `**/stripe/**`, `**/booking/reservation.ts`, `**/booking/pricing.ts`, `**/api/guest/**`, `**/api/webhooks/**`, `**/middleware/tenant.ts`, `**/auth/**`

**Why**: Revenue impact, security vulnerabilities, data corruption risk

#### 🟠 HIGH (90% coverage, TDD REQUIRED)
**Patterns**: `**/api/admin/**`, `**/api/v1/**`, `**/booking/availability.ts`, `**/booking/check-in.ts`, `**/booking/actions.ts`, `**/email/**`, `**/config/schemas.ts`, `**/middleware/**`

**Why**: User-facing errors, business logic enforcement, data integrity

#### 🟡 MEDIUM (70% coverage, test after)
**Patterns**: `components/**/*.tsx`, `**/analytics/**`, `**/dashboard/**`

**Why**: Degraded UX if broken, not revenue-blocking

#### 🟢 LOW (50% coverage, smoke tests)
**Patterns**: `**/constants/**`, `**/utils.ts`, `**/types.ts`

**Why**: Pure functions, no side effects

#### 🔵 EXPERIMENTAL (0% coverage, no tests)
**Detect if**: File contains `// @experimental` comment or path includes `/experimental/`

### TDD Workflow

#### Step 1: Classify and Ask User (BP-1, BP-2)

```
User: "Add payment refund API"

Your Response:
"I've classified this as 🔴 CRITICAL (payment processing).

Risk factors:
- File path: app/api/v1/payments/[id]/refund/route.ts
- Involves financial transactions
- Direct revenue impact

TDD methodology requires test-first development (C-1):
1. Write failing tests first (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor with confidence

Should I proceed with TDD? [Yes/No/Different approach]"
```

For MEDIUM/LOW risk, inform and proceed:
```
"This is 🟡 MEDIUM risk (dashboard feature).
I'll implement first, then add tests. Coverage target: 70%"
```

#### Step 2: RED Phase (If TDD Confirmed)

Create test file first (T-1), show failing test:

```typescript
I'm creating the test file first:

File: lib/booking/payment/refund.test.ts

import { describe, test, expect } from 'vitest'
import { processRefund } from './refund'

describe('processRefund', () => {  // T-12: Group by function name
  test('should reject refund exceeding original amount', async () => {
    // T-7: Parameterized inputs
    const originalAmount = 10000
    const refundAmount = 15000

    const result = await processRefund({
      reservationId: 'res-123',
      amount: refundAmount,
      originalAmount,
    })

    // T-9: Strong assertion
    expect(result.success).toBe(false)
    expect(result.error.code).toBe('REFUND_EXCEEDS_ORIGINAL')
  })
})

⚠️ Test will FAIL - processRefund() doesn't exist yet (expected in RED phase).

Ready for GREEN phase?
```

#### Step 3: GREEN Phase

Implement minimal code to pass:

```typescript
File: lib/booking/payment/refund.ts

export async function processRefund(input: RefundInput) {
  if (input.amount > input.originalAmount) {
    return {
      success: false,
      error: { code: 'REFUND_EXCEEDS_ORIGINAL' }
    }
  }
  // ... minimal implementation
}

✅ Test PASSES!

Next steps:
1. Add edge case tests (negative amounts, zero, etc.)? (T-10)
2. Add integration tests with database? (T-2)
3. Proceed to REFACTOR phase?
```

#### Step 4: REFACTOR Phase

Suggest improvements while maintaining test coverage (C-4, C-9).

### Testing Best Practices

**DO**:
- Use dynamic test data (helpers in `lib/booking/test-utils/`) (T-7)
- Mock external services (Stripe, email) (T-4)
- Test edge cases and error paths (T-10)
- Follow existing test patterns
- Separate unit from integration tests (T-3)

**DON'T**:
- Hardcode dates or UUIDs (T-7)
- Skip tests for critical code
- Commit `test.only` or `test.skip`
- Test type-checker conditions (T-11)

### Coverage Targets
- **CRITICAL**: 100% line + branch
- **HIGH**: 90%
- **MEDIUM**: 70%
- **LOW**: 50%
- **EXPERIMENTAL**: 0% until promoted

---

## Writing Functions Checklist (C-2, C-4, C-9)

When evaluating a function you implemented, ask:

1. Can you read the function and HONESTLY easily follow what it's doing? If yes, stop here.
2. Does the function have very high cyclomatic complexity? If yes, simplify.
3. Are there common data structures/algorithms that would make this easier? (parsers, trees, stacks/queues)
4. Are there unused parameters?
5. Are there unnecessary type casts that can be moved to function arguments?
6. Is the function easily testable without mocking core features? If not, can it be tested via integration?
7. Does it have hidden untested dependencies that can be factored into arguments?
8. Brainstorm 3 better function names consistent with rest of codebase.

**IMPORTANT (C-9)**: Do NOT refactor out a separate function unless:
- The refactored function is used in >1 place
- It's the only way to unit-test otherwise untestable logic
- The original function is extremely hard to follow

---

## Writing Tests Checklist (T-1 through T-13)

When evaluating a test you implemented, verify:

1. ✅ Parameterized inputs; no unexplained literals (T-7)
2. ✅ Test can fail for a real defect (no trivial asserts)
3. ✅ Test description states exactly what the final expect verifies (T-8)
4. ✅ Compare to independent expectations, not function output re-used as oracle
5. ✅ Follow same lint/type-safety/style rules as prod code
6. ✅ Express invariants/axioms when practical (commutativity, idempotence, round-trip)
7. ✅ Tests grouped under `describe(functionName, ...)` (T-12)
8. ✅ Use `expect.any(...)` for non-deterministic values (T-13)
9. ✅ Strong assertions over weak (T-9)
10. ✅ Test edge cases, realistic/unexpected input, boundaries (T-10)
11. ✅ Don't test type-checker conditions (T-11)

---

## Test Effectiveness Requirements (MANDATORY)

**Test count is a vanity metric.** Tests must catch real bugs. Apply these rules to every test suite:

### TE-1 (MUST) Mutation Testing Mindset

For each test, ask: "If I broke the code in an obvious way, would this test fail?"

```typescript
// ❌ BAD: Test passes even if implementation is wrong
test('creates reservation', () => {
  const result = createReservation(input)
  expect(result).toBeDefined()  // Proves nothing
})

// ✅ GOOD: Test fails if business logic breaks
test('creates reservation with correct total from nightly rate × nights', () => {
  const result = createReservation({
    nightlyRate: 5000,  // $50.00
    nights: 3,
  })
  expect(result.totalAmount).toBe(15000)  // Would fail if calculation broke
})
```

### TE-2 (MUST) Failure Modes Are Not Optional

Every function that can fail MUST have tests for failure cases. Happy path alone is insufficient.

**Required failure tests for domain entities:**
- Invalid construction (bad inputs to `create()`)
- Invalid state transitions (e.g., cancel already-cancelled)
- Boundary violations (amounts < 0, dates in past)
- Authorization failures (user lacks permission)

```typescript
describe('Reservation.cancel', () => {
  test('succeeds for confirmed reservation', () => { /* happy path */ })

  // ✅ REQUIRED: Failure modes
  test('throws when reservation already cancelled', () => {
    const reservation = createCancelledReservation()
    expect(() => reservation.cancel()).toThrow('already cancelled')
  })

  test('throws when reservation already checked in', () => {
    const reservation = createCheckedInReservation()
    expect(() => reservation.cancel()).toThrow('cannot cancel after check-in')
  })
})
```

### TE-3 (MUST) Persistence Round-Trip Verification

Any entity with `toPersistence()` / `fromPersistence()` MUST have a round-trip test:

```typescript
test('round-trip persistence preserves all data', () => {
  const original = Reservation.create({ /* all fields */ })

  const persisted = original.toPersistence()
  const reconstituted = Reservation.fromPersistence(persisted)

  // Verify EVERY field, not just ID
  expect(reconstituted.id).toBe(original.id)
  expect(reconstituted.status).toBe(original.status)
  expect(reconstituted.totalAmount).toBe(original.totalAmount)
  expect(reconstituted.guestId).toBe(original.guestId)
  // ... all fields
})
```

### TE-4 (MUST) Schema Validation Tests

For any `toPersistence()` method, verify output matches actual database columns:

```typescript
test('toPersistence output matches database schema', () => {
  const entity = MyEntity.create({ /* ... */ })
  const persisted = entity.toPersistence()

  // These are the ACTUAL column names from src/contracts/db.ts
  expect(persisted).toHaveProperty('id')
  expect(persisted).toHaveProperty('created_at')
  expect(persisted).toHaveProperty('property_id')  // Not 'propertyId'

  // Verify NO extra keys that don't exist in schema
  const validKeys = ['id', 'property_id', 'created_at', /* ... actual columns */]
  Object.keys(persisted).forEach(key => {
    expect(validKeys).toContain(key)
  })
})
```

### TE-5 (MUST) Domain Invariants

Test that business rules cannot be violated:

```typescript
describe('domain invariants', () => {
  test('reservation total cannot be negative', () => {
    expect(() => Reservation.create({ totalAmount: -100 }))
      .toThrow('total amount must be positive')
  })

  test('check-out date must be after check-in date', () => {
    expect(() => Reservation.create({
      checkIn: new Date('2024-01-15'),
      checkOut: new Date('2024-01-10'),  // Before check-in
    })).toThrow('check-out must be after check-in')
  })

  test('cannot add more guests than site capacity', () => {
    const site = Site.create({ maxOccupancy: 4 })
    expect(() => site.validateOccupancy(6))
      .toThrow('exceeds maximum occupancy')
  })
})
```

### TE-6 (MUST) State Transition Coverage

For entities with status/state, test ALL valid transitions AND invalid ones:

```typescript
describe('reservation state transitions', () => {
  // Valid transitions
  test('pending → confirmed (on payment)', () => { /* ... */ })
  test('confirmed → checked_in (on arrival)', () => { /* ... */ })
  test('checked_in → checked_out (on departure)', () => { /* ... */ })
  test('pending → cancelled (before payment)', () => { /* ... */ })
  test('confirmed → cancelled (with refund)', () => { /* ... */ })

  // ✅ REQUIRED: Invalid transitions
  test('cannot transition checked_out → checked_in', () => {
    const reservation = createCheckedOutReservation()
    expect(() => reservation.checkIn()).toThrow()
  })

  test('cannot transition cancelled → confirmed', () => {
    const reservation = createCancelledReservation()
    expect(() => reservation.confirm()).toThrow()
  })
})
```

### TE-7 (SHOULD) Boundary Value Testing

Test at boundaries, not just arbitrary values:

```typescript
describe('pricing boundaries', () => {
  test('minimum stay of 1 night', () => { /* ... */ })
  test('exactly at minimum stay', () => { /* ... */ })
  test('below minimum stay throws', () => { /* ... */ })

  test('discount at exactly 7 nights', () => { /* ... */ })
  test('no discount at 6 nights', () => { /* ... */ })

  test('zero amount handling', () => { /* ... */ })
  test('maximum integer amount', () => { /* ... */ })
})
```

### Test Quality Gate

Before marking any module complete, verify:

- [ ] Every public method has at least one failure mode test
- [ ] All state transitions tested (valid AND invalid)
- [ ] Persistence round-trip test exists and checks ALL fields
- [ ] Schema validation test confirms column names match database
- [ ] Domain invariants are tested and enforced
- [ ] No tests that would pass with obviously broken code

---

## Code Style

- **Language**: TypeScript (strict mode)
- **Formatting**: 2-space indentation, semicolons optional
- **Naming**: kebab-case for files (`booking-utils.ts`), camelCase for variables (C-2)
- **Exports**: Prefer named exports over default
- **Components**: Function components only (React 19)
- **Imports**: Use `import type` for type-only imports (C-6)
- **Types vs Interfaces**: Default to `type`; use `interface` only when more readable (C-8)
- **Branded Types**: Use for domain IDs (C-5)

---

## Environment Configuration

Required environment variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY` (email)
- `SENTRY_DSN` (optional, error tracking)

---

## Shortcuts

The user may invoke these shortcuts at any time:

### QNEW
Understand all BEST PRACTICES listed in CLAUDE.md. Your code SHOULD ALWAYS follow these best practices.

### QPLAN
Analyze similar parts of the codebase and determine whether your plan:
- Is consistent with rest of codebase
- Introduces minimal changes
- Reuses existing code

### QCODE
Implement your plan and ensure:
- New tests pass
- You didn't break existing tests (`npm run test:run`)
- Code is formatted (`npm run lint`)
- Type-checking passes (`npm run type-check`)

### QCHECK
You are a SKEPTICAL senior software engineer. Perform this analysis for every MAJOR code change (skip minor):
1. Writing Functions Best Practices checklist
2. Writing Tests Best Practices checklist
3. Implementation Best Practices (BP-1 through BP-4, C-1 through C-9, T-1 through T-13, D-1 through D-4)

### QCHECKF
You are a SKEPTICAL senior software engineer. Perform Writing Functions Best Practices checklist for every MAJOR function you added/edited.

### QCHECKT
You are a SKEPTICAL senior software engineer. Perform Writing Tests Best Practices checklist for every MAJOR test you added/edited.

### QUX
Imagine you are a human UX tester of the feature you implemented. Output a comprehensive list of scenarios you would test, sorted by highest priority.

### QGIT
Add all changes to staging, create a commit, and push to remote.

Follow Conventional Commits format (GH-1):
```
<type>[optional scope]: <description>

[optional body]
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`, `ci`, `build`, `style`

⛔ **CRITICAL (GH-2)**: Commit message must NOT contain:
- Any mention of Claude, Anthropic, AI, or automated generation
- Co-Authored-By lines referencing AI
- "Generated with" footers
- Robot emojis or AI-related links

After committing, verify the commit message with `git log -1` to confirm compliance.

---

## Reference Documents

- `TDD-IMPLEMENTATION-GUIDE.md` - Comprehensive testing guide with templates
- `AGENTS.md` - Repository guidelines for all AI assistants
- `lib/booking/test-utils/` - Shared test helpers (dynamic dates, IDs)
