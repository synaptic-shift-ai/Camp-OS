# CampOS User Journey Flow Diagrams

## Quick Reference

| User Type | Entry Route | Email Redirect | Post-Verification | Login Redirect |
|-----------|-------------|----------------|-------------------|----------------|
| **Explorer** | `/register` | `/auth/callback?next=/resources` | `/resources` | `/resources` |
| **Buyer** | `/signup` | `/auth/callback?next=/company-details` | `/company-details` → Sales Funnel | Varies by status |

---

## Explorer (Tire Kicker) Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPLORER PERSONA                              │
│                  "Just browsing/learning"                        │
└─────────────────────────────────────────────────────────────────┘

    START: Marketing Site (/)
           │
           ├─→ CTA: "Explore Demo"
           ├─→ CTA: "Learn More"
           └─→ CTA: "View Resources"
           │
           ▼
    ┌──────────────────┐
    │   /register      │  Lightweight Registration
    │                  │  • Full Name
    │  user_type:      │  • Email
    │  'explorer'      │  • Password
    └──────────────────┘
           │
           │ emailRedirectTo: /auth/callback?next=/resources
           ▼
    ┌──────────────────┐
    │ Email Sent       │  "Check your email"
    └──────────────────┘
           │
           │ User clicks verification link
           ▼
    ┌──────────────────┐
    │ /auth/callback   │  ✅ Honors 'next' parameter
    │  ?next=/resources│  → Redirects to /resources
    └──────────────────┘
           │
           ▼
    ╔══════════════════╗
    ║   /resources     ║  No Payment Required! 🎉
    ║                  ║
    ║  • Demo Sandbox  ║  Browse freely
    ║  • Documentation ║  Learn the platform
    ║  • Tutorials     ║  Watch videos
    ║  • Case Studies  ║  See success stories
    ║  • ROI Calc      ║  Calculate value
    ╚══════════════════╝
           │
           │ When ready to subscribe...
           ▼
    ┌──────────────────┐
    │ Conversion CTA   │  "Ready to Start?"
    │   → /signup      │  → Enter Buyer Journey
    └──────────────────┘
           │
           ▼
        [Buyer Flow]
