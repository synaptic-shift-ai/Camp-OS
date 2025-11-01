# Conversion Pipeline Flow - Complete User Journey

**Last Updated**: 2025-10-30 (Post-Crisis Recovery)
**Status**: ✅ WORKING (All fixes deployed)

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONVERSION PIPELINE                              │
│                    (Customer → Onboarding → Dashboard)                   │
└─────────────────────────────────────────────────────────────────────────┘

1. PLAN SELECTION
   ┌──────────────┐
   │ /choose-plan │ → User selects plan, billing cycle, properties
   └──────┬───────┘
          │
          ↓
2. STRIPE CHECKOUT
   ┌────────────────────┐
   │ Stripe Hosted Page │ → Payment processing (test mode: 4242 4242...)
   └──────┬─────────────┘
          │
          ↓ Payment Success
          │
   ┌──────┴──────────────────────────────────────────────────────┐
   │                    CRITICAL SECTION                          │
   │         (Where incident occurred - Oct 30, 2025)             │
   └──────────────────────────────────────────────────────────────┘
          │
          ↓
3. WEBHOOK PROCESSING (Stripe → API)
   ┌────────────────────────────────────────────────────────┐
   │ POST /api/stripe/webhook                               │
   │                                                         │
   │ Event 1: checkout.session.completed                   │
   │   ✅ Creates company record                            │
   │   ✅ Creates properties (from metadata)                │
   │   ✅ Sets subscription_status = "active"               │
   │   ✅ Logs to subscription_events                       │
   │                                                         │
   │ Event 2: customer.subscription.created (RACE!)        │
   │   ⚠️  RETRY LOGIC (max 3 attempts, 500ms delay)       │
   │   ✅ Finds company by stripe_customer_id              │
   │   ✅ Updates subscription details                      │
   │                                                         │
   │ Event 3: invoice.payment_succeeded                    │
   │   ⚠️  RETRY LOGIC (same as above)                     │
   │   ✅ Logs payment event                                │
   └────────────────┬──────────────────────────────────────┘
                    │
                    ↓
4. REDIRECT TO WIZARD
   ┌────────────────────────────────────┐
   │ /dashboard/sites?wizard=true       │ ← Stripe success_url
   └────────────────┬───────────────────┘
                    │
                    ↓
5. MIDDLEWARE CHECK (lib/supabase/middleware.ts)
   ┌─────────────────────────────────────────────────────────┐
   │ Check 1: Authentication ✅ (user logged in)             │
   │ Check 2: Subscription ✅ (companies.subscription_status)│
   │ Check 3: Onboarding Status                              │
   │                                                          │
   │   🚨 CRITICAL LOGIC (Fixed in 184f6fd):                │
   │                                                          │
   │   const isWizardOrOnboarding =                          │
   │     wizard=true OR /onboarding path                     │
   │                                                          │
   │   if (isWizardOrOnboarding) {                           │
   │     ✅ ALLOW ACCESS (wizard IS onboarding)             │
   │   } else {                                              │
   │     Check incomplete properties → redirect /onboarding  │
   │   }                                                      │
   │                                                          │
   │   ⚠️  WITHOUT THIS CHECK → INFINITE REDIRECT LOOP!     │
   └────────────────┬────────────────────────────────────────┘
                    │
                    ↓ ALLOWED
                    │
6. PROPERTIES API
   ┌──────────────────────────────────────────────────────┐
   │ GET /api/onboarding/properties                       │
   │                                                       │
   │ 🚨 CRITICAL (Fixed in 8cdd5ec):                     │
   │                                                       │
   │   .select("*")  // ALL FIELDS                       │
   │                                                       │
   │   Returns:                                            │
   │   - id, slug, name                                    │
   │   - owner_id, company_id                             │
   │   - wizard_step_completed, wizard_progress           │
   │   - site_count, onboarding_completed                 │
   │   - ... ALL OTHER FIELDS                             │
   │                                                       │
   │   ⚠️  PARTIAL SELECT → PropertyContext fails!       │
   └────────────────┬─────────────────────────────────────┘
                    │
                    ↓
