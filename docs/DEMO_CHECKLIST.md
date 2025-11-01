# Investor Demo Checklist - November 2, 2025

**Quick Reference**: Critical tasks for successful demo delivery

---

## SATURDAY, NOV 1 (TODAY) - 12-14 hours

### Morning (8am-12pm)
- [ ] **Dashboard Audit** (1h) - List components, plan integration
- [ ] **E2E Test Setup** (3h)
  - Install Playwright: `npm install -D @playwright/test`
  - Create `tests/e2e/conversion-pipeline.spec.ts`
  - Test: Plan → Stripe → Webhook → Wizard → Dashboard
  - Verify: NO redirect loops (regression test)

### Afternoon (1pm-5pm)
- [ ] **Dashboard Integration #1** (4h) - Site List
  - Create API: `app/api/dashboard/sites/route.ts`
  - Update component: `components/dashboard/sites/site-list.tsx`
  - Add loading skeleton + error handling
  - Manual test: Wizard sites appear in dashboard

### Evening (6pm-9pm)
- [ ] **Dashboard Integration #2** (optional) - Stats or Bookings
- [ ] **Validation** (30 min)
  - E2E test passes
  - Dashboard shows real data
  - Type-check passes
  - Commit and push to git

### End of Day Requirements
- ✅ E2E test passing
- ✅ At least 1 dashboard component with real data
- ✅ No regressions to conversion pipeline

---

## SUNDAY, NOV 2 (DEMO DAY) - 8-10 hours

### Morning (8am-12pm)
- [ ] **Finish Dashboard** (3h) - Stats cards, bookings list
- [ ] **Error Handling** (1h) - Replace spinners with Skeleton, add Retry buttons

### Afternoon (1pm-4pm)
- [ ] **Integration Testing** (2h)
  - Test complete signup → dashboard flow
  - Test returning user flow
  - Run E2E test suite
  - Fix any bugs discovered
- [ ] **Demo Prep** (1h)
  - Write demo script
  - Rehearse 2-3 times
  - Time demo (15-20 min target)

### Buffer (4pm-6pm)
- [ ] Final polish and bug fixes
- [ ] Deploy to production
- [ ] Final production test
- [ ] Rest before demo

### 30 Minutes Before Demo
- [ ] Production site is up
- [ ] Test signup flow one last time
- [ ] Clear browser cache
- [ ] Test Stripe card ready: 4242 4242 4242 4242, 12/34, 123
- [ ] Close Slack, email, notifications
- [ ] Demo script open
- [ ] Deep breath

### Evening - DEMO TIME 🎯
- [ ] Deliver demo (15-20 min)
- [ ] Q&A session
- [ ] Note investor feedback
- [ ] Celebrate! 🎉

---

## CRITICAL PATHS (DON'T SKIP)

### Must Complete
1. **E2E Test** - Prevents regression, builds confidence
2. **Dashboard Integration** - At least site list showing real data
3. **Error Handling** - Graceful failures, no infinite spinners
4. **Demo Rehearsal** - Practice makes perfect

### Can Skip If Time Runs Out
- Additional dashboard features (beyond site list)
- UI polish and styling
- Comprehensive test coverage
- Performance optimization

---

## DEMO FLOW (15-20 minutes)

1. **Intro** (2 min) - Explain CampOS value proposition
2. **Plan Selection** (1 min) - Choose Professional Monthly
3. **Checkout** (3 min) - Fill info, Stripe test card, submit
4. **Wizard** (5 min) - Complete onboarding, show setup flow
5. **Dashboard** (8 min) - **MAIN EVENT** - Show real data, navigation, features
6. **Closing** (2 min) - Summarize, Q&A

### Test Data for Demo
- Company Name: "Riverside Campground"
- Property Name: "Riverside RV Park"
- Site Count: 50
- Stripe Card: 4242 4242 4242 4242, 12/34, 123

---

## BACKUP PLANS

### If Dashboard Integration Fails
- Demo with 1 working feature (site list)
- Acknowledge rest is in progress
- Focus on conversion pipeline quality

### If E2E Test Keeps Failing
- Fix the regression immediately (critical)
- Don't proceed until conversion pipeline works
- Revert to last known good commit if needed

### If Demo Goes Wrong
- Stay calm, have explanation ready
- Show screen recording backup
- Focus on value, not technical issues
- Be honest about what's not yet built

---

## SUCCESS CRITERIA

### Minimum (MUST ACHIEVE)
- ✅ Conversion pipeline works during demo
- ✅ Dashboard shows at least 1-2 features with real data
- ✅ E2E test passing (prevents future issues)
- ✅ No crashes or infinite loops

### Stretch (NICE TO HAVE)
- Dashboard shows 3+ features with real data
- Demo runs smoothly with no hiccups
- Investor is visibly impressed

---

## EMERGENCY COMMANDS

```bash
# Run E2E tests
npx playwright test

# Run E2E tests in UI mode (debug)
npx playwright test --ui

# Type check
npm run type-check

# Run all tests
npm run test

# Deploy to production
git add .
git commit -m "feat(demo): [description]"
git push origin main

# Rollback if deployment breaks
git revert HEAD
git push origin main
```

---

## KEY REMINDERS

1. **Test After Every Change** - Run E2E test frequently
2. **Cut Scope Aggressively** - 1 working feature > 3 broken features
3. **Sleep Well** - 6-7 hours minimum each night
4. **Stay Calm During Demo** - You've prepared well
5. **This is ONE Demo** - Not a product launch, not your entire career

---

## POST-DEMO (Monday+)

- [ ] Document investor feedback
- [ ] Note any bugs discovered
- [ ] Return to CAM-129 middleware refactor sprint
- [ ] Implement deferred P0 items
- [ ] Schedule team retrospective

---

**Full Details**: See `docs/EMERGENCY_SPRINT_NOV_1-2_2025.md`

**You've got this. Let's make it count. 🚀**
