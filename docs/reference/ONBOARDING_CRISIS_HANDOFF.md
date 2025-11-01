# CRITICAL SESSION HANDOFF: Onboarding Wizard Failure Recovery

**Date**: 2025-10-30
**Status**: 🟢 RESOLVED - All fixes deployed to production
**Severity**: CRITICAL - Complete conversion pipeline failure during live demo

---

## Executive Summary

The onboarding wizard completely failed during a live demo tonight, breaking the entire conversion pipeline (Stripe checkout → webhook → company creation → onboarding wizard). This was a **regression** introduced by commit `d078412` from 2 days ago. The wizard worked flawlessly before this architectural refactor.

**Root Cause**: Middleware refactor removed the `wizard=true` query parameter check, causing an infinite redirect loop that prevented users from accessing the onboarding wizard after successful payment.

**Impact**:
- New customers could not complete onboarding after paying
- Zero conversion for an unknown duration (potentially 2 days)
- Demo failure in front of stakeholders
- Loss of customer confidence

**Current Status**: All three critical issues identified and fixed. Pipeline fully operational.

---

## What Was Broken

### 1. Infinite Redirect Loop (CRITICAL)
**Symptoms**: After successful Stripe checkout, users were stuck in loading state with console showing 307 redirects

**Technical Details**:
- User completes payment → Stripe webhook creates company/properties → redirects to `/dashboard/sites?wizard=true`
- Middleware saw incomplete onboarding → redirected to `/onboarding`
- `/onboarding` page redirected back to `/dashboard/sites?wizard=true`
- **Result**: Infinite 307 redirect loop, wizard never loads

**Root Cause**: Commit `d078412` refactored middleware to check `companies` table instead of `properties` table for subscription status. This was architecturally correct BUT removed the critical wizard access logic:

```typescript
// BEFORE d078412 (WORKED):
// Middleware allowed /dashboard/sites when wizard=true param present

// AFTER d078412 (BROKE):
// Middleware always redirected to /onboarding for incomplete properties
// No exception for wizard=true query parameter
```

### 2. Race Condition in Webhook Handlers
**Symptoms**: "Company not found" errors in webhook logs for `customer.subscription.updated` events

**Technical Details**:
- Stripe fires `checkout.session.completed` and `customer.subscription.created` events simultaneously
- `checkout.session.completed` creates company in database (takes ~200-500ms)
- `customer.subscription.created` tries to update company immediately
- Database write from first webhook hasn't propagated yet
- **Result**: Second webhook fails with "Company not found"

**Impact**: Subscription status not updated, potential data inconsistency

### 3. Incomplete Property Data from API
**Symptoms**: Onboarding wizard stuck on loading spinner after login

**Technical Details**:
- Properties API was using `.select("id, name, company_id, onboarding_completed")` (subset of fields)
- `PropertyContext` in frontend requires ALL property fields including:
  - `slug`, `owner_id`, `wizard_step_completed`, `wizard_progress`, etc.
- Missing fields caused PropertyContext initialization to fail silently
- **Result**: Wizard couldn't load property data, stuck on spinner

---

## The Regression Timeline

### October 28, 2025 - 1:26 PM (Commit `d078412`)
**What Changed**: "fix(companies): correct billing architecture to use companies table"

This commit made the following changes:
1. ✅ **Correct**: Updated middleware to check `companies.subscription_status` instead of properties table
2. ✅ **Correct**: Fixed webhook to use `company_id` in `subscription_events` (not `property_id`)
3. ✅ **Correct**: Added migration for `subscription_events.company_id` column
4. ❌ **BREAKING**: Removed wizard access exception logic from middleware

**Files Changed**:
- `lib/supabase/middleware.ts` - Refactored subscription checks, **removed wizard=true exception**
- `app/api/stripe/webhook/route.ts` - Changed to company-level subscription events
- `supabase/migrations/20251028000000_add_company_id_to_subscription_events.sql` - Schema update

**Why It Broke**:
The refactor focused on fixing the billing architecture (company-level vs property-level) but inadvertently removed the critical onboarding wizard access logic. The middleware now had NO special case for users in the onboarding flow.

### October 30, 2025 - 9:00 PM (Live Demo)
**What Happened**: Complete conversion pipeline failure

