# MVP Shipment Plan: CampgroundOps to First Customer

**Timeline:** 1-2 Weeks
**Goal:** Ship production-ready MVP to first paying customer
**Last Updated:** 2025-01-26

---

## Executive Summary

**Current State:** ✅ Production-ready booking flow with Stripe payments, type-safe architecture, comprehensive tests
**Target:** Ship MVP to first paying customer within 1-2 weeks
**Strategy:** Focus on critical admin capabilities, email notifications, basic monitoring, and minimal onboarding

---

## Gap Analysis

### ✅ What's Production-Ready
- Guest booking flow (search → checkout → payment → confirmation)
- Stripe payment processing + webhook handling
- Type-safe money handling (BIGINT cents)
- Multi-tenant database schema with RLS
- Comprehensive test coverage (23/23 money type tests passing)
- CI/CD with type-safety enforcement
- Dashboard UI components (reservations, payments, sites, analytics)

### ❌ Critical Gaps for MVP
1. **Email Notifications** - No confirmation emails, payment receipts, or operator alerts
2. **Admin Operations** - Dashboard shows mock data, no backend for cancel/refund/manual booking
3. **Operator Onboarding** - No sign-up flow, property setup, or site creation wizard
4. **Production Monitoring** - No error tracking or performance monitoring
5. **Real Data Integration** - Dashboard needs connection to actual reservations/payments from Supabase

---

## Implementation Plan

### **WEEK 1: Core Admin & Email (Days 1-7)**

#### Phase 1A: Connect Dashboard to Real Data (Days 1-2)

**Objective:** Replace mock data with live Supabase queries

**Files to modify:**
- `app/dashboard/reservations/page.tsx` - Replace mock reservations array with real data
- `app/dashboard/payments/page.tsx` - Connect to actual payments table
- `app/dashboard/page.tsx` - Calculate real stats (revenue, occupancy, bookings)
- `lib/dashboard/queries.ts` (NEW) - Server-side data fetching functions

**API Endpoints to create:**
```typescript
GET /api/admin/reservations?status=confirmed&page=1&limit=50
GET /api/admin/payments?status=paid&startDate=2025-01-01
GET /api/admin/stats // Dashboard statistics
```

**Implementation Details:**
- Use existing `lib/supabase/server.ts` for authenticated queries
- Add pagination support for large datasets
- Include tenant isolation (filter by property_id)
- Add loading states and error boundaries
- Implement search/filter functionality

**Deliverable:** Operators see their actual reservation data in real-time

**Acceptance Criteria:**
- [ ] Dashboard loads real reservations from database
- [ ] Payment history shows actual Stripe transactions
- [ ] Stats reflect accurate revenue and occupancy data
- [ ] Search and filtering work correctly
- [ ] Multi-tenant isolation verified (no data leakage)

---

#### Phase 1B: Critical Admin Operations (Days 2-3)

**Objective:** Enable operators to manage reservations through dashboard

**Priority 1: Cancel Reservation**

**Files to create:**
- `app/api/admin/reservations/[id]/cancel/route.ts` (NEW)
- `components/admin/cancel-reservation-dialog.tsx` (NEW)
- `lib/admin/cancel-reservation.ts` (NEW - business logic)

**Implementation:**
```typescript
POST /api/admin/reservations/[id]/cancel
Body: { reason?: string, refund?: boolean }
Response: { success: boolean, reservation: Reservation }
```

**Logic:**
1. Validate reservation exists and belongs to tenant
2. Update reservation status to 'cancelled'
3. Set cancelled_at timestamp
4. If refund=true, call Stripe refund API
5. Send cancellation email to guest
6. Return updated reservation

**UI:**
- Add "Cancel Reservation" button to dropdown menu in reservations table
- Confirmation dialog with reason input
- Optional refund checkbox
- Loading state during API call
- Success/error toast notifications

---

**Priority 2: Manual Booking Creation**

**Files to create:**
- `app/api/admin/reservations/create/route.ts` (NEW)
- `components/admin/manual-booking-form.tsx` (NEW)
- `app/dashboard/reservations/new/page.tsx` (NEW)

**Implementation:**
- Reuse existing `lib/booking/reservation.ts` business logic
- Support cash/check payment methods (skip Stripe)
- Mark reservation as 'confirmed' immediately for manual bookings
- Include guest creation/lookup
- Validate site availability before creation

**Form Fields:**
- Site selection (dropdown)
- Guest information (reuse guest form)
- Check-in/check-out dates (date picker)
- Number of guests, pets, vehicles
- Payment method (cash, check, card)
- Amount paid (if applicable)
- Special requests/notes

**Deliverable:** Operators can cancel bookings and create manual reservations (phone/walk-in)

