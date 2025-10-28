# Session Handoff: Company-Based Billing Implementation

**Date**: 2025-01-27
**Status**: Phase 1 Complete - Database & Payment Flow
**Next Phase**: Onboarding Wizard with Property Dropdown

---

## What We Accomplished

### 1. Authentication Flow Fix ✅
**Problem**: Email verification with PKCE flow was causing cross-domain cookie issues, blocking the sales funnel.

**Solution**: Implemented industry-standard immediate session authentication (used by Stripe, Vercel, etc.)
- Users get session immediately on signup (no email verification blocking)
- Email verification sent asynchronously in background
- Dashboard access gated behind verification (security feature)
- Sales funnel works smoothly without interruption

**Files Changed**:
- `lib/supabase/client.ts` - Reverted to default localStorage for PKCE
- `components/signup-client.tsx` - Immediate session redirect
- `app/auth/callback/route.ts` - Simplified for verification redirects
- `app/verify-email/page.tsx` - NEW: Email verification gate for dashboard
- `lib/supabase/middleware.ts` - Added email verification check

### 2. Company-Based Billing Architecture ✅
**Problem**: User submitted company details → those details disappeared → had to manually enter property names in onboarding

**Solution**: Proper B2B SaaS architecture with companies as billing entities
- Company details stored in localStorage (no DB write until payment succeeds)
- Data passed through payment flow via Stripe metadata
- Webhook creates company + properties with real names/site counts
- No abandoned cart pollution in database

**Files Changed**:
- `supabase/migrations/20251027130000_add_companies_table.sql` - NEW: Companies table
- `components/company-details-client.tsx` - Added company name field, localStorage storage
- `components/choose-plan-client.tsx` - Reads company data from URL params
- `app/api/stripe/create-checkout/route.ts` - Passes company data to Stripe metadata
- `app/api/stripe/webhook/route.ts` - Creates company + properties from metadata
- `components/payment-success-client.tsx` - Shows "check email" instead of broken CTA

---

## Current State

### ✅ What's Working
1. **Authentication**: Users sign up → get immediate session → proceed through funnel
2. **Company Details**: Form collects company name + property details → stores in localStorage
3. **Plan Selection**: Receives company data, passes to checkout
4. **Stripe Checkout**: Company data stored in session metadata
5. **Payment Success**: Shows appropriate "check email" message

### ⚠️ What's NOT Done Yet
1. **Database Migration**: The `companies` table does NOT exist yet in Supabase
2. **Webhook Testing**: Hasn't been tested with real Stripe events
3. **Onboarding Page**: Still shows old single-property flow, not property dropdown
4. **Middleware Check**: Still checks `properties` table for subscription, should check `companies`

### 🔴 Critical Blocker
**The database migration MUST be run before any testing can happen.**

Without it:
- Webhook will fail to create company (table doesn't exist)
- Properties won't have `company_id` field (column doesn't exist)
- Users will get errors after payment

---

## Testing Steps (After Migration)

### Prerequisites
1. Run database migration in Supabase:
   ```bash
   # Option 1: Supabase Dashboard → SQL Editor
   # Paste contents of: supabase/migrations/20251027130000_add_companies_table.sql
   # Click "Run"

   # Option 2: Supabase CLI
   supabase db push
   ```

2. Verify migration succeeded:
   ```sql
   -- Check companies table exists
   SELECT * FROM companies LIMIT 1;

   -- Check company_id column exists on properties
   SELECT company_id FROM properties LIMIT 1;
   ```

### Test Flow

#### Test 1: Complete Signup → Payment Flow
1. **Clear cookies/cache**
2. Go to `/signup`
3. Fill out form:
   - Company Name: "Test Campgrounds LLC"
   - Full Name: "John Doe"
   - Email: (use real email you can access)
   - Password: (test password)
4. **Expected**: Immediate redirect to `/company-details`

5. Fill out company details:
   - Company Name: "Test Campgrounds LLC"
   - # of Properties: 2
   - Property 1: Name: "Pine Valley Campground", Sites: 20
   - Property 2: Name: "Mountain View RV Park", Sites: 15