User attempts to demo the product:
1. ✅ Choose plan page works
2. ✅ Stripe checkout works
3. ✅ Payment succeeds
4. ❌ Redirect to wizard fails - infinite 307 loop
5. ❌ User cannot access dashboard
6. ❌ Demo fails, stakeholder confidence lost

---

## The Recovery (All Fixes Deployed)

### Fix #1: Webhook Race Condition (Commit `819753f`)
**Time**: 9:00 PM
**What**: Added retry logic to prevent "Company not found" errors

```typescript
// Added retry with 3 attempts, 500ms delays
let company = null
let attempts = 0
const maxAttempts = 3

while (!company && attempts < maxAttempts) {
  attempts++
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (data) {
    company = data
  } else if (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}
```

**Impact**: Prevents webhook failures due to timing, ensures subscription status is always updated

**Files Changed**:
- `/e/Projects/Saas_CampOS/app/api/stripe/webhook/route.ts`

---

### Fix #2: Properties API Incomplete Fields (Commit `8cdd5ec`)
**Time**: 9:18 PM
**What**: Changed from subset select to full wildcard select

```typescript
// BEFORE:
.select("id, name, company_id, onboarding_completed")

// AFTER:
.select("*")  // All fields needed by PropertyContext
```

**Impact**: Wizard can now load property data and initialize PropertyContext correctly

**Files Changed**:
- `/e/Projects/Saas_CampOS/app/api/onboarding/properties/route.ts`

---

### Fix #3: Middleware Redirect Loop (Commits `c24735a`, `184f6fd`)
**Time**: 9:26 PM - 9:31 PM (two iterations to get right)
**What**: Restored wizard access exception logic

**First Attempt** (`c24735a`):
```typescript
// Allow /dashboard/sites when wizard=true
const isWizardRoute = pathname === "/dashboard/sites" &&
                      request.nextUrl.searchParams.get("wizard") === "true"

if (!isWizardRoute && incompleteProperties && incompleteProperties.length > 0) {
  // redirect to /onboarding
}
```

**Problem**: Still had loops during wizard navigation between steps

**Final Fix** (`184f6fd`):
```typescript
// SIMPLIFIED: Allow ANY request with wizard=true OR /onboarding path
const isWizardOrOnboarding =
  request.nextUrl.searchParams.get("wizard") === "true" ||
  pathname.startsWith("/onboarding")

if (!isWizardOrOnboarding) {
  // Check for incomplete properties and redirect if needed
}
```

**Key Insight**: The wizard IS the onboarding process. Once `wizard=true` is present, allow ALL navigation regardless of pathname. This handles:
- Initial entry: `/dashboard/sites?wizard=true`
- Step navigation: `router.replace()` calls
- Any future wizard routes

**Impact**: Wizard now fully accessible, no redirect loops, onboarding works end-to-end

**Files Changed**:
- `/e/Projects/Saas_CampOS/lib/supabase/middleware.ts`

---

## Current System State

### ✅ Working End-to-End Flow

1. **Marketing Site** → User clicks "Get Started"
2. **Plan Selection** (`/choose-plan`) → User selects plan and billing cycle
3. **Stripe Checkout** → Payment processed successfully
4. **Webhook Processing**:
   - `checkout.session.completed` creates company + properties in database
   - `customer.subscription.created` updates subscription status (with retry logic)
   - `invoice.payment_succeeded` logs payment event (with retry logic)
5. **Redirect to Wizard** → `/dashboard/sites?wizard=true`
6. **Middleware** → Allows access due to `wizard=true` parameter
7. **Properties API** → Returns all property fields
8. **Wizard Loads** → PropertyContext initializes, wizard shows all properties
9. **Onboarding Steps** → User completes setup for each property
10. **Completion** → Redirect to dashboard, setup complete toast shown

### 🔧 All Critical Systems Operational

- ✅ Stripe webhook handlers with race condition protection
- ✅ Company/property creation on successful payment
- ✅ Middleware wizard access exception logic
- ✅ Properties API returning complete field set
- ✅ Onboarding wizard loading and navigation
- ✅ Multi-property onboarding support
- ✅ Completion status tracking

### 📊 Verification Performed

All fixes have been deployed to production. The complete conversion pipeline has been tested manually:

