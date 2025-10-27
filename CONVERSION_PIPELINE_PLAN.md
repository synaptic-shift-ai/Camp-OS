# Conversion Pipeline Implementation Plan

## Overview
This plan implements the complete end-to-end conversion funnel from marketing site to onboarding, including registration, email verification, plan selection, and payment processing with Stripe Checkout.

**User Journey:**
```
Marketing CTA → Signup → Email Verification → Plan Selection → Stripe Checkout → Payment Success → Onboarding
```

---

## Architecture

### Flow Diagram
```
┌─────────────────┐
│  Marketing CTAs │ (Hero, Pricing)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   /signup       │ Email + Password registration
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Email Inbox     │ Supabase verification email
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  /choose-plan   │ Select subscription tier
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stripe Checkout │ Payment details + 14-day trial
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ /payment/success│ Hybrid: Button + Email link
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  /onboarding    │ Setup property workflow
└─────────────────┘
```

### Technical Stack
- **Frontend**: Next.js 15, React 19, Shadcn/UI, React Hook Form, Zod
- **Auth**: Supabase Auth with email verification
- **Payments**: Stripe Checkout (subscription mode)
- **Email**: Resend for transactional emails
- **Database**: Supabase/PostgreSQL

---

## Phase 1: Database & Infrastructure

### 1.1 Database Migration

**File**: `supabase/migrations/20251027120000_subscription_management.sql`

```sql
-- Add subscription fields to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid')),
ADD COLUMN IF NOT EXISTS subscription_plan TEXT CHECK (subscription_plan IN ('starter', 'professional', 'enterprise')),
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ;

-- Create subscription events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_stripe_customer ON properties(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_subscription ON properties(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_subscription_status ON properties(subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_property ON subscription_events(property_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);

-- RLS policies for subscription_events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription events"
  ON subscription_events FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id = auth.uid()
    )
  );
```

### 1.2 Environment Variables

**File**: `.env.local` (add these)

```bash
# Stripe Price IDs (get from Stripe Dashboard after creating products)
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL=price_xxxxxxxxxxxxx

# Stripe Webhook Secret (get from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Resend API Key (for transactional emails)
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

**File**: `.env.example` (update documentation)

```bash
# Add to existing .env.example:

# Stripe Subscription Price IDs
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL=price_xxxxxxxxxxxxx

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Resend Email API
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

---

## Phase 2: Marketing CTA Updates

### 2.1 Hero Section Update

**File**: `components/sections/hero-section.tsx`

**Change**: Line 68
```tsx
// BEFORE
<Link href="#components" className="flex items-center">

// AFTER
<Link href="/signup" className="flex items-center">
```

### 2.2 Pricing Section Update

**File**: `components/sections/pricing-section.tsx`

**Changes**: Lines 110-124

```tsx
// BEFORE
<Button className="w-full bg-background border-0 text-foreground hover:text-white">
  {plan.cta}
</Button>

// AFTER
<Link
  href={plan.name === "Enterprise" ? "/contact" : `/signup?plan=${plan.name.toLowerCase()}`}
  className="w-full"
>
  <Button className="w-full bg-background border-0 text-foreground hover:text-white">
    {plan.cta}
  </Button>
</Link>
```

Update imports at top:
```tsx
import Link from "next/link"
```

---

## Phase 3: Page Development (v0)

### 3.1 Signup Page

**v0 Prompt:**

```
Create a modern signup page for a SaaS campground management platform called CampOS.

Design Requirements:
- Glassmorphism aesthetic with subtle gradient effects
- Dark mode optimized (black/gray tones with red accent: #dc2626)
- Mobile-first responsive design
- Center-aligned card layout with animated gradient border

Form Components:
- Email input (type="email", required)
- Password input (type="password", required, minimum 8 characters)
- Confirm password input (validation: must match password)
- Terms of service checkbox with link
- "Create Account" submit button with loading state
- Link to login page: "Already have an account? Sign in"

Visual Elements:
- CampOS logo at top (use placeholder)
- Page title: "Start Your Free Trial"
- Subtitle: "No credit card required. 14 days free."
- Success state: "Check your email to verify your account"
- Error state display for form validation

Technical Stack:
- Use shadcn/ui components (Card, Input, Button, Checkbox)
- React Hook Form for form handling
- Include form validation with helpful error messages
- Framer Motion for subtle animations
- Use Inter font family

Color Palette:
- Background: Black/dark gray gradients
- Accent: Red (#dc2626)
- Text: White/gray
- Glass effect: rgba(255, 255, 255, 0.05)

Include proper TypeScript types and accessibility features (aria-labels, proper focus states).
```

