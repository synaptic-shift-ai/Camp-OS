# Emergency Sprint Playbook: Investor Demo Nov 2, 2025

**Sprint Duration**: November 1-2, 2025 (Saturday-Sunday)
**Demo Date**: Sunday, November 2, 2025 (Evening)
**Sprint Goal**: Deliver a confident, working demo of CampOS to investor
**Status**: EXECUTABLE

---

## Sprint Overview

### The Mission
Transform CampOS from a working conversion pipeline (plan selection → payment → onboarding) into a **demo-ready application** that showcases real data flowing through the system. This is a 2-day emergency sprint to prove product viability to an investor.

### What Success Looks Like
- Investor sees a complete user journey: signup → payment → wizard → dashboard
- Dashboard displays **real data** from database (not mock data)
- No crashes, no infinite loops, no embarrassing errors
- Demo delivered confidently in 15-20 minutes
- Investor says "This looks promising"

### Hard Constraints
1. **Demo is non-negotiable**: Sunday evening, cannot be rescheduled
2. **36 hours total**: Saturday 8am to Sunday 6pm
3. **Solo developer**: All work done by one person
4. **No breaking changes**: Conversion pipeline must stay working
5. **Production quality not required**: Demo quality is sufficient

### Critical Context
- **Conversion pipeline fixed**: Oct 30 redirect loop incident resolved
- **TypeScript errors**: 0 (clean codebase)
- **CAM-129 planning complete**: Comprehensive middleware audit, spec, and test plan
- **15 tests skipped**: Not demo-blocking, defer to post-demo
- **Middleware refactor**: 6-week project, cannot complete before demo

---

## Linear Issues (Complete Traceability)

All emergency sprint work is tracked in Linear with 100% traceability.

### Demo Critical Issues (MUST COMPLETE)

| Issue | Title | Estimate | Priority | Deadline |
|-------|-------|----------|----------|----------|
| **CAM-150** | Dashboard Audit & Integration Planning | 1h | High (2) | Sat 9am |
| **CAM-149** | E2E Test: Conversion Pipeline Regression Prevention | 6h | High (2) | Sat 12pm |
| **CAM-148** | Dashboard Database Integration for Demo | 12h | Urgent (1) | Sun 11am |

**Total**: 19 hours

**CAM-150: Dashboard Audit & Integration Planning**
- Audit all dashboard components using mock data
- Identify database tables/queries needed
- Prioritize components by demo visibility
- Create `docs/DASHBOARD_INTEGRATION_PLAN.md`
- **Deliverable**: Integration plan document

**CAM-149: E2E Test: Conversion Pipeline Regression Prevention**
- Install Playwright and configure for Next.js
- Write test: Plan selection → Stripe checkout → Webhook → Wizard → Dashboard
- Verify NO redirect loops (regression test for Oct 30 incident)
- Test passes locally using Stripe test mode
- **Deliverable**: `tests/e2e/conversion-pipeline.spec.ts`

**CAM-148: Dashboard Database Integration for Demo**
- Create API endpoint: `/api/dashboard/sites` (tenant-isolated)
- Update Site List component to fetch from API
- Create API endpoint: `/api/dashboard/stats` (total sites, bookings, revenue)
- Update Stats Cards component to fetch from API
- Add loading states (Skeleton component)
- Add error states (user-friendly messages)
- Manual test: Wizard → Dashboard shows real data
- **Deliverable**: 2-3 dashboard components with real data

---

### Demo Quality Issues (SHOULD COMPLETE)

| Issue | Title | Estimate | Priority | Deadline |
|-------|-------|----------|----------|----------|
| **CAM-151** | Graceful Error States for Dashboard Components | 3h | Medium (3) | Sun 12pm |
| **CAM-152** | Demo Script & Rehearsal | 1h | High (2) | Sun 4pm |
| **CAM-153** | Manual QA: Full User Journey Testing | 2h | High (2) | Sun 3pm |

**Total**: 6 hours

**CAM-151: Graceful Error States for Dashboard Components**
- Replace infinite spinners with Skeleton loaders
- Add error states with "Retry" button
- User-friendly error messages
- Apply pattern to all dashboard components

**CAM-152: Demo Script & Rehearsal**
- Write demo script with talking points (15-20 min)
- Rehearse demo flow 2-3 times
- Time the demo
- Identify risky clicks to avoid
- Prepare backup plan (screen recording)