6. Click "Choose Plan"
7. **Expected**: Redirect to `/choose-plan?sites=35&company=<base64>`
   - Check URL has both `sites` and `company` params
   - Recommended plan should be "Growth" (35 sites)

8. Select a plan (use Starter for testing)
9. Click "Get Started"
10. **Expected**: Redirect to Stripe Checkout
    - No 401 errors
    - Checkout loads successfully

11. Complete payment with test card: `4242 4242 4242 4242`
12. **Expected**: Redirect to `/payment/success`
    - Shows "We're Setting Up Your Properties"
    - Shows "Check your email" message
    - NO "Continue to Onboarding" button (removed)

#### Test 2: Verify Webhook Created Records
1. Check Vercel logs for webhook execution:
   ```
   [Webhook] Parsed company data: { companyName: 'Test Campgrounds LLC', propertyCount: 2 }
   [Webhook] Company created: <uuid>
   [Webhook] Properties created: 2
   ```

2. Query Supabase to verify data:
   ```sql
   -- Check company was created
   SELECT * FROM companies WHERE name = 'Test Campgrounds LLC';

   -- Check properties were created with real names
   SELECT id, name, company_id, site_count, onboarding_completed
   FROM properties
   WHERE company_id = '<company-id-from-above>';

   -- Should see:
   -- "Pine Valley Campground" with 20 sites
   -- "Mountain View RV Park" with 15 sites
   -- Both with onboarding_completed = false
   ```

#### Test 3: Check Email Notification (Future)
Once email service is integrated, verify:
- User receives "Properties Ready for Onboarding" email
- Email contains link to `/onboarding`
- Email mentions company name and property count

---

## Known Issues

### 1. Middleware Still Checks Old Structure
**File**: `lib/supabase/middleware.ts`

**Current Code** (lines 62-67):
```typescript
const { data: property } = await supabase
  .from("properties")
  .select("id, subscription_status, onboarding_completed")
  .eq("owner_id", user.id)
  .single()

if (!property || !property.subscription_status || property.subscription_status !== "active") {
```

**Problem**: This checks `subscription_status` on `properties` table, but we moved it to `companies` table.

**Fix Needed**:
```typescript
// Get user's company with subscription status
const { data: company } = await supabase
  .from("companies")
  .select("id, subscription_status")
  .eq("owner_id", user.id)
  .single()

if (!company || company.subscription_status !== "active") {
  // Redirect to choose-plan
}
```

### 2. Onboarding Page Not Updated
**File**: `app/onboarding/page.tsx` (not modified yet)

**Current State**: Shows single-property wizard

**Needed**:
- Property dropdown to select which property to configure
- Load properties for user's company
- Pre-fill property name and site count
- Save button to preserve progress
- Can switch between properties

### 3. Subscription Events Table Field Name
**File**: `app/api/stripe/webhook/route.ts`

**Current Code**: `property_id` used for both properties and companies
```typescript
await supabase.from("subscription_events").insert({
  property_id: company.id, // ⚠️ Confusing - should be company_id
  event_type: "subscription_created",
  ...
})
```

**Fix Needed**: Either:
- Rename column to `entity_id` or `related_id`
- OR add separate `company_id` column
- Update RLS policies accordingly

---

## Next Steps

### Phase 2: Onboarding Wizard (Next Session)

1. **Update Middleware** to check `companies` table for subscription status
   - Priority: HIGH (blocks onboarding access)
   - Estimate: 15 minutes

2. **Fetch User's Properties** on onboarding page
   - Query: `SELECT * FROM properties WHERE owner_id = auth.uid() AND onboarding_completed = false`
   - Should return properties created by webhook

3. **Build Property Dropdown**
   - Component: Dropdown or tabs to switch between properties
   - Shows: Property name + site count
   - Position: Top of onboarding page

4. **Property Configuration Wizard** (per property)
   - Basic Info: Pre-filled name, address, description
   - Amenities: Checkboxes for RV hookups, wifi, etc.
   - Photos: Upload property images
   - Pricing: Default per-site pricing
   - Save Button: Mark `onboarding_completed = true`