**Expected Output:** `app/(auth)/signup/page.tsx`

---

### 3.2 Plan Selection Page

**v0 Prompt:**

```
Create a plan selection page for CampOS after user email verification.

Design Requirements:
- Same glassmorphism aesthetic as marketing site
- Dark mode with red accent (#dc2626)
- Responsive grid layout (1 column mobile, 3 columns desktop)
- Animated gradient border on "Popular" plan

Page Structure:
- Header: "Choose Your Plan"
- Subheader: "All plans include a 14-day free trial. No credit card required until trial ends."
- Back link to marketing site

Pricing Cards (3 plans):

1. Starter Plan:
   - Price: $99/month
   - Features:
     * Up to 50 sites
     * Online booking portal
     * Basic site map
     * Payment processing
     * Email support
     * Mobile app access
   - CTA: "Start Free Trial"

2. Professional Plan (POPULAR):
   - Price: $199/month
   - Features:
     * Up to 150 sites
     * Online booking portal
     * Interactive site maps
     * Payment processing
     * Guest management CRM
     * Analytics & reporting
     * Priority support
     * Custom branding
   - CTA: "Start Free Trial"
   - Show "Most Popular" badge

3. Enterprise Plan:
   - Price: "Custom"
   - Features:
     * Unlimited sites
     * Online booking portal
     * Advanced site maps
     * Payment processing
     * Guest management CRM
     * Advanced analytics
     * Multi-property support
     * API access
     * Dedicated account manager
   - CTA: "Contact Sales"

Functionality:
- Pre-select plan from URL query param (?plan=starter)
- Highlight selected plan
- Disable CTA while loading
- "Contact Sales" opens mailto link
- "Start Free Trial" triggers API call to create Stripe checkout

Technical Stack:
- Use shadcn/ui components (Card, Button, Badge)
- Next.js 15 with App Router
- Framer Motion for card hover effects
- TypeScript with proper types
- Include loading states and error handling

Visual Effects:
- Hover scale effect on cards
- Animated gradient border on popular plan
- Check icons for features (green #10b981)
- Subtle glassmorphic card backgrounds
```

**Expected Output:** `app/(auth)/choose-plan/page.tsx`

---

### 3.3 Payment Success Page

**v0 Prompt:**

```
Create a payment success confirmation page for CampOS with a hybrid approach.

Design Requirements:
- Celebratory but professional tone
- Same glassmorphism aesthetic (dark mode, red accent)
- Center-aligned card with success icon
- Mobile-first responsive

Page Content:

1. Success Icon:
   - Large green checkmark in a circle
   - Animated entrance (scale + fade)

2. Main Message:
   - Heading: "Payment Successful!"
   - Subheading: "Your 14-day free trial has started"

3. Email Confirmation:
   - Icon: Mail/envelope
   - Text: "We've sent onboarding instructions to:"
   - Display user email in monospace font
   - Note: "Check your inbox (and spam folder) for the link"

4. Call-to-Action Section:
   - Primary CTA: Large button "Continue to Onboarding" with arrow icon
   - Secondary text: "Or wait for the email if you prefer"

5. What's Next:
   - Mini timeline/checklist showing:
     * ✓ Account created
     * ✓ Payment method saved
     * → Set up your property (2 min)
     * → Add campsites (5 min)
     * → Connect Stripe for payouts (3 min)

6. Support:
   - Small text at bottom: "Need help? Contact support@campos.com"

Technical Stack:
- Next.js 15 with App Router
- shadcn/ui components (Card, Button)
- Framer Motion for success animation
- TypeScript
- Verify Stripe session_id from URL params
- Protected route (requires authentication)

Visual Elements:
- Green success color (#10b981)
- Animated checkmark entrance
- Subtle confetti effect (optional)
- Timeline with icons and connecting lines

Accessibility:
- Proper heading hierarchy
- ARIA labels for icons
- Focus management
- Screen reader announcements for success state
```