```

---

## Buyer (Campground Owner) Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                      BUYER PERSONA                               │
│               "Ready to subscribe and use"                       │
└─────────────────────────────────────────────────────────────────┘

    START: Marketing Site (/)
           │
           ├─→ CTA: "Get Started"
           ├─→ CTA: "Start Free Trial"
           └─→ CTA: "Sign Up"
           │
           ▼
    ┌──────────────────┐
    │    /signup       │  Full Registration
    │                  │  • Company Name
    │  user_type:      │  • Full Name
    │  'buyer'         │  • Email
    │                  │  • Password
    └──────────────────┘
           │
           │ emailRedirectTo: /auth/callback?next=/company-details
           ▼
    ┌──────────────────┐
    │ Email Sent       │  "Check your email"
    └──────────────────┘
           │
           │ User clicks verification link
           ▼
    ┌──────────────────┐
    │ /auth/callback   │  ✅ Honors 'next' parameter
    │  ?next=/company  │  → Redirects to /company-details
    │     -details     │
    └──────────────────┘
           │
           ▼
    ╔══════════════════╗
    ║ /company-details ║  SALES FUNNEL - Step 1
    ║                  ║
    ║ • # Properties   ║  Collect business info
    ║ • Property Names ║  Calculate site count
    ║ • Site Counts    ║
    ╚══════════════════╝
           │
           │ Calculate total sites
           ▼
    ╔══════════════════╗
    ║  /choose-plan    ║  SALES FUNNEL - Step 2
    ║  ?sites=X        ║
    ║                  ║  Show 4 plans:
    ║ • Starter        ║  • Highlight recommended
    ║ • Growth         ║  • Monthly vs Annual
    ║ • Pro            ║  • Clear pricing
    ║ • Enterprise     ║
    ╚══════════════════╝
           │
           │ User selects plan + billing
           │ API: POST /api/stripe/create-checkout
           ▼
    ┌──────────────────┐
    │ Stripe Checkout  │  PAYMENT - External
    │  (stripe.com)    │
    │                  │  Secure payment form
    │  💳 Enter Card   │  Process subscription
    └──────────────────┘
           │
           ├─→ Cancel: /payment/failure
           │
           └─→ Success ▼
    ┌──────────────────────────────────────────┐
    │          Stripe Webhook                  │
    │  (Background - happens simultaneously)   │
    │                                          │
    │  checkout.session.completed event:       │
    │  • Create properties record              │
    │  • Set subscription_status = 'active'    │
    │  • Set onboarding_completed = FALSE      │
    └──────────────────────────────────────────┘
           │
           ▼
    ╔══════════════════╗
    ║ /payment/success ║  Success Screen
    ║                  ║
    ║ ✅ Success!      ║  Show plan details
    ║                  ║  Show next steps
    ║ [Continue to     ║
    ║  Onboarding]     ║
    ╚══════════════════╝
           │
           │ Click "Continue to Onboarding"
           ▼
    ╔══════════════════╗
    ║   /onboarding    ║  ONBOARDING - Step 1/4
    ║                  ║
    ║ Property Setup   ║  • Name, Address
    ║                  ║  • Phone, Email
    ║                  ║  • Description
    ╚══════════════════╝
           │
           ▼
    ╔══════════════════╗
    ║ /onboarding/     ║  ONBOARDING - Step 2/4
    ║    sites         ║
    ║                  ║  • Add Campsite Records
    ║ Add Sites        ║  • Site Names
    ║                  ║  • Capacities
    ╚══════════════════╝
           │
           ▼
    ╔══════════════════╗
    ║ /onboarding/     ║  ONBOARDING - Step 3/4
    ║ stripe-connect   ║
    ║                  ║  • Connect for Payouts
    ║ Stripe Connect   ║  • Receive guest payments
    ╚══════════════════╝
           │
           ▼
    ╔══════════════════╗
    ║ /onboarding/     ║  ONBOARDING - Step 4/4
    ║   complete       ║
    ║                  ║  • All Set!
    ║ ✅ Complete      ║  • Update DB:
    ║                  ║    onboarding_completed = TRUE
    ╚══════════════════╝
           │
           │ Redirect to dashboard
           ▼
    ╔══════════════════╗
    ║   /dashboard     ║  🎯 MAIN APPLICATION
    ║                  ║
    ║ ✅ Authenticated ║  Full access granted
    ║ ✅ Subscribed    ║  Manage campground
    ║ ✅ Onboarded     ║  View bookings
    ╚══════════════════╝
```

---

## Login Flow (Returning Users)

```
┌─────────────────────────────────────────────────────────────────┐
│                    RETURNING USER LOGIN                          │
└─────────────────────────────────────────────────────────────────┘

    START: /login
           │
           │ Enter email + password
           ▼
    ┌──────────────────┐
    │  Authenticate    │  Check credentials
    └──────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Check user_type  │  Read metadata
    └──────────────────┘
           │
           ├─────────────┬─────────────┬─────────────┐
           │             │             │             │
           ▼             ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Explorer │  │  Buyer   │  │  Buyer   │  │  Buyer   │
    │          │  │    No    │  │ Incomplete│  │ Complete │
    │          │  │ Property │  │ Onboard   │  │          │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘
           │             │             │             │
           ▼             ▼             ▼             ▼
    /resources   /choose-plan   /onboarding   /dashboard

    Browse         Select          Complete      Full
    resources      plan &          property      access
    freely         pay             setup         granted
```

---

## Middleware Protection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              MIDDLEWARE PROTECTION LAYERS                        │
│         (Runs on EVERY request to protected routes)             │
└─────────────────────────────────────────────────────────────────┘

