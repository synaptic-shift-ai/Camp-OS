# Post-Incident Action Plan - Onboarding Crisis Recovery

**Incident Date**: October 30, 2025
**Plan Created**: October 30, 2025
**Priority**: P0 (Critical)
**Owner**: Engineering Team

---

## Overview

This action plan ensures the onboarding wizard crisis never happens again. All items are prioritized and have clear ownership requirements.

**Incident Summary**: Middleware refactor broke onboarding wizard, causing complete conversion pipeline failure during live demo. Three critical bugs fixed in production tonight, but systemic issues remain.

**Goal**: Transform from "reactive crisis mode" to "proactive prevention mode" within 1 week.

---

## Critical Path Items - INVESTOR DEMO SPRINT

**CONTEXT**: Investor demo scheduled for Sunday evening, Nov 2. All timelines adjusted accordingly.

### 🚨 P0: E2E Test Coverage (4-6 hours)
**Deadline**: Saturday Nov 1, 2025 Morning (DEMO-CRITICAL)
**Owner**: You
**Blocks**: Demo confidence, future deployments

**Acceptance Criteria**:
- [ ] Playwright installed and configured
- [ ] Test file created: `tests/e2e/conversion-pipeline.spec.ts`
- [ ] Test covers: Plan selection → Stripe checkout → Webhook → Wizard → Dashboard
- [ ] Test uses Stripe test mode (no real charges)
- [ ] Test runs in CI/CD pipeline
- [ ] Test MUST pass before merging to main
- [ ] Test cleans up data after completion

**Implementation Notes**:
```typescript
// tests/e2e/conversion-pipeline.spec.ts
import { test, expect } from '@playwright/test'

test('new user can complete onboarding after payment', async ({ page }) => {
  // 1. Start at /choose-plan
  await page.goto('/choose-plan')

  // 2. Select plan
  await page.click('[data-plan="professional"]')
  await page.click('[data-billing="monthly"]')

  // 3. Enter company info (new modal flow)
  await page.fill('[name="companyName"]', 'Test Company')
  await page.fill('[name="propertyName"]', 'Test Campground')
  await page.fill('[name="siteCount"]', '50')

  // 4. Click checkout
  await page.click('button:has-text("Continue to Payment")')

  // 5. Wait for Stripe checkout
  await page.waitForURL(/checkout\.stripe\.com/)

  // 6. Fill Stripe test card
  await page.fill('[name="cardNumber"]', '4242424242424242')
  await page.fill('[name="cardExpiry"]', '1234')
  await page.fill('[name="cardCvc"]', '123')
  await page.fill('[name="billingName"]', 'Test User')

  // 7. Submit payment
  await page.click('button[type="submit"]')

  // 8. Wait for redirect to wizard (critical check!)
  await page.waitForURL(/dashboard\/sites\?wizard=true/, {
    timeout: 10000  // Give webhook time to process
  })

  // 9. CRITICAL: Verify NO redirect loops
  await page.waitForTimeout(2000)  // Wait 2 seconds
  const currentUrl = page.url()
  expect(currentUrl).toContain('wizard=true')  // Should still be on wizard

  // 10. Verify wizard loads
  await expect(page.locator('h1')).toContainText('Property Setup Wizard')

  // 11. Complete wizard (basic flow)
  await page.click('button:has-text("Get Started")')
  // ... complete remaining steps

  // 12. Verify completion
  await page.waitForURL('/dashboard')
  await expect(page.locator('text=Setup Complete')).toBeVisible()
})
```

**Files to Create**:
- `tests/e2e/conversion-pipeline.spec.ts`
- `playwright.config.ts` (if not exists)

**Risk**: None - purely additive testing

---

### 🚨 P0: Dashboard Database Integration (12-16 hours)
**Deadline**: Saturday Nov 1, 2025 Evening (DEMO-CRITICAL)
**Owner**: You
**Blocks**: Investor demo