1. **Test Payment Flow**: Used Stripe test mode checkout
2. **Verified Webhook Logs**: Confirmed retry logic working, no "Company not found" errors
3. **Accessed Wizard**: No redirect loops, wizard loads immediately
4. **Completed Onboarding**: All steps work, redirect to dashboard successful

---

## Why This Happened (Post-Mortem Analysis)

### 1. Architectural Refactor Without Full Integration Testing
**What**: Commit `d078412` made a correct architectural change (company-level billing) but didn't test the onboarding flow

**Why**:
- Focus was on fixing billing architecture
- Testing guides were created but wizard flow not retested
- Regression tests for critical user journeys missing

### 2. Missing Regression Test Suite
**What**: No automated tests for complete conversion pipeline

**Critical Gap**:
```
No tests covering:
- Stripe checkout → webhook → database writes
- Middleware redirect logic for onboarding
- Wizard access with incomplete properties
- Properties API field completeness
```

### 3. Silent Failures
**What**: Missing fields in Properties API caused silent failure - no error, just loading spinner

**Why**:
- Frontend PropertyContext didn't validate required fields
- No type-safety between API response and frontend expectations
- No error boundaries to catch initialization failures

### 4. Incomplete Change Impact Analysis
**What**: Middleware changes didn't consider wizard access edge case

**Why**:
- Wizard access logic was buried in conditional checks
- Not documented as critical requirement
- No comments explaining the business logic

---

## Critical Recommendations

### 🚨 IMMEDIATE ACTIONS REQUIRED

#### 1. Add Regression Test Suite (HIGHEST PRIORITY)
**What**: Playwright E2E tests for complete conversion pipeline

**Scenarios to Cover**:
```typescript
describe("Conversion Pipeline", () => {
  test("new user can complete full onboarding after payment", async () => {
    // 1. Navigate to /choose-plan
    // 2. Select plan and billing cycle
    // 3. Complete Stripe test checkout
    // 4. Wait for webhook processing (polling)
    // 5. Verify redirect to wizard
    // 6. Verify no redirect loops (check URL stays stable)
    // 7. Complete wizard steps
    // 8. Verify redirect to dashboard
    // 9. Verify setup complete toast
  })

  test("middleware allows wizard access with incomplete onboarding", async () => {
    // Setup: User with paid subscription but incomplete onboarding
    // Navigate to /dashboard/sites?wizard=true
    // Verify: No redirect to /onboarding
    // Verify: Wizard loads successfully
  })

  test("properties API returns all required fields", async () => {
    // Call /api/onboarding/properties
    // Verify response includes: id, slug, owner_id, wizard_step_completed, etc.
    // Validate against PropertyContext type requirements
  })
})
```

**Files to Create**:
- `/e/Projects/Saas_CampOS/tests/e2e/conversion-pipeline.spec.ts`
- `/e/Projects/Saas_CampOS/tests/e2e/onboarding-wizard.spec.ts`
- `/e/Projects/Saas_CampOS/tests/integration/properties-api.test.ts`

**Acceptance Criteria**:
- [ ] Tests run in CI/CD pipeline
- [ ] Tests MUST pass before deploying middleware changes
- [ ] Tests use Stripe test mode (no real charges)
- [ ] Tests clean up test data after run

---

#### 2. Add Type Safety to API Responses
**What**: Generate TypeScript types for API responses and validate at runtime

**Implementation**:
```typescript
// types/api.ts
import type { Database } from "@/database/types"

export type PropertyResponse = Database["public"]["Tables"]["properties"]["Row"]

// app/api/onboarding/properties/route.ts
import type { PropertyResponse } from "@/types/api"

export async function GET() {
  const { data: properties } = await supabase
    .from("properties")
    .select("*")  // Type-safe: must match PropertyResponse

  return NextResponse.json({
    properties: properties as PropertyResponse[]
  })
}

// Frontend: Add runtime validation
import { z } from "zod"

const PropertySchema = z.object({
  id: z.string(),
  slug: z.string(),
  owner_id: z.string(),
  wizard_step_completed: z.string().nullable(),
  // ... all required fields
})

const propertiesData = await response.json()
const validated = PropertySchema.array().parse(propertiesData.properties)
```

**Impact**: Prevent silent failures from missing fields, catch API contract violations at build time