User requests: /dashboard/reservations
           │
           ▼
    ┌──────────────────┐
    │  Layer 1: Auth   │  Is user authenticated?
    │                  │
    │  If NO:          │  → Redirect: /login?redirect=/dashboard/...
    │  If YES:         │  → Continue to Layer 2
    └──────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Layer 2:         │  Check properties table:
    │ Subscription     │  • Does property exist?
    │                  │  • Is subscription_status = 'active'?
    │  If NO:          │  → Redirect: /choose-plan
    │  If YES:         │  → Continue to Layer 3
    └──────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Layer 3:         │  Check properties table:
    │ Onboarding       │  • Is onboarding_completed = TRUE?
    │                  │
    │  If NO:          │  → Redirect: /onboarding
    │  If YES:         │  → ✅ Allow Access
    └──────────────────┘
           │
           ▼
    ╔══════════════════╗
    ║   /dashboard     ║  Access Granted!
    ║  /reservations   ║
    ╚══════════════════╝
```

---

## Auth Callback Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│         /auth/callback ROUTING DECISION TREE                     │
└─────────────────────────────────────────────────────────────────┘

User lands on: /auth/callback?next=X&code=ABC123
           │
           ▼
    ┌──────────────────┐
    │ Exchange Code    │  Get session from Supabase
    └──────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Check 'next'     │  Is 'next' query param present?
    │  parameter       │
    └──────────────────┘
           │
           ├─ YES ──────────────────┐
           │                        │
           │                        ▼
           │                 ┌──────────────────┐
           │                 │ HONOR 'next'     │
           │                 │ Redirect to:     │
           │                 │ • /company-...   │  Sales funnel
           │                 │ • /resources     │  Explorer hub
           │                 │ • /onboarding    │  Resume onboarding
           │                 └──────────────────┘
           │
           └─ NO ───────────────────┐
                                    ▼
                             ┌──────────────────┐
                             │ Check user_type  │
                             │   metadata       │
                             └──────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
              ┌──────────────┐            ┌──────────────┐
              │  'explorer'  │            │   'buyer'    │
              └──────────────┘            └──────────────┘
                     │                             │
                     ▼                             ▼
              → /resources              ┌──────────────────┐
                                        │ Check property   │
                                        │   table          │
                                        └──────────────────┘
                                                │
                                 ┌──────────────┼──────────────┐
                                 │              │              │
                                 ▼              ▼              ▼
                          No Property   Incomplete     Complete
                                 │       Onboarding   Onboarding
                                 ▼              │              │
                          → /choose-plan       ▼              ▼
                                        → /onboarding  → /dashboard
```

---

## Data Flow: Payment → Onboarding

```
┌─────────────────────────────────────────────────────────────────┐
│          HOW PAYMENT CREATES THE PROPERTY RECORD                 │
└─────────────────────────────────────────────────────────────────┘

User completes payment at Stripe
           │
           ▼
    ┌──────────────────┐
    │ Stripe Webhook   │  POST /api/stripe/webhook
    │                  │  Event: checkout.session.completed
    └──────────────────┘
           │
           │ Extract metadata from session:
           │ • supabase_user_id
           │ • planId (starter/growth/pro/enterprise)
           │ • billingCycle (monthly/annual)
           │ • siteCount
           ▼
    ┌──────────────────┐
    │ Check if user    │  Query properties table
    │ has property     │  WHERE owner_id = user_id
    └──────────────────┘
           │
           ├─ Exists ──────────────────┐
           │                           │
           │                           ▼
           │                    ┌──────────────────┐
           │                    │ UPDATE property  │
           │                    │ • stripe_customer_id
           │                    │ • subscription_id
           │                    │ • subscription_status
           │                    │ • subscription_plan
           │                    │ • billing_cycle
           │                    │ • site_count
           │                    └──────────────────┘
           │                           │
           │                           └─────┐
           │                                 │
           └─ Doesn't Exist ────┐            │
                                 │            │
                                 ▼            │
                          ┌──────────────────┐│
                          │ CREATE property  ││
                          │ • owner_id       ││
                          │ • name (default) ││
                          │ • slug           ││
                          │ • subscription*  ││
                          │ • onboarding_    ││
                          │   completed:     ││
                          │   FALSE ← 🔑     ││
                          └──────────────────┘│
                                 │            │
                                 └────────────┘
                                       │
                                       ▼
                                ┌──────────────────┐
                                │ Log event to     │
                                │ subscription_    │
                                │ events table     │
                                └──────────────────┘
                                       │
                                       ▼
                                  ✅ Complete

User can now proceed to /onboarding
Property exists with onboarding_completed = FALSE
User will be prompted to complete setup
```