7. WIZARD LOADS
   ┌──────────────────────────────────────┐
   │ PropertyContext initializes          │
   │ Multi-property wizard displays       │
   │ User completes setup for each prop   │
   └────────────────┬─────────────────────┘
                    │
                    ↓
8. ONBOARDING STEPS
   ┌──────────────────────────────────────┐
   │ Step 1: Basic Info                   │
   │ Step 2: Site Details                 │
   │ Step 3: Pricing                      │
   │ Step 4: Review & Launch              │
   └────────────────┬─────────────────────┘
                    │
                    ↓ All Complete
                    │
9. COMPLETION
   ┌──────────────────────────────────────┐
   │ POST /api/onboarding/complete        │
   │ Updates: onboarding_completed = true │
   └────────────────┬─────────────────────┘
                    │
                    ↓
10. DASHBOARD
    ┌──────────────────────────────────────┐
    │ /dashboard                           │
    │ ✅ Shows SetupCompleteToast         │
    │ ✅ Full access to all features      │
    └──────────────────────────────────────┘
```

---

## Error Conditions & Fixes

### ❌ ISSUE #1: Webhook Race Condition
**Symptom**: "Company not found" errors in logs

**Flow**:
```
Stripe fires events simultaneously:
  checkout.session.completed (creates company)  ←─┐
  customer.subscription.created (updates company) ←┘ RACE!
    ↓
  company not found yet → ERROR
```

**Fix** (Commit `819753f`):
```typescript
// Retry with backoff
let attempts = 0
while (!company && attempts < 3) {
  // Find company
  if (!found) await sleep(500ms)
}
```

**Impact**: ✅ Subscription always updated, no lost data

---

### ❌ ISSUE #2: Incomplete Properties API Response
**Symptom**: Wizard stuck on loading spinner

**Flow**:
```
Properties API:
  .select("id, name, company_id, onboarding_completed")
    ↓
PropertyContext expects ALL fields:
  - wizard_step_completed ← MISSING!
  - wizard_progress ← MISSING!
  - slug ← MISSING!
    ↓
  Silent failure → infinite loading
```

**Fix** (Commit `8cdd5ec`):
```typescript
.select("*")  // Return ALL fields
```

**Impact**: ✅ PropertyContext initializes, wizard loads

---

### ❌ ISSUE #3: Middleware Redirect Loop (THE BIG ONE)
**Symptom**: Infinite 307 redirects, wizard never loads

**Flow - BEFORE FIX**:
```
/dashboard/sites?wizard=true
  ↓
Middleware: "onboarding incomplete → /onboarding"
  ↓
/onboarding
  ↓
Onboarding page: "redirect to wizard"
  ↓
/dashboard/sites?wizard=true
  ↓
♾️ INFINITE LOOP
```

**Root Cause** (Commit `d078412`):
```typescript
// Refactored to use companies table (correct)
// BUT removed wizard access exception (BREAKING)

if (incompleteProperties.length > 0) {
  if (!pathname.startsWith("/onboarding")) {
    redirect("/onboarding")  // ← Always redirects wizard!
  }
}
```

**Fix - FIRST ATTEMPT** (Commit `c24735a`):
```typescript
const isWizardRoute =
  pathname === "/dashboard/sites" &&
  wizard === "true"

if (!isWizardRoute && incompleteProperties.length > 0) {
  redirect("/onboarding")
}
```

**Problem**: Still had loops during step navigation

**Fix - FINAL** (Commit `184f6fd`):
```typescript
// SIMPLIFIED: Allow wizard OR onboarding paths
const isWizardOrOnboarding =
  wizard === "true" ||
  pathname.startsWith("/onboarding")

if (!isWizardOrOnboarding) {
  // Only then check incomplete properties
}
```

**Impact**: ✅ No redirect loops, wizard fully accessible

---

## Critical Dependencies

### Database Tables
```sql
companies
  - id
  - owner_id
  - subscription_status ← Checked by middleware
  - stripe_customer_id ← Used by webhooks
  - subscription_id

properties
  - id
  - company_id
  - onboarding_completed ← Checked by middleware
  - wizard_step_completed
  - wizard_progress
  - ... ALL FIELDS needed by PropertyContext

