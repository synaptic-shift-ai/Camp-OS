# Payment Flow Testing Guide

## Prerequisites Checklist

### ✅ Completed
- [x] Database migration run (companies table created)
- [x] Middleware updated to check companies.subscription_status
- [x] Webhook updated to use company_id in subscription_events
- [x] Stripe keys configured in .env.local

### ⚠️ Required Before Testing
- [ ] **STRIPE_WEBHOOK_SECRET** - Missing from .env.local (see setup below)
- [ ] Local webhook listener running (Stripe CLI)
- [ ] Development server running

---

## Setup: Stripe Webhook for Local Testing

### Option 1: Stripe CLI (Recommended for Local Testing)

1. **Install Stripe CLI** (if not already installed):
   ```bash
   # Windows (using Scoop)
   scoop install stripe

   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe CLI**:
   ```bash
   stripe login
   ```

3. **Start webhook forwarding**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   This will output something like:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxx (^C to quit)
   ```

4. **Copy the signing secret** and add to `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

5. **Restart your dev server** to pick up the new environment variable.

### Option 2: Stripe Dashboard Webhook (For Deployed Testing)

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter URL: `https://your-domain.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the signing secret and add to environment variables

---

## Test Flow

### Test 1: Complete Signup → Payment Flow

#### Step 1: Start Development Environment

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start Stripe webhook listener
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

#### Step 2: Clear Browser State

1. Open incognito/private browsing window
2. Or clear cookies/localStorage for localhost:3000

#### Step 3: Signup

1. Navigate to: http://localhost:3000/signup
2. Fill out form:
   - **Full Name**: Test User
   - **Email**: test+$(date +%s)@example.com (or any unique email)
   - **Password**: TestPassword123!
3. Click "Sign Up"
4. **Expected**: Immediate redirect to `/company-details`
5. **Verify**: Check browser console for "[Auth] User created" log

#### Step 4: Company Details

1. Fill out company details form:
   - **Company Name**: "Test Campgrounds LLC"
   - **Number of Properties**: 2
   - **Property 1**:
     - Name: "Pine Valley Campground"
     - Sites: 20
   - **Property 2**:
     - Name: "Mountain View RV Park"
     - Sites: 15
2. Click "Choose Plan"
3. **Expected**: Redirect to `/choose-plan?sites=35&company=<base64>`
4. **Verify**:
   - Check URL has both `sites` and `company` params
   - Open browser console and run: `JSON.parse(atob(new URLSearchParams(location.search).get('company')))`
   - Should show company data structure

#### Step 5: Plan Selection

1. **Verify**: Recommended plan should be "Growth" (35 sites)
2. Select **Starter** plan (easier for testing)
3. Toggle billing cycle if desired (monthly/annual)
4. Click "Get Started"
5. **Expected**: Loading spinner, then redirect to Stripe Checkout
6. **Verify**: No 401 errors in browser console
7. **Check Stripe CLI output** for session creation

#### Step 6: Stripe Checkout

1. Fill out Stripe test payment form:
   - **Email**: (auto-filled)
   - **Card**: 4242 4242 4242 4242
   - **Expiry**: Any future date (e.g., 12/34)
   - **CVC**: Any 3 digits (e.g., 123)
   - **Name**: Test User
   - **Country**: United States
   - **ZIP**: 12345
2. Click "Subscribe"
3. **Expected**: Processing → Redirect to `/payment/success`

#### Step 7: Webhook Processing

1. **Check Stripe CLI terminal** - should see:
   ```
   --> checkout.session.completed [evt_xxxxx]
   <-- [200] POST http://localhost:3000/api/stripe/webhook [evt_xxxxx]
   ```

2. **Check dev server logs** for:
   ```
   [Webhook] Parsed company data: { companyName: 'Test Campgrounds LLC', propertyCount: 2 }
   [Webhook] Company created: <uuid>
   [Webhook] Properties created: 2
   ```

3. **If errors occur**:
   - Check webhook signature verification
   - Check database permissions (service role key)
   - Check company data JSON parsing

#### Step 8: Payment Success Page

1. **Verify UI shows**:
   - ✅ "We're Setting Up Your Properties"
   - ✅ "Check your email" message
   - ❌ NO "Continue to Onboarding" button (should be removed)

2. **Check email inbox** (currently logs only):
   - Dev console should show: `[Onboarding Email] Should send to ...`

---

### Test 2: Verify Database Records

1. Open Supabase dashboard: https://supabase.com/dashboard
2. Go to Table Editor

#### Check Companies Table

```sql
-- Find the company created by webhook
SELECT
  id,
  name,
  owner_id,
  stripe_customer_id,
  subscription_id,
  subscription_status,
  subscription_plan,
  billing_cycle,
  created_at
FROM companies
WHERE name = 'Test Campgrounds LLC'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- ✅ Company record exists
- ✅ `name` = "Test Campgrounds LLC"
- ✅ `stripe_customer_id` starts with "cus_"
- ✅ `subscription_id` starts with "sub_"
- ✅ `subscription_status` = "active"
- ✅ `subscription_plan` matches selected plan

#### Check Properties Table

```sql
-- Find properties linked to the company
SELECT
  id,
  name,
  company_id,
  owner_id,
  site_count,
  onboarding_completed,
  created_at