**CAM-153: Manual QA: Full User Journey Testing**
- Scenario 1: Fresh user onboarding (signup → wizard → dashboard)
- Scenario 2: Returning user (login → dashboard)
- Scenario 3: Error scenarios (network disconnect → retry)
- Verify E2E test passes
- Fix any critical bugs discovered

---

### Post-Demo Issues (DEFERRED)

| Issue | Title | Estimate | Priority | Start Date |
|-------|-------|----------|----------|------------|
| **CAM-154** | Fix 15 Skipped Tests (Reservation & Pricing) | 10h | High (2) | Nov 4 |
| **CAM-155** | Type Safety: Generate & Apply Supabase Types | 2h | Medium (3) | Nov 4 |
| **CAM-156** | Error Monitoring: Sentry Integration | 4h | Medium (3) | Nov 4 |
| **CAM-157** | Create Deployment Checklist & Runbook | 1h | Low (4) | Nov 4 |

**Total**: 17 hours (Week of Nov 4-8)

These issues are intentionally deferred to avoid scope creep and maintain focus on demo delivery.

---

## Execution Timeline

### Saturday, November 1, 2025 - Day 1

**Total Available**: 12-14 hours
**Focus**: Dashboard integration + E2E test foundation

```
08:00 ━━━━━━━━━━━━━━━ START DAY 1 ━━━━━━━━━━━━━━━
      ⏰ Task: Dashboard Audit & Planning (1h) - CAM-150
      📝 Deliverable: Integration plan document
      ✅ Exit Criteria: Know what to build and priority order

09:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: E2E Test Setup - Part 1 (1.5h) - CAM-149
      📦 Install Playwright + configure

10:30 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: E2E Test Setup - Part 2 (1.5h) - CAM-149
      ✍️ Write conversion pipeline test

12:00 ━━━━━━━━━━ LUNCH BREAK (1 hour) ━━━━━━━━━━
      ☕ Eat well, clear your head
      ✅ Morning Goals: E2E test written and passing

13:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Dashboard Integration - Site List API (2h) - CAM-148
      📁 Create app/api/dashboard/sites/route.ts
      🔐 Implement tenant isolation

15:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Dashboard Integration - Site List UI (2h) - CAM-148
      🎨 Update components/dashboard/sites/site-list.tsx
      ✨ Add loading + error states

17:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ✅ Checkpoint: Site list showing real data?
         YES → Continue to optional features
         NO  → Debug until working (CRITICAL)

18:00 ━━━━━━━━━ DINNER BREAK (1 hour) ━━━━━━━━━━
      🍕 Recharge for evening session

19:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Dashboard Integration - Stats Cards (2h) - CAM-148
      📊 Optional: Add stats if time permits
      OR: Polish site list if behind schedule

21:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Day 1 Validation (30min)
      ✅ Run E2E test (must pass)
      ✅ Manual test complete flow
      ✅ Commit to git

21:30 ━━━━━━━━━━━━ END DAY 1 ━━━━━━━━━━━━━━━━━━
      🎯 Required: E2E test + site list working
      🌟 Bonus: Stats cards also working
      🛏️ GET GOOD SLEEP (7-8 hours)
```

**Saturday Success Criteria**:
- ✅ E2E test passing (`npx playwright test`)
- ✅ Dashboard site list shows real data from database
- ✅ No regressions to conversion pipeline
- ✅ TypeScript type-check passes (`npm run type-check`)
- ✅ Changes committed to git with conventional commit messages

---

### Sunday, November 2, 2025 - Day 2 (DEMO DAY)

**Total Available**: 8-10 hours before demo
**Focus**: Finish dashboard integration, add error handling, demo prep