**Files to Change**:
- `/e/Projects/Saas_CampOS/types/api.ts` (new file)
- `/e/Projects/Saas_CampOS/app/api/onboarding/properties/route.ts`
- `/e/Projects/Saas_CampOS/components/property-context.tsx`

---

#### 3. Document Critical Business Logic
**What**: Add inline comments for non-obvious business rules

**Example**:
```typescript
// lib/supabase/middleware.ts

// CRITICAL: The onboarding wizard MUST be accessible even when
// onboarding_completed = false. The wizard IS the onboarding process.
// Breaking this check will prevent new customers from completing setup.
//
// This check was accidentally removed in commit d078412, causing a
// production incident where customers couldn't access the wizard after payment.
//
// DO NOT REMOVE without verifying:
// 1. E2E test coverage for wizard access
// 2. Manual testing of complete conversion pipeline
// 3. Review with product team
const isWizardOrOnboarding =
  request.nextUrl.searchParams.get("wizard") === "true" ||
  pathname.startsWith("/onboarding")
```

**Files to Update**:
- `/e/Projects/Saas_CampOS/lib/supabase/middleware.ts` (wizard access logic)
- `/e/Projects/Saas_CampOS/app/api/stripe/webhook/route.ts` (race condition retry logic)
- `/e/Projects/Saas_CampOS/app/api/onboarding/properties/route.ts` (why SELECT * is required)

---

#### 4. Add Monitoring and Alerting
**What**: Set up error tracking for critical conversion pipeline failures

**Implementation**:
```typescript
// lib/monitoring.ts
import * as Sentry from "@sentry/nextjs"

export function trackConversionEvent(
  event: "checkout_started" | "webhook_received" | "company_created" |
         "wizard_loaded" | "onboarding_completed",
  metadata: Record<string, any>
) {
  Sentry.addBreadcrumb({
    category: "conversion",
    message: event,
    data: metadata,
    level: "info"
  })

  // Also log to analytics
  console.log(`[Conversion] ${event}:`, metadata)
}

export function trackConversionError(
  stage: string,
  error: Error,
  metadata: Record<string, any>
) {
  Sentry.captureException(error, {
    tags: { conversion_stage: stage },
    extra: metadata
  })

  console.error(`[Conversion Error] ${stage}:`, error, metadata)
}
```

**Add to Critical Points**:
- Webhook handlers (company creation, race conditions)
- Middleware (redirect decisions)
- Properties API (field validation)
- Wizard initialization (PropertyContext)

**Alerts to Configure**:
- [ ] "Company not found" errors in webhook > 5% of events
- [ ] Middleware redirect loops (same user hitting middleware > 10 times/minute)
- [ ] Properties API returning < expected field count
- [ ] Wizard initialization failures

---

#### 5. Create Pre-Deployment Checklist
**What**: Mandatory checklist for ANY middleware or webhook changes

**Checklist**:
```markdown
## Pre-Deployment Checklist for Conversion Pipeline Changes

### Before Making Changes
- [ ] Read previous incident documentation (ONBOARDING_CRISIS_HANDOFF.md)
- [ ] Review critical business logic comments in affected files
- [ ] Identify all code paths that could affect new user onboarding

### Testing Requirements
- [ ] All existing E2E tests pass (when implemented)
- [ ] Manual test: Complete checkout → wizard → dashboard flow
- [ ] Manual test: Verify no redirect loops with browser DevTools
- [ ] Webhook test: Verify company creation with Stripe test mode
- [ ] Load test: Properties API returns all required fields

### Code Review Requirements
- [ ] PR includes "Why" explanation, not just "What"
- [ ] Impact analysis includes onboarding flow consideration
- [ ] Changes to middleware MUST explain wizard access logic
- [ ] Changes to webhook MUST explain race condition handling

### Deployment Requirements
- [ ] Deployed to staging first
- [ ] Conversion pipeline tested on staging with real Stripe test mode
- [ ] Error monitoring confirmed working
- [ ] Rollback plan documented

### Post-Deployment Validation
- [ ] Monitor webhook logs for errors (15 minutes)
- [ ] Verify no "Company not found" errors
- [ ] Test new checkout completes successfully
- [ ] Verify wizard loads without redirect loops
```

**Files to Create**:
- `/e/Projects/Saas_CampOS/.github/PULL_REQUEST_TEMPLATE.md` (add checklist section)
- `/e/Projects/Saas_CampOS/docs/reference/DEPLOYMENT_CHECKLIST.md`

