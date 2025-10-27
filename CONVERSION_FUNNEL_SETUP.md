# Conversion Funnel Setup Guide

This guide covers the setup and configuration required to get the CampOS conversion funnel operational.

## Overview

The conversion funnel implements an immediate purchase flow (no trial period) with the following steps:

1. **Marketing Page** (`/`) → "Get Started" CTA
2. **Signup** (`/signup`) → Create account with email verification
3. **Company Details** (`/company-details`) → Collect property and site information
4. **Plan Selection** (`/choose-plan`) → Choose plan based on site count
5. **Stripe Checkout** (external) → Complete payment
6. **Success** (`/payment/success`) → Confirmation with onboarding CTA
7. **Onboarding** (`/onboarding`) → Complete setup

## Prerequisites

### Required Accounts & Services

- [x] Supabase project with Auth enabled
- [x] Stripe account (test and production)
- [ ] Resend account (or other email service) for transactional emails
- [ ] Domain configured for production

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe webhook configuration)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_...)

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000 (or your production URL)

# Email (Optional - for onboarding emails)
RESEND_API_KEY=re_... (if using Resend)
```

## Database Setup

### 1. Run Migration

The subscription management migration has already been created. Run it:

```bash
# Using Supabase CLI
supabase db push

# Or apply the migration file directly in Supabase Studio
# File: supabase/migrations/20251027120000_subscription_management.sql
```

This creates:
- `stripe_customer_id`, `subscription_id`, `subscription_status`, etc. columns in `properties` table
- `subscription_events` table for audit logging
- Appropriate indexes and RLS policies

### 2. Verify RLS Policies

Ensure Row Level Security is enabled on:
- `properties` table (users can only access their own)
- `subscription_events` table (users can only view their own events)

## Stripe Configuration

### 1. Create Products (Test Mode)

In the [Stripe Dashboard](https://dashboard.stripe.com/test/products), create products for each plan:

**Starter Plan**
- Name: "CampOS Starter Plan"
- Pricing:
  - Monthly: $199/month
  - Annual: $2,148/year (10% discount = $179/month equivalent)

**Growth Plan**
- Name: "CampOS Growth Plan"
- Pricing:
  - Monthly: $399/month
  - Annual: $4,308/year (10% discount = $359/month equivalent)

**Pro Plan**
- Name: "CampOS Pro Plan"
- Pricing:
  - Monthly: $799/month
  - Annual: $8,628/year (10% discount = $719/month equivalent)

> **Note**: The implementation uses dynamic pricing via `price_data` in Stripe Checkout, so you don't need to pre-create Price objects. However, creating Products helps with Stripe Dashboard organization.

### 2. Configure Webhook Endpoint

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "+ Add endpoint"
3. Set endpoint URL: `https://your-domain.com/api/stripe/webhook`
   - For local testing: Use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward events
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`

### 3. Test Webhook with Stripe CLI (Local Development)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# This will output a webhook signing secret - add it to .env.local
```

## Supabase Auth Configuration

### 1. Email Templates

Update email templates in Supabase Dashboard → Authentication → Email Templates:

**Confirm Signup**
- Subject: "Verify your CampOS account"
- Body: Include link to complete company details after verification

**Example Template:**
```html
<h2>Welcome to CampOS!</h2>
<p>Click the link below to verify your email and complete your setup:</p>
<p><a href="{{ .ConfirmationURL }}">Verify Email</a></p>
<p>This link expires in 24 hours.</p>
```

### 2. Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

**Redirect URLs** (whitelist):
- `http://localhost:3000/auth/callback` (development)
- `https://your-domain.com/auth/callback` (production)

**Site URL**:
- `http://localhost:3000` (development)
- `https://your-domain.com` (production)

### 3. Enable Email Confirmations

In Supabase Dashboard → Authentication → Settings:

- ✅ Enable email confirmations
- Email confirmation URL: Uses default (`{{ .ConfirmationURL }}`)

## Email Service Setup (Optional)

The webhook currently logs that it should send an onboarding email but doesn't actually send it. To enable:

### Option 1: Resend

1. Sign up at [Resend](https://resend.com)
2. Add your domain and verify DNS records
3. Get API key and add to `.env.local`
4. Uncomment the Resend code in `/app/api/stripe/webhook/route.ts`

### Option 2: Other Services

Update the `sendOnboardingEmail` function in the webhook route to use your preferred service.

## Testing Checklist

### Local Development Testing

- [ ] Start local development server: `npm run dev`
- [ ] Start Stripe webhook forwarding: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] Test complete signup flow:
  1. Navigate to `/signup`
  2. Create account (use test email)
  3. Verify email confirmation page shows
  4. Check Supabase Auth dashboard for new user
  5. Click verification link in email
  6. Verify redirect to `/company-details`
  7. Fill in property details
  8. Select a plan on `/choose-plan`
  9. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
  10. Verify redirect to `/payment/success`
  11. Check Supabase `properties` table for subscription data
  12. Check Stripe Dashboard for customer and subscription
  13. Verify webhook events received (check terminal with `stripe listen`)

### Test Cards

Use these Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

All test cards:
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

## Production Deployment (Vercel)

### Step 1: Deploy to Vercel

1. **Connect Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository
   - Configure project settings (Framework: Next.js should auto-detect)

