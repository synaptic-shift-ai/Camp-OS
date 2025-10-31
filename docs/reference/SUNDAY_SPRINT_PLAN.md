# Sunday Sprint Plan - Investor Demo Recovery

**Demo Date**: Sunday, November 2, 2025 (Evening)
**Time Available**: 2.5 days (Oct 30 PM → Nov 2 PM)
**Critical Objective**: Deliver working demo to investor with confidence

---

## Hard Constraints

1. **Sunday evening demo is non-negotiable**
2. **Must have working conversion pipeline** (already fixed ✅)
3. **Must have dashboard integrated with database** (new requirement)
4. **Must have confidence it won't break during demo** (E2E tests)
5. **No room for another failure**

---

## Sprint Goals (Prioritized)

### 🎯 Goal 1: Dashboard Database Integration (MUST HAVE)
**Why**: Investor wants to see data flowing through the system
**Time Budget**: 12-16 hours (largest effort)
**Deadline**: Saturday evening

### 🎯 Goal 2: Conversion Pipeline E2E Test (MUST HAVE)
**Why**: Prevents another demo disaster
**Time Budget**: 4-6 hours
**Deadline**: Saturday morning

### 🎯 Goal 3: Basic Error Handling (MUST HAVE)
**Why**: Graceful failures vs infinite spinners
**Time Budget**: 2-3 hours
**Deadline**: Sunday morning

### 🚫 DEFERRED: Everything else
**Why**: Not demo-critical, can be done after investor meeting

---

## Day-by-Day Execution Plan

### Thursday Evening (Oct 30) - TONIGHT
**Available**: 2-3 hours
**Status**: ✅ COMPLETE

- [x] Fix conversion pipeline bugs
- [x] Deploy to production
- [x] Create incident documentation
- [x] Create sprint plan

**Sleep well - you have a big 2 days ahead.**

---

### Friday (Oct 31) - DAY 1
**Available**: 8-10 hours
**Focus**: E2E Tests + Dashboard Planning

#### Morning (4 hours) - E2E Test Foundation
- [ ] Install Playwright: `npm install -D @playwright/test` (15 min)
- [ ] Configure Playwright for Next.js (30 min)
- [ ] Write basic conversion E2E test (3 hours)
  - Plan selection → Stripe checkout → Webhook → Wizard → Dashboard
  - Use Stripe test mode
  - Verify no redirect loops
  - Must pass before continuing

**Critical Test Coverage**:
```typescript
test('conversion pipeline works end-to-end', async ({ page }) => {
  // 1. Start at plan selection
  await page.goto('/choose-plan')

  // 2. Complete purchase flow
  // ... (see detailed implementation below)

  // 3. CRITICAL: Verify wizard loads (no loops)
  await page.waitForURL(/wizard=true/)
  await page.waitForTimeout(2000)
  expect(page.url()).toContain('wizard=true')

  // 4. Complete wizard
  // ... wizard steps

  // 5. Verify dashboard loads
  await page.waitForURL('/dashboard')
})
```

**Exit Criteria**: E2E test passes locally ✅

---

#### Afternoon (4-6 hours) - Dashboard Database Integration Planning
- [ ] Audit current dashboard components (1 hour)
  - What's hardcoded vs dynamic?
  - What database queries are needed?
  - What API endpoints exist vs need to be created?

- [ ] Create dashboard integration task list (1 hour)
  - Break down into smallest possible tasks
  - Identify dependencies
  - Estimate each task (be realistic!)

- [ ] Implement highest-value dashboard feature (2-4 hours)
  - Recommendation: Start with **site list/grid from database**
  - This is the most visible for demo
  - Already have properties in DB from onboarding

**Dashboard Integration Questions to Answer**:
1. What does the investor expect to see in the dashboard?
2. What's already showing dummy data?
3. What database queries are needed?
4. What API endpoints need to be created?

**Exit Criteria**: Clear plan for Saturday + 1 dashboard feature working

---

### Saturday (Nov 1) - DAY 2
**Available**: 10-12 hours
**Focus**: Dashboard Integration Sprint