---

### 📋 SHOULD HAVE (High Priority)

#### 6. Add Error Boundaries to Wizard
**What**: Graceful error handling for wizard initialization failures

```typescript
// components/onboarding/wizard-error-boundary.tsx
export function WizardErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2>Oops! Something went wrong loading your onboarding wizard.</h2>
          <p className="text-muted-foreground">Error: {error.message}</p>
          <div className="flex gap-4 mt-4">
            <Button onClick={resetError}>Try Again</Button>
            <Button variant="outline" onClick={() => {
              // Log error and redirect to support
              trackConversionError("wizard_initialization", error, {})
              window.location.href = "/support?issue=wizard_error"
            }}>
              Contact Support
            </Button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
```

**Impact**: Users get clear error messages instead of infinite loading spinners

---

#### 7. Add Database Migration Testing
**What**: Test database migrations in isolation before deploying

**Process**:
1. Create migration locally
2. Apply to clean test database
3. Verify schema changes
4. Test RLS policies with test data
5. Verify webhook handlers work with new schema
6. Only then commit migration

**Tools**:
- Supabase local development
- Migration test scripts

---

#### 8. Add Webhook Idempotency
**What**: Ensure webhooks can be safely retried without duplicate data

```typescript
// app/api/stripe/webhook/route.ts

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const idempotencyKey = session.id

  // Check if already processed
  const { data: existing } = await supabase
    .from("subscription_events")
    .select("id")
    .eq("stripe_event_id", idempotencyKey)
    .single()

  if (existing) {
    console.log('[Webhook] Already processed:', idempotencyKey)
    return // Skip duplicate processing
  }

  // Process checkout...
}
```

**Impact**: Prevents duplicate companies if webhook is retried by Stripe

---

### 🎯 NICE TO HAVE (Medium Priority)

#### 9. Add Visual Regression Testing
**What**: Screenshot comparison for wizard UI

**Tools**: Percy, Chromatic, or Playwright visual comparisons

**Scenarios**:
- Wizard loading state
- Each wizard step
- Error states
- Completion state

---

#### 10. Improve Logging Strategy
**What**: Structured logging with correlation IDs

```typescript
// lib/logger.ts
export function createLogger(context: string) {
  const correlationId = generateId()

  return {
    info: (message: string, data?: any) => {
      console.log(`[${context}][${correlationId}] ${message}`, data)
    },
    error: (message: string, error: Error, data?: any) => {
      console.error(`[${context}][${correlationId}] ${message}`, error, data)
      trackConversionError(context, error, { ...data, correlationId })
    }
  }
}

// Usage in webhook
const logger = createLogger("Webhook")
logger.info("Processing checkout", { sessionId: session.id })
```

**Impact**: Easier debugging of issues across distributed system (webhook → database → middleware → frontend)

---

## Pending Work & Validation

### ✅ COMPLETED
- [x] Fix webhook race condition with retry logic
- [x] Fix Properties API to return all fields
- [x] Fix middleware redirect loop
- [x] Deploy all fixes to production
- [x] Manual testing of complete flow
- [x] Verify webhook logs show no errors
- [x] Create comprehensive handoff documentation

### ⚠️ CRITICAL NEXT STEPS (DO BEFORE ANY OTHER WORK)

1. **Add E2E Tests for Conversion Pipeline** (Priority: CRITICAL)
   - Estimated: 4-6 hours
   - Blocks: Any future middleware or webhook changes
   - Files: `tests/e2e/conversion-pipeline.spec.ts`

2. **Add Type Safety to Properties API** (Priority: CRITICAL)
   - Estimated: 2 hours
   - Blocks: Any Properties API changes
   - Files: `types/api.ts`, `app/api/onboarding/properties/route.ts`

3. **Document Critical Business Logic** (Priority: CRITICAL)
   - Estimated: 1 hour
   - Blocks: None (can be done immediately)
   - Files: Add comments to middleware.ts, webhook/route.ts

4. **Create Deployment Checklist** (Priority: HIGH)
   - Estimated: 1 hour
   - Blocks: None
   - Files: `docs/reference/DEPLOYMENT_CHECKLIST.md`

