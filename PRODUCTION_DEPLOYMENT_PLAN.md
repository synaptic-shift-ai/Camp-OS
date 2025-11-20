# CampOps Production Deployment Plan

**Version:** 1.0
**Date:** 2025-11-19
**Purpose:** Comprehensive guide for deploying CampOps to production and onboarding first customers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Architecture](#current-system-architecture)
3. [Customer Onboarding Flow](#customer-onboarding-flow)
4. [Dev-to-Prod Migration Concerns](#dev-to-prod-migration-concerns)
5. [Environment Configuration](#environment-configuration)
6. [Pre-Production Checklist](#pre-production-checklist)
7. [Production Cutover Procedure](#production-cutover-procedure)
8. [Customer Onboarding Playbook](#customer-onboarding-playbook)
9. [On-Site Configuration Guide](#on-site-configuration-guide)
10. [Rollback Procedures](#rollback-procedures)
11. [Post-Deployment Monitoring](#post-deployment-monitoring)

---

## Executive Summary

This document provides a complete end-to-end deployment plan for CampOps, covering:

- **Current State**: Multi-tenant SaaS with Stripe subscription flow
- **Database**: Supabase PostgreSQL with Row-Level Security
- **Customer Flow**: Purchase → Email invitation → Magic link → Onboarding wizard → Dashboard access
- **Critical Gaps**: Test data cleanup, rate limiting, webhook idempotency, monitoring
- **Deployment Timeline**: Estimated 2-3 weeks for production-ready deployment

### Key Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Test data persisting in production | HIGH | Run cleanup scripts before cutover |
| Test API endpoints exposed | HIGH | Disable via environment variable check |
| Webhook duplicate processing | HIGH | Implement idempotency check |
| Missing rate limiting | MEDIUM | Add rate limiting to auth endpoints |
| No disaster recovery plan | MEDIUM | Configure automated backups |

---

## Current System Architecture

### Multi-Tenant Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Auth                           │
│                    (User accounts)                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Companies                              │
│           (Billing entity / Primary tenant)                 │
│  - owner_id (auth.users)                                    │
│  - stripe_customer_id                                       │
│  - subscription_id                                          │
│  - subscription_status ('active', 'past_due', 'canceled')   │
│  - onboarding_token (magic link auth)                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Properties                              │
│              (Campgrounds / Secondary tenant)               │
│  - company_id                                               │
│  - booking_page_slug                                        │
│  - onboarding_completed                                     │
│  - stripe_account_id (Stripe Connect)                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
          ┌────────┴────────┬─────────────┬──────────────┐
          ▼                 ▼             ▼              ▼
     ┌────────┐      ┌──────────┐   ┌─────────┐   ┌──────────┐
     │  Sites │      │  Guests  │   │Reserves │   │ Payments │
     └────────┘      └──────────┘   └─────────┘   └──────────┘
```

### Authentication Flow

```
User purchases on marketing site
         │
         ▼
   Stripe Checkout
         │
         ▼
Webhook creates company + properties
         │
         ▼
Email sent with onboarding_token
         │
         ▼
User clicks magic link (/auth/verify-token?token=xxx)
         │
         ▼
Token validated → Supabase magic link generated
         │
         ▼
Auto sign-in → Redirect to /dashboard/sites?wizard=true
         │
         ▼
User completes onboarding wizard
         │
         ▼
Dashboard access granted
```

### Current Email Access Resolution

**After Purchase:**
1. Customer completes payment on Stripe Checkout
2. Stripe webhook `checkout.session.completed` fires
3. System creates:
   - Company record with owner_id
   - Onboarding token (32-byte hex, 7-day expiry)
   - Property records from metadata
4. Email sent via Resend to customer with link:
   ```
   https://app.campops.com/auth/verify-token?token={64-char-hex-token}
   ```
5. User clicks link → Token validated → Magic link generated → Auto sign-in
6. Redirects to: `/dashboard/sites?wizard=true`

**Current Implementation:**
- File: `src/app/api/stripe/webhook/route.ts:160-199` (Company creation)
- File: `src/app/api/auth/verify-token/route.ts` (Token validation)
- Email template: `src/lib/email/templates/` (Resend integration)

**Where It Resolves:**
- Token validation endpoint: `/api/auth/verify-token`
- Final destination: `/dashboard/sites?wizard=true` (onboarding wizard)
- After wizard: `/dashboard` (main dashboard)

---

## Customer Onboarding Flow

### Complete Journey Map

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SIGNUP (Marketing Site → App)                             │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User visits /signup                                              │
│ 2. Creates account (email/password)                                 │
│    - Immediate session (email verification optional)                │
│    - User type: 'buyer'                                             │
│    - Metadata: company_name, full_name                              │
│ 3. Redirects to /company-details                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: COMPANY DETAILS                                            │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User enters:                                                     │
│    - Company name                                                   │
│    - Number of properties (1-10)                                    │
│    - For each property: name, site count                            │
│ 2. Data stored in localStorage (backup)                             │
│ 3. Redirects to /choose-plan                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PLAN SELECTION & PAYMENT                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User selects tier (Starter, Growth, Pro, Enterprise)            │
│ 2. Selects billing cycle (monthly/annual)                           │
│ 3. System creates Stripe Checkout session with metadata:            │
│    {                                                                │
│      userId: "...",                                                 │
│      planId: "...",                                                 │
│      companyData: { companyName, properties: [...] }                │
│    }                                                                │
│ 4. Redirects to Stripe Checkout                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 4: PAYMENT PROCESSING (Stripe Webhook)                       │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Webhook: checkout.session.completed                             │
│ 2. Create company record:                                           │
│    - owner_id (from metadata userId)                                │
│    - stripe_customer_id                                             │
│    - subscription_id, subscription_status: 'active'                 │
│    - onboarding_token (32-byte random hex)                          │
│    - onboarding_token_expires_at (7 days)                           │
│ 3. Create properties from metadata                                  │
│ 4. Send email with magic link via Resend                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 5: EMAIL INVITATION                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Email contains:                                                     │
│   Subject: "Welcome to CampOps - Complete Your Setup"              │
│   Link: https://app.campops.com/auth/verify-token?token=xxx        │
│                                                                     │
│ Token features:                                                     │
│   - 64-character hex string                                         │
│   - 7-day expiration                                                │
│   - One-time use only                                               │
│   - Marked used after validation                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 6: MAGIC LINK AUTHENTICATION                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User clicks email link                                           │
│ 2. POST /api/auth/verify-token {token}                              │
│ 3. Server validates:                                                │
│    - Token exists                                                   │
│    - Not expired (< 7 days)                                         │
│    - Not used (onboarding_token_used_at IS NULL)                    │
│ 4. Generate Supabase magic link via admin API                       │
│ 5. Mark token as used                                               │
│ 6. Return action_link to frontend                                   │
│ 7. Frontend redirects to Supabase magic link                        │
│ 8. Auto sign-in → redirect to /dashboard/sites?wizard=true          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 7: ONBOARDING WIZARD                                         │
├─────────────────────────────────────────────────────────────────────┤
│ User completes:                                                     │
│   1. Property configuration (address, hours, policies)              │
│   2. Site creation/import (CSV or manual)                           │
│   3. Stripe Connect setup (payment processing)                      │
│   4. Booking page customization (slug, colors, logo)                │
│   5. Final review                                                   │
│                                                                     │
│ On completion:                                                      │
│   - properties.onboarding_completed = true                          │
│   - Redirect to /dashboard                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 8: DASHBOARD ACCESS                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Full feature access:                                                │
│   - View reservations, guests, analytics                            │
│   - Manage properties and sites                                     │
│   - Process payments                                                │
│   - Generate reports                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Dev-to-Prod Migration Concerns

### Critical Issues

#### 1. Test Data Persistence

**Problem:** Development database contains hardcoded test data that will persist if migrated to production.

**Affected Data:**

**Test Properties:**
- Property ID: `12da6cb6-ac60-41df-ad6f-640fe3c9091a` (from setup-test-data.sql)
- Property ID: `86ab6f78-9c2c-45bb-9c6d-4c107a060c3c` (from seed-analytics-data.sql)

**Test Reservations:**
- Confirmation numbers matching: `CAMP-TEST-%`
- Confirmation numbers matching: `CAMP-202[0-9]%` (from seed script)

**Test Guests:**
- Emails matching: `%.smith@email.com`, `%.johnson@email.com`, etc.
- Phone numbers: `555-01%`, `555-02%`, etc.
- Test addresses: `100 Main Street`, `101 Main Street`, etc.

**Cleanup Script Required:**

```sql
-- ===================================================================
-- PRODUCTION DATABASE CLEANUP SCRIPT
-- ===================================================================
-- ⚠️ WARNING: Run this ONLY on a fresh production database
-- ⚠️ DO NOT run on development database - will delete test data
-- ===================================================================

BEGIN;

-- 1. Delete test reservations (by confirmation number pattern)
DELETE FROM reservations
WHERE confirmation_number LIKE 'CAMP-TEST-%'
   OR confirmation_number LIKE 'CAMP-202[0-5]%'; -- Old seed data

-- 2. Delete test payments (orphaned by reservation deletion)
DELETE FROM payments
WHERE reservation_id NOT IN (SELECT id FROM reservations);

-- 3. Delete test guests (by email pattern)
DELETE FROM guests
WHERE email ~ '@email\.com$'  -- Seed data pattern
   OR phone LIKE '555-%';      -- Test phone pattern

-- 4. Delete test properties (hardcoded IDs from scripts)
DELETE FROM properties
WHERE id IN (
  '12da6cb6-ac60-41df-ad6f-640fe3c9091a',
  '86ab6f78-9c2c-45bb-9c6d-4c107a060c3c'
);

-- 5. Delete test companies (orphaned by property deletion)
DELETE FROM companies
WHERE id NOT IN (SELECT DISTINCT company_id FROM properties WHERE company_id IS NOT NULL);

-- 6. Verify cleanup
SELECT
  'properties' as table_name,
  COUNT(*) as remaining_records
FROM properties
UNION ALL
SELECT 'companies', COUNT(*) FROM companies
UNION ALL
SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL
SELECT 'guests', COUNT(*) FROM guests
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;

-- Expected result: 0 records in all tables for fresh production DB

COMMIT;
-- ROLLBACK; -- Uncomment if verification shows unexpected data
```

**Recommendation:**
- Create a fresh Supabase production project (do NOT copy dev database)
- Run migrations only (no seed scripts)
- Verify zero records before customer onboarding

#### 2. Test API Endpoints Exposed

**Problem:** Development-only API endpoints will be accessible in production unless explicitly disabled.

**Endpoints to Disable:**

| Endpoint | File | Purpose | Risk |
|----------|------|---------|------|
| `/api/test-booking-data` | `src/app/api/test-booking-data/route.ts` | List all properties for testing | Exposes all tenant data |
| `/api/test/create-incomplete-property` | `src/app/api/test/create-incomplete-property/route.ts` | Create test properties | Bypasses payment flow |

**Current Protection:**
```typescript
// src/app/api/test/create-incomplete-property/route.ts:27
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json(
    { error: 'Test endpoints are not available in production' },
    { status: 403 }
  )
}
```

**Status:** ✅ Already protected (verified in code)

**Action Required:**
- Verify `NODE_ENV=production` is set in production environment
- Add integration test to verify 403 response in production mode

#### 3. Environment Variable Differences

**Development vs Production:**

| Variable | Development | Production | Notes |
|----------|-------------|------------|-------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://app.campops.com` | OAuth redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | Dev project URL | Prod project URL | Separate databases |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev anon key | Prod anon key | Different projects |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev service key | Prod service key | ⚠️ Secret - Never commit |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` | ⚠️ Live payments |
| `STRIPE_WEBHOOK_SECRET` | Test webhook secret | Prod webhook secret | Signature verification |
| `RESEND_API_KEY` | Shared or test key | Production key | Email sending |
| `RESEND_FROM_EMAIL` | `noreply@test.com` | `noreply@campops.com` | Verified domain required |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional (disabled) | Required | Error tracking |
| `NODE_ENV` | `development` | `production` | Disables test endpoints |

**Critical Secrets (NEVER in version control):**
- `SUPABASE_SERVICE_ROLE_KEY` - Bypasses RLS, full database access
- `STRIPE_SECRET_KEY` - Create charges, refunds, access customer data
- `STRIPE_WEBHOOK_SECRET` - Verify webhook authenticity
- `RESEND_API_KEY` - Send emails from your domain

**Recommended Secret Management:**
- **Option 1:** Vercel Environment Variables (if deploying to Vercel)
- **Option 2:** AWS Secrets Manager
- **Option 3:** Google Cloud Secret Manager
- **Option 4:** HashiCorp Vault

#### 4. Missing Production Features

**Rate Limiting:**
- Status: ❌ Not implemented
- Critical endpoints: `/api/auth/verify-token`, `/api/auth/login`
- Recommendation: Implement before production (see Production Checklist)

**Webhook Idempotency:**
- Status: ⚠️ Not checked
- Risk: Duplicate webhook could create duplicate company
- Recommendation: Add subscription_id uniqueness check

**Audit Logging:**
- Status: ⚠️ Table exists, not used
- Table: `api_audit_log`
- Recommendation: Log all auth events, payment events, admin actions

**Email Verification:**
- Status: ⚠️ Optional (disabled for faster signup)
- Production: Should be enforced
- Risk: Account takeover if email not verified

**Session Monitoring:**
- Status: ❌ Not implemented
- Recommendation: Log all sessions, detect anomalies

#### 5. Database Migration Strategy

**Current Approach:** Run all migrations sequentially on fresh database

**Migration Files:**
```
supabase/migrations/
├── 20251027080000_onboarding_enhancements.sql
├── 20251027120000_subscription_management.sql
├── 20251027130000_add_companies_table.sql
├── 20251028000000_add_company_id_to_subscription_events.sql
├── 20251028140000_property_wizard_enhancements.sql
├── 20251028140001_site_configuration_enhancements.sql
├── 20251028190000_booking_page_configuration.sql
├── 20251029000000_guest_booking_enhancements.sql
├── 20251029140000_fix_rls_recursion_and_public_access.sql
├── 20251029140001_fix_rls_properly.sql
├── 20251029140002_fix_rls_with_security_definer.sql
├── 20251029140003_fix_rls_public_schema.sql         # ← CRITICAL RLS fix
├── ... (30+ more migrations)
```

**Recommendation:**
1. Create fresh Supabase production project
2. Run migrations in order: `supabase db push` or `supabase db reset` (remote)
3. Verify RLS policies: Query `pg_policies` table
4. Test multi-tenant isolation with test user
5. Verify zero records in all tables
6. Run advisors: Check for security/performance issues

**Testing Migration:**
```bash
# 1. Create staging environment (copy of production)
supabase link --project-ref staging-project-ref

# 2. Run migrations
supabase db push

# 3. Verify zero data
psql postgres://... -c "SELECT COUNT(*) FROM properties"

# 4. Test onboarding flow end-to-end
# 5. Verify tenant isolation (user A cannot see user B's data)
```

---

## Environment Configuration

### Production Environment Variables

```bash
# ===================================================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ===================================================================
# ⚠️ NEVER commit this file to version control
# ⚠️ Store secrets in secure secret manager (AWS Secrets Manager, etc.)
# ===================================================================

# -------------------------------------------------------------------
# Application Configuration
# -------------------------------------------------------------------
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.campops.com

# -------------------------------------------------------------------
# Supabase Configuration (Production Project)
# -------------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://[your-prod-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG... # Production anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...     # ⚠️ SECRET - Production service role

# -------------------------------------------------------------------
# Stripe Configuration (LIVE KEYS)
# -------------------------------------------------------------------
STRIPE_SECRET_KEY=sk_live_...                      # ⚠️ SECRET - Live secret key
NEXT_PUBLIC_STRIPE_CLIENT_ID=ca_...                # Connect client ID
STRIPE_WEBHOOK_SECRET=whsec_...                    # ⚠️ SECRET - Webhook signing

# Webhook endpoint: https://app.campops.com/api/webhooks/stripe
# Create webhook in Stripe dashboard with events:
#   - checkout.session.completed
#   - customer.subscription.updated
#   - customer.subscription.deleted

# -------------------------------------------------------------------
# Email Configuration (Resend Production)
# -------------------------------------------------------------------
RESEND_API_KEY=re_...                              # ⚠️ SECRET - Production API key
RESEND_FROM_EMAIL=noreply@campops.com              # Must be verified domain

# Verify domain in Resend:
# 1. Add DNS records (SPF, DKIM, DMARC)
# 2. Verify in Resend dashboard
# 3. Send test email before production

# -------------------------------------------------------------------
# Error Tracking (Sentry Production)
# -------------------------------------------------------------------
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...   # Production DSN
SENTRY_ORG=campops
SENTRY_PROJECT=campops-production
SENTRY_AUTH_TOKEN=sntrys_...                       # ⚠️ SECRET - For source maps
NEXT_PUBLIC_SENTRY_ENABLED=true
SENTRY_ENABLED=true

# -------------------------------------------------------------------
# Security Configuration
# -------------------------------------------------------------------
# Rate limiting (if using Upstash Redis)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...                       # ⚠️ SECRET

# -------------------------------------------------------------------
# Feature Flags
# -------------------------------------------------------------------
NEXT_PUBLIC_ENABLE_EMAIL_VERIFICATION=true         # Enforce email verification
NEXT_PUBLIC_ENABLE_2FA=false                       # Future: Enable 2FA
```

### Vercel Deployment Configuration

If deploying to Vercel:

```bash
# Install Vercel CLI
npm install -g vercel

# Link to project
vercel link

# Set production environment variables
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add RESEND_API_KEY production
# ... (repeat for all secrets)

# Deploy
vercel --prod
```

### Docker Deployment Configuration

If using Docker:

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_CLIENT_ID
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_STRIPE_CLIENT_ID=$NEXT_PUBLIC_STRIPE_CLIENT_ID
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

---

## Pre-Production Checklist

### Week 1: Foundation Setup

- [ ] **Create Production Supabase Project**
  - Create new project (do NOT copy dev database)
  - Note project URL and keys
  - Enable database backups (daily, 7-day retention minimum)
  - Configure point-in-time recovery (PITR)

- [ ] **Run Database Migrations**
  ```bash
  supabase link --project-ref prod-project-ref
  supabase db push
  ```
  - Verify all migrations applied successfully
  - Check RLS policies exist: `SELECT * FROM pg_policies`
  - Verify zero records: `SELECT COUNT(*) FROM properties`

- [ ] **Create Stripe Production Account**
  - Activate live mode in Stripe dashboard
  - Create webhook endpoint: `https://app.campops.com/api/webhooks/stripe`
  - Add events: `checkout.session.completed`, `customer.subscription.*`
  - Copy webhook signing secret
  - Create Stripe Connect application
  - Copy Connect client ID

- [ ] **Configure Email Domain (Resend)**
  - Add domain to Resend
  - Configure DNS records (SPF, DKIM, DMARC)
  - Verify domain
  - Send test email to confirm deliverability

- [ ] **Set Up Error Tracking (Sentry)**
  - Create Sentry production project
  - Copy DSN
  - Configure source map uploads
  - Test error reporting

### Week 2: Security Hardening

- [ ] **Implement Rate Limiting**
  - Install rate limiting library (e.g., `@upstash/ratelimit`)
  - Add middleware to `/api/auth/verify-token` (5 requests/min per IP)
  - Add middleware to `/api/auth/login` (10 requests/min per IP)
  - Test rate limiting with integration test

- [ ] **Add Webhook Idempotency Check**
  ```typescript
  // Before creating company in webhook handler
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('subscription_id', subscriptionId)
    .single()

  if (existing) {
    console.log('[Webhook] Company already exists, skipping')
    return NextResponse.json({ received: true })
  }
  ```

- [ ] **Enforce Email Verification**
  - Set `NEXT_PUBLIC_ENABLE_EMAIL_VERIFICATION=true`
  - Update signup flow to require verification
  - Test verification email delivery

- [ ] **Add Audit Logging**
  - Implement audit log middleware
  - Log events:
    - User authentication (login, logout, token verification)
    - Payment events (checkout, refund, subscription change)
    - Admin actions (property creation, site modification)
    - Failed authorization attempts
  - Add log viewer in admin dashboard

- [ ] **Security Audit**
  - Run Supabase advisors: Security & Performance
    ```sql
    SELECT * FROM supabase_advisors.security_advisor();
    SELECT * FROM supabase_advisors.performance_advisor();
    ```
  - Review RLS policies for tenant isolation
  - Test multi-tenant isolation with two test users
  - Verify service role client usage is limited
  - Check for SQL injection vulnerabilities

### Week 3: Testing & Deployment

- [ ] **Load Testing**
  - Test onboarding flow: 100 concurrent users
  - Test booking flow: 500 concurrent searches
  - Test dashboard: 50 concurrent property managers
  - Verify database connection pool settings
  - Monitor response times (target: p95 < 500ms)

- [ ] **End-to-End Testing**
  - Test complete customer journey (signup → payment → onboarding → dashboard)
  - Test Stripe webhook processing (use Stripe CLI)
  - Test email delivery (onboarding invitation, password reset)
  - Test magic link authentication
  - Test guest booking flow (public, no auth)

- [ ] **Deployment Infrastructure**
  - Set up production hosting (Vercel, AWS, GCP, or Docker)
  - Configure custom domain: `app.campops.com`
  - Enable HTTPS/SSL (Let's Encrypt or CDN-managed)
  - Configure CDN (Cloudflare, CloudFront, etc.)
  - Set up DNS records

- [ ] **Monitoring Setup**
  - Configure Sentry alerts (error rate > 1%)
  - Set up uptime monitoring (Pingdom, UptimeRobot)
  - Configure database monitoring (Supabase dashboard)
  - Set up Stripe webhook monitoring
  - Create Slack/PagerDuty alerts for critical failures

- [ ] **Documentation**
  - Update README with production deployment steps
  - Document environment variables
  - Create runbook for common operations
  - Document rollback procedures

---

## Production Cutover Procedure

### Pre-Cutover (T-24 hours)

1. **Freeze Development**
   - Stop all feature development
   - Only critical bugfixes allowed
   - Communicate freeze to team

2. **Final Testing**
   - Run full test suite: `npm run test:run`
   - Run E2E tests: `npm run test:e2e`
   - Verify build: `npm run build`
   - Type check: `npm run type-check`

3. **Backup Verification**
   - Verify Supabase automated backups enabled
   - Create manual backup before cutover
   - Test backup restoration process

4. **Staging Smoke Test**
   - Deploy to staging environment
   - Complete full customer journey
   - Verify all integrations (Stripe, Resend, Sentry)

### Cutover (T-0)

**Recommended Time:** Saturday 2:00 AM PT (low traffic)

```bash
# ===================================================================
# PRODUCTION CUTOVER CHECKLIST
# ===================================================================

# 1. Deploy application
vercel --prod
# OR
docker build -t campops-prod .
docker push registry/campops-prod:latest
kubectl rollout deploy campops-production

# 2. Verify deployment health
curl https://app.campops.com/api/health

# 3. Verify database connectivity
curl https://app.campops.com/api/test-db-connection

# 4. Test authentication flow
# - Login with test user
# - Verify token validation works
# - Verify dashboard accessible

# 5. Test Stripe webhook
stripe trigger checkout.session.completed

# 6. Verify email delivery
# - Trigger onboarding email
# - Check Resend dashboard for delivery status

# 7. Monitor error rate
# - Check Sentry dashboard
# - Verify no critical errors

# 8. Monitor response times
# - Check application monitoring (Vercel Analytics, New Relic, etc.)
# - Verify p95 response time < 500ms

# 9. Test guest booking flow (public)
# - Navigate to /book/test-property
# - Search for availability
# - Complete mock booking

# 10. Announce go-live
# - Update status page
# - Notify team in Slack
# - Monitor for 2 hours
```

### Post-Cutover (T+2 hours)

1. **Health Checks**
   - [ ] Application responding (200 OK)
   - [ ] Database queries working
   - [ ] Authentication functional
   - [ ] Stripe webhooks processing
   - [ ] Emails sending

2. **Monitoring**
   - [ ] Error rate < 0.1%
   - [ ] Response time p95 < 500ms
   - [ ] No database connection errors
   - [ ] No failed webhook deliveries

3. **Functional Testing**
   - [ ] Signup flow works
   - [ ] Payment processing works
   - [ ] Email delivery works
   - [ ] Dashboard loads
   - [ ] Booking flow works

4. **Communication**
   - [ ] Post go-live status update
   - [ ] Document any issues encountered
   - [ ] Update on-call rotation

---

## Customer Onboarding Playbook

### For First 10 Customers

**Goal:** White-glove onboarding, gather feedback, iterate quickly

**Pre-Purchase:**
1. Schedule onboarding call (30 minutes)
2. Send welcome email with:
   - What to expect
   - Requirements (property info, site count, Stripe account)
   - Timeline (1 hour setup)

**Purchase:**
1. Customer completes payment on Stripe
2. System sends onboarding email within 5 minutes
3. You receive notification (via Slack webhook or email)

**Onboarding Call (Scheduled):**
1. **Introduction (5 min)**
   - Welcome to CampOps
   - Overview of platform
   - Answer questions

2. **Magic Link Setup (5 min)**
   - Verify customer received email
   - Walk through clicking magic link
   - Verify auto sign-in works

3. **Property Configuration (10 min)**
   - Guide through property details form
   - Explain check-in/check-out times
   - Set up property policies

4. **Site Setup (5 min)**
   - Explain CSV import vs manual entry
   - If using CSV: Provide template, assist with upload
   - If manual: Show site creation form

5. **Payment Setup (3 min)**
   - Connect Stripe account
   - Explain payment processing (fees, payouts)
   - Verify account connected

6. **Booking Page (2 min)**
   - Customize booking page (logo, colors)
   - Set booking page slug
   - Preview booking page

7. **Next Steps (5 min)**
   - Share booking page URL
   - Explain how to test bookings
   - Schedule follow-up call (1 week)
   - Provide support contact

**Post-Onboarding:**
1. Send summary email with:
   - Booking page URL
   - Dashboard link
   - Support contact
   - Documentation links
2. Add customer to feedback group
3. Schedule 1-week check-in call

### On-Site Customer Configuration

If you need to assist customer on-site:

**Before Arrival:**
- [ ] Customer has active subscription
- [ ] Customer has Stripe account ready
- [ ] Customer has property information ready (address, policies, etc.)
- [ ] Customer has site list (CSV or manual)
- [ ] Your laptop has:
  - Production access (read-only)
  - Screen sharing capability
  - Testing credentials

**On-Site Agenda (2 hours):**

**Hour 1: Platform Setup**
1. Verify customer account access (15 min)
   - Customer logs in
   - Verify dashboard loads
   - Check property exists
2. Complete property configuration (20 min)
   - Property details, policies, hours
   - Contact information
   - Photos/logo upload
3. Site configuration (25 min)
   - Import CSV or create manually
   - Review site types, pricing
   - Set amenities

**Hour 2: Payment & Go-Live**
1. Stripe Connect setup (15 min)
   - Connect Stripe account
   - Verify payment processing
   - Test transaction
2. Booking page customization (15 min)
   - Set slug, colors, logo
   - Preview booking page
   - Test guest booking flow
3. Training (20 min)
   - Dashboard overview
   - How to manage reservations
   - How to process payments
   - How to run reports
4. Q&A and next steps (10 min)

**Post-Visit:**
- Send follow-up email with notes
- Schedule remote check-in (3 days)
- Add to feedback/beta group

---

## On-Site Configuration Guide

### Equipment Checklist

- [ ] Laptop with production access
- [ ] Mobile hotspot (backup internet)
- [ ] HDMI cable (for screen sharing)
- [ ] Customer property information packet
- [ ] CSV template for site import
- [ ] Business cards with support contact

### Step-by-Step Onboarding Wizard

**Step 1: Verify Access**
```
1. Navigate to https://app.campops.com
2. Customer logs in (email/password)
3. Verify redirect to dashboard
4. Confirm property appears in dropdown
```

**Step 2: Property Details**
```
Form Fields:
  - Property Name: [Auto-filled from signup]
  - Address: [Customer inputs]
  - City, State, Zip
  - Phone: (555) 123-4567
  - Email: support@campground.com
  - Website: www.campground.com
  - Check-in Time: 3:00 PM
  - Check-out Time: 11:00 AM
  - Directions: [Text area]
  - Policies: [Text area]

Validation:
  ✓ Address geocoded successfully
  ✓ Phone number valid format
  ✓ Email valid format
  ✓ Times in valid range
```

**Step 3: Site Configuration**

**Option A: CSV Import**
```csv
site_number,site_name,site_type,base_price,max_occupancy,max_vehicles,allow_pets,pet_fee,amenities
1,Riverside RV A-1,rv,85.00,6,2,true,20.00,"water,electric,sewer,wifi"
2,Forest Tent B-1,tent,45.00,4,1,true,15.00,"picnic_table,fire_pit"
3,Lakeside Cabin C-1,cabin,150.00,4,2,true,25.00,"kitchen,bathroom,heating,wifi"
```

**Validation:**
- [ ] All required fields present
- [ ] Site numbers unique
- [ ] Prices in valid range ($0.01 - $999.99)
- [ ] Max occupancy > 0
- [ ] Amenities valid (from predefined list)

**Option B: Manual Entry**
```
For each site:
  1. Click "Add Site"
  2. Fill form (site number, name, type, price, etc.)
  3. Select amenities from checkboxes
  4. Click "Save Site"
  5. Repeat
```

**Step 4: Stripe Connect**
```
1. Click "Connect Stripe Account"
2. Redirect to Stripe Connect OAuth flow
3. Customer completes Stripe onboarding:
   - Business information
   - Bank account
   - Identity verification
4. Redirect back to CampOps
5. Verify stripe_account_id saved
6. Display success message
```

**Step 5: Booking Page Customization**
```
Form Fields:
  - Booking Page Slug: campground-name-12345
  - Logo: [Upload image]
  - Primary Color: #3B82F6
  - Preview: [Live preview iframe]

Actions:
  - Save & Preview
  - Copy booking URL
  - Test booking (opens in new tab)
```

**Step 6: Complete Onboarding**
```
Final Checklist:
  ✓ Property details complete
  ✓ At least 1 site created
  ✓ Stripe account connected
  ✓ Booking page configured

On Submit:
  - Mark property.onboarding_completed = true
  - Redirect to /dashboard
  - Show success toast
```

### Troubleshooting Common Issues

**Issue:** Customer didn't receive email
```
Solution:
1. Check spam folder
2. Verify email in companies.owner_id → auth.users.email
3. Check Resend dashboard for delivery status
4. Resend via admin panel:
   POST /api/admin/resend-onboarding-email
   { "companyId": "..." }
```

**Issue:** Magic link expired
```
Solution:
1. Check companies.onboarding_token_expires_at
2. If expired, generate new token:
   UPDATE companies
   SET onboarding_token = encode(gen_random_bytes(32), 'hex'),
       onboarding_token_expires_at = NOW() + INTERVAL '7 days',
       onboarding_token_used_at = NULL
   WHERE id = '...';
3. Resend email with new token
```

**Issue:** Stripe Connect fails
```
Solution:
1. Verify customer has valid Stripe account
2. Check Stripe Connect application settings
3. Verify NEXT_PUBLIC_STRIPE_CLIENT_ID correct
4. Check browser console for errors
5. Try different browser (Safari issues?)
```

**Issue:** CSV import fails
```
Solution:
1. Download template: /dashboard/sites/import/template
2. Verify CSV format (UTF-8, comma-delimited)
3. Check for special characters in site names
4. Validate amenities match predefined list
5. Ensure prices are numeric (no $ symbol)
```

---

## Rollback Procedures

### Application Rollback (Code Issues)

**Vercel:**
```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]

# Example
vercel rollback campops-prod-abc123.vercel.app
```

**Docker/Kubernetes:**
```bash
# Rollback deployment
kubectl rollout undo deployment/campops-production

# Check rollback status
kubectl rollout status deployment/campops-production

# Rollback to specific revision
kubectl rollout undo deployment/campops-production --to-revision=2
```

### Database Rollback (Migration Issues)

**⚠️ WARNING:** Database rollbacks are risky and may result in data loss.

**Option 1: Restore from Backup**
```bash
# 1. Create snapshot of current state
supabase db dump > current-state-$(date +%Y%m%d-%H%M%S).sql

# 2. Restore from backup
supabase db reset --db-url postgres://...backup-url

# 3. Verify restoration
psql postgres://... -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5"
```

**Option 2: Down Migration (if available)**
```sql
-- Example down migration (reverse changes)
-- File: supabase/migrations/20251120000000_rollback_feature.sql

-- Rollback: Remove column
ALTER TABLE properties DROP COLUMN new_feature_column;

-- Rollback: Restore RLS policy
DROP POLICY "new_policy" ON properties;
CREATE POLICY "old_policy" ON properties
  FOR SELECT
  USING (owner_id = auth.uid());
```

### Rollback Decision Matrix

| Scenario | Rollback Method | Risk Level |
|----------|----------------|------------|
| UI bug, no data changes | Code rollback only | LOW |
| API bug, read-only | Code rollback only | LOW |
| API bug, write operations | Code rollback + verify data integrity | MEDIUM |
| Database schema change | Restore from backup | HIGH |
| Payment processing bug | Immediate code rollback + manual refunds | CRITICAL |

### Emergency Contact Procedure

**Critical Issues (Revenue-impacting, data corruption):**
1. Stop all deployments immediately
2. Notify team in #incidents Slack channel
3. Start incident log (Google Doc)
4. Implement rollback
5. Post-mortem within 24 hours

---

## Post-Deployment Monitoring

### Week 1: Intensive Monitoring

**Daily Checks:**
- [ ] Check Sentry for errors (target: <10 errors/day)
- [ ] Review Stripe dashboard for failed payments
- [ ] Check email delivery status (Resend dashboard)
- [ ] Review Supabase logs for query errors
- [ ] Verify webhook deliveries (Stripe dashboard)

**Metrics to Track:**
- User signups per day
- Successful onboardings (completed wizard)
- Failed payments
- Average response time (target: <500ms p95)
- Error rate (target: <0.1%)
- Email delivery rate (target: >99%)

### Week 2-4: Normal Operations

**Weekly Checks:**
- [ ] Review Supabase advisors (security + performance)
- [ ] Check database size growth
- [ ] Review slow query log (>1s queries)
- [ ] Audit user-reported issues
- [ ] Review customer feedback

**Alerts to Configure:**
- Error rate > 1% (5 min window) → Page on-call
- Payment failure rate > 5% → Email + Slack
- Email bounce rate > 2% → Email
- Database CPU > 80% → Slack
- Response time p95 > 1s → Slack

### Monthly Checks

- [ ] Review security advisors
- [ ] Audit RLS policies
- [ ] Check for unused indexes
- [ ] Review database backup retention
- [ ] Test disaster recovery restore
- [ ] Review customer churn rate
- [ ] Analyze payment failure patterns

---

## Appendix

### A. Supabase Advisors Queries

```sql
-- Security Advisor
SELECT * FROM supabase_advisors.security_advisor();

-- Performance Advisor
SELECT * FROM supabase_advisors.performance_advisor();

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Find missing indexes
SELECT * FROM supabase_advisors.index_advisor();
```

### B. Production Database Verification

```sql
-- Verify tenant isolation (run as test user)
-- Should return 0 rows for other user's data
SELECT COUNT(*) FROM properties WHERE owner_id != auth.uid();

-- Verify RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'sites', 'guests', 'reservations', 'payments');
-- Expected: rowsecurity = true for all

-- Check for orphaned records
SELECT COUNT(*) FROM properties WHERE company_id NOT IN (SELECT id FROM companies);
SELECT COUNT(*) FROM sites WHERE property_id NOT IN (SELECT id FROM properties);
```

### C. Customer Communication Templates

**Onboarding Email (sent automatically after purchase):**
```
Subject: Welcome to CampOps - Complete Your Setup 🏕️

Hi [First Name],

Thank you for choosing CampOps! Your account has been created and you're ready to get started.

Complete your setup in 3 easy steps:

1. Click the link below to sign in (no password needed!)
   https://app.campops.com/auth/verify-token?token=...

2. Complete the setup wizard (takes about 15 minutes)
   - Configure your property details
   - Add your campsites
   - Connect your Stripe account for payments

3. Start accepting bookings!

Your setup link expires in 7 days. If you need help, reply to this email or call us at (555) 123-4567.

Welcome aboard!
The CampOps Team
```

**Follow-up Email (1 week after onboarding):**
```
Subject: How's your first week with CampOps going?

Hi [First Name],

It's been a week since you completed your CampOps setup. We wanted to check in and see how things are going!

Quick wins this week:
- [X] bookings received
- $[Y] in revenue processed
- [Z] guests checked in

Need help with anything? We're here for you:
- Schedule a call: calendly.com/campops
- Email us: support@campops.com
- Call us: (555) 123-4567

We'd love to hear your feedback. What's working well? What could be better?

Best regards,
[Your Name]
CampOps Team
```

### D. Common SQL Queries for Support

```sql
-- Find customer by email
SELECT
  u.id as user_id,
  u.email,
  c.id as company_id,
  c.name as company_name,
  c.subscription_status
FROM auth.users u
LEFT JOIN companies c ON c.owner_id = u.id
WHERE u.email = 'customer@example.com';

-- Check onboarding status
SELECT
  c.name,
  p.name as property_name,
  p.onboarding_completed,
  p.stripe_account_id IS NOT NULL as stripe_connected,
  p.booking_page_slug
FROM companies c
JOIN properties p ON p.company_id = c.id
WHERE c.owner_id = 'user-id';

-- View recent reservations for debugging
SELECT
  r.confirmation_number,
  r.check_in_date,
  r.check_out_date,
  r.status,
  r.payment_status,
  r.total_amount / 100.0 as total_dollars,
  g.email as guest_email,
  p.name as property_name
FROM reservations r
JOIN guests g ON g.id = r.guest_id
JOIN properties p ON p.id = r.property_id
WHERE r.property_id = 'property-id'
ORDER BY r.created_at DESC
LIMIT 10;
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-19 | Initial | Complete production deployment plan |

---

**END OF DOCUMENT**