#### Morning (4 hours) - Core Dashboard Features
- [ ] Implement remaining dashboard database queries
- [ ] Connect components to real data
- [ ] Test data flow end-to-end
- [ ] Fix any bugs

**Priority Order** (do in this sequence):
1. **Sites/Properties Display** - Most visible
2. **Booking List** (if needed for demo)
3. **Stats/Metrics** (if needed for demo)
4. **Settings** (lowest priority)

---

#### Afternoon (4 hours) - Integration Testing & Polish
- [ ] Run conversion E2E test (should still pass)
- [ ] Manual test complete user journey
- [ ] Fix any integration bugs
- [ ] Test on production (if possible)

---

#### Evening (2-4 hours) - Error Handling & Buffer
- [ ] Add basic error boundaries to critical components
- [ ] Add loading states to dashboard components
- [ ] Replace infinite spinners with error messages
- [ ] Buffer time for unexpected issues

**Minimum Error Handling**:
```typescript
// components/dashboard/sites/site-list.tsx
if (error) {
  return (
    <div className="text-center py-8">
      <p className="text-red-500">Failed to load sites</p>
      <button onClick={refetch}>Retry</button>
    </div>
  )
}

if (loading) {
  return <Skeleton />  // NOT infinite spinner
}
```

**Exit Criteria**: Dashboard fully integrated + E2E test passing

---

### Sunday Morning (Nov 2) - DAY 3 - DEMO DAY
**Available**: 4-6 hours before demo
**Focus**: Final Testing & Demo Prep

#### Morning (3 hours) - Final Validation
- [ ] Fresh test account signup and onboarding (45 min)
- [ ] Complete dashboard walkthrough (30 min)
- [ ] Run E2E test suite (15 min)
- [ ] Fix any critical bugs found (1 hour buffer)
- [ ] Document any known issues for post-demo (30 min)

---

#### Midday (2 hours) - Demo Rehearsal
- [ ] Run through complete demo flow 3 times
- [ ] Time the demo (should be ~15-20 minutes)
- [ ] Prepare talking points for each section
- [ ] Identify what NOT to click (known issues)
- [ ] Have backup plan if something fails

**Demo Flow Rehearsal**:
1. Show plan selection page (30 sec)
2. Complete checkout with test card (2 min)
3. Show webhook processing (30 sec - optional)
4. Complete onboarding wizard (5 min)
5. Tour dashboard with real data (8 min)
6. Q&A buffer (5 min)

---

#### Afternoon - Buffer & Rest
- [ ] Deploy final changes to production
- [ ] Monitor logs for 30 minutes
- [ ] Take a break - clear your head
- [ ] Review talking points one more time

---

### Sunday Evening - INVESTOR DEMO
**Time**: TBD
**Duration**: ~20-30 minutes
**Confidence Level**: HIGH (if plan followed)

**Pre-Demo Checklist** (30 min before):
- [ ] Production site is up
- [ ] Test signup flow one more time
- [ ] Clear browser cache
- [ ] Have test Stripe card ready (4242 4242 4242 4242)
- [ ] Close unnecessary browser tabs
- [ ] Close Slack/email - no distractions

**During Demo**:
- Stay calm - you know this works
- If something breaks, have the explanation ready
- Focus on value, not technical details
- Take feedback notes for after

---

## What We're DEFERRING (Post-Demo)

These are important but NOT demo-critical:

- ❌ Type safety (Supabase types, Zod validation)
- ❌ Detailed code documentation
- ❌ Deployment checklist
- ❌ Error monitoring (Sentry)
- ❌ Visual regression tests
- ❌ Webhook idempotency
- ❌ Team retrospective
- ❌ Process improvements

**Do these AFTER the demo**, per the original action plan timeline.

---

## Critical Success Factors

### What Will Make This Work

1. **Ruthless Prioritization**
   - Dashboard integration: YES
   - E2E test: YES
   - Everything else: LATER

2. **Realistic Scope**
   - Don't try to make dashboard perfect
   - Just make it functional with real data
   - Investor cares about flow, not polish

3. **Test Early, Test Often**
   - Run E2E test after every major change
   - Manual test complete flow daily
   - Don't skip testing to "save time"

4. **Know Your Limits**
   - If running out of time, cut features
   - Better to demo less that works than more that breaks
   - Dashboard with 1-2 real features > 10 broken features