2. **Add Environment Variables**:

   In Vercel Project → Settings → Environment Variables, add:

   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key

   # Stripe (use test keys first, then switch to live)
   STRIPE_SECRET_KEY=sk_test_... (or sk_live_... after testing)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_...)

   # IMPORTANT: Leave STRIPE_WEBHOOK_SECRET empty for now - we'll add it after Step 2

   # App URL
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

   # Email (Optional)
   RESEND_API_KEY=re_... (if using Resend)
   ```

3. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete
   - Note your deployment URL (e.g., `https://your-app.vercel.app`)

### Step 2: Configure Stripe Webhook

**CRITICAL**: This must be done AFTER deploying to Vercel because you need your production URL.

1. **Create Webhook Endpoint**:
   - Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
   - Click "+ Add endpoint"
   - **Endpoint URL**: `https://your-app.vercel.app/api/stripe/webhook`
     (Replace with your actual Vercel URL)
   - **Events to send**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Click "Add endpoint"

2. **Get Webhook Signing Secret**:
   - After creating the endpoint, click on it
   - Click "Reveal" under "Signing secret"
   - Copy the secret (starts with `whsec_`)

3. **Add Secret to Vercel**:
   - Go to Vercel Project → Settings → Environment Variables
   - Add new variable:
     - Name: `STRIPE_WEBHOOK_SECRET`
     - Value: `whsec_...` (paste the signing secret)
   - Click "Save"

4. **Redeploy**:
   - Go to Vercel Project → Deployments
   - Click "..." on latest deployment → "Redeploy"
   - Check "Use existing Build Cache" (faster)
   - This redeploy picks up the new `STRIPE_WEBHOOK_SECRET`

5. **Test Webhook**:
   - Back in Stripe Dashboard, click your webhook endpoint
   - Click "Send test webhook"
   - Select `checkout.session.completed`
   - Verify response shows `200 OK`

### Step 3: Configure Supabase for Production

1. **Update Redirect URLs**:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add to **Redirect URLs**:
     - `https://your-app.vercel.app/auth/callback`
   - Update **Site URL**:
     - `https://your-app.vercel.app`

2. **Run Database Migration** (if not done already):
   ```bash
   supabase db push
   ```

3. **Verify Email Templates**:
   - Supabase Dashboard → Authentication → Email Templates
   - Update any localhost URLs to production URLs

### Step 4: Pre-launch Checklist

- [ ] All environment variables added to Vercel
- [ ] Stripe webhook endpoint created and secret added
- [ ] Supabase redirect URLs updated to production domain
- [ ] Database migration applied
- [ ] Email templates updated (no localhost references)
- [ ] Test full flow in production with test card
- [ ] Set up monitoring for Stripe webhook failures
- [ ] Configure Resend (or email service) for production emails
- [ ] Verify email templates work correctly
- [ ] Test payment flow with real card (then refund)

### Step 5: Go Live with Real Payments

Once testing is successful with test mode:

1. **Switch to Live Mode**:
   - Get live Stripe keys from [Stripe Dashboard (Live mode)](https://dashboard.stripe.com/apikeys)
   - Update Vercel environment variables:
     - `STRIPE_SECRET_KEY=sk_live_...`
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`

2. **Create Live Webhook**:
   - Go to [Stripe Webhooks (Live mode)](https://dashboard.stripe.com/webhooks)
   - Create new endpoint with same URL and events
   - Get new signing secret
   - Update `STRIPE_WEBHOOK_SECRET` in Vercel

3. **Redeploy Vercel**

4. **Final Test**:
   - Complete a real purchase (use your own card)
   - Verify everything works end-to-end
   - Refund the test purchase in Stripe Dashboard

### Monitoring

Monitor these for issues:

1. **Stripe Dashboard**:
   - Failed payments
   - Webhook delivery failures
   - Subscription status

2. **Supabase Logs**:
   - Auth failures
   - Database errors

3. **Application Logs**:
   - Checkout creation errors
   - Webhook processing failures

## Troubleshooting

### Common Issues

**Webhook signature verification failed**
- Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint secret
- Check that webhook endpoint URL is correct
- Ensure raw request body is being used (Next.js handles this automatically)

**Checkout session creation fails**
- Check user is authenticated (Supabase session exists)
- Verify Stripe secret key is correct
- Check plan ID is valid

**Email verification not working**
- Verify Supabase email templates are configured
- Check redirect URLs are whitelisted
- Ensure email provider isn't blocking Supabase emails

**Properties table update fails after payment**
- Check `SUPABASE_SERVICE_ROLE_KEY` is set (required for webhook)
- Verify RLS policies allow service role access
- Check that migration was applied correctly

## Flow Diagrams

### User Journey
```
Marketing → Signup → Email Verify → Company Details → Choose Plan → Stripe Checkout → Success → Onboarding
```

### Data Flow
```
1. Signup creates Supabase user (no property yet)
2. Email verification activates account
3. Company details page collects business info
4. Plan selection triggers Stripe Checkout
5. Stripe webhook creates/updates property record
6. Success page shows confirmation
7. Onboarding link completes setup
```

## Next Steps

After completing setup:

1. Test end-to-end flow in development
2. Configure production Stripe products
3. Set up email service for onboarding
4. Deploy to production
5. Test with real payment (then refund)
6. Monitor for first few real customers

## Support

For issues with:
- **Stripe**: [Stripe Support](https://support.stripe.com)
- **Supabase**: [Supabase Docs](https://supabase.com/docs)
- **Next.js**: [Next.js Docs](https://nextjs.org/docs)