**Expected Output:** `app/(auth)/payment/success/page.tsx`

---

## Phase 4: API Development

### 4.1 Create Stripe Checkout Session

**File**: `app/api/stripe/create-checkout/route.ts`

```typescript
import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    // Verify email is confirmed
    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: "Please verify your email first." }, { status: 403 })
    }

    const body = await request.json()
    const { plan } = body

    // Validate plan
    if (!plan || !["starter", "professional"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 })
    }

    // Get price ID from environment
    const priceId =
      plan === "starter"
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL

    if (!priceId) {
      console.error(`[Stripe Checkout] Missing price ID for plan: ${plan}`)
      return NextResponse.json({ error: "Plan configuration error" }, { status: 500 })
    }

    // Get or create Stripe customer
    const supabaseServiceRole = createServiceRoleClient()
    const { data: properties } = await supabaseServiceRole
      .from("properties")
      .select("stripe_customer_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)

    const existingProperty = properties?.[0]
    let customerId = existingProperty?.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to database (will be linked to property after onboarding)
      // For now, create a temporary property record or store in user metadata
      // We'll update this when property is created during onboarding
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: user.id,
          plan: plan,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/choose-plan`,
      metadata: {
        user_id: user.id,
        plan: plan,
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error("[Stripe Checkout] Error creating checkout session:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
```

---

### 4.2 Stripe Webhook Handler

**File**: `app/api/stripe/webhook/route.ts`

```typescript
import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { Resend } from "resend"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (error) {
    console.error("[Stripe Webhook] Signature verification failed:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan

        if (!userId) {
          console.error("[Stripe Webhook] No user_id in session metadata")
          break
        }

        // Get or create property for this user
        const { data: properties } = await supabase
          .from("properties")
          .select("id, owner_id, email")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)

        let propertyId = properties?.[0]?.id
        const userEmail = properties?.[0]?.email

        // If no property exists yet, user hasn't completed onboarding
        // We'll store subscription data and link it later
        if (!propertyId) {
          console.log(`[Stripe Webhook] No property found for user ${userId}, subscription will be linked after onboarding`)
          // Store in a temporary table or user metadata
          // For now, we'll just log it and let the onboarding flow handle it
        } else {
          // Update property with subscription details
          const trialEnd = session.subscription
            ? new Date((await stripe.subscriptions.retrieve(session.subscription as string)).trial_end! * 1000)
            : null

          await supabase
            .from("properties")
            .update({
              stripe_customer_id: session.customer as string,
              subscription_id: session.subscription as string,
              subscription_status: "trialing",
              subscription_plan: plan,
              trial_ends_at: trialEnd?.toISOString(),
              subscription_created_at: new Date().toISOString(),
            })
            .eq("id", propertyId)
            .eq("owner_id", userId)

          // Log event
          await supabase.from("subscription_events").insert({
            property_id: propertyId,
            event_type: "checkout.session.completed",
            stripe_event_id: event.id,
            event_data: session,
          })
        }

        // Send welcome email with onboarding link
        if (userEmail) {
          await sendWelcomeEmail(userEmail, userId)
        }

        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find property by customer ID
        const { data: properties } = await supabase
          .from("properties")
          .select("id, owner_id")
          .eq("stripe_customer_id", customerId)
          .limit(1)

        const property = properties?.[0]

        if (property) {
          await supabase
            .from("properties")
            .update({
              subscription_status: subscription.status,
              trial_ends_at: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
            })
            .eq("id", property.id)

          // Log event
          await supabase.from("subscription_events").insert({
            property_id: property.id,
            event_type: "customer.subscription.updated",
            stripe_event_id: event.id,
            event_data: subscription,
          })
        }

        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: properties } = await supabase
          .from("properties")
          .select("id, owner_id")
          .eq("stripe_customer_id", customerId)
          .limit(1)

        const property = properties?.[0]

        if (property) {
          await supabase
            .from("properties")
            .update({
              subscription_status: "canceled",
              subscription_canceled_at: new Date().toISOString(),
            })
            .eq("id", property.id)

          // Log event
          await supabase.from("subscription_events").insert({
            property_id: property.id,
            event_type: "customer.subscription.deleted",
            stripe_event_id: event.id,
            event_data: subscription,
          })
        }

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function sendWelcomeEmail(email: string, userId: string) {
  try {
    await resend.emails.send({
      from: "CampOS <onboarding@campos.com>",
      to: email,
      subject: "Welcome to CampOS - Start Your Free Trial",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0a0a0a; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Welcome to CampOS</h1>
              </div>

              <!-- Content -->
              <div style="padding: 40px 30px;">
                <p style="color: #e5e5e5; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                  Thanks for subscribing to CampOS! Your 14-day free trial starts now.
                </p>

                <p style="color: #e5e5e5; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                  Let's get your campground online in just a few minutes:
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/onboarding/setup-property"
                     style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Start Onboarding →
                  </a>
                </div>

                <!-- Timeline -->
                <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; margin: 30px 0;">
                  <h3 style="color: #e5e5e5; margin: 0 0 20px; font-size: 18px;">What to expect:</h3>

                  <div style="margin-bottom: 16px;">
                    <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">✓ Step 1: Property Details</div>
                    <div style="color: #9ca3af; font-size: 14px;">Set up your campground information (2 minutes)</div>
                  </div>

                  <div style="margin-bottom: 16px;">
                    <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">✓ Step 2: Add Sites</div>
                    <div style="color: #9ca3af; font-size: 14px;">Create your campsites and set pricing (5 minutes)</div>
                  </div>

                  <div>
                    <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">✓ Step 3: Connect Stripe</div>
                    <div style="color: #9ca3af; font-size: 14px;">Set up payments to receive bookings (3 minutes)</div>
                  </div>
                </div>

                <!-- Support -->
                <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                  Need help getting started?<br>
                  Reply to this email or contact us at <a href="mailto:support@campos.com" style="color: #dc2626; text-decoration: none;">support@campos.com</a>
                </p>
              </div>

              <!-- Footer -->
              <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                  © 2025 CampOS. All rights reserved.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    })
    console.log(`[Email] Welcome email sent to ${email}`)
  } catch (error) {
    console.error("[Email] Failed to send welcome email:", error)
  }
}
```

---

### 4.3 Verify Stripe Session

**File**: `app/api/stripe/verify-session/route.ts`

```typescript
import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get("session_id")

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Verify session belongs to this user
    if (session.metadata?.user_id !== user.id) {
      return NextResponse.json({ error: "Session does not belong to user" }, { status: 403 })
    }

    return NextResponse.json({
      status: session.status,
      customerEmail: session.customer_email,
      plan: session.metadata?.plan,
      subscriptionId: session.subscription,
    })
  } catch (error) {
    console.error("[Stripe] Error verifying session:", error)
    return NextResponse.json({ error: "Failed to verify session" }, { status: 500 })
  }
}
```

---

## Phase 5: Integration & Testing

### 5.1 Stripe Dashboard Setup

**Manual Steps Required:**

1. **Create Products in Stripe Dashboard**
   - Go to: https://dashboard.stripe.com/test/products
   - Create "CampOS Starter Plan"
     - Price: $99/month recurring
     - Enable 14-day free trial
     - Copy Price ID → Add to `.env.local` as `NEXT_PUBLIC_STRIPE_PRICE_STARTER`

   - Create "CampOS Professional Plan"
     - Price: $199/month recurring
     - Enable 14-day free trial
     - Copy Price ID → Add to `.env.local` as `NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL`

2. **Set Up Webhook Endpoint**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Add endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy Signing Secret → Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

3. **Test Webhook Locally**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

### 5.2 Resend Setup

**Manual Steps:**

1. Sign up at https://resend.com
2. Verify your domain (or use resend.dev for testing)
3. Get API key → Add to `.env.local` as `RESEND_API_KEY`
4. Update email "from" address in webhook handler to match verified domain

### 5.3 Supabase Email Configuration

**Update Supabase Email Templates:**

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Update "Confirm signup" template redirect URL:
   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/choose-plan
   ```

