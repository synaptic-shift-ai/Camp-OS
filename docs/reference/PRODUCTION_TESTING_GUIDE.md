# Production Testing Guide (Vercel)

## Prerequisites

### 1. Verify Vercel Environment Variables

Go to your Vercel project dashboard: https://vercel.com/dashboard

1. Navigate to: **Project → Settings → Environment Variables**

2. **Verify these are set** (for Production environment):
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   STRIPE_SECRET_KEY
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   NEXT_PUBLIC_APP_URL (your production URL)
   STRIPE_WEBHOOK_SECRET (we'll set this below)
   ```

3. **If any are missing**, add them now and **redeploy**

---

## Setup: Stripe Webhook for Production

### Step 1: Get Your Vercel Production URL

Your webhook endpoint will be: `https://your-domain.vercel.app/api/stripe/webhook`

Example: `https://campos-production.vercel.app/api/stripe/webhook`

### Step 2: Create Webhook in Stripe Dashboard

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/test/webhooks

   ⚠️ Make sure you're in **Test mode** (toggle in top-right)

2. **Click "Add endpoint"**

3. **Endpoint URL**: Enter your production webhook URL
   ```
   https://your-domain.vercel.app/api/stripe/webhook
   ```

4. **Description**: "Production Webhook - Company Billing"

5. **Select events to listen to**:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

6. **Click "Add endpoint"**

### Step 3: Copy Signing Secret

1. After creating endpoint, click on it to view details

2. Under **"Signing secret"**, click **"Reveal"**

3. Copy the secret (starts with `whsec_`)

### Step 4: Add to Vercel Environment Variables

1. Go back to Vercel: **Project → Settings → Environment Variables**

2. **Add new variable**:
   - **Key**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: `whsec_xxxxx` (paste your signing secret)
   - **Environment**: Check **Production** (and Preview if you want)

3. **Save**

### Step 5: Redeploy

1. Go to: **Project → Deployments**

2. Find latest deployment → **"..." menu** → **"Redeploy"**

3. **OR** push a new commit to trigger deployment:
   ```bash
   git commit --allow-empty -m "chore: trigger redeploy for webhook secret"
   git push
   ```

4. **Wait for deployment to complete** (usually 2-3 minutes)

---

## Testing the Payment Flow

### Test 1: Complete Signup → Payment (Happy Path)

#### Preparation
1. **Open incognito/private browsing window**
2. **Have ready**:
   - Stripe test card: `4242 4242 4242 4242`
   - Unique test email (e.g., `test.user.$(date +%s)@example.com`)

#### Flow

**1. Signup** (`/signup`)
- Full Name: `Test User Production`
- Email: `test.prod.$(timestamp)@example.com` (use unique email)
- Password: `TestPassword123!`
- Click "Sign Up"
- **Expected**: Redirect to `/company-details`

**2. Company Details** (`/company-details`)
- Company Name: `Test Campgrounds LLC - Production`
- Number of Properties: `2`
- Property 1:
  - Name: `Pine Valley Campground`
  - Sites: `20`
- Property 2:
  - Name: `Mountain View RV Park`
  - Sites: `15`
- Click "Choose Plan"
- **Expected**: Redirect to `/choose-plan?sites=35&company=<base64>`
- **Verify**: URL has both `sites` and `company` parameters

**3. Plan Selection** (`/choose-plan`)
- **Verify**: Recommended plan is "Growth" (35 sites)
- Select: **Starter Plan** (easier for testing)
- Billing: **Monthly** (or Annual to test discount)
- Click "Get Started"
- **Expected**: Redirect to Stripe Checkout (stripe.com domain)

**4. Stripe Checkout**
- Email: (should be pre-filled)
- Card Number: `4242 4242 4242 4242`
- Expiry: `12/34` (any future date)
- CVC: `123`
- Name: `Test User`
- Country: `United States`
- ZIP: `12345`
- Click "Subscribe"
- **Expected**: Processing → Success → Redirect to `/payment/success`

**5. Payment Success Page** (`/payment/success`)
- **Verify shows**:
  - ✅ "We're Setting Up Your Properties" heading
  - ✅ "Check your email" message
  - ❌ NO "Continue to Onboarding" button
- **Expected**: Clean page, no errors

---

### Test 2: Monitor Webhook Processing

#### Using Vercel Logs (Real-time)

1. **Open Vercel Dashboard**: https://vercel.com/dashboard

2. **Navigate to**: Project → **Logs** tab

3. **Filter logs**:
   - Search: `webhook` or `[Webhook]`
   - Time: Last 15 minutes

4. **Look for these log entries** (after completing payment):
   ```
   [Webhook] Parsed company data: { companyName: 'Test Campgrounds LLC - Production', propertyCount: 2 }
   [Webhook] Company created: <uuid>
   [Webhook] Properties created: 2
   ```

5. **If you see errors**:
   - Check signature verification errors
   - Check database permission errors
   - Verify SUPABASE_SERVICE_ROLE_KEY is set

#### Using Stripe Dashboard

1. **Go to**: https://dashboard.stripe.com/test/events

2. **Find recent events** (last 5 minutes):
   - Look for: `checkout.session.completed`
   - Status should be: ✅ Succeeded

3. **Click on event** → **Webhooks** tab

4. **Verify**:
   - ✅ Your endpoint received the event
   - ✅ Response: `200 OK`
   - ✅ Response time: < 2 seconds

5. **If you see errors**:
   - Click "Response" to see error details
   - Check endpoint URL is correct
   - Verify signing secret matches

---

### Test 3: Verify Database Records

#### Using Supabase Dashboard

1. **Go to**: https://supabase.com/dashboard

2. **Select your project**

3. **Navigate to**: Table Editor → SQL Editor

#### Check Company Created

```sql
-- Find the company created in last hour
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
WHERE name ILIKE '%Test Campgrounds LLC - Production%'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results**:
- ✅ 1 row returned
- ✅ `name` = "Test Campgrounds LLC - Production"
- ✅ `stripe_customer_id` starts with `cus_`
- ✅ `subscription_id` starts with `sub_`
- ✅ `subscription_status` = `active`
- ✅ `subscription_plan` = selected plan (e.g., "starter")
- ✅ `billing_cycle` = selected cycle (e.g., "monthly")

**Copy the `id` for next query** → `<company_id>`

#### Check Properties Created

```sql
-- Find properties linked to the company
-- Replace <company_id> with ID from above query
SELECT
  id,
  name,
  company_id,
  owner_id,
  site_count,
  onboarding_completed,
  slug,
  created_at
FROM properties
WHERE company_id = '<company_id>'
ORDER BY name ASC;
```

**Expected Results**:
- ✅ 2 rows returned
- ✅ Property 1:
  - `name` = "Pine Valley Campground"
  - `site_count` = 20
  - `company_id` = `<company_id>`
  - `onboarding_completed` = false
- ✅ Property 2:
  - `name` = "Mountain View RV Park"
  - `site_count` = 15
  - `company_id` = `<company_id>`
  - `onboarding_completed` = false
- ✅ Both have same `owner_id`

#### Check Subscription Events

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
WHERE company_id = '<company_id>'
ORDER BY created_at DESC;
```

**Expected Results**:
- ✅ At least 1 row (subscription_created)
- ✅ `company_id` = `<company_id>` (NOT null)
- ✅ `property_id` IS NULL (company-level event)
- ✅ `event_type` = "subscription_created"
- ✅ `metadata` contains:
  ```json
  {
    "plan_id": "starter",
    "billing_cycle": "monthly",
    "site_count": "35",
    "company_name": "Test Campgrounds LLC - Production",
    "properties_count": 2
  }
  ```

---

## Edge Case Testing

### Test 4: Single Property Company

1. **Signup with new email**
2. **Company details**:
   - Name: "Single Property Test"
   - Properties: **1**
   - Property: "Solo Campground" - 10 sites
3. **Complete payment**
4. **Verify database**:
   - 1 company record
   - 1 property record
   - Property has `company_id` set

### Test 5: Multiple Properties (Max)

1. **Signup with new email**
2. **Company details**:
   - Name: "Multi Property Test"
   - Properties: **5** (or max allowed)
   - Fill all properties with unique names
3. **Complete payment**
4. **Verify database**:
   - 1 company record
   - 5 property records
   - All properties linked to same company

### Test 6: Payment Failure (Card Declined)

1. **Signup with new email**
2. **Complete company details**
3. **On Stripe checkout**, use test card: `4000 0000 0000 0002` (declined)
4. **Complete form**, click Subscribe
5. **Expected**: Payment fails, redirect to `/payment/failure`
6. **Verify database**:
   - ❌ NO company record created
   - ❌ NO properties created
   - ✅ Database stays clean

---

## Troubleshooting Production Issues

### Issue 1: Webhook Returns 401 Unauthorized

**Symptoms**:
- Stripe dashboard shows webhook failed (401)
- Payment completes but no database records

**Check**:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
2. Check Vercel logs for auth errors
3. Verify service role key has permissions to bypass RLS

**Fix**:
```bash
# Redeploy after fixing env vars
git commit --allow-empty -m "fix: update service role key"
git push
```

### Issue 2: Webhook Signature Verification Failed

**Symptoms**:
- Stripe shows 400 "Invalid signature"
- Vercel logs: "Webhook signature verification failed"

**Check**:
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Ensure secret starts with `whsec_`
3. Check you're using TEST mode webhook secret (not live)

**Fix**:
1. Get correct signing secret from Stripe
2. Update in Vercel environment variables
3. Redeploy

### Issue 3: Database Records Not Created

**Symptoms**:
- Webhook returns 200 OK
- But no records in database

**Check Vercel Logs** for:
```
[Webhook] Company created: <uuid>
[Webhook] Properties created: 2
```

If missing:
1. Check JSON parsing errors in logs
2. Verify company data structure in metadata
3. Check database foreign key constraints
4. Verify RLS policies don't block service role

### Issue 4: 401 on Checkout Creation

**Symptoms**:
- Alert: "Session error. Please try logging in again"
- Checkout never opens

**Check**:
1. User is logged in (check auth state)
2. Cookies are being sent to API route
3. Session hasn't expired
4. PKCE flow completed successfully

**Fix**:
- Try signup again in fresh incognito window
- Check middleware isn't blocking API routes
- Verify `NEXT_PUBLIC_APP_URL` matches production domain

---

## Post-Testing Validation Checklist

After completing all tests:

### ✅ Environment Setup
- [ ] All Vercel environment variables set correctly
- [ ] Stripe webhook created and pointing to production
- [ ] Webhook signing secret matches Vercel env var
- [ ] Latest deployment includes all code changes

### ✅ Payment Flow
- [ ] Signup creates user immediately
- [ ] Company details form works and passes data
- [ ] Plan selection shows correct recommendation
- [ ] Stripe checkout opens without 401 errors
- [ ] Payment processes successfully

### ✅ Webhook Processing
- [ ] Webhook receives events (Stripe dashboard shows 200)
- [ ] Vercel logs show company/properties created
- [ ] Processing completes in < 2 seconds
- [ ] No errors in Vercel logs

### ✅ Database Records
- [ ] Company record exists with correct data
- [ ] Properties created with real names (from form)
- [ ] Properties linked to company via company_id
- [ ] Subscription events use company_id (not property_id)
- [ ] All records have correct owner_id

### ✅ Edge Cases
- [ ] Single property companies work
- [ ] Multiple properties (5+) work
- [ ] Failed payments don't create records
- [ ] Unique slugs generated for properties

---

## Quick Test Summary

For rapid testing, follow this checklist:

**Pre-Test Setup** (Once):
- [ ] Stripe webhook endpoint created
- [ ] Webhook secret added to Vercel
- [ ] Latest code deployed

**Each Test Run** (5-10 minutes):
1. [ ] Incognito window
2. [ ] Unique email: `test.$(timestamp)@example.com`
3. [ ] Company: "Test Campgrounds - Prod"
4. [ ] Properties: 2 (Pine Valley - 20, Mountain View - 15)
5. [ ] Plan: Starter (monthly)
6. [ ] Card: 4242 4242 4242 4242
7. [ ] Check Vercel logs for webhook success
8. [ ] Query Supabase: 1 company, 2 properties, 1+ events

**Success Criteria**:
- ✅ No errors in UI
- ✅ Webhook logs show success in Vercel
- ✅ Stripe dashboard shows 200 OK
- ✅ Database has all records with correct data

---

## Next Steps

Once testing passes:
1. ✅ Mark "Test payment flow" as complete
2. ✅ Document any issues found
3. ✅ Proceed to Phase 3: Onboarding Wizard
4. ✅ Consider testing in Stripe's Live mode before real users

---

## Monitoring in Production

Set up these for ongoing monitoring:

### Stripe Webhooks
- Enable webhook notifications in Stripe
- Monitor failed webhook deliveries
- Set up Slack/email alerts for failures

### Vercel Logs
- Use Vercel's log drains for persistent logging
- Set up error alerting
- Monitor function execution times

### Supabase
- Check database growth
- Monitor RLS policy performance
- Set up alerts for failed queries