**Acceptance Criteria:**
- [ ] Cancel button in UI triggers confirmation dialog
- [ ] Cancellation updates database and sends email
- [ ] Manual booking form validates all inputs
- [ ] Manual booking creates reservation without Stripe
- [ ] Availability checking works for manual bookings
- [ ] Guest records created/linked correctly

---

#### Phase 1C: Email Notifications (Days 4-5)

**Objective:** Automated transactional emails for booking lifecycle

**Email Service:** Resend (https://resend.com)
- Generous free tier: 100 emails/day, 3K emails/month
- React Email templates (JSX/TSX)
- Excellent deliverability
- Simple API

**Installation:**
```bash
npm install resend react-email @react-email/components
```

**Environment Variables:**
```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=bookings@yourcampground.com
RESEND_REPLY_TO=support@yourcampground.com
```

**Templates to Implement:**

1. **Booking Confirmation** (to guest after payment)
   - Confirmation number, dates, site details
   - Total amount charged
   - Cancellation policy
   - Directions/check-in instructions
   - Contact information

2. **Payment Receipt** (to guest)
   - Payment amount, method, date
   - Reservation details
   - Stripe receipt link

3. **Cancellation Notification** (to guest)
   - Cancellation confirmation
   - Refund details (if applicable)
   - Refund timeline

4. **New Booking Alert** (to operator)
   - Guest name, dates, site
   - Amount received
   - Link to reservation in dashboard

**Files to Create:**
```
lib/email/
├── send.ts                                    # Email service wrapper
├── templates/
│   ├── booking-confirmation.tsx               # Guest confirmation
│   ├── payment-receipt.tsx                    # Payment receipt
│   ├── cancellation.tsx                       # Cancellation notice
│   └── new-booking-alert.tsx                  # Operator alert
└── types.ts                                   # Email data types
```

**Email Service Implementation:**
```typescript
// lib/email/send.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingConfirmation(data: BookingConfirmationData) {
  return await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: data.guestEmail,
    subject: `Booking Confirmed - ${data.confirmationNumber}`,
    react: BookingConfirmationTemplate(data),
  });
}
```

**Integration Points:**
- **Stripe webhook** (`app/api/webhooks/stripe/route.ts`) - Send confirmation on payment success
- **Cancel endpoint** - Send cancellation email
- **Manual booking** - Send confirmation for manual bookings
- **Refund endpoint** - Send refund confirmation

**Deliverable:** Automated emails for all booking lifecycle events

**Acceptance Criteria:**
- [ ] Booking confirmation sends after successful payment
- [ ] Payment receipt sent to guest
- [ ] Cancellation email sends when booking cancelled
- [ ] Operator receives new booking alerts
- [ ] Emails render correctly in all major clients (Gmail, Outlook, Apple Mail)
- [ ] Unsubscribe links included (required by CAN-SPAM)
- [ ] Email logs visible in Resend dashboard
- [ ] Failed emails retry automatically

---

#### Phase 1D: Production Monitoring (Days 6-7)

**Objective:** Real-time error tracking and performance monitoring

**Monitoring Stack:**

1. **Sentry** - Error tracking and performance
   - Free tier: 5K errors/month
   - Source map support for debugging
   - Performance tracing
   - Release tracking

2. **Vercel Analytics** - Already included with deployment
   - Web vitals (LCP, FID, CLS)
   - Page views and traffic
   - Device/browser breakdown

**Sentry Setup:**

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Environment Variables:**
```env
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=... # For source maps upload
SENTRY_ORG=your-org
SENTRY_PROJECT=campgroundops
```

**Files Created by Wizard:**
- `sentry.client.config.ts` - Browser error tracking
- `sentry.server.config.ts` - Server error tracking
- `sentry.edge.config.ts` - Edge runtime tracking
- `next.config.mjs` - Updated with Sentry webpack plugin

**Manual Integrations:**
- Update `app/error.tsx` to report errors to Sentry
- Add Sentry error boundary in `app/layout.tsx`
- Track payment flow performance
- Monitor webhook processing time

**Custom Instrumentation:**
```typescript
// Critical paths to monitor
import * as Sentry from '@sentry/nextjs';

// In payment intent creation
Sentry.startSpan({ name: 'create-payment-intent' }, async () => {
  // Payment creation logic
});

// In webhook handler
Sentry.startSpan({ name: 'stripe-webhook-processing' }, async () => {
  // Webhook logic
});
```

**Alerts to Configure:**
- Payment failures
- Webhook processing errors
- Database connection issues
- Email delivery failures
- 5xx server errors

**Deliverable:** Real-time error tracking and alerting in production

**Acceptance Criteria:**
- [ ] Sentry captures frontend errors
- [ ] Sentry captures backend/API errors
- [ ] Source maps uploaded for readable stack traces
- [ ] Performance traces visible for critical flows
- [ ] Alerts configured for high-priority errors
- [ ] Test error triggers correctly in Sentry dashboard

---

### **WEEK 2: Onboarding, Refunds & Launch (Days 8-14)**

#### Phase 2A: Operator Onboarding (Days 8-9)

**Objective:** Enable new campground operators to sign up and configure their property

**MVP Approach:** Manual-assisted onboarding for first customer, automate incrementally

**Minimal Automated Flow:**

1. **Sign-up Form** - Basic information collection
2. **Property Creation** - Create database records
3. **Welcome Email** - Setup instructions
4. **Manual Assistance** - You help add sites via dashboard

**Files to Create:**
```
app/onboarding/
├── page.tsx                                   # Sign-up form
├── success/page.tsx                           # Success confirmation
└── layout.tsx                                 # Onboarding layout

app/api/onboarding/
└── register/route.ts                          # Registration endpoint

lib/onboarding/
├── setup-property.ts                          # Property initialization
└── create-operator-user.ts                    # User account creation

lib/email/templates/
└── welcome-operator.tsx                       # Welcome email template
```

**Sign-up Form Fields:**
- Campground name
- Owner name (first, last)
- Email address
- Phone number
- Address (city, state)
- Number of sites (estimate)
- Preferred subdomain (e.g., `pinelake.campgroundops.com`)

**Registration Endpoint:**
```typescript
POST /api/onboarding/register
Body: {
  campgroundName: string
  ownerName: { first: string, last: string }
  email: string
  phone: string
  address: { city: string, state: string }
  estimatedSites: number
  subdomain: string
}
Response: {
  success: boolean
  propertyId: string
  message: string
}
```

**Database Changes:**
1. Create property record in `properties` table
2. Create owner user account (Supabase Auth)
3. Link user to property
4. Send welcome email with login link

**Welcome Email Content:**
- Login credentials
- Link to dashboard
- Getting started guide
- Next steps (add sites, configure settings)
- Support contact info

---

**Site Management (Basic CRUD)**

**Objective:** Operators can add, edit, and manage their sites

**Files to Modify/Create:**
- `app/dashboard/sites/page.tsx` (MODIFY) - Add Create/Edit UI
- `app/dashboard/sites/new/page.tsx` (NEW) - Create site form
- `app/dashboard/sites/[id]/edit/page.tsx` (NEW) - Edit site form
- `app/api/admin/sites/route.ts` (NEW) - CRUD endpoints
- `components/admin/site-form.tsx` (NEW) - Reusable site form

**Site Form Fields:**
- Site number/name
- Site type (tent, RV, cabin, etc.)
- Max occupancy, max vehicles
- Size (sq ft)
- Base price (per night)
- Weekend price (optional)
- Hookups (electric, water, sewer)
- Amenities (wifi, firepit, picnic table, etc.)
- Pet policy (allow pets, pet fee)
- ADA accessible checkbox
- Images (upload later - defer to v1.1)

**API Endpoints:**
```typescript
GET    /api/admin/sites              # List all sites
POST   /api/admin/sites              # Create site
GET    /api/admin/sites/[id]         # Get single site
PUT    /api/admin/sites/[id]         # Update site
DELETE /api/admin/sites/[id]         # Delete site (soft delete)
```

**Validation:**
- All prices in cents (BIGINT)
- Site number unique within property
- Required fields enforced
- Tenant isolation on all operations

**Deliverable:** New operators can sign up and add their sites

**Acceptance Criteria:**
- [ ] Sign-up form validates all inputs
- [ ] Registration creates property and user account
- [ ] Welcome email delivers successfully
- [ ] Operator can log in to dashboard
- [ ] Operator can create new sites
- [ ] Operator can edit existing sites
- [ ] Site data persists correctly in database
- [ ] Multi-tenant isolation enforced

---

#### Phase 2B: Refund Processing (Days 9-10)

**Objective:** Enable operators to issue refunds through dashboard

**Files to Create:**
- `app/api/admin/payments/[id]/refund/route.ts` (NEW)
- `lib/payments/refund.ts` (NEW) - Stripe refund logic
- `components/admin/refund-dialog.tsx` (NEW) - Refund UI
- `lib/email/templates/refund-confirmation.tsx` (NEW)

**Refund Endpoint:**
```typescript
POST /api/admin/payments/[id]/refund
Body: {
  amount?: number  // Optional partial refund (in cents)
  reason?: string
}
Response: {
  success: boolean
  refund: Stripe.Refund
  updatedPayment: Payment
}
```

**Implementation Logic:**
1. Validate payment exists and belongs to tenant
2. Check payment has associated Stripe payment ID
3. Call Stripe refund API
4. Update payment status to 'refunded'
5. Update reservation payment_status
6. Send refund confirmation email to guest
7. Log refund in system

**Stripe Refund API:**
```typescript
// lib/payments/refund.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function processRefund(
  paymentIntentId: string,
  amount?: number
) {
  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount, // Omit for full refund
  });
}
```

**Refund Dialog UI:**
- Triggered from payments dashboard
- Show payment details (amount, date, guest)
- Refund type selector (full/partial)
- Amount input for partial refunds
- Reason textarea (optional)
- Confirmation step
- Processing state
- Success/error messaging

**Email Notification:**
- Refund amount
- Original payment details
- Refund reason (if provided)
- Timeline (5-10 business days)
- Contact information for questions

**Deliverable:** Operators can issue full or partial refunds

**Acceptance Criteria:**
- [ ] Refund button visible in payments dashboard
- [ ] Refund dialog shows payment details
- [ ] Full refund processes correctly via Stripe
- [ ] Partial refund calculates and processes correctly
- [ ] Database updates to reflect refund status
- [ ] Guest receives refund confirmation email
- [ ] Operator sees updated status in dashboard
- [ ] Error handling for failed refunds

---

#### Phase 2C: Production Deployment & Testing (Days 10-12)

**Objective:** Deploy to production and conduct comprehensive smoke testing

**Deployment Checklist:**

**1. Supabase Production Setup**
- [ ] Create production Supabase project
- [ ] Run all migrations in order:
  ```bash
  # From scripts/
  001_migrate_money_to_cents.sql
  002_finalize_money_migration.sql
  ```
- [ ] Verify Row Level Security (RLS) policies enabled
- [ ] Configure database backups (daily)
- [ ] Generate production API keys
- [ ] Update `src/contracts/db.ts` with production types

**2. Stripe Production Configuration**
- [ ] Create Stripe production account (if not exists)
- [ ] Obtain production API keys
- [ ] Create webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
- [ ] Configure webhook events: `payment_intent.succeeded`
- [ ] Copy webhook signing secret
- [ ] Test webhook with Stripe CLI:
  ```bash
  stripe trigger payment_intent.succeeded
  ```

**3. Resend Production Setup**
- [ ] Verify custom domain DNS records
- [ ] Confirm domain authentication in Resend
- [ ] Update `RESEND_FROM_EMAIL` to production domain
- [ ] Test email delivery to multiple providers (Gmail, Outlook, Yahoo)

**4. Sentry Production Configuration**
- [ ] Create production project in Sentry
- [ ] Configure release tracking
- [ ] Set up alerts for critical errors
- [ ] Add team members to notifications

**5. Vercel Deployment**
- [ ] Connect GitHub repository to Vercel
- [ ] Configure environment variables in Vercel dashboard:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  RESEND_API_KEY=re_...
  RESEND_FROM_EMAIL=bookings@yourcampground.com
  SENTRY_DSN=https://...@sentry.io/...
  SENTRY_AUTH_TOKEN=...
  ```
- [ ] Configure custom domain (optional)
- [ ] Enable automatic deployments from main branch
- [ ] Configure preview deployments for PRs

**6. DNS & Domain Setup** (if applicable)
- [ ] Point custom domain to Vercel
- [ ] Configure SSL certificate (auto via Vercel)
- [ ] Set up email domain SPF/DKIM records

**Production Environment File:**
```env
# .env.production
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=bookings@yourcampground.com
SENTRY_DSN=https://...@sentry.io/...
```

---

**Smoke Testing Checklist:**

**End-to-End Booking Flow:**
- [ ] Search for available sites (various date ranges)
- [ ] Select site and proceed to checkout
- [ ] Fill guest information form
- [ ] Complete payment with test card: `4242 4242 4242 4242`
- [ ] Verify redirect to confirmation page
- [ ] Check booking confirmation email received
- [ ] Verify payment receipt email received
- [ ] Confirm reservation appears in dashboard
- [ ] Verify Stripe payment visible in Stripe dashboard

**Admin Operations:**
- [ ] Log in to operator dashboard
- [ ] View reservations list
- [ ] Search/filter reservations
- [ ] Create manual booking (cash payment)
- [ ] Cancel a reservation
- [ ] Verify cancellation email sent
- [ ] Issue full refund
- [ ] Issue partial refund
- [ ] Create new site
- [ ] Edit existing site
- [ ] Delete site (soft delete)

**Email Delivery:**
- [ ] Booking confirmation arrives within 1 minute
- [ ] Payment receipt arrives
- [ ] Cancellation email arrives
- [ ] Refund confirmation arrives
- [ ] Emails render correctly in Gmail
- [ ] Emails render correctly in Outlook
- [ ] Unsubscribe links work
- [ ] All links in emails work

**Error Tracking:**
- [ ] Trigger test error in frontend
- [ ] Verify error appears in Sentry
- [ ] Trigger API error
- [ ] Verify error captured with context
- [ ] Check source maps work (readable stack traces)
- [ ] Verify alerts fire correctly

**Multi-Tenant Isolation:**
- [ ] Create 2 test properties (Property A, Property B)
- [ ] Add sites to each property
- [ ] Create reservation in Property A
- [ ] Log in as Property B operator
- [ ] Verify Property A reservation NOT visible
- [ ] Attempt direct API access with Property A reservation ID
- [ ] Verify 403/404 error (no data leakage)

**Performance:**
- [ ] Dashboard loads within 2 seconds
- [ ] Booking search returns results within 1 second
- [ ] Payment processing completes within 5 seconds
- [ ] Webhook processing completes within 10 seconds

**Deliverable:** Live production environment ready for first customer

**Acceptance Criteria:**
- [ ] All smoke tests pass
- [ ] No critical errors in Sentry for 24 hours
- [ ] Email deliverability > 95%
- [ ] Multi-tenant isolation verified
- [ ] Performance meets targets
- [ ] SSL certificate valid
- [ ] Custom domain working (if configured)

---

#### Phase 2D: Documentation & First Customer (Days 12-14)

**Objective:** Create operator documentation and onboard first customer

**Operator Documentation:**

**1. Quick Start Guide** (`docs/operator-guide.md`)
- Dashboard overview
- How to add sites
- How to manage reservations
- How to process refunds
- Understanding reports/analytics
- Contact support

**2. FAQ** (`docs/faq.md`)
- How do I cancel a booking?
- How do I issue a refund?
- What payment methods are supported?
- How do guests receive confirmation?
- Can I create bookings for phone/walk-in guests?
- How do I add more sites?
- What if a payment fails?
- How do I update my campground information?

**3. Support Documentation**
- Support email/phone
- Expected response time
- Escalation process for urgent issues
- Known limitations
- Feature roadmap

**Files to Create:**
```
docs/
├── operator-guide.md                          # Complete operator manual
├── faq.md                                     # Frequently asked questions
├── support.md                                 # Support contact info
└── deployment-runbook.md                      # Technical deployment guide
```

---

**First Customer Onboarding:**

**Pre-Onboarding (You):**
- [ ] Verify production environment stable
- [ ] Prepare customer-specific checklist
- [ ] Set up monitoring dashboards
- [ ] Create onboarding spreadsheet template

**Onboarding Session (With Customer):**

**Step 1: Account Setup (30 min)**
- [ ] Help customer complete sign-up form
- [ ] Verify account created successfully
- [ ] Walk through dashboard tour
- [ ] Explain each section (reservations, payments, sites, etc.)

**Step 2: Property Configuration (1 hour)**
- [ ] Collect site information (spreadsheet or manual)
- [ ] Import sites into system (batch create via dashboard)
- [ ] Configure pricing for each site type
- [ ] Set weekend pricing (if applicable)
- [ ] Configure pet policies
- [ ] Review and correct any mistakes

**Step 3: Payment Setup (30 min)**
- [ ] Connect Stripe account (Stripe Connect or direct)
- [ ] Verify webhook endpoint configured
- [ ] Test payment with Stripe test card
- [ ] Verify funds routing correctly

**Step 4: Email Configuration (15 min)**
- [ ] Verify sending domain
- [ ] Send test booking confirmation
- [ ] Review email templates
- [ ] Customize branding (if needed)

**Step 5: Test Booking Together (30 min)**
- [ ] Customer creates test reservation
- [ ] Walk through booking flow as guest
- [ ] Complete test payment
- [ ] Verify emails delivered
- [ ] Check dashboard shows reservation
- [ ] Test cancellation
- [ ] Test refund

**Step 6: Training (1 hour)**
- [ ] How to create manual bookings
- [ ] How to cancel reservations
- [ ] How to process refunds
- [ ] How to modify site availability
- [ ] How to read analytics
- [ ] Where to get help

**Post-Onboarding:**
- [ ] Send summary email with login credentials
- [ ] Share operator guide and FAQ
- [ ] Schedule check-in call (1 week)
- [ ] Monitor for first real bookings
- [ ] Provide white-glove support for first week

**Customer-Specific Setup Notes:**
```markdown
# [Customer Name] Onboarding Checklist

## Property Details
- Name: Pine Lake Campground
- Sites: 42 total (30 RV, 10 tent, 2 cabins)
- Location: Lake Tahoe, CA
- Season: Year-round

## Completed
- [x] Account created
- [x] 42 sites added
- [x] Pricing configured
- [x] Stripe connected
- [x] Test booking successful

## Pending
- [ ] Custom branding (logo, colors)
- [ ] Import historical reservations
- [ ] Staff training session

## Notes
- Customer prefers email support
- Needs weekly occupancy reports
- Wants mobile app in future
```

**Deliverable:** First customer successfully onboarded and operational

**Acceptance Criteria:**
- [ ] Customer can log in independently
- [ ] Customer can create manual bookings
- [ ] Customer can manage reservations
- [ ] Customer understands refund process
- [ ] Customer knows how to get support
- [ ] First real guest booking processes successfully
- [ ] Customer satisfied with platform (NPS survey)

---

## Technology Decisions

| Need | Solution | Rationale | Cost |
|------|----------|-----------|------|
| **Email** | Resend | React Email templates, 100/day free, excellent deliverability | $0-20/mo |
| **Error Tracking** | Sentry | Industry standard, 5K errors/month free, Next.js integration | $0 (MVP) |
| **Hosting** | Vercel | Optimized for Next.js, automatic deployments, global CDN | $0 (Hobby) |
| **Database** | Supabase | Already integrated, PostgreSQL, generous free tier | $0-25/mo |
| **Payments** | Stripe | Already implemented, 2.9% + 30¢ per transaction | Pay-as-you-go |
| **Analytics** | Vercel Analytics | Included with Vercel, web vitals tracking | $0 |

**Total Infrastructure Cost (MVP):** $0-45/month

---

## Alternative Technology Considerations

**Considered but Deferred:**

| Alternative | Why Deferred |
|-------------|--------------|
| **SendGrid** for email | More complex setup, Resend simpler for MVP |
| **LogRocket** for session replay | Overkill for MVP, expensive |
| **Posthog** for analytics | Can add later, Vercel Analytics sufficient |
| **AWS SES** for email | Requires more DevOps, Resend easier |
| **Self-hosted monitoring** | Too much operational overhead |

---

## Risk Mitigation

### High Risk Items

**1. Email Deliverability**
- **Risk:** Emails land in spam, customers don't receive confirmations
- **Mitigation:**
  - Use Resend with verified custom domain
  - Configure SPF, DKIM, DMARC records correctly
  - Test with mail-tester.com before launch
  - Monitor bounce rates in Resend dashboard
  - Have manual email backup process ready
- **Contingency:** Manually email confirmations while debugging

**2. Stripe Webhook Reliability**
- **Risk:** Webhooks fail, payments succeed but reservations stay pending
- **Mitigation:**
  - Already idempotent (duplicate webhooks safe)
  - Stripe automatic retries (up to 3 days)
  - Sentry monitoring on webhook errors
  - Manual reconciliation script as backup
- **Contingency:** Daily manual check of Stripe vs. database

**3. Multi-Tenant Data Leakage**
- **Risk:** One operator sees another's data
- **Mitigation:**
  - All queries include property_id WHERE clause
  - Row Level Security (RLS) in Supabase
  - Comprehensive security tests (already passing)
  - Regular security audits
- **Contingency:** Immediate rollback if leakage detected

**4. First Customer Experience**
- **Risk:** Customer frustrated by bugs or missing features
- **Mitigation:**
  - Manual white-glove onboarding
  - Fast support response (< 4 hours)
  - Regular check-ins first week
  - Proactive monitoring with Sentry
  - Under-promise, over-deliver on timeline
- **Contingency:** Refund and apologize if experience poor

**5. Performance Under Load**
- **Risk:** Site slows down with multiple simultaneous bookings
- **Mitigation:**
  - Vercel auto-scales serverless functions
  - Supabase connection pooling
  - Optimistic locking for race conditions
  - Monitor with Sentry performance tracking
- **Contingency:** Upgrade Vercel/Supabase tier if needed

---

### Medium Risk Items

**Email Template Rendering**
- **Risk:** Emails look broken in some clients (Outlook, Yahoo)
- **Mitigation:** Test with Litmus or Email on Acid, use React Email best practices
- **Contingency:** Simplify templates to plain text + basic HTML

**Stripe Connect Complexity**
- **Risk:** Customer's Stripe account setup confusing
- **Mitigation:** Use direct Stripe keys for MVP (not Connect), simplify later
- **Contingency:** You set up Stripe for customer

**Data Migration from Existing System**
- **Risk:** Customer has legacy reservation data to import
- **Mitigation:** Start fresh for MVP, plan migration script for later
- **Contingency:** Manual data entry or customer starts without history

---

## Success Metrics

### Week 1 Checkpoints

**Day 2:**
- [ ] Dashboard shows real reservation data
- [ ] Payment history connected to Supabase

**Day 3:**
- [ ] Operator can cancel a booking through UI
- [ ] Manual booking form functional

**Day 5:**
- [ ] Booking confirmation email sends automatically
- [ ] Payment receipt delivers to guest

**Day 7:**
- [ ] Sentry captures and reports errors
- [ ] All Week 1 phases complete

---

### Week 2 Checkpoints

**Day 9:**
- [ ] New operator can sign up
- [ ] Operator can add sites through dashboard

**Day 10:**
- [ ] Operator can issue full refund
- [ ] Refund email delivers to guest

**Day 12:**
- [ ] Production deployment successful
- [ ] End-to-end test booking completes
- [ ] All smoke tests pass

**Day 14:**
- [ ] First customer onboarded
- [ ] Customer completes first real booking
- [ ] No critical errors for 24 hours

---

### MVP Launch Criteria (Must Have)

**Functionality:**
- [ ] Guest can search and book available sites
- [ ] Payment processing works end-to-end
- [ ] Booking confirmation email delivers
- [ ] Operator can view all reservations in dashboard
- [ ] Operator can cancel bookings
- [ ] Operator can create manual bookings
- [ ] Operator can issue refunds
- [ ] Operator can add/edit sites

**Quality:**
- [ ] All tests passing (23/23 money type tests minimum)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Sentry error rate < 1% of requests
- [ ] Email deliverability > 95%

**Security:**
- [ ] Multi-tenant isolation verified
- [ ] Stripe webhook signature verification working
- [ ] HTTPS enabled on custom domain
- [ ] No hardcoded secrets in code

**Operational:**
- [ ] Production monitoring active (Sentry)
- [ ] Error alerts configured
- [ ] Database backups enabled
- [ ] Support process documented

**Customer:**
- [ ] Operator documentation complete
- [ ] Onboarding checklist prepared
- [ ] Support contact established
- [ ] First customer trained and confident

---

## Post-MVP Enhancements

**Defer to v1.1 (After First Customer Feedback):**

### Booking Features
- [ ] Edit/modify existing reservations (change dates, sites)
- [ ] Waitlist functionality for sold-out dates
- [ ] Multi-site bookings (book 2+ sites in one transaction)
- [ ] Gift cards and promo codes
- [ ] Deposit/partial payment support

### Admin Features
- [ ] Bulk operations (mass cancellation, exports)
- [ ] Custom email template editor
- [ ] Advanced filtering and search
- [ ] Reservation notes and internal comments
- [ ] Check-in/check-out workflow

### Analytics
- [ ] Revenue forecasting and trends
- [ ] Occupancy heatmaps
- [ ] Guest demographics
- [ ] Seasonal pricing recommendations
- [ ] Competitor rate analysis

### Guest Experience
- [ ] Guest portal (view/modify bookings)
- [ ] Guest reviews and ratings
- [ ] Loyalty program
- [ ] Mobile app (iOS/Android)

### Operations
- [ ] Automated pricing optimization (ML-based)
- [ ] Multi-property management for single operator
- [ ] Staff roles and permissions
- [ ] Housekeeping/maintenance tracking
- [ ] Inventory management

### Integrations
- [ ] Google Calendar sync
- [ ] Airbnb/VRBO integration
- [ ] POS system integration
- [ ] Accounting software (QuickBooks)

---

## Estimated Effort Breakdown

| Phase | Component | Days | Priority | Dependencies |
|-------|-----------|------|----------|--------------|
| **1A** | Dashboard Real Data | 1.5 | Critical | None |
| **1B** | Cancel Reservations | 0.75 | Critical | 1A |
| **1B** | Manual Bookings | 0.75 | Critical | 1A |
| **1C** | Email Setup | 0.5 | Critical | None |
| **1C** | Email Templates | 1 | Critical | Email Setup |
| **1C** | Email Integration | 0.5 | Critical | Templates, 1B |
| **1D** | Sentry Setup | 0.5 | Medium | None |
| **1D** | Error Instrumentation | 0.5 | Medium | Sentry Setup |
| **2A** | Sign-up Flow | 1 | Critical | None |
| **2A** | Site Management CRUD | 1 | Critical | Sign-up |
| **2B** | Refund Processing | 1 | High | 1B |
| **2C** | Production Setup | 1 | Critical | All above |
| **2C** | Smoke Testing | 1 | Critical | Production |
| **2D** | Documentation | 0.5 | High | None |
| **2D** | Customer Onboarding | 1.5 | Critical | All above |
| | **Total** | **13 days** | | **1-2 weeks** |

**Critical Path:** 1A → 1B → 1C → 2A → 2C → 2D = 10 days
**Buffer:** 3 days for unexpected issues, polish, testing

---

## Daily Implementation Checklist

### Day 1: Dashboard Data Integration
- [ ] Create `lib/dashboard/queries.ts` with server-side queries
- [ ] Update `app/dashboard/reservations/page.tsx` with real data
- [ ] Add loading states and error boundaries
- [ ] Test with multiple properties (multi-tenant)
- [ ] Commit: `feat(dashboard): connect reservations to real data`

### Day 2: Payments Data + Cancel Flow
- [ ] Update `app/dashboard/payments/page.tsx` with real data
- [ ] Create cancel API route
- [ ] Build cancel dialog component
- [ ] Test cancellation flow end-to-end
- [ ] Commit: `feat(admin): implement reservation cancellation`

### Day 3: Manual Bookings
- [ ] Create manual booking form component
- [ ] Create manual booking API endpoint
- [ ] Add "New Reservation" button to dashboard
- [ ] Test manual booking creation
- [ ] Commit: `feat(admin): add manual booking creation`

### Day 4: Email Service Setup
- [ ] Install Resend: `npm install resend react-email`
- [ ] Create email service wrapper
- [ ] Set up environment variables
- [ ] Test basic email send
- [ ] Commit: `feat(email): add Resend email service`

### Day 5: Email Templates
- [ ] Create booking confirmation template
- [ ] Create payment receipt template
- [ ] Create cancellation template
- [ ] Test email rendering in multiple clients
- [ ] Commit: `feat(email): add transactional email templates`

### Day 6: Email Integration
- [ ] Integrate email into Stripe webhook
- [ ] Add email to cancel endpoint
- [ ] Add email to manual booking
- [ ] Test all email triggers
- [ ] Commit: `feat(email): integrate emails into booking lifecycle`

### Day 7: Monitoring Setup
- [ ] Install Sentry: `npx @sentry/wizard@latest -i nextjs`
- [ ] Configure error boundaries
- [ ] Add performance instrumentation
- [ ] Test error capture
- [ ] Commit: `feat(monitoring): add Sentry error tracking`

### Day 8: Operator Onboarding
- [ ] Create onboarding sign-up form
- [ ] Create registration API endpoint
- [ ] Create welcome email template
- [ ] Test onboarding flow
- [ ] Commit: `feat(onboarding): add operator registration flow`

### Day 9: Site Management
- [ ] Create site form component
- [ ] Create site CRUD API endpoints
- [ ] Update sites dashboard with edit UI
- [ ] Test site creation/editing
- [ ] Commit: `feat(admin): add site management CRUD`

### Day 10: Refund Processing
- [ ] Create refund API endpoint
- [ ] Build refund dialog component
- [ ] Create refund email template
- [ ] Test full and partial refunds
- [ ] Commit: `feat(payments): add refund processing`

### Day 11: Production Setup
- [ ] Create production Supabase project
- [ ] Run migrations on production
- [ ] Configure Stripe production
- [ ] Set up Resend production domain
- [ ] Configure Vercel environment variables
- [ ] Deploy to production
- [ ] Commit: `chore(deploy): production environment setup`

### Day 12: Smoke Testing
- [ ] Run all smoke tests from checklist
- [ ] Fix any issues discovered
- [ ] Verify multi-tenant isolation
- [ ] Monitor Sentry for errors
- [ ] Commit: `test: production smoke testing complete`

### Day 13: Documentation
- [ ] Write operator guide
- [ ] Write FAQ
- [ ] Create support documentation
- [ ] Prepare onboarding materials
- [ ] Commit: `docs: add operator documentation`

### Day 14: First Customer Onboarding
- [ ] Schedule onboarding session
- [ ] Complete onboarding checklist
- [ ] Import customer sites
- [ ] Test booking with customer
- [ ] Provide training
- [ ] Monitor first real bookings
- [ ] Commit: `chore: first customer successfully onboarded`

---

## Next Steps After Plan Approval

### Immediate Actions (Day 1 Morning):
1. **Install Dependencies**
   ```bash
   npm install resend react-email @react-email/components
   npm install @sentry/nextjs
   ```

2. **Create Project Structure**
   ```bash
   mkdir -p lib/dashboard
   mkdir -p lib/email/templates
   mkdir -p lib/admin
   mkdir -p lib/onboarding
   mkdir -p app/api/admin/reservations
   mkdir -p app/api/admin/payments
   mkdir -p app/api/admin/sites
   mkdir -p components/admin
   mkdir -p docs
   ```

3. **Set Up Environment Variables**
   - Create Resend account
   - Create Sentry account
   - Add keys to `.env.local`

4. **Begin Phase 1A: Dashboard Real Data**
   - Start with `lib/dashboard/queries.ts`
   - Then update `app/dashboard/reservations/page.tsx`

### Daily Workflow:
- [ ] Morning: Review plan, pick day's tasks
- [ ] Implement features using TDD approach
- [ ] Run tests: `npm run test`
- [ ] Type check: `npm run type-check`
- [ ] Commit progress with conventional commits
- [ ] Evening: Update this plan with completed checkboxes

### Communication:
- Daily progress updates
- Flag blockers immediately
- Ask questions early
- Celebrate wins

---

**Let's build this! 🚀**

Questions or ready to start Day 1?