```
08:00 ━━━━━━━━━━━━━━━ START DAY 2 ━━━━━━━━━━━━━━━
      ⏰ Task: Dashboard Integration - Completion (3h) - CAM-148
      📊 Add remaining features (stats, bookings)
      OR: Polish existing features if behind

11:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Graceful Error Handling (1h) - CAM-151
      🔄 Replace spinners with Skeleton
      ⚠️ Add error states with Retry buttons

12:00 ━━━━━━━━━━ LUNCH BREAK (1 hour) ━━━━━━━━━━
      🥗 Light meal, stay focused
      ✅ Morning Goals: Dashboard complete + error handling

13:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Integration Testing (1h) - CAM-153
      🧪 Test complete user journey
      🐛 Fix any bugs discovered

14:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: E2E Test Validation (30min) - CAM-153
      ✅ Run full E2E suite
      🔍 Verify no regressions

14:30 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Demo Script Writing (30min) - CAM-152
      📝 Write step-by-step demo flow
      🎯 Identify what to show/avoid

15:00 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰ Task: Demo Rehearsal (1h) - CAM-152
      🎭 Practice demo flow 2-3 times
      ⏱️ Time yourself (target: 15-20 min)

16:00 ━━━━━━━━━━ BUFFER TIME (2 hours) ━━━━━━━━━
      🔧 Fix any last-minute issues
      🚀 Deploy to production
      ✅ Test on production

18:00 ━━━━━━━━━━ FINAL PREP (30min) ━━━━━━━━━━━
      ✅ Production site up
      ✅ Browser cache cleared
      ✅ Test card ready (4242...)
      ✅ Demo script open
      ✅ Notifications off

18:30 ━━━━━━━━━━ REST BEFORE DEMO ━━━━━━━━━━━━━
      😌 Clear your head
      💪 Confidence check
      🎯 Review key talking points

[TIME] ━━━━━━━━━━ INVESTOR DEMO 🎯 ━━━━━━━━━━━━
      ⏱️ Duration: 15-20 minutes

      00:00 - 02:00 | Introduction
      02:00 - 03:00 | Plan Selection
      03:00 - 06:00 | Checkout Flow
      06:00 - 11:00 | Onboarding Wizard
      11:00 - 19:00 | Dashboard Tour ⭐ (MAIN EVENT)
      19:00 - 20:00 | Closing & Q&A

[TIME+30] ━━━━━━━ POST-DEMO DEBRIEF ━━━━━━━━━━━
      📝 Note investor feedback
      🐛 Document any bugs found
      🎉 CELEBRATE - You did it!
```

**Sunday Success Criteria**:
- ✅ Dashboard has 2-3 features with real data
- ✅ All components have graceful error handling
- ✅ E2E test suite passing
- ✅ Demo rehearsed and timed
- ✅ Production deployment successful
- ✅ Demo delivered confidently
- ✅ No critical bugs during demo

---

## Technical Implementation

### E2E Test: Conversion Pipeline

**File**: `tests/e2e/conversion-pipeline.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('conversion pipeline: payment to dashboard', async ({ page }) => {
  // 1. Start at plan selection
  await page.goto('http://localhost:3000/choose-plan')

  // 2. Select Professional Monthly plan
  await page.click('[data-testid="plan-professional"]')
  await page.click('[data-testid="billing-monthly"]')

  // 3. Fill company info in modal
  await page.fill('[name="companyName"]', 'E2E Test Campground')
  await page.fill('[name="propertyName"]', 'Test RV Park')
  await page.fill('[name="siteCount"]', '25')

  // 4. Proceed to Stripe checkout
  await page.click('button:has-text("Continue to Payment")')

  // 5. Wait for Stripe checkout page
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 })

  // 6. Fill Stripe test card
  const cardFrame = page.frameLocator('iframe').first()
  await cardFrame.locator('[name="number"]').fill('4242424242424242')
  await cardFrame.locator('[name="expiry"]').fill('12/34')
  await cardFrame.locator('[name="cvc"]').fill('123')
  await page.fill('[name="billingName"]', 'E2E Test User')

  // 7. Submit payment
  await page.click('button[type="submit"]:has-text("Pay")')

  // 8. CRITICAL: Wait for wizard (webhook must process)
  await page.waitForURL(/dashboard\/sites\?wizard=true/, {
    timeout: 20000 // Give webhook time to process
  })

  // 9. CRITICAL: Verify NO redirect loops
  await page.waitForTimeout(3000) // Wait 3 seconds
  const currentUrl = page.url()
  expect(currentUrl).toContain('wizard=true')
  expect(currentUrl).toContain('/dashboard/sites')

  // 10. Verify wizard content loads
  await expect(page.locator('h1')).toContainText('Setup Wizard', {
    timeout: 5000
  })
})

test('wizard access after page refresh (no loops)', async ({ page }) => {
  // Regression test for Oct 30 incident

  // 1. Navigate directly to wizard
  await page.goto('http://localhost:3000/dashboard/sites?wizard=true')

  // 2. Wait for wizard to load
  await expect(page.locator('h1')).toContainText('Setup Wizard', {
    timeout: 10000
  })

  // 3. Verify NO redirect loops
  await page.waitForTimeout(2000)
  const url = page.url()
  expect(url).toContain('wizard=true')

  // 4. Refresh page
  await page.reload()

  // 5. Verify still on wizard (no redirect away)
  await page.waitForTimeout(2000)
  const urlAfterRefresh = page.url()
  expect(urlAfterRefresh).toContain('wizard=true')
})
```