### 5.4 Testing Checklist

**End-to-End Test Flow:**

- [ ] Click "Start Free Trial" on marketing page → Goes to `/signup`
- [ ] Fill signup form → Receives verification email
- [ ] Click email link → Redirects to `/choose-plan`
- [ ] Select plan → Redirects to Stripe Checkout
- [ ] Enter test card (4242 4242 4242 4242) → Payment succeeds
- [ ] Redirected to `/payment/success` → See success message + email notice
- [ ] Click "Continue to Onboarding" → Goes to `/onboarding/setup-property`
- [ ] Check email → Received welcome email with onboarding link
- [ ] Complete onboarding → Property created with subscription data
- [ ] Verify database → `properties` table has subscription fields populated
- [ ] Check Stripe Dashboard → Subscription created with 14-day trial
- [ ] Check `subscription_events` table → Events logged correctly

**Edge Cases to Test:**

- [ ] User closes tab during Stripe checkout → Can resume from `/choose-plan`
- [ ] User clicks email link after already completing onboarding → Redirected to dashboard
- [ ] Webhook fires before user completes onboarding → Data stored correctly
- [ ] User tries to access `/choose-plan` without email verification → Redirected to login
- [ ] User selects Enterprise plan → Redirected to contact form (not Stripe)
- [ ] Invalid session_id on success page → Shows error message
- [ ] Webhook signature verification fails → Returns 400 error
- [ ] Email delivery fails → Logged but doesn't block flow