5. **Progress Tracking**
   - Show which properties completed onboarding
   - Allow switching between properties
   - Don't lose progress when switching

6. **Completion Flow**
   - When all properties have `onboarding_completed = true`
   - Redirect to `/dashboard`
   - Show welcome message

### Phase 3: Testing & Polish

1. **End-to-End Test**: Complete flow with real Stripe webhook
2. **Edge Cases**:
   - What if user refreshes on `/choose-plan`? (localStorage should restore data)
   - What if webhook fails? (Retry mechanism? Manual recovery?)
   - What if user has existing property from before migration?
3. **Email Integration**: Set up Resend for onboarding emails
4. **Dashboard Property Switcher**: Dropdown in header to switch between properties

---

## Architecture Notes

### Why Companies Table?
**Billing Entity Separation**: In B2B SaaS, the billing entity (company) is often different from the operational entities (properties).

Examples:
- "Campgrounds Unlimited, LLC" (company) owns:
  - "Pine Valley Campground" (property)
  - "Mountain View RV Park" (property)
  - "Riverside Camping Resort" (property)
- One subscription, one Stripe customer
- Multiple properties managed under single billing entity

**Benefits**:
- Correct for tax/accounting (bill the legal entity)
- Scalable for enterprise (100s of properties)
- Proper portfolio management
- One place to check subscription status

### Why Not Save Company Data on Form Submit?
**Abandoned Cart Problem**: Users often:
1. Fill out company details
2. Browse plans
3. Leave without paying

If we saved company records immediately, database would fill with junk data from window shoppers.

**Solution**: Store in localStorage + URL params until payment succeeds. Only write to DB after Stripe confirms payment.

### Why Base64 Encode Company Data?
**URL Safety**: Company names can have special characters ("Campgrounds & More, LLC"), which break URL params.

Base64 encoding ensures:
- Data survives URL encoding/decoding
- Works across redirects
- Handles special characters safely

---

## File Structure Reference

### Database
```
supabase/migrations/
  └── 20251027130000_add_companies_table.sql  ← NEW MIGRATION (NOT RUN YET)
```

### Authentication Flow
```
components/signup-client.tsx                  ← Immediate session
app/auth/callback/route.ts                    ← Simplified verification
app/verify-email/page.tsx                     ← NEW: Email verification gate
lib/supabase/middleware.ts                    ← Email check for dashboard
```

### Company & Payment Flow
```
components/company-details-client.tsx         ← Company name + properties
components/choose-plan-client.tsx             ← Decode company data
app/api/stripe/create-checkout/route.ts       ← Pass to Stripe metadata
app/api/stripe/webhook/route.ts               ← Create company + properties
components/payment-success-client.tsx         ← "Check email" message
```

### Onboarding (NOT UPDATED YET)
```
app/onboarding/page.tsx                       ← Still old single-property flow
```

---

## Questions for Next Session

1. **Email Service**: Do you have Resend API key? Should we integrate it now or keep placeholder?
2. **Onboarding Wizard**: Step-by-step wizard or single scrolling form per property?
3. **Photo Uploads**: Should onboarding include photo upload, or make it optional/later?
4. **Pricing Strategy**: Set default pricing during onboarding, or require user input?
5. **Dashboard Access**: Should dashboard require ALL properties completed, or just one?

---

## Commit History

- `44474cf` - fix(auth): wrap useSearchParams in Suspense boundary for Next.js 15
- `dd0e9b0` - feat(auth): implement immediate session auth with async email verification
- `3b4ebee` - feat(companies): implement company-based billing and property management ← **CURRENT**

---

## Summary

**We're at a clean break point.** The foundation is solid:
- ✅ Authentication works smoothly
- ✅ Company data flows through payment pipeline
- ✅ Webhook logic ready to create proper records

**Critical next step**: Run the database migration, then test the payment flow end-to-end.

**Then**: Build the onboarding wizard with property dropdown to complete the user journey.