FROM properties
WHERE company_id = '<company-id-from-above>'
ORDER BY created_at ASC;
```

**Expected**:
- ✅ 2 property records exist
- ✅ Property 1: name = "Pine Valley Campground", site_count = 20
- ✅ Property 2: name = "Mountain View RV Park", site_count = 15
- ✅ Both have `company_id` matching the company
- ✅ Both have `onboarding_completed` = false
- ✅ Both have same `owner_id` as company

#### Check Subscription Events Table

```sql
-- Find subscription events for the company
SELECT
  id,
  company_id,
  property_id,
  event_type,
  stripe_event_id,
  metadata,
  created_at
FROM subscription_events
WHERE company_id = '<company-id-from-above>'
ORDER BY created_at DESC;
```

**Expected**:
- ✅ At least 1 event record exists (subscription_created)
- ✅ `company_id` is set (NOT null)
- ✅ `property_id` is null (company-level event)
- ✅ `event_type` = "subscription_created"
- ✅ `metadata` contains company name and property count

---

### Test 3: Edge Cases

#### Test 3a: Refresh on Choose Plan Page

1. Complete signup and company details
2. On `/choose-plan` page, **refresh browser**
3. **Expected**: Company data should persist (stored in localStorage)
4. **Verify**: URL params still present, form still shows correct data

#### Test 3b: Single Property Company

1. Signup with new email
2. Company details: Set "Number of Properties" to **1**
3. Enter single property details
4. Complete checkout
5. **Verify**: Database has 1 property linked to company

#### Test 3c: Maximum Properties

1. Signup with new email
2. Company details: Set "Number of Properties" to **5** (or max allowed)
3. Enter all property details
4. Complete checkout
5. **Verify**: Database has correct number of properties

#### Test 3d: Failed Payment

1. Use Stripe test card: **4000 0000 0000 0002** (card declined)
2. Complete checkout flow
3. **Expected**: Payment fails, redirected to `/payment/failure`
4. **Verify**: NO company or properties created in database

---

## Test Results Checklist

After completing all tests, verify:

### ✅ Authentication Flow
- [ ] Signup creates user immediately
- [ ] User gets session without email verification blocking
- [ ] Email verification sent asynchronously

### ✅ Company Data Flow
- [ ] Company details stored in localStorage
- [ ] Data passed via URL params to choose-plan
- [ ] Data base64-encoded correctly
- [ ] Data included in Stripe checkout metadata

### ✅ Stripe Integration
- [ ] Checkout session created successfully
- [ ] Metadata includes company data
- [ ] Webhook receives and processes events
- [ ] Webhook signature verification passes

### ✅ Database Records
- [ ] Company record created with correct data
- [ ] Properties created with real names (not "Property 1", "Property 2")
- [ ] Properties linked to company via company_id
- [ ] Subscription events use company_id (not property_id)
- [ ] All records have correct owner_id

### ✅ Error Handling
- [ ] Failed payments don't create database records
- [ ] Missing webhook secret causes graceful error
- [ ] Invalid metadata handled gracefully

---

## Common Issues & Solutions

### Issue: Webhook signature verification fails

**Symptoms**:
- Webhook returns 400 "Invalid signature"
- Stripe CLI shows "[400] POST ..."

**Solution**:
1. Ensure STRIPE_WEBHOOK_SECRET is set in .env.local
2. Restart dev server after adding secret
3. Verify Stripe CLI is forwarding to correct URL

### Issue: 401 Unauthorized on checkout

**Symptoms**:
- Alert shows "Session error. Please try logging in again"
- Browser console shows 401 error

**Solution**:
1. Check cookies are being sent (check browser dev tools → Network → Headers)
2. Verify user is authenticated before clicking "Get Started"
3. Try signing up again in incognito mode

### Issue: Company not created in database

**Symptoms**:
- Webhook logs show success
- Database query returns no results

**Solution**:
1. Check SUPABASE_SERVICE_ROLE_KEY is set correctly
2. Verify RLS policies on companies table
3. Check webhook logs for database errors
4. Verify company data JSON is valid

### Issue: Properties missing company_id

**Symptoms**:
- Properties exist but company_id is null

**Solution**:
1. Verify migration `20251027130000_add_companies_table.sql` was run
2. Check column exists: `SELECT company_id FROM properties LIMIT 1;`
3. Re-run migration if needed

---

## Manual Testing Script

For quick re-testing, you can use this bash script:

```bash
#!/bin/bash
# test-payment-flow.sh

echo "🧪 Payment Flow Test"
echo "===================="
echo ""
echo "1. Clear browser data (cookies/localStorage)"
echo "2. Navigate to: http://localhost:3000/signup"
echo "3. Signup with: test+$(date +%s)@example.com"
echo "4. Company: Test Campgrounds LLC"
echo "5. Properties: 2 (Pine Valley - 20 sites, Mountain View - 15 sites)"
echo "6. Plan: Starter (monthly)"
echo "7. Card: 4242 4242 4242 4242"
echo ""
echo "Expected Database Records:"
echo "-------------------------"
echo "Company: Test Campgrounds LLC (subscription_status = active)"
echo "Properties: 2 records (onboarding_completed = false)"
echo "Events: 1+ records (company_id set, property_id null)"
```

---

## Next Steps After Testing

Once all tests pass:

1. **Update handoff document** with test results
2. **Build onboarding wizard** (next phase)
3. **Setup email integration** (Resend API)
4. **Deploy to staging** for full end-to-end test