---

## Route Protection Matrix

| Route | Auth Required | Subscription Required | Onboarding Required | Accessible By |
|-------|---------------|----------------------|---------------------|---------------|
| `/` | ❌ | ❌ | ❌ | Everyone |
| `/register` | ❌ | ❌ | ❌ | Everyone |
| `/signup` | ❌ | ❌ | ❌ | Everyone |
| `/login` | ❌ | ❌ | ❌ | Everyone |
| `/resources` | ✅ | ❌ | ❌ | Authenticated explorers |
| `/company-details` | ✅ | ❌ | ❌ | Authenticated buyers (sales funnel) |
| `/choose-plan` | ✅ | ❌ | ❌ | Authenticated buyers (sales funnel) |
| `/payment/*` | ✅ | ❌ | ❌ | Authenticated buyers (payment flow) |
| `/onboarding/*` | ✅ | ✅ | ❌ | Subscribed buyers (setup) |
| `/dashboard/*` | ✅ | ✅ | ✅ | Fully onboarded buyers |

---

## Common Scenarios

### Scenario 1: Explorer tries to access Dashboard
```
Explorer User → Attempts /dashboard
  ↓
Middleware: Check auth → ✅ Pass
Middleware: Check subscription → ❌ FAIL (no property)
  ↓
Redirect → /choose-plan
  ↓
User must subscribe to access dashboard
```

### Scenario 2: Buyer skips onboarding, tries Dashboard
```
Buyer User (paid, not onboarded) → Attempts /dashboard
  ↓
Middleware: Check auth → ✅ Pass
Middleware: Check subscription → ✅ Pass (active)
Middleware: Check onboarding → ❌ FAIL (incomplete)
  ↓
Redirect → /onboarding
  ↓
User must complete setup first
```

### Scenario 3: Email link clicked days later
```
User clicks verification link from email
  ↓
/auth/callback?next=/company-details
  ↓
Callback checks: Is 'next' present? → YES
  ↓
Redirect → /company-details
  ↓
User continues where they left off (sales funnel)
```

### Scenario 4: Direct navigation to protected route
```
Anonymous user → Navigates directly to /dashboard
  ↓
Middleware: Check auth → ❌ FAIL (not authenticated)
  ↓
Redirect → /login?redirect=/dashboard
  ↓
After login, will be redirected back if authorized
```

---

## Success Indicators

### ✅ Sales Funnel Works
- Email verification → Company Details (not Onboarding)
- Company Details → Plan Selection
- Plan Selection → Stripe Checkout
- Payment Success → Onboarding (not Dashboard)

### ✅ Onboarding Enforced
- Cannot access Dashboard without onboarding_completed = TRUE
- Middleware redirects incomplete users to /onboarding
- Login redirects incomplete users to /onboarding

### ✅ Subscription Required
- Cannot access Dashboard without active subscription
- Cannot access Onboarding without payment
- Middleware redirects to /choose-plan if no subscription

### ✅ Persona Routing Works
- Explorers → /resources (no payment)
- Buyers → Sales funnel → Dashboard
- Login routes to correct location based on persona

### ✅ Business Model Protected
- No onboarding without payment
- No dashboard without subscription
- Clear conversion path from explorer to buyer