5. **Set Up Error Monitoring** (Priority: HIGH)
   - Estimated: 3-4 hours
   - Blocks: None
   - Tools: Sentry or similar

---

## Risk Areas & Ongoing Concerns

### 🔴 HIGH RISK

1. **No Automated Regression Tests**
   - **Risk**: Another refactor could break wizard again
   - **Mitigation**: Implement E2E tests ASAP (see Critical Next Steps #1)
   - **Owner**: Assign to senior engineer

2. **Silent API Failures**
   - **Risk**: Missing fields could cause new silent failures
   - **Mitigation**: Add type safety and runtime validation (see Critical Next Steps #2)
   - **Owner**: Backend team

3. **Webhook Race Conditions**
   - **Risk**: Retry logic might not cover all edge cases
   - **Mitigation**: Add idempotency checks (see Should Have #8)
   - **Current**: Retry logic working but not fully battle-tested

### 🟡 MEDIUM RISK

4. **Incomplete Error Boundaries**
   - **Risk**: Wizard failures still show loading spinner
   - **Mitigation**: Add error boundaries (see Should Have #6)
   - **Current**: No graceful error handling for wizard initialization

5. **Manual Testing Only**
   - **Risk**: Regression could slip through
   - **Mitigation**: Automated testing + deployment checklist
   - **Current**: Relying on manual verification

6. **No Monitoring/Alerting**
   - **Risk**: Future issues might go undetected
   - **Mitigation**: Set up error tracking (see Critical Next Steps #5)
   - **Current**: Only manual log review

### 🟢 LOW RISK (Monitoring Only)

7. **Email Notifications**
   - **Status**: Placeholder code exists but not implemented
   - **Impact**: Users don't receive onboarding email
   - **Priority**: Low (wizard works without it)

---

## Ready to Continue

### For Next Development Session

**If Implementing E2E Tests** (HIGHEST PRIORITY):
1. Install Playwright: `npm install -D @playwright/test`
2. Create test file: `tests/e2e/conversion-pipeline.spec.ts`
3. Set up Stripe test mode fixtures
4. Implement checkout → webhook → wizard → completion test
5. Add to CI/CD pipeline
6. Document test data cleanup process

**If Working on Type Safety**:
1. Generate Supabase types: `npx supabase gen types typescript`
2. Create API types file: `types/api.ts`
3. Update Properties API with type assertions
4. Add Zod validation in PropertyContext
5. Test with missing fields to verify validation works

**If Changing Middleware or Webhooks**:
1. **STOP** - Read this handoff document first
2. Read critical business logic comments in code
3. Follow deployment checklist (create if doesn't exist)
4. Manual test complete conversion pipeline
5. Deploy to staging first
6. Monitor logs for 15 minutes post-deploy

### Key Files to Reference

**Conversion Pipeline**:
- `/e/Projects/Saas_CampOS/lib/supabase/middleware.ts` - Wizard access logic
- `/e/Projects/Saas_CampOS/app/api/stripe/webhook/route.ts` - Company creation
- `/e/Projects/Saas_CampOS/app/api/onboarding/properties/route.ts` - Property data

**Onboarding Wizard**:
- `/e/Projects/Saas_CampOS/components/property-context.tsx` - PropertyContext requirements
- `/e/Projects/Saas_CampOS/app/onboarding/*` - Wizard UI components

**Documentation**:
- `/e/Projects/Saas_CampOS/docs/reference/PAYMENT_FLOW_TESTING_GUIDE.md` - Testing procedures
- `/e/Projects/Saas_CampOS/docs/reference/PRODUCTION_TESTING_GUIDE.md` - Production validation
- `/e/Projects/Saas_CampOS/docs/reference/ONBOARDING_CRISIS_HANDOFF.md` - This document

### Success Criteria for "Done"

The conversion pipeline incident will be considered fully resolved when:

- [ ] E2E tests cover checkout → webhook → wizard → completion
- [ ] Tests run in CI/CD and MUST pass before deployment
- [ ] Properties API has type safety and runtime validation
- [ ] Critical business logic has inline documentation
- [ ] Error monitoring is active with alerts configured
- [ ] Deployment checklist is enforced for pipeline changes
- [ ] 7 days pass with zero conversion pipeline errors
- [ ] Team conducts post-mortem and updates processes

**Timeline**: 2-3 days for critical items, 1 week for complete resolution

---

## Lessons Learned (For Team Retrospective)

### What Went Wrong
1. **Architectural refactor without integration testing** - Focused on schema, didn't test user flow
2. **No regression test coverage** - Critical path had zero automated tests
3. **Silent failures** - Missing data caused infinite loading, no error message
4. **Incomplete change impact analysis** - Didn't realize wizard access was affected
5. **No deployment checklist** - Pipeline changes deployed without flow validation

### What Went Right
1. **Rapid diagnosis** - Identified all three issues within 90 minutes
2. **Systematic fixing** - Fixed in order: webhook → API → middleware
3. **Comprehensive logging** - Added during fixes helped verify resolution
4. **Good version control** - Git history made regression analysis easy
5. **Clear commit messages** - Conventional Commits format helped track changes

### Process Improvements Needed
1. **Mandatory E2E tests** for conversion pipeline before ANY deployment
2. **Type safety** at API boundaries to prevent silent failures
3. **Deployment checklist** for high-risk changes (middleware, webhooks, auth)
4. **Error monitoring** with alerts for critical failures
5. **Code comments** for non-obvious business logic
6. **Staging environment** testing before production deploy

### Cultural Improvements
1. **Question refactors** that touch critical paths
2. **Manual testing** of complete user journeys, not just unit tests
3. **Document critical business logic** in code comments
4. **Rollback plan** for every deployment
5. **Team review** for changes affecting conversion pipeline

---

## Appendix: Technical Details

### Commit SHA References

**Regression Introduced**:
- `d078412` - "fix(companies): correct billing architecture to use companies table" (Oct 28, 1:26 PM)

**Recovery Commits**:
- `819753f` - "fix(webhook): resolve race condition between checkout and subscription events" (Oct 30, 9:00 PM)
- `8cdd5ec` - "fix(onboarding): select all property fields and add comprehensive logging" (Oct 30, 9:18 PM)
- `c24735a` - "fix(middleware): break infinite redirect loop preventing wizard access" (Oct 30, 9:26 PM)
- `184f6fd` - "fix(middleware): simplify wizard access logic to prevent all redirect loops" (Oct 30, 9:31 PM)

### Database Schema Impact

**Tables Affected**:
- `companies` - Subscription status now checked here (correctly)
- `properties` - Onboarding status checked for redirect logic
- `subscription_events` - Now uses `company_id` instead of `property_id`

**No Schema Changes Required** - All fixes were code-only

### Environment Variables Used
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public API key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin operations
- `STRIPE_SECRET_KEY` - Stripe API
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification

### API Endpoints Involved
- `POST /api/stripe/webhook` - Stripe event handlers
- `GET /api/onboarding/properties` - Property data for wizard
- Middleware runs on all routes matching config pattern

### Testing Performed (Manual)

✅ **Stripe Test Mode Checkout**:
- Plan selection → Stripe hosted checkout → Payment with test card
- Verified webhook received and processed
- Verified company and properties created in database

✅ **Wizard Access**:
- Confirmed redirect to `/dashboard/sites?wizard=true`
- Verified no redirect loops (URL stays stable)
- Verified wizard loads within 2 seconds

✅ **Properties API**:
- Called `/api/onboarding/properties` directly
- Verified response includes all required fields
- Checked browser DevTools Network tab

✅ **Webhook Logs**:
- Reviewed Vercel logs for webhook processing
- Confirmed no "Company not found" errors
- Verified retry logic executed successfully

---

## Contact & Escalation

**For Questions About This Incident**:
- Review this document first
- Check commit history for technical details
- Review webhook logs in Vercel dashboard

**Before Making Changes to**:
- Middleware → Read this document, test wizard flow
- Webhooks → Read this document, test with Stripe test mode
- Properties API → Verify field requirements with PropertyContext

**If Conversion Pipeline Breaks Again**:
1. Check Vercel logs for webhook errors
2. Check browser DevTools for redirect loops
3. Verify Properties API response includes all fields
4. Review recent commits to middleware.ts and webhook/route.ts
5. Rollback recent changes if root cause unclear
6. Reference this document for known issues and solutions

---

**End of Handoff Document**

*This document should be referenced before any changes to the conversion pipeline (middleware, webhooks, onboarding APIs). The pain of this incident should never be repeated.*