**Acceptance Criteria**:
- [ ] Dashboard components connected to real database queries
- [ ] At minimum: Sites/Properties display from database
- [ ] Bonus: Bookings list, stats/metrics (if time permits)
- [ ] All dashboard data flows through proper API routes
- [ ] Loading states and basic error handling
- [ ] Manual testing of complete dashboard UX

**Implementation Priority** (do in this order):
1. **Sites/Properties Grid** - Most visible for demo
2. **Bookings List** - If needed for demo narrative
3. **Stats Dashboard** - If time allows
4. **Settings** - Skip for demo

**Critical Success Factor**: Focus on functionality over polish. Investor cares about data flow, not perfect UI.

**Files to Review**:
- Current dashboard components (identify what's hardcoded)
- Existing API endpoints
- Database schema for required queries

**Risk**: HIGH - Dashboard integration is largest unknown. Start early, cut scope aggressively if needed.

---

### ⚠️ P0→P1: Type Safety for Properties API (2 hours) [DEFERRED POST-DEMO]
**Deadline**: November 2, 2025 (3 days)
**Owner**: Backend Engineer
**Blocks**: Properties API changes

**Acceptance Criteria**:
- [ ] Supabase types generated: `database/types.ts`
- [ ] API types file created: `types/api.ts`
- [ ] Properties API uses proper typing
- [ ] PropertyContext validates fields at runtime with Zod
- [ ] Test added for missing fields (should fail gracefully)

**Implementation**:
```typescript
// types/api.ts
import type { Database } from '@/database/types'

export type PropertyResponse = Database['public']['Tables']['properties']['Row']

export type PropertiesApiResponse = {
  properties: PropertyResponse[]
}

// app/api/onboarding/properties/route.ts
import type { PropertiesApiResponse } from '@/types/api'

export async function GET(): Promise<NextResponse<PropertiesApiResponse>> {
  const { data: properties } = await supabase
    .from('properties')
    .select('*')  // Type-safe: must match PropertyResponse

  return NextResponse.json({ properties })
}

// components/property-context.tsx
import { z } from 'zod'

const PropertySchema = z.object({
  id: z.string(),
  slug: z.string(),
  owner_id: z.string(),
  wizard_step_completed: z.string().nullable(),
  wizard_progress: z.number().nullable(),
  // ... all required fields with validation
})

// In useEffect:
try {
  const validated = PropertySchema.array().parse(data.properties)
  setProperties(validated)
} catch (error) {
  console.error('Properties API returned invalid data:', error)
  toast.error('Failed to load properties. Please refresh.')
}
```

**Files to Change**:
- `types/api.ts` (new)
- `app/api/onboarding/properties/route.ts`
- `components/property-context.tsx`

**Risk**: Low - additive changes only

---

### 🚨 P0: Document Critical Business Logic (1 hour)
**Deadline**: November 1, 2025 (2 days)
**Owner**: Any Senior Engineer
**Blocks**: None (can be done immediately)

**Acceptance Criteria**:
- [ ] Middleware wizard access logic has detailed comment
- [ ] Webhook race condition handling documented
- [ ] Properties API SELECT * requirement explained
- [ ] Each comment references this incident document

**Implementation**:
```typescript
// lib/supabase/middleware.ts

// ============================================================================
// CRITICAL BUSINESS LOGIC: Onboarding Wizard Access
// ============================================================================
//
// The onboarding wizard MUST be accessible even when onboarding_completed = false.
// The wizard IS the onboarding process - users cannot complete setup without it.
//
// INCIDENT HISTORY:
// - Oct 30, 2025: Removing this check caused infinite redirect loop (commit d078412)
// - Impact: Complete conversion pipeline failure during live demo
// - Resolution: Restored wizard exception in commits c24735a, 184f6fd
//
// BEFORE CHANGING:
// 1. Read: docs/reference/ONBOARDING_CRISIS_HANDOFF.md
// 2. Run E2E test: npm run test:e2e -- conversion-pipeline
// 3. Manual test: Complete checkout → verify wizard loads (no loops)
// 4. Review with product team
//
// See: docs/reference/CONVERSION_PIPELINE_FLOW.md for full flow
// ============================================================================
const isWizardOrOnboarding =
  request.nextUrl.searchParams.get("wizard") === "true" ||
  pathname.startsWith("/onboarding")

if (!isWizardOrOnboarding) {
  // Only redirect to onboarding for non-wizard dashboard access
  // ...
}
```

**Files to Update**:
- `lib/supabase/middleware.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/onboarding/properties/route.ts`

**Risk**: None - documentation only

---

### ⚠️ P1: Create Deployment Checklist (1 hour)
**Deadline**: November 3, 2025 (4 days)
**Owner**: DevOps/Engineering Lead
**Blocks**: None

**Acceptance Criteria**:
- [ ] Checklist document created
- [ ] Added to PR template
- [ ] Enforced for conversion pipeline changes
- [ ] Team trained on usage

**Implementation**: See template in main handoff document section "Create Pre-Deployment Checklist"

**Files to Create**:
- `docs/reference/DEPLOYMENT_CHECKLIST.md`
- `.github/PULL_REQUEST_TEMPLATE.md` (update)

**Risk**: None - process improvement only

---

### ⚠️ P1: Error Monitoring Setup (3-4 hours)
**Deadline**: November 5, 2025 (6 days)
**Owner**: DevOps/Senior Engineer
**Blocks**: None

**Acceptance Criteria**:
- [ ] Sentry or similar error tracking configured
- [ ] Conversion events tracked at each step
- [ ] Alerts configured for critical failures
- [ ] Dashboard accessible to team
- [ ] Test error reporting works

**Critical Alerts**:
```yaml
alerts:
  - name: "Webhook: Company Not Found"
    condition: error_message contains "Company not found"
    threshold: "> 5% of webhook events"
    severity: critical
    notify: engineering-team

  - name: "Middleware: Redirect Loop Detected"
    condition: same_user_id hits middleware > 10 times/minute
    threshold: any occurrence
    severity: critical
    notify: engineering-team

  - name: "Properties API: Invalid Response"
    condition: error_message contains "invalid data"
    threshold: "> 1% of API calls"
    severity: high
    notify: backend-team

  - name: "Wizard: Initialization Failure"
    condition: error in PropertyContext initialization
    threshold: any occurrence
    severity: high
    notify: frontend-team
```

**Tools Options**:
- Sentry (recommended)
- LogRocket
- Datadog
- Custom (Supabase Edge Functions + PagerDuty)

**Risk**: None - monitoring only

---

## High Priority Items (DO THIS MONTH)

### 📋 P2: Error Boundaries for Wizard (2 hours)
**Deadline**: November 10, 2025
**Owner**: Frontend Engineer

**Implementation**: Add `WizardErrorBoundary` component (see main handoff doc)

**Files to Create**:
- `components/onboarding/wizard-error-boundary.tsx`
- `app/dashboard/sites/page.tsx` (wrap wizard)

---

### 📋 P2: Webhook Idempotency (2 hours)
**Deadline**: November 12, 2025
**Owner**: Backend Engineer

**Implementation**: Check `subscription_events.stripe_event_id` before processing

**Files to Change**:
- `app/api/stripe/webhook/route.ts`

---

### 📋 P2: Database Migration Testing Process (3 hours)
**Deadline**: November 15, 2025
**Owner**: DevOps/Database Lead

**Deliverables**:
- [ ] Local Supabase development setup guide
- [ ] Migration testing checklist
- [ ] Rollback procedure documented

---

### 📋 P3: Visual Regression Testing (4 hours)
**Deadline**: November 20, 2025
**Owner**: QA/Frontend Engineer

**Tools**: Percy, Chromatic, or Playwright screenshots

**Coverage**: Wizard UI states

---

### 📋 P3: Structured Logging (3 hours)
**Deadline**: November 25, 2025
**Owner**: Backend Engineer

**Implementation**: Correlation IDs, structured JSON logs

---

## Team Process Changes (ONGOING)

### Code Review Standards
**Effective Immediately**:
- [ ] All middleware changes require 2 reviewers
- [ ] All webhook changes require integration test
- [ ] All conversion pipeline PRs must reference deployment checklist
- [ ] PR description must include "Impact on onboarding flow" section

### Testing Standards
**Effective Immediately**:
- [ ] Manual test conversion pipeline for ANY middleware/webhook change
- [ ] E2E tests must pass before merging (once implemented)
- [ ] Stripe test mode checkout required for payment changes

### Documentation Standards
**Effective Immediately**:
- [ ] Critical business logic requires inline comments
- [ ] Non-obvious redirects must explain "why"
- [ ] Race condition handling must be documented

---

## Retrospective Action Items

### What We'll Change

1. **Testing Culture**
   - BEFORE: Unit tests, manual spot checking
   - AFTER: E2E tests for critical paths, integration testing

2. **Deployment Process**
   - BEFORE: Push to main → hope it works
   - AFTER: Staging → manual validation → production → monitoring

3. **Code Documentation**
   - BEFORE: "Code should be self-documenting"
   - AFTER: Critical logic has comments explaining "why"

4. **Monitoring**
   - BEFORE: Check logs when something breaks
   - AFTER: Alerts catch issues before users report them

5. **Change Impact Analysis**
   - BEFORE: "Does this fix the bug?"
   - AFTER: "What else could this affect?"

### Retrospective Meeting
**When**: November 1, 2025 (tomorrow)
**Duration**: 60 minutes
**Attendees**: Engineering team, Product lead

**Agenda**:
1. Incident timeline review (10 min)
2. What went wrong (15 min)
3. What went right (10 min)
4. Action plan review (15 min)
5. Commitment to changes (10 min)

---

## Progress Tracking - INVESTOR DEMO SPRINT

### Thursday Evening (Oct 30) - COMPLETE ✅
- [x] Fix deployed to production
- [x] Incident documentation created
- [x] Sprint plan created

### Friday (Nov 1) - DAY 1
- [ ] E2E tests implemented (Morning - 4 hours)
- [ ] Dashboard integration planned (Afternoon - 2 hours)
- [ ] First dashboard feature working (Afternoon - 2-4 hours)

### Saturday (Nov 2) - DAY 2
- [ ] Dashboard fully integrated (Morning/Afternoon - 8 hours)
- [ ] Basic error handling added (Evening - 2 hours)
- [ ] E2E test still passing (Evening validation)

### Sunday (Nov 3) - DEMO DAY
- [ ] Final testing and demo prep (Morning - 4 hours)
- [ ] Demo rehearsal (Midday - 2 hours)
- [ ] Investor demo (Evening)

### POST-DEMO (Nov 4+)
- [ ] Type safety added (by Nov 5)
- [ ] Critical logic documented (by Nov 5)
- [ ] Deployment checklist created (by Nov 6)
- [ ] Error monitoring setup (by Nov 8)

### Week 2 (Nov 6 - Nov 12)
- [ ] Team retrospective completed (Nov 1)
- [ ] Error boundaries added (by Nov 10)
- [ ] Webhook idempotency added (by Nov 12)

### Week 3 (Nov 13 - Nov 19)
- [ ] Migration testing process documented (by Nov 15)

### Week 4 (Nov 20 - Nov 26)
- [ ] Visual regression testing (by Nov 20)
- [ ] Structured logging (by Nov 25)

### Demo Success Metrics (Sunday, Nov 2)
- [ ] Conversion pipeline works during demo (no crashes)
- [ ] Dashboard shows real data from database
- [ ] E2E test passing (prevents future regressions)
- [ ] Investor provides positive feedback

### Long-Term Success Metrics (Post-Demo)
- [ ] 7 days with zero conversion pipeline errors
- [ ] E2E tests passing in CI
- [ ] All P0 items completed (post-demo timeline)
- [ ] Type safety and monitoring deployed

---

## Daily Checklist (Until E2E Tests Deployed)

**Every Day Until E2E Tests Are Running**:
- [ ] Check webhook logs for errors (morning)
- [ ] Verify no customer reports of wizard issues (afternoon)
- [ ] Run manual test of conversion pipeline (if changes deployed)
- [ ] Update action plan progress

**Every Deploy**:
- [ ] Manual test: Complete Stripe checkout
- [ ] Verify: Wizard loads without loops
- [ ] Monitor: Logs for 15 minutes post-deploy

---

## Risk Mitigation

### If Another Critical Bug Found

**Immediate Response**:
1. Assess severity (P0 = blocks new customers)
2. If P0: Stop all non-critical work
3. Diagnose with incident lead
4. Fix → deploy → verify
5. Document in incident log
6. Update this action plan

**Rollback Triggers**:
- Webhook "Company not found" > 5% of events
- Middleware redirect loops detected
- Wizard not loading for new customers
- Any P0 bug affecting conversion pipeline

**Rollback Process**:
```bash
# 1. Identify bad commit
git log --oneline -10

# 2. Revert (don't delete history)
git revert <bad-commit-sha>

# 3. Deploy immediately
git push origin main

# 4. Verify fix
# (manual test conversion pipeline)

# 5. Post-mortem
# Update incident docs
```

---

## Communication Plan

### Internal Updates
- **Daily**: Progress update in team chat (until P0s complete)
- **Weekly**: Action plan status in team meeting
- **Completion**: Announcement when all P0s done

### External Updates (if applicable)
- **Customers Affected**: Direct email apology + explanation
- **Prospects in Pipeline**: Proactive communication about fix
- **Marketing Site**: No public statement needed (fixed quickly)

---

## Definition of Done

### Demo Ready (Sunday, Nov 2)
This incident is considered **DEMO-READY** when:

- ✅ Incident occurred (Oct 30)
- ✅ Immediate fix deployed (Oct 30)
- ✅ Documentation created (Oct 30)
- [ ] E2E tests implemented and passing (by Nov 1)
- [ ] Dashboard integrated with database (by Nov 1)
- [ ] Demo rehearsal completed (Nov 2)
- [ ] Conversion pipeline validated end-to-end

**Target Date**: Sunday Evening, November 2, 2025

### Fully Resolved (Post-Demo)
This incident is considered **FULLY RESOLVED** when:

- ✅ Demo successful (Nov 2)
- [ ] All deferred P0 items completed (by Nov 8)
- [ ] E2E tests running in CI and passing
- [ ] 7 consecutive days with zero conversion pipeline errors
- [ ] Team retrospective completed
- [ ] Process improvements adopted

**Target Date**: November 15, 2025 (2 weeks post-demo)

---

## Questions & Answers

**Q: Why are we investing so much time in tests for a "fixed" bug?**
A: This wasn't just a bug - it was a symptom of systemic issues. Without E2E tests, we WILL have another crisis.

**Q: Can we skip some of the P0 items to ship features faster?**
A: No. Conversion pipeline failures = zero revenue. This is existential.

**Q: What if we don't have time for all this?**
A: The time to fix this crisis was 90 minutes. The time for customer trust recovery is weeks. Prevention is cheaper.

**Q: Who owns making sure this gets done?**
A: Engineering lead owns overall plan. Individual items have assigned owners above.

---

## Resources

**Documentation**:
- [Full Incident Report](./ONBOARDING_CRISIS_HANDOFF.md) - Complete analysis
- [Quick Summary](./INCIDENT_SUMMARY_2025_10_30.md) - TL;DR version
- [Pipeline Flow](./CONVERSION_PIPELINE_FLOW.md) - Visual diagrams

**Code References**:
- Middleware: `/e/Projects/Saas_CampOS/lib/supabase/middleware.ts`
- Webhook: `/e/Projects/Saas_CampOS/app/api/stripe/webhook/route.ts`
- Properties API: `/e/Projects/Saas_CampOS/app/api/onboarding/properties/route.ts`

**Testing Guides**:
- [Payment Flow Testing](./PAYMENT_FLOW_TESTING_GUIDE.md)
- [Production Testing](./PRODUCTION_TESTING_GUIDE.md)

---

**Last Updated**: 2025-10-30, 10:30 PM
**Next Review**: 2025-11-01 (daily until P0s complete)
**Owner**: Engineering Team Lead