**Playwright Config**: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

---

### Dashboard API Endpoints

**File**: `app/api/dashboard/sites/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // 2. Get user's company (tenant isolation)
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json(
      { error: 'Company not found' },
      { status: 404 }
    )
  }

  // 3. Fetch sites for this company (tenant-isolated)
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select(`
      id,
      name,
      site_number,
      site_type,
      status,
      base_price,
      max_occupancy,
      amenities
    `)
    .eq('company_id', company.id)
    .order('site_number', { ascending: true })

  if (sitesError) {
    console.error('Failed to fetch sites:', sitesError)
    return NextResponse.json(
      { error: 'Failed to fetch sites' },
      { status: 500 }
    )
  }

  return NextResponse.json({ sites: sites || [] })
}
```

**File**: `app/api/dashboard/stats/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Fetch stats (tenant-isolated)
  const { count: siteCount } = await supabase
    .from('sites')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)

  const { count: bookingCount } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)

  const { data: revenueData } = await supabase
    .from('reservations')
    .select('total_price')
    .eq('company_id', company.id)
    .eq('status', 'confirmed')

  const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0

  return NextResponse.json({
    totalSites: siteCount || 0,
    totalBookings: bookingCount || 0,
    totalRevenue,
  })
}
```

---

### React Components with Error Handling

