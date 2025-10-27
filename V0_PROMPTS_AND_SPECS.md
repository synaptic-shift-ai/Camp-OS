# v0 Prompts & Technical Specifications - Conversion Funnel

## Overview
This document contains all v0 prompts, TypeScript types, API contracts, and validation rules needed to build the CampOS conversion funnel.

**IMPORTANT:** All pages MUST use the exact CampOS design system specified below. The design system is defined in `app/globals.css` and `tailwind.config.ts`.

---

## CampOS Design System Quick Reference

### Critical Classes to Use
```css
/* Cards */
.glassmorphic-card              /* Main card styling with backdrop blur */

/* Buttons */
.neumorphic-button-primary      /* Primary CTA buttons (red) */
.neumorphic-button              /* Secondary buttons */

/* Borders */
.border-glow-red                /* Animated red border for popular items */

/* Text */
.gradient-text                  /* Animated gradient text for headings */
font-heading                    /* For all headings */
tracking-tight                  /* For headings */
text-muted-foreground          /* For body text */
```

### Color Variables
```css
--primary: hsl(346.8 77.2% 49.8%)           /* Red #dc2626 */
--background: hsl(20 14.3% 4.1%)            /* Dark background */
--foreground: hsl(0 0% 95%)                 /* White text */
--muted-foreground: hsl(240 5% 64.9%)       /* Gray text */
--border: hsl(240 3.7% 15.9%)               /* Border color */
```

### Success/Action Colors
- Success Green: `#10b981`
- Animated Border: `["#dc2626", "#4b5563", "#dc2626", "#4b5563"]`

### Typography
- Font: Geist (`--font-sans` and `--font-heading`)
- Headings: `font-heading font-semibold tracking-tight`
- Sizes: `text-4xl sm:text-5xl` (h1), `text-3xl sm:text-4xl` (h2)

### Animations (Framer Motion)
```typescript
// Entry animations
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}

// Hover effects
whileHover={{ scale: 1.03 }}
whileTap={{ scale: 0.98 }}
```

### Spacing
- Section: `py-12 md:py-24 lg:py-32`
- Container: `container px-6 md:px-8`
- Form fields: `space-y-4`
- Border radius: `rounded-xl` (0.75rem / 12px)

---