subscription_events
  - id
  - company_id ← Changed from property_id in d078412
  - event_type
  - stripe_event_id ← Idempotency key
```

### Environment Variables (Required)
```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Testing Checklist

### Manual Testing (DO BEFORE DEPLOY)
- [ ] Complete test checkout with Stripe test card (4242 4242 4242 4242)
- [ ] Verify no "Company not found" in webhook logs
- [ ] Verify redirect to `/dashboard/sites?wizard=true` works
- [ ] Open browser DevTools → Check NO redirect loops (URL stable)
- [ ] Verify wizard loads within 2 seconds
- [ ] Complete all wizard steps
- [ ] Verify redirect to dashboard
- [ ] Verify SetupCompleteToast appears

### Automated Testing (TODO - CRITICAL)
- [ ] E2E test: Full conversion pipeline
- [ ] Integration test: Properties API returns all fields
- [ ] Unit test: Middleware wizard access logic
- [ ] Integration test: Webhook retry logic
- [ ] Integration test: Webhook idempotency

---

## Monitoring Points

### Webhook Logs (Vercel Dashboard)
```
✅ Good:
[Webhook] ✓ Signature verified successfully
[Webhook] ✓ Company found: <uuid>
[Webhook] ✅ Company created successfully
[Webhook] ✅ Properties created: 2

❌ Bad:
[Webhook] ❌ Company not found after 3 attempts
[Webhook] ❌ ERROR creating company
```

### Middleware Behavior (Browser DevTools Network)
```
✅ Good:
/dashboard/sites?wizard=true → 200 OK (stable URL)

❌ Bad:
/dashboard/sites?wizard=true → 307 /onboarding
/onboarding → 307 /dashboard/sites?wizard=true
(repeating infinitely)
```

### Properties API Response (Browser DevTools)
```json
✅ Good:
{
  "properties": [{
    "id": "...",
    "slug": "...",
    "wizard_step_completed": "...",
    // ... ALL FIELDS PRESENT
  }]
}

❌ Bad:
{
  "properties": [{
    "id": "...",
    "name": "...",
    // Missing: slug, wizard_step_completed, etc.
  }]
}
```

---

## Quick Reference

### If Conversion Pipeline Breaks

1. **Check webhook logs** (Vercel dashboard)
   - Look for: "Company not found", "ERROR creating company"

2. **Check browser console**
   - Look for: 307 redirects, infinite loops

3. **Verify Properties API**
   - Open `/api/onboarding/properties` directly
   - Verify all fields present in response

4. **Recent commits**
   ```bash
   git log --oneline -10
   # Look for changes to middleware.ts, webhook/route.ts
   ```

5. **Rollback if needed**
   ```bash
   git revert <bad-commit-sha>
   git push origin main
   ```

### If Changing Middleware

1. **Read**: `/e/Projects/Saas_CampOS/docs/reference/ONBOARDING_CRISIS_HANDOFF.md`
2. **Test**: Complete conversion pipeline manually
3. **Verify**: No redirect loops with wizard=true param
4. **Deploy**: Staging first, monitor logs

### If Changing Webhooks

1. **Read**: Webhook race condition documentation
2. **Test**: Stripe test mode checkout
3. **Verify**: Company creation works, no "not found" errors
4. **Deploy**: Monitor logs for 15 minutes

---

## Success Metrics (Current)

| Metric | Status | Notes |
|--------|--------|-------|
| Webhook Success Rate | ✅ 100% | Manual testing, no errors in logs |
| Company Creation | ✅ Working | Retry logic prevents race conditions |
| Wizard Access | ✅ Working | No redirect loops |
| Properties API | ✅ Working | Returns all required fields |
| Onboarding Completion | ✅ Working | Full flow tested end-to-end |

**Last Verified**: 2025-10-30, 10:00 PM
**Next Verification**: After E2E tests implemented

---

**Related Documents**:
- [Full Incident Report](./ONBOARDING_CRISIS_HANDOFF.md)
- [Quick Summary](./INCIDENT_SUMMARY_2025_10_30.md)
- [Payment Testing Guide](./PAYMENT_FLOW_TESTING_GUIDE.md)
- [Production Testing Guide](./PRODUCTION_TESTING_GUIDE.md)