5. **Sleep**
   - Don't code all night Friday/Saturday
   - Tired developer = more bugs
   - Demo with a clear head

---

## Risk Mitigation

### High-Risk Scenarios

**Risk 1: Dashboard integration takes longer than expected**
- **Mitigation**: Start with simplest feature (site list)
- **Backup**: Demo with 1 working dashboard feature vs none
- **Deadline**: If not done by Saturday 6pm, cut scope

**Risk 2: E2E test uncovers new bugs**
- **Mitigation**: Run test Friday morning (early detection)
- **Backup**: Fix bugs immediately vs continuing with dashboard
- **Priority**: Working flow > more features

**Risk 3: Production deployment breaks something**
- **Mitigation**: Deploy Saturday afternoon, not Sunday
- **Backup**: Revert to current working production
- **Process**: Always manual test after deploy

**Risk 4: Demo environment issue (internet, browser, etc.)**
- **Mitigation**: Record backup video of working flow
- **Backup**: Have screen recording ready to show
- **Test**: Run demo from same device/network you'll use

---

## Daily Standup Questions

### Friday Morning
- What did I finish yesterday? (Bug fixes ✅)
- What will I finish today? (E2E test + dashboard plan)
- What's blocking me? (Nothing yet)

### Saturday Morning
- What did I finish yesterday? (E2E test + dashboard plan)
- What will I finish today? (Dashboard integration)
- What's blocking me? (Unknown unknowns in dashboard)

### Sunday Morning
- What did I finish yesterday? (Dashboard integration)
- What will I finish today? (Final testing + demo prep)
- What's blocking me? (Nerves - it's demo day!)

---

## Definition of Success

**Minimum Success** (Must achieve):
- ✅ Conversion pipeline works (signup → onboarding → dashboard)
- ✅ Dashboard shows real data from database (at least 1 feature)
- ✅ E2E test passes (prevents regression)
- ✅ No crashes during demo

**Stretch Success** (Nice to have):
- Dashboard shows 2-3 features with real data
- Graceful error handling (no infinite spinners)
- Polished UI (not critical)

**Demo Success Metrics**:
- Investor says "This looks promising"
- Investor asks about next steps (positive signal)
- Investor doesn't find critical bugs during demo
- You feel confident in the product

---

## Emergency Contacts & Resources

### If You Get Stuck

**Technical Issues**:
1. Check recent git commits for similar code
2. Check Supabase docs for query syntax
3. Check Next.js docs for API routes
4. Ask for help in team chat (if applicable)

**Time Management Issues**:
1. Review this sprint plan
2. Cut scope aggressively
3. Focus on demo-critical features only
4. Consider recording backup demo video

**Stress Management**:
1. Take regular breaks (every 2 hours)
2. Go for short walks
3. Sleep at least 6 hours each night
4. Remember: One demo doesn't define the product

### Quick Reference Docs
- [Conversion Pipeline Flow](./CONVERSION_PIPELINE_FLOW.md)
- [Incident Handoff](./ONBOARDING_CRISIS_HANDOFF.md)
- [Payment Testing Guide](./PAYMENT_FLOW_TESTING_GUIDE.md)

---

## Post-Demo Action Items

**Immediately After Demo** (Sunday Evening):
- [ ] Note investor feedback
- [ ] Document any bugs discovered during demo
- [ ] Celebrate the win (you survived!)

**Monday Morning**:
- [ ] Implement investor feedback (highest priority)
- [ ] Return to original action plan (type safety, monitoring, etc.)
- [ ] Schedule team retrospective
- [ ] Send investor follow-up email

---

## Motivation

You've already proven you can fix critical bugs under pressure (90 min recovery tonight).

Now you have 2.5 days to:
1. Build confidence with E2E tests
2. Integrate dashboard with database
3. Deliver a solid demo

**You can do this.** Stay focused, prioritize ruthlessly, and test frequently.

The investor gave you another chance - make it count.

---

**Sprint Owner**: You
**Success Criteria**: Investor says "yes" to next steps
**Deadline**: Sunday Evening, Nov 2, 2025

Let's build something great. 🚀