**File**: `components/dashboard/sites/site-list.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Site = {
  id: string
  name: string
  site_number: string
  site_type: string
  status: string
  base_price: number
}

export function SiteList() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSites = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/dashboard/sites')

      if (!response.ok) {
        throw new Error('Failed to load sites')
      }

      const data = await response.json()
      setSites(data.sites)
    } catch (err) {
      console.error('Error fetching sites:', err)
      setError('Failed to load sites. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSites()
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error}
          <Button onClick={fetchSites} variant="outline" size="sm" className="ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (sites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No sites found. Add your first site to get started.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sites.map(site => (
        <div
          key={site.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div>
            <h3 className="font-semibold">{site.name}</h3>
            <p className="text-sm text-muted-foreground">
              {site.site_type} • Site #{site.site_number}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">${site.base_price}/night</p>
            <p className="text-sm text-muted-foreground">{site.status}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## Demo Preparation

### Demo Script (15-20 minutes)

**Pre-Demo Setup (30 min before)**:
- [ ] Production site is up: https://your-app.vercel.app
- [ ] Browser cache cleared
- [ ] Test Stripe card ready: 4242 4242 4242 4242, 12/34, 123
- [ ] Close unnecessary browser tabs
- [ ] Close Slack, email, notifications
- [ ] Have backup plan ready (screen recording)

---

**1. Introduction (2 min)**

What to say:
> "CampOS is a modern, all-in-one platform for campground operators. Let me show you how easy it is to get started."

What to show: Home page or marketing site

---

**2. Plan Selection (1 min)**

What to do:
- Navigate to `/choose-plan`
- Hover over plan features
- Click "Professional" plan
- Select "Monthly" billing

What to say:
> "Operators choose a plan based on their campground size. We have simple, transparent pricing."

What NOT to click: Don't change plans mid-demo

---

**3. Checkout Flow (3 min)**

What to do:
- Fill company info modal:
  - Company Name: "Riverside Campground"
  - Property Name: "Riverside RV Park"
  - Site Count: 50
- Click "Continue to Payment"
- Fill Stripe checkout:
  - Card: 4242 4242 4242 4242
  - Expiry: 12/34
  - CVC: 123
  - Name: "Demo User"
- Submit payment

What to say:
> "We use Stripe for secure payment processing. Behind the scenes, we're creating their account, setting up their database, and preparing their onboarding."

What NOT to do: Don't use real credit card

---

**4. Onboarding Wizard (5 min)**

What to do:
- Wait for wizard to load (webhook processing)
- Click "Get Started"
- Complete wizard steps:
  - Add sample sites
  - Configure basic settings
  - Set up initial availability
- Click "Complete Setup"

What to say:
> "After payment, operators go through a simple wizard to set up their campground. We guide them through adding sites, setting prices, and configuring their property."

What to highlight:
- No complex setup required
- Wizard saves progress automatically
- Data flows into their dashboard

What NOT to do: Don't skip steps (show the flow)

---

**5. Dashboard Tour (8 min) - MAIN EVENT**

What to do:
- Navigate through dashboard sections:
  - **Stats Overview**: Show total sites, bookings, revenue
  - **Site List**: Show sites added in wizard
  - **Recent Activity**: Show recent changes
  - **Navigation**: Show sidebar, property switcher

What to say:
> "Now they have a fully functional dashboard. Everything is connected to the database - these are the actual sites they just created in the wizard."

What to highlight:
- Real data (not mock)
- Clean, modern UI
- Intuitive navigation
- Ready for actual campground operations

What NOT to click:
- Features not yet implemented
- Settings that might break something
- Detailed analytics (if not ready)

---

**6. Closing (2 min)**

What to say:
> "This is CampOS - a complete solution for modern campground management. What you've seen is:
> - Seamless payment and onboarding
> - Automated account setup
> - Real-time data flow
> - Beautiful, intuitive interface
>
> The entire conversion pipeline - from signup to working dashboard - takes less than 5 minutes. Operators can start managing their campground immediately."

Q&A:
- Be ready for technical questions
- Be honest about what's not yet built
- Focus on the vision and roadmap

---

**Known Issues (Don't Show)**:
- [List any known bugs or incomplete features]
- [Workarounds if investor clicks on them]

**Backup Plan**:
If live demo fails:
- Have screen recording ready
- Show pre-recorded demo
- Explain what happened, show logs/fixes

---

### Demo Checklist (30 Minutes Before)

**Technical**:
- [ ] Production site is up and responsive
- [ ] Test signup flow one last time on production
- [ ] Dashboard shows real data
- [ ] Stats cards show correct numbers
- [ ] No redirect loops detected
- [ ] E2E test passes: `npx playwright test`
- [ ] No console errors in browser

**Environment**:
- [ ] Clear browser cache and cookies
- [ ] Test Stripe card ready: 4242 4242 4242 4242, 12/34, 123
- [ ] Demo script open and reviewed
- [ ] Backup screen recording ready
- [ ] Close Slack, email, all notifications
- [ ] Phone on silent mode

**Mental**:
- [ ] Deep breath - you've prepared well
- [ ] Review key talking points
- [ ] Confidence check: "I know this works"

---

## Success Criteria & Validation

### Minimum Success (MUST ACHIEVE)
- ✅ Conversion pipeline works (signup → onboarding → dashboard)
- ✅ Dashboard shows real data from database (at least 1-2 features)
- ✅ E2E test passes (prevents regression)
- ✅ No crashes during demo
- ✅ Graceful error handling (no infinite spinners)

### Stretch Success (NICE TO HAVE)
- Dashboard shows 3+ features with real data
- E2E test covers complete wizard flow
- Demo runs smoothly with no hiccups
- Investor is visibly impressed

### Demo Success Metrics
- Investor says "This looks promising" or similar positive feedback
- Investor asks about next steps (positive signal)
- Investor doesn't find critical bugs during demo
- You feel confident in the product
- No major embarrassment

---

### Quality Gates

**End of Saturday (9pm)**:
- [ ] `npx playwright test` - E2E test passing
- [ ] `npm run type-check` - No TypeScript errors
- [ ] Manual test: Signup → Onboard → Dashboard (complete flow works)
- [ ] At least 1 dashboard component shows real data
- [ ] No infinite redirect loops detected
- [ ] Changes committed to git

**End of Sunday Morning (12pm)**:
- [ ] 2-3 dashboard components with real data
- [ ] All components have graceful error handling
- [ ] E2E test still passing after changes
- [ ] Integration testing complete (no critical bugs)

**30 Minutes Before Demo (Sunday 6pm)**:
- [ ] Production site up and responsive
- [ ] Test signup flow works on production
- [ ] Demo script ready
- [ ] Demo rehearsed successfully
- [ ] Backup plan ready (screen recording)

---

## Risk Mitigation

### High-Risk Scenarios & Mitigation

**Risk 1: Dashboard integration takes longer than expected**
- **Probability**: MEDIUM-HIGH
- **Impact**: HIGH (investor will notice mock data)
- **Mitigation**:
  - Start with simplest component (site list)
  - Cut scope aggressively: 1 working feature > 3 broken features
  - Deadline: If not done by Sunday 12pm, cut scope
- **Backup**: Demo with 1 working dashboard feature, acknowledge rest is in progress

**Risk 2: E2E test uncovers new regression**
- **Probability**: LOW-MEDIUM
- **Impact**: CRITICAL (broken conversion pipeline)
- **Mitigation**:
  - Run E2E test early (Saturday morning)
  - Fix bugs immediately before continuing
  - Test after EVERY change to dashboard/middleware
- **Backup**: Revert to last known good commit

**Risk 3: Production deployment breaks something**
- **Probability**: LOW
- **Impact**: CRITICAL (demo will fail)
- **Mitigation**:
  - Deploy Saturday evening (not Sunday)
  - Manual test after every deployment
  - Have rollback plan ready
- **Backup**: Revert deployment, demo from local or staging

**Risk 4: Demo environment issues (internet, browser, etc.)**
- **Probability**: LOW
- **Impact**: HIGH (can't show product)
- **Mitigation**:
  - Record backup video of working flow
  - Test from same device/network as demo
  - Have screen recording ready
- **Backup**: Show pre-recorded demo, explain technical difficulty

**Risk 5: Investor clicks on incomplete feature**
- **Probability**: MEDIUM
- **Impact**: MEDIUM (awkward moment)
- **Mitigation**:
  - Document known incomplete features
  - Practice demo flow to avoid those areas
  - Prepare explanation: "That's on our roadmap for next sprint"
- **Backup**: Honest acknowledgment, pivot to working features

---

## Post-Demo Actions

### Immediately After (Sunday Evening)
- [ ] Celebrate - you did it! 🎉
- [ ] Document investor feedback
- [ ] Note any bugs discovered during demo
- [ ] Get good sleep - you earned it

### Monday Morning (Nov 4)
- [ ] Triage investor feedback (urgent vs. later)
- [ ] Close CAM-148, CAM-149, CAM-150, CAM-151, CAM-152, CAM-153 (if complete)
- [ ] Move CAM-154, CAM-155, CAM-156, CAM-157 to "In Progress"
- [ ] Schedule team retrospective

### Week of Nov 4-8 (POST-DEMO SPRINT)
- [ ] CAM-154: Fix 15 Skipped Tests (10h)
- [ ] CAM-155: Type Safety: Generate & Apply Supabase Types (2h)
- [ ] CAM-156: Error Monitoring: Sentry Integration (4h)
- [ ] CAM-157: Create Deployment Checklist & Runbook (1h)

### Week of Nov 11+ (BACK TO CAM-129)
- Resume 6-week middleware refactor sprint
- Phase 2: Foundation (CAM-135, CAM-136, CAM-137)
- Phase 3: Wizard Logic (CAM-138, CAM-139, CAM-140)
- Phase 4: Testing (CAM-141, CAM-142, CAM-143, CAM-144)
- Phase 5: Docs & Deployment (CAM-145, CAM-146, CAM-147)

---

## Quick Reference

### Emergency Commands

```bash
# E2E tests
npx playwright test
npx playwright test --ui  # Debug mode

# Quality checks
npm run type-check
npm run test

# Deploy
git add .
git commit -m "feat(demo): [description]"
git push origin main

# Rollback if deployment breaks
git revert HEAD
git push origin main
```

### Test Data for Demo
- Company Name: "Riverside Campground"
- Property Name: "Riverside RV Park"
- Site Count: 50
- Stripe Card: 4242 4242 4242 4242, 12/34, 123

### Linear URLs
- CAM-148: https://linear.app/campgroundops/issue/CAM-148
- CAM-149: https://linear.app/campgroundops/issue/CAM-149
- CAM-150: https://linear.app/campgroundops/issue/CAM-150
- CAM-151: https://linear.app/campgroundops/issue/CAM-151
- CAM-152: https://linear.app/campgroundops/issue/CAM-152
- CAM-153: https://linear.app/campgroundops/issue/CAM-153

---

## Key Reminders

1. **Test After Every Change** - Run E2E test frequently
2. **Cut Scope Aggressively** - 1 working feature > 3 broken features
3. **Sleep Well** - 6-7 hours minimum each night
4. **Stay Calm During Demo** - You've prepared well
5. **This is ONE Demo** - Not a product launch, not your entire career

---

**You've got this. Let's make this demo count. 🚀**