---

## Phase 6: Production Deployment

### 6.1 Environment Variables (Vercel)

Add to Vercel project settings:

```
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL=price_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
RESEND_API_KEY=re_xxxxx
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### 6.2 Database Migration

Run migration on production:

```bash
# Via Supabase Dashboard or CLI
supabase db push
```

### 6.3 Production Stripe Webhook

1. Switch Stripe to live mode
2. Create products in live mode (same as test)
3. Add production webhook endpoint
4. Update environment variables with live keys

### 6.4 DNS & Email

1. Verify domain in Resend for production emails
2. Update "from" email in webhook handler
3. Test email delivery in production

---

## Success Metrics

**Conversion Funnel KPIs:**

- Signup completion rate
- Email verification rate
- Plan selection rate
- Payment completion rate
- Onboarding completion rate
- Trial-to-paid conversion rate

**Technical Health:**

- Webhook delivery success rate
- Email delivery success rate
- API error rates
- Page load times

---

## Rollback Plan

If issues arise:

1. **Revert Marketing CTAs**: Change back to `#components` temporarily
2. **Database**: Migrations are additive (won't break existing data)
3. **Stripe**: Can pause webhook endpoint without deleting
4. **Email**: Can disable in code without removing Resend account

---

## Support Resources

- **Stripe Docs**: https://stripe.com/docs/billing/subscriptions/trials
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **Resend Docs**: https://resend.com/docs
- **Next.js App Router**: https://nextjs.org/docs/app

---

## Next Steps After This Phase

After conversion pipeline is complete:

1. **Week 2, Phase 2A**: Site management features (CRUD operations)
2. **Week 2, Phase 2B**: Calendar availability view
3. **Week 3**: Guest booking flow
4. **Week 4**: Payment processing for bookings

---

## Notes

- All monetary amounts in Stripe are in cents
- Trial period is configured in Stripe products, not code
- Webhook events are idempotent (safe to replay)
- Email templates should be version controlled (consider using Resend's template feature)
- Consider adding analytics tracking for conversion funnel