## Table of Contents
1. [Shared Types & Constants](#shared-types--constants)
2. [Page 1: /signup](#page-1-signup)
3. [Page 2: /choose-plan](#page-2-choose-plan)
4. [Page 3: /payment/success](#page-3-paymentsuccess)
5. [API Specifications](#api-specifications)

---

## Shared Types & Constants

### TypeScript Types

```typescript
// app/types/subscription.ts

export type PlanTier = 'starter' | 'growth' | 'pro' | 'enterprise'
export type BillingCycle = 'monthly' | 'annual'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete'

export interface PlanConfig {
  id: PlanTier
  name: string
  description: string
  basePrice: number // monthly price in dollars
  annualDiscount: number // percentage (e.g., 10 for 10%)
  siteBand: {
    min: number
    max: number | null // null = unlimited
  }
  features: string[]
  bookingQuota: number
  popular?: boolean
  disabled?: boolean
  disabledReason?: string
}

export interface SignupFormData {
  email: string
  password: string
  confirmPassword: string
  propertyName: string
  siteCount: number
}

export interface ChoosePlanFormData {
  plan: PlanTier
  billingCycle: BillingCycle
}

export interface CreateCheckoutRequest {
  plan: PlanTier
  billingCycle: BillingCycle
  siteCount: number
}

export interface CreateCheckoutResponse {
  sessionId: string
  url: string
}

export interface VerifySessionResponse {
  status: string
  customerEmail: string
  plan: PlanTier
  billingCycle: BillingCycle
  subscriptionId: string
}
```

### Plan Configuration Constants

```typescript
// lib/constants/plans.ts

import type { PlanConfig, PlanTier } from '@/app/types/subscription'

export const PLANS: Record<PlanTier, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small campgrounds and seasonal operations',
    basePrice: 199,
    annualDiscount: 10, // Will be updated when you decide
    siteBand: { min: 1, max: 50 },
    bookingQuota: 250,
    features: [
      'Up to 50 sites',
      '250 bookings/month included',
      'Online booking portal',
      'Basic site map',
      'Payment processing',
      'Email support',
      'Mobile app access',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    description: 'Ideal for growing RV parks and glamping sites',
    basePrice: 399,
    annualDiscount: 10,
    siteBand: { min: 51, max: 150 },
    bookingQuota: 750,
    popular: true,
    features: [
      'Up to 150 sites',
      '750 bookings/month included',
      'Online booking portal',
      'Interactive site maps',
      'Payment processing',
      'Portfolio pooling',
      'Advanced analytics',
      'Priority support',
      'Custom branding',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For large properties and serious operators',
    basePrice: 799,
    annualDiscount: 10,
    siteBand: { min: 151, max: 400 },
    bookingQuota: 1800,
    features: [
      'Up to 400 sites',
      '1,800 bookings/month included',
      'Online booking portal',
      'Advanced site maps',
      'Payment processing',
      'Portfolio pooling',
      'Advanced analytics',
      'Advanced integrations',
      'Priority support',
      'Dedicated account manager',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For multi-property operators and complex operations',
    basePrice: 0, // Custom pricing
    annualDiscount: 0,
    siteBand: { min: 401, max: null },
    bookingQuota: 0, // Custom
    features: [
      'Unlimited sites',
      'Custom booking quotas',
      'Multi-property support',
      'White-glove onboarding',
      'API access',
      'Custom integrations',
      '24/7 support',
      'Dedicated CSM',
      'SLA guarantees',
    ],
  },
}

export function getRecommendedPlan(siteCount: number): PlanTier {
  if (siteCount <= 50) return 'starter'
  if (siteCount <= 150) return 'growth'
  if (siteCount <= 400) return 'pro'
  return 'enterprise'
}

export function calculatePrice(plan: PlanTier, billingCycle: BillingCycle): number {
  const config = PLANS[plan]
  if (plan === 'enterprise') return 0 // Custom pricing

  const monthlyPrice = config.basePrice
  if (billingCycle === 'annual') {
    const annualPrice = monthlyPrice * 12
    const discount = annualPrice * (config.annualDiscount / 100)
    return annualPrice - discount
  }
  return monthlyPrice
}

export function isPlanValidForSiteCount(plan: PlanTier, siteCount: number): boolean {
  const config = PLANS[plan]
  if (plan === 'enterprise') return siteCount >= 401

  const { min, max } = config.siteBand
  if (max === null) return siteCount >= min
  return siteCount >= min && siteCount <= max
}
```

### Validation Rules

```typescript
// lib/validation/subscription.ts

import { z } from 'zod'

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  propertyName: z.string().min(2, 'Property name must be at least 2 characters'),
  siteCount: z.number().int().min(1, 'Must have at least 1 site'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export const choosePlanSchema = z.object({
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'annual']),
})
```

---

## Page 1: /signup

### v0 Prompt

```
Create a modern signup page for CampOS, a SaaS campground management platform.

DESIGN REQUIREMENTS - EXACT CampOS Design System:
- MUST use the exact design system defined below
- Glassmorphism aesthetic with CampOS-specific effects
- Dark mode optimized
- Mobile-first responsive design (container: max-w-md on mobile, centered)
- Center-aligned card with glassmorphic styling

EXACT DESIGN SYSTEM SPECIFICATIONS:

**Colors (from tailwind.config.ts):**
```css
/* Dark mode colors (primary theme) */
--background: hsl(20 14.3% 4.1%);        /* Very dark brown-gray */
--foreground: hsl(0 0% 95%);             /* Off-white */
--primary: hsl(346.8 77.2% 49.8%);       /* Red #dc2626 */
--primary-foreground: hsl(355.7 100% 97.3%);
--muted-foreground: hsl(240 5% 64.9%);   /* Gray text */
--border: hsl(240 3.7% 15.9%);           /* Dark border */
--card: hsl(24 9.8% 10%);                /* Dark card background */
```

**Glassmorphic Card Styling (MUST USE THIS CLASS):**
```css
.glassmorphic-card {
  background-color: rgba(var(--background), 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;  /* 12px */
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  transition: all 300ms ease-in-out;
}

/* Hover state */
.glassmorphic-card:hover {
  transform: scale(1.03);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}
```

**Typography:**
- Font: Geist (use --font-sans and --font-heading)
- Headings: font-heading font-semibold tracking-tight
- Body: text-muted-foreground
- Large headings: text-4xl sm:text-5xl (for h1)

**Button Styling (Primary CTA):**
Use `.neumorphic-button-primary` class:
```css
.neumorphic-button-primary {
  background-color: rgba(var(--primary), 0.9);
  color: hsl(var(--primary-foreground));
  border-radius: 0.75rem;
  box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.2),
              -4px -4px 10px rgba(255, 255, 255, 0.05);
  transition: all 300ms ease-in-out;
}

.neumorphic-button-primary:hover {
  background-color: hsl(var(--primary));
  transform: scale(1.03);
  box-shadow: 6px 6px 15px rgba(0, 0, 0, 0.25),
              -6px -6px 15px rgba(255, 255, 255, 0.07);
}
```

**Success Color:**
- Green: #10b981 (for checkmarks and success states)

**Animations (Framer Motion):**
```typescript
// Entry animations
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
}

// Hover effects
whileHover={{ scale: 1.03 }}
whileTap={{ scale: 0.98 }}
```

**Spacing:**
- Section padding: py-12 md:py-24 lg:py-32
- Container: container px-6 md:px-8
- Card padding: p-6 md:p-8
- Form field spacing: space-y-4

**Border Radius:**
- Cards, buttons, inputs: rounded-xl (0.75rem / 12px)
- Pills: rounded-full

**Important CSS Classes to Use:**
- Cards: `glassmorphic-card`
- Primary buttons: `neumorphic-button-primary`
- Secondary buttons: `neumorphic-button`
- Red glow border: `border-glow-red`
- Gradient text: `gradient-text` (for hero titles)

PAGE STRUCTURE:
- CampOS logo at top (use placeholder icon from lucide-react)
- Page title: "Get Started with CampOS"
- Subtitle: "Join hundreds of campgrounds modernizing their operations"
- Back link: "← Back to Home" (links to "/")

FORM FIELDS (in order):
1. Property Name
   - Label: "Property Name"
   - Placeholder: "Pine Valley Campground"
   - Type: text
   - Required: true
   - Validation: Min 2 characters

2. Number of Sites
   - Label: "How many campsites do you have?"
   - Placeholder: "50"
   - Type: number
   - Required: true
   - Validation: Min 1
   - Helper text: "This helps us recommend the right plan"

3. Email
   - Label: "Email"
   - Placeholder: "you@example.com"
   - Type: email
   - Required: true
   - Validation: Valid email format

4. Password
   - Label: "Password"
   - Placeholder: "••••••••"
   - Type: password
   - Required: true
   - Validation: Min 8 characters
   - Helper text: "At least 8 characters"

5. Confirm Password
   - Label: "Confirm Password"
   - Placeholder: "••••••••"
   - Type: password
   - Required: true
   - Validation: Must match password

FORM VALIDATION:
- Use Zod for schema validation
- Use React Hook Form for form handling
- Show inline errors below each field
- Disable submit button while loading or if validation fails
- Show generic error alert at top if API call fails

SUBMIT BUTTON:
- Text: "Create Account"
- Loading state: Show spinner + "Creating account..."
- Full width
- Red gradient background (#dc2626)

SUCCESS STATE:
After successful signup, show success card:
- Icon: Green checkmark in circle
- Title: "Check your email"
- Message: "We've sent a verification link to [email]"
- Instruction: "Click the link in the email to verify your account and continue to plan selection."
- Button: "Back to Home" (links to "/")

FOOTER LINKS:
- "Already have an account? Sign in" → links to /login
- "By creating an account, you agree to our Terms of Service and Privacy Policy"

TECHNICAL STACK:
- Next.js 15 with App Router
- TypeScript with strict types
- React Hook Form + Zod validation
- shadcn/ui components: Card, Input, Button, Label, Alert
- Framer Motion for animations
- Geist font (already configured via --font-sans and --font-heading)
- Use existing glassmorphic-card and neumorphic-button classes from globals.css

API INTEGRATION:
Form submits to Supabase Auth signup with this flow:
1. Call supabase.auth.signUp({ email, password, options: { emailRedirectTo, data: { property_name, site_count } } })
2. On success: Show success state
3. On error: Show error alert with message

ACCESSIBILITY:
- Proper ARIA labels
- Focus management
- Keyboard navigation
- Screen reader announcements
- High contrast mode support
```

### File Location
`app/(auth)/signup/page.tsx`

### Dependencies
```json
{
  "dependencies": [
    "@hookform/resolvers",
    "react-hook-form",
    "zod",
    "framer-motion",
    "@/lib/supabase/client",
    "@/components/ui/card",
    "@/components/ui/input",
    "@/components/ui/button",
    "@/components/ui/label",
    "@/components/ui/alert"
  ]
}
```

---

## Page 2: /choose-plan

### v0 Prompt

```
Create a plan selection page for CampOS after user email verification.

DESIGN REQUIREMENTS - EXACT CampOS Design System:
- MUST match the exact CampOS design system (same as /signup page)
- Use glassmorphic-card styling for plan cards
- Responsive grid layout (1 column mobile, 2 columns tablet, 4 columns desktop for all plans)
- Popular plan uses AnimatedGradientBorder component
- Disabled plans: reduced opacity (opacity-50) + cursor-not-allowed

EXACT DESIGN SYSTEM (same as /signup):
Use the same design specifications as Page 1 (/signup):
- Colors: Primary red hsl(346.8 77.2% 49.8%), dark background
- Cards: glassmorphic-card class
- Buttons: neumorphic-button-primary for primary CTAs
- Typography: font-heading tracking-tight for titles
- Animations: Framer Motion with scale(1.03) on hover
- Green checkmarks: #10b981
- See full design system in Page 1 specifications above

PAGE STRUCTURE:
- Header: "Choose Your Plan"
- Subheader: "Based on your [X] sites, we recommend the [Plan Name] plan."
- Back link: "← Back" (to marketing page)

BILLING CYCLE TOGGLE:
Position: Center, above plan cards
- Options: "Monthly" | "Annual"
- Show savings on annual: "Save [X]% with annual billing"
- Default: Monthly
- Style: Pill toggle switch (shadcn/ui Tabs component)
- When toggled, update all plan prices immediately

PRICING CARDS (4 plans):

CARD LAYOUT (each card):
┌─────────────────────────────┐
│ [Popular Badge - if Growth] │
│ PLAN NAME                   │
│ Description text            │
│                             │
│ $XXX/mo or $X,XXX/yr       │
│ billed [monthly/annually]   │
│                             │
│ ✓ Feature 1                 │
│ ✓ Feature 2                 │
│ ✓ Feature 3                 │
│ ... (all features)          │
│                             │
│ [CTA Button]                │
│ [Disabled reason if any]    │
└─────────────────────────────┘

PLAN 1 - STARTER ($199/mo):
- Sites: Up to 50 sites
- Bookings: 250/month included
- Features:
  * Online booking portal
  * Basic site map
  * Payment processing
  * Email support
  * Mobile app access
- CTA: "Get Started"
- Disabled if: siteCount > 50
- Disabled message: "Your property has too many sites for this plan"

PLAN 2 - GROWTH ($399/mo) [POPULAR]:
- Badge: "Most Popular" (top-right, bg-red-500, white text, rounded-full, px-3 py-1, text-xs)
- Border: Use AnimatedGradientBorder component with these exact colors:
  ```typescript
  <AnimatedGradientBorder
    colors={["#dc2626", "#4b5563", "#dc2626", "#4b5563"]}
    borderWidth={1}
    duration={8}
  >
  ```
- Sites: 51-150 sites
- Bookings: 750/month included
- Features:
  * Everything in Starter, plus:
  * Interactive site maps
  * Portfolio pooling
  * Advanced analytics
  * Priority support
  * Custom branding
- CTA: "Get Started"
- Disabled if: siteCount < 51 OR siteCount > 150
- Disabled messages:
  - If too few: "Upgrade your site count or choose Starter"
  - If too many: "Your property has too many sites for this plan"

PLAN 3 - PRO ($799/mo):
- Sites: 151-400 sites
- Bookings: 1,800/month included
- Features:
  * Everything in Growth, plus:
  * Advanced site maps
  * Advanced integrations
  * Dedicated account manager
  * Higher quotas
- CTA: "Get Started"
- Disabled if: siteCount < 151 OR siteCount > 400
- Disabled messages:
  - If too few: "Choose a smaller plan for your site count"
  - If too many: "Contact our Enterprise team"

PLAN 4 - ENTERPRISE (Custom):
- Sites: 401+ sites
- Bookings: Custom quotas
- Features:
  * Multi-property support
  * White-glove onboarding
  * API access
  * Custom integrations
  * 24/7 support
  * Dedicated CSM
  * SLA guarantees
- CTA: "Contact Sales"
- Action: Opens mailto:sales@campos.com with pre-filled subject
- Never disabled

FUNCTIONALITY:
- Read siteCount from URL params: /choose-plan?sites=75
- Calculate recommended plan based on site count
- Show recommendation message at top
- Highlight recommended plan with subtle glow
- When billing cycle changes, recalculate all prices
- Annual pricing formula: (monthlyPrice * 12) * (1 - discount/100)
- Show annual price as total, then show monthly equivalent below
- "Get Started" button calls /api/stripe/create-checkout
- On success, redirect to Stripe Checkout URL
- On error, show error alert
- "Contact Sales" opens mailto:sales@campos.com?subject=Enterprise%20Plan%20Inquiry

VISUAL EFFECTS:
- Hover scale effect on all cards using Framer Motion:
  ```typescript
  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
  ```
- Animated gradient border on Popular plan (AnimatedGradientBorder component)
- Check icons: lucide-react Check, color: #10b981, size: h-4 w-4
- Cards use glassmorphic-card class
- Recommended plan: Add subtle glow with border-glow-red class
- Smooth transitions (transition-all duration-300) when toggling billing cycle

TECHNICAL STACK:
- Next.js 15 with App Router
- TypeScript with strict types
- shadcn/ui components: Card, Button, Badge, Tabs
- Framer Motion for animations
- AnimatedGradientBorder component (from @/components/ui/animated-gradient-border)
- Use searchParams to get siteCount from URL
- Geist font (via --font-sans and --font-heading)
- Use existing CampOS design system classes from globals.css

ACCESSIBILITY:
- Proper heading hierarchy (h1, h2, h3)
- ARIA labels for icons and buttons
- Focus management for keyboard nav
- Screen reader announcements for price changes
- High contrast mode support
- Disabled state clearly communicated

PRICING CALCULATION:
Show prices based on billing cycle:
- Monthly: $XXX/mo
- Annual: $X,XXX/yr (then show: "Equivalent to $XXX/mo" in smaller text)

Example for Growth plan:
- Monthly: $399/mo
- Annual: $4,308/yr (Equivalent to $359/mo) ← 10% discount
```

### File Location
`app/(auth)/choose-plan/page.tsx`

### Dependencies
```json
{
  "dependencies": [
    "framer-motion",
    "@/lib/constants/plans",
    "@/components/ui/card",
    "@/components/ui/button",
    "@/components/ui/badge",
    "@/components/ui/tabs",
    "@/components/ui/alert"
  ]
}
```

### Props/State
```typescript
// Retrieved from URL params
const searchParams = useSearchParams()
const siteCount = Number(searchParams.get('sites')) || 0

// Local state
const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

// Computed
const recommendedPlan = getRecommendedPlan(siteCount)
```

---

## Page 3: /payment/success

### v0 Prompt

```
Create a payment success confirmation page for CampOS with a hybrid approach.

DESIGN REQUIREMENTS - EXACT CampOS Design System:
- MUST match the exact CampOS design system (same as previous pages)
- Celebratory but professional tone
- Use glassmorphic-card styling
- Center-aligned layout (max-w-2xl container)
- Mobile-first responsive design

EXACT DESIGN SYSTEM (same as previous pages):
Use the same design specifications as Pages 1 & 2:
- Colors: Primary red hsl(346.8 77.2% 49.8%), dark background
- Cards: glassmorphic-card class
- Primary button: neumorphic-button-primary class
- Typography: font-heading tracking-tight
- Animations: Framer Motion entry animations
- Success green: #10b981
- See full design system in Page 1 specifications above

PAGE STRUCTURE:

1. SUCCESS ICON:
   - Large green checkmark in a circle (lucide-react CheckCircle2)
   - Animated entrance (scale from 0 to 1 + fade in)
   - Size: 64px
   - Color: Green #10b981
   - Background circle: Green with 10% opacity

2. MAIN MESSAGE:
   - Heading: "Payment Successful!"
   - Subheading: "Welcome to CampOS"
   - Text color: White
   - Font: Bold for heading, regular for subheading

3. PLAN DETAILS SUMMARY:
   Display confirmed plan details:
   - Plan name: "[Plan Name] Plan"
   - Billing: "$XXX/month" or "$X,XXX/year"
   - Sites: "Up to [X] sites"
   - Bookings: "[X] bookings/month included"
   - Background: Subtle glass card
   - Border: Thin border with low opacity

4. EMAIL CONFIRMATION SECTION:
   - Icon: Mail/envelope (lucide-react Mail)
   - Text: "We've sent onboarding instructions to:"
   - Display user email in monospace font
   - Note: "Check your inbox (and spam folder) for the link"
   - Style: Info callout box with blue accent

5. DUAL-PATH CTA SECTION:
   - Primary CTA:
     * Large button "Continue to Onboarding →"
     * Red gradient background
     * Full width on mobile
     * Arrow icon (lucide-react ArrowRight)
     * Hover effect

   - Secondary text:
     * "Or use the email link if you prefer to start later"
     * Smaller, muted text
     * Centered

6. WHAT'S NEXT TIMELINE:
   Title: "What to expect:"

   Timeline items (with connecting vertical line):

   ✓ Account created (green check)
     "Your CampOS account is active"

   ✓ Payment confirmed (green check)
     "Subscription started successfully"

   → Set up your property (arrow, white)
     "Add property details and upload photos (2 min)"

   → Add campsites (arrow, white)
     "Create your sites and set pricing (5 min)"

   → Connect Stripe (arrow, white)
     "Link your Stripe account for payouts (3 min)"

7. SUPPORT SECTION:
   - Small text at bottom
   - "Need help getting started?"
   - Link: "Contact our team" → mailto:support@campos.com
   - Or: "View setup guide" → /docs/getting-started

FUNCTIONALITY:
- Verify session_id from URL params: /payment/success?session_id=xxx
- Call /api/stripe/verify-session to get subscription details
- Show loading state while verifying
- If verification fails, show error state
- Protected route: requires authentication
- "Continue to Onboarding" → /onboarding

LOADING STATE:
While verifying session:
- Show spinner
- Text: "Confirming your payment..."
- Disable CTA button

ERROR STATE:
If verification fails:
- Red X icon instead of checkmark
- Heading: "Unable to verify payment"
- Message: "Please contact support with your payment confirmation."
- CTA: "Contact Support" → mailto:support@campos.com
- Secondary CTA: "Back to Plans" → /choose-plan

VISUAL ELEMENTS:
- Success checkmark icon: CheckCircle2 from lucide-react, size 64px, color #10b981
- Animated entrance using Framer Motion:
  ```typescript
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, type: "spring" }}
  >
  ```
- Timeline connecting lines: border-l-2 border-border/50
- All cards: glassmorphic-card class
- Primary CTA: neumorphic-button-primary class
- Secondary links: text-muted-foreground hover:text-foreground
- Smooth transitions: transition-all duration-300

TECHNICAL STACK:
- Next.js 15 with App Router
- TypeScript with strict types
- shadcn/ui components (Card, Button, Alert)
- Framer Motion for animations
- lucide-react for icons (CheckCircle2, Mail, ArrowRight, X)
- Geist font (via --font-sans and --font-heading)
- Use existing CampOS design system classes from globals.css

ACCESSIBILITY:
- Proper heading hierarchy (h1 for "Payment Successful!")
- ARIA labels for all icons
- Focus management (auto-focus on CTA)
- Screen reader announcement for success state
- Keyboard navigation support

API INTEGRATION:
On mount:
1. Get session_id from URL params
2. Call GET /api/stripe/verify-session?session_id=xxx
3. Parse response to get plan details
4. Display plan information
5. Handle errors gracefully
```

### File Location
`app/(auth)/payment/success/page.tsx`

### Dependencies
```json
{
  "dependencies": [
    "framer-motion",
    "lucide-react",
    "@/components/ui/card",
    "@/components/ui/button",
    "@/components/ui/alert",
    "@/lib/constants/plans"
  ]
}
```

### Props/State
```typescript
// URL params
const searchParams = useSearchParams()
const sessionId = searchParams.get('session_id')

// State
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [session, setSession] = useState<VerifySessionResponse | null>(null)

// On mount: verify session
useEffect(() => {
  if (!sessionId) {
    setError('Missing session ID')
    setLoading(false)
    return
  }

  fetch(`/api/stripe/verify-session?session_id=${sessionId}`)
    .then(res => res.json())
    .then(data => {
      setSession(data)
      setLoading(false)
    })
    .catch(() => {
      setError('Failed to verify payment')
      setLoading(false)
    })
}, [sessionId])
```

---

## API Specifications

### API 1: Create Checkout Session

**Endpoint:** `POST /api/stripe/create-checkout`

**Request Body:**
```typescript
{
  plan: 'starter' | 'growth' | 'pro', // enterprise handled separately
  billingCycle: 'monthly' | 'annual',
  siteCount: number
}
```

**Response:**
```typescript
// Success (200)
{
  sessionId: string,
  url: string // Stripe Checkout URL to redirect to
}

// Error (400/401/500)
{
  error: string
}
```

**Logic:**
1. Verify user is authenticated
2. Verify email is confirmed
3. Validate plan selection matches site count
4. Get Stripe Price ID from env based on plan + billing cycle
5. Create or get Stripe customer
6. Create Stripe Checkout Session:
   - mode: 'subscription'
   - No trial period (immediate payment)
   - success_url: /payment/success?session_id={CHECKOUT_SESSION_ID}
   - cancel_url: /choose-plan?sites={siteCount}
   - metadata: { user_id, plan, billing_cycle, site_count }
7. Return session ID and URL

**Required Env Vars:**
```
NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_GROWTH_MONTHLY=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_GROWTH_ANNUAL=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL=price_xxxxx
```

---

### API 2: Stripe Webhook Handler

**Endpoint:** `POST /api/stripe/webhook`

**Headers Required:**
- `stripe-signature`: Webhook signature for verification

**Events to Handle:**
1. `checkout.session.completed`
2. `customer.subscription.updated`
3. `customer.subscription.deleted`

**Logic for checkout.session.completed:**
1. Verify webhook signature
2. Get user_id from session metadata
3. Find or create property for user
4. Update property with:
   - stripe_customer_id
   - subscription_id
   - subscription_status: 'active'
   - subscription_plan
   - billing_cycle
   - site_count
   - monthly_booking_quota
   - subscription_created_at
5. Log event to subscription_events table
6. Send onboarding email via Resend

**Email Template:**
- Subject: "Welcome to CampOS - Let's Get You Set Up"
- Include: Onboarding link (/onboarding)
- Include: Plan details
- Include: What's next timeline
- Professional HTML email using @react-email/components

---

### API 3: Verify Session

**Endpoint:** `GET /api/stripe/verify-session?session_id=xxx`

**Response:**
```typescript
// Success (200)
{
  status: 'complete' | 'expired' | 'open',
  customerEmail: string,
  plan: 'starter' | 'growth' | 'pro',
  billingCycle: 'monthly' | 'annual',
  subscriptionId: string
}

// Error (400/401/403/500)
{
  error: string
}
```

**Logic:**
1. Verify user is authenticated
2. Retrieve session from Stripe
3. Verify session belongs to authenticated user
4. Return session details
5. Handle errors gracefully

---

## Environment Variables Required

Add to `.env.local`:

```bash
# Stripe Price IDs - Monthly
NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_GROWTH_MONTHLY=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxx

# Stripe Price IDs - Annual
NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_GROWTH_ANNUAL=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL=price_xxxxxxxxxxxxx

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Testing Checklist

### Manual Testing Flow:
1. ✓ Navigate to marketing page → Click "Get Started"
2. ✓ Fill signup form with valid data
3. ✓ Submit → See email verification success message
4. ✓ Check email inbox for verification link
5. ✓ Click verification link
6. ✓ Redirected to /choose-plan with site count
7. ✓ See plan recommendation based on site count
8. ✓ Toggle monthly/annual billing
9. ✓ Try selecting invalid plan (should be disabled)
10. ✓ Select valid plan → Click "Get Started"
11. ✓ Redirected to Stripe Checkout
12. ✓ Enter test card: 4242 4242 4242 4242
13. ✓ Complete payment
14. ✓ Redirected to /payment/success
15. ✓ See success message + plan details
16. ✓ Check email for onboarding instructions
17. ✓ Click "Continue to Onboarding"
18. ✓ Verify property created with subscription data
19. ✓ Check Stripe Dashboard for subscription
20. ✓ Check subscription_events table

### Edge Cases:
- ✓ User closes Stripe checkout → Can return to /choose-plan
- ✓ Invalid session_id on success page → Show error
- ✓ User not authenticated → Redirect to login
- ✓ Email not verified → Redirect to verification page
- ✓ Webhook fires before property creation → Handle gracefully

---

## Implementation Order

1. Create types and constants files
2. Build /signup page in v0
3. Build /choose-plan page in v0
4. Build /payment/success page in v0
5. Implement API routes
6. Update auth callback routing
7. Configure Stripe products
8. Set up webhook endpoint
9. Test end-to-end flow
10. Deploy

---

## Notes

- All monetary amounts in Stripe are in cents (multiply by 100)
- Annual discount is currently 10%, may be updated
- Webhook events are idempotent (safe to replay)
- Email templates should be version controlled
- Consider adding analytics tracking for conversion funnel
- Enterprise plan requires manual sales process (mailto link)
