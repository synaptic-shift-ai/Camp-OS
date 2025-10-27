# Campground Onboarding - Complete Implementation Plan

**Project**: CampOS Campground Management Platform
**Feature**: Operator Onboarding Workflow
**Timeline**: Days 8-12 (Week 2 of MVP Shipment Plan)
**Status**: Planning Complete - Ready for Implementation
**Last Updated**: 2025-01-27

---

## Executive Summary

### Objective
Create a fully automated, self-service onboarding flow that takes a new campground operator from sign-up to accepting their first booking in under 30 minutes.

### Why This Matters
**This is a major differentiating feature** - most campground management systems require manual setup calls, technical expertise, or days of configuration. We're building a frictionless onboarding experience that gets operators live immediately.

### Success Criteria
- ✅ Property information complete
- ✅ At least one site created with full details (name, type, occupancy, pricing, hookups)
- ✅ Stripe payment processing connected via OAuth
- ✅ Booking page URL generated and shareable
- ✅ Operator can accept first real booking within 30 minutes of sign-up

### Key Decision: Scrap and Rebuild
**Decision Made**: Delete existing broken onboarding pages and rebuild from scratch using v0.dev with detailed specifications to ensure:
- Design consistency with existing dashboard
- Type safety and proper validation
- API integration from day one
- Production-ready code quality

---

## Current State Analysis

### ✅ What Exists Today
1. **Property Setup Page** (`app/onboarding/page.tsx`)
   - Basic form for property information
   - Connected to `/api/onboarding/setup-property` API
   - Creates property record in database

2. **Sites Setup Page** (`app/onboarding/sites/page.tsx`)
   - Form to add sites one-by-one
   - Shows list of added sites
   - **Problem**: References non-existent `/api/onboarding/add-site` API
   - **Problem**: Missing hookups field (required per user requirements)

3. **Property Setup API** (`app/api/onboarding/setup-property/route.ts`)
   - Handles property creation/update
   - Tenant isolation enforced
   - Uses service role client for database writes

4. **Dashboard** (`app/dashboard/*`)
   - Real data integration complete
   - Shows reservations, payments, sites, analytics
   - Professional UI with shadcn/ui components

### ❌ Critical Gaps
1. **Site Creation API** - Missing endpoint `/api/onboarding/add-site`
2. **Onboarding Completion API** - Missing endpoint `/api/onboarding/complete`
3. **Hookups Field** - Not in site creation form (essential per requirements)
4. **Stripe Connect Integration** - No OAuth flow exists
5. **Success Page** - No post-onboarding celebration/checklist
6. **Booking Page URL** - No shareable link generation or routing
7. **Test Booking Wizard** - No guided first booking experience
8. **Bulk Site Import** - No CSV/spreadsheet upload option (defer to v1.1)
9. **Progress Tracking** - No visual wizard progress indicator
10. **Stripe Status Verification** - No check that Stripe is properly connected

---

## Onboarding Flow Design

### User Journey (4 Steps)

```
┌─────────────────────────────────────────────────────────────┐
│                    STEP 1: PROPERTY INFO                    │
│  /onboarding/property                                       │
│                                                             │
│  Collect: Name, Address, City, State, Zip, Phone, Email    │
│  Duration: ~3 minutes                                       │
│  Progress: 25%                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    STEP 2: ADD SITES                        │
│  /onboarding/sites                                          │
│                                                             │
│  Add: Site name, type, occupancy, price, hookups           │
│  Minimum: 1 site required                                  │
│  Duration: ~10-15 minutes (varies by # of sites)           │
│  Progress: 50%                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  STEP 3: STRIPE CONNECT                     │
│  /onboarding/stripe-connect                                 │
│                                                             │
│  Action: One-click OAuth connection to Stripe              │
│  Duration: ~2-3 minutes                                     │
│  Progress: 75%                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  STEP 4: COMPLETE & LAUNCH                  │
│  /onboarding/complete                                       │
│                                                             │
│  Show: Completion checklist, booking URL, next steps      │
│  Actions: Copy URL, test booking, go to dashboard          │
│  Progress: 100%                                             │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Progressive Disclosure**: Only ask for essential information at each step
2. **Immediate Feedback**: Show success states, live validation, helpful errors
3. **Visual Progress**: Always show step X of 4 and progress bar
4. **No Dead Ends**: Every page has a clear next action
5. **Graceful Degradation**: Works on mobile, tablet, desktop
6. **Speed Over Perfection**: Get to "good enough" fast, refine later

---

## Technical Architecture

### Page Structure

Each page follows this consistent pattern:

```typescript
// 1. Client Component
"use client"

// 2. Imports (React, Next, UI components, icons)
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, Button, Input, Progress } from "@/components/ui/*"
import { Building2, ArrowRight, Loader2 } from "lucide-react"

// 3. Validation Schema (Zod)
const schema = z.object({
  field: z.string().min(1, 'Required'),
})

// 4. Component
export default function Page() {
  // State management
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form handling (react-hook-form + Zod)
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  })

  // Submit handler
  async function onSubmit(data) {
    // API call
    // Error handling
    // Success redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background...">
      {/* Header with icon */}
      {/* Progress indicator */}
      {/* Form card */}
      {/* Submit button */}
    </div>
  )
}
```

### API Architecture

All APIs follow this pattern:

```typescript
// 1. Imports
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 2. Type definitions
interface RequestBody {
  field: string
}

// 3. Handler
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Validate request
    const body: RequestBody = await request.json()

    // 3. Database operation (with tenant isolation)
    const { data, error } = await supabase
      .from('table')
      .insert({ ...body, user_id: user.id })
      .select()
      .single()

    // 4. Error handling
    if (error) throw error

    // 5. Success response
    return NextResponse.json({ success: true, data })
  } catch (error) {
    // Error logging and response
    return NextResponse.json({ error: 'Message' }, { status: 500 })
  }
}
```

### Database Schema

**New Columns Needed**:

```sql
-- Properties table
ALTER TABLE properties
ADD COLUMN stripe_account_id TEXT,
ADD COLUMN stripe_connected_at TIMESTAMPTZ,
ADD COLUMN booking_page_slug TEXT UNIQUE,
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

-- Sites table
ALTER TABLE sites
ADD COLUMN hookups JSONB DEFAULT '{"water": false, "electric": false, "sewer": false}';
```

**Indexes Needed**:

```sql
CREATE INDEX idx_properties_slug ON properties(booking_page_slug);
CREATE INDEX idx_properties_onboarding ON properties(onboarding_completed);
```

---

## Detailed Requirements

### PAGE 1: Property Setup (`/onboarding/property`)

**Purpose**: Collect basic campground information

**Fields**:
- Property Name * (string, min 1 char)
- Description (textarea, optional)
- Address * (string, min 1 char)
- City * (string, min 1 char)
- State * (string, exactly 2 chars, uppercase)
- Zip Code * (string, min 5 chars)
- Phone * (string, min 10 chars)
- Contact Email * (email validation)

**Validation**: Zod schema with field-level error messages

**API**: `POST /api/onboarding/setup-property` (already exists)

**Success Action**: Redirect to `/onboarding/sites`

**Design Notes**:
- Gradient background: `bg-gradient-to-br from-background via-background to-muted/20`
- Large property icon in circle: `Building2` (lucide-react)
- Progress bar showing 25%
- Form in Card component
- Continue button with arrow icon

---

### PAGE 2: Site Management (`/onboarding/sites`)

**Purpose**: Build campsite inventory

**Two-Column Layout**:
- **Left**: Add Site Form
- **Right**: Sites List (shows added sites)

**Site Fields**:
- Site Name/Number * (e.g., "Site A1", "RV Spot 15")
- Site Type * (dropdown):
  - Tent Site
  - RV Site
  - Cabin
  - Glamping
  - Yurt
  - Other
- Max Occupancy * (number, 1-50)
- Nightly Rate * (USD, dollars with cents)
- **Hookups** * (checkboxes):
  - Water
  - Electric (30/50 amp)
  - Sewer
- Description (optional, textarea)

**Functionality**:
- Add site → appears in right column immediately
- Delete site → remove from list
- Continue button → only enabled when ≥1 site added
- Clear form after each successful add

**Validation**:
- All required fields
- Nightly rate > 0
- At least one site must be added before continuing

**API**: `POST /api/onboarding/add-site` (needs to be created)

**Success Action**: Click Continue → redirect to `/onboarding/stripe-connect`

**Design Notes**:
- Progress bar showing 50%
- Site type icons change based on selection
- Hookups in bordered box with checkboxes
- Sites list shows icon, name, type badge, occupancy, price, hookups summary
- Mobile-responsive: stacks to single column on small screens

---

### PAGE 3: Stripe Connect (`/onboarding/stripe-connect`)

**Purpose**: One-click payment processing setup

**Content**:
- Hero section with CreditCard icon
- Benefits list (checkmarks):
  - Secure & Trusted (powered by Stripe)
  - Fast Payouts (2-3 days)
  - No Hidden Fees (2.9% + $0.30)
- Large "Connect with Stripe" button
- Help text: "Don't have a Stripe account? Create one for free"

**OAuth Flow**:
1. User clicks "Connect with Stripe"
2. Generate OAuth URL with:
   - `client_id` (from env)
   - `redirect_uri` (our callback URL)
   - `state` (CSRF token)
3. Save state to sessionStorage
4. Redirect to Stripe OAuth page
5. User authorizes in Stripe
6. Stripe redirects to `/api/stripe/connect/authorize?code=xxx&state=xxx`
7. Backend exchanges code for `stripe_account_id`
8. Save account ID to database
9. Redirect to `/onboarding/complete`

**API**: `GET /api/stripe/connect/authorize` (needs to be created)

**Success Action**: Automatic redirect to completion page

**Design Notes**:
- Progress bar showing 75%
- Large connect button (primary color)
- Loading state: "Connecting to Stripe..."
- Error handling for failed connections

**Environment Variables Required**:
```env
NEXT_PUBLIC_STRIPE_CLIENT_ID=ca_xxx
STRIPE_SECRET_KEY=sk_live_xxx (or sk_test_xxx)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

### PAGE 4: Onboarding Complete (`/onboarding/complete`)

**Purpose**: Celebrate success and guide next steps

**Sections**:

1. **Hero Header**
   - Large green checkmark icon
   - "🎉 Your Campground is Live!"
   - Property name
   - Progress: 100%

2. **Completion Checklist** (all green)
   - ✓ Property Information (name • city, state)
   - ✓ Sites Added (X sites - breakdown by type)
   - ✓ Pricing Configured (all sites have rates)
   - ✓ Payment Processing (Stripe connected)

3. **What's Next** (numbered steps)
   - **1. Share Your Booking Page**
     - Copyable URL input field
     - Copy button
     - "✓ Copied!" confirmation

   - **2. Create a Test Booking**
     - Opens booking page in new tab
     - Button: "Try Test Booking →"

   - **3. Explore Your Dashboard**
     - Button: "Go to Dashboard →"

4. **Help & Resources**
   - "View Documentation" (opens /docs)
   - "Contact Support" (mailto link)

**Data Display**:
- Fetch from `/api/onboarding/completion-status`
- Show accurate site count and breakdown
- Generate booking URL: `/book/{property-slug}-{short-id}`

**API**: `GET /api/onboarding/completion-status` (needs to be created)

**Design Notes**:
- Green theme for success (bg-green-50, text-green-600)
- Large numbered steps for clarity
- Prominent booking URL in monospace font
- All action buttons clearly labeled

---

## API Specifications

### 1. Site Creation API

**File**: `app/api/onboarding/add-site/route.ts`

**Endpoint**: `POST /api/onboarding/add-site`

**Authentication**: Required (Supabase session)

**Request Body**:
```typescript
{
  name: string              // "Site A1"
  type: 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'
  maxOccupancy: number     // 1-50
  nightly_rate: number     // In CENTS (e.g., 5000 = $50.00)
  hookups: {
    water: boolean
    electric: boolean
    sewer: boolean
  }
  description?: string     // Optional
}
```

**Response** (Success - 200):
```typescript
{
  success: true,
  siteId: string,          // UUID
  site: {
    id: string,
    property_id: string,
    name: string,
    type: SiteType,
    max_occupancy: number,
    nightly_rate: number,
    hookups: { water: boolean, electric: boolean, sewer: boolean },
    created_at: string
  }
}
```

**Response** (Error):
- 401: Unauthorized (no user session)
- 400: Missing required fields
- 404: Property not found
- 409: Site name already exists for this property
- 500: Database error

**Business Logic**:
1. Authenticate user via Supabase session
2. Get user's property_id
3. Validate property exists and onboarding not yet completed
4. Validate required fields (name, type, maxOccupancy, nightly_rate, hookups)
5. Ensure nightly_rate is positive integer (cents)
6. Check site name is unique within property
7. Insert site record with tenant isolation (property_id)
8. Return created site

**Database Operations**:
```typescript
// 1. Get property
const { data: property } = await supabase
  .from('properties')
  .select('id, onboarding_completed')
  .eq('owner_id', user.id)
  .single()

// 2. Create site
const { data: site } = await supabase
  .from('sites')
  .insert({
    property_id: property.id,
    site_number: name, // Or generate
    site_name: name,
    site_type: type,
    max_occupancy: maxOccupancy,
    base_price: nightly_rate, // Already in cents
    hookups: hookups,
    status: 'available',
  })
  .select()
  .single()
```

---

### 2. Onboarding Completion API

**File**: `app/api/onboarding/complete/route.ts`

**Endpoint**: `POST /api/onboarding/complete`

**Authentication**: Required

**Request Body**: None (gets user from session)

**Response** (Success - 200):
```typescript
{
  success: true,
  property: {
    id: string,
    name: string,
    onboarding_completed: true,
    booking_page_url: string
  },
  stats: {
    total_sites: number,
    sites_by_type: {
      tent: number,
      rv: number,
      cabin: number,
      // ...
    },
    stripe_connected: boolean
  }
}
```

**Response** (Error):
- 401: Unauthorized
- 400: Onboarding incomplete (with missing items list)
- 404: Property not found
- 500: Database error

**Completion Validation**:
```typescript
// Must ALL be true:
1. Property exists with name, address, city, state, zip, phone, email
2. At least 1 site created
3. All sites have nightly_rate > 0
4. stripe_account_id is not null
```

**Business Logic**:
1. Get user's property
2. Validate completion criteria (all 4 items above)
3. If incomplete: return 400 with list of missing items
4. If complete:
   - Generate booking page slug from property name
   - Update property: `onboarding_completed = true`, `onboarding_completed_at = NOW()`, `booking_page_slug = slug`
   - Count sites by type
   - Generate booking URL
   - Return success response

**Booking URL Generation**:
```typescript
function generateBookingUrl(propertyName: string, propertyId: string): string {
  const slug = propertyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const shortId = propertyId.slice(0, 8)
  return `${process.env.NEXT_PUBLIC_APP_URL}/book/${slug}-${shortId}`
}
```

---

### 3. Stripe OAuth Callback API

**File**: `app/api/stripe/connect/authorize/route.ts`

**Endpoint**: `GET /api/stripe/connect/authorize`

**Query Parameters**:
- `code`: Authorization code from Stripe
- `state`: CSRF protection token

**Authentication**: Session-based

**Response**:
- Success: Redirect to `/onboarding/complete`
- Error: Redirect to `/onboarding/stripe-connect?error=xxx`

**Business Logic**:
1. Verify state parameter matches sessionStorage (CSRF protection)
2. Exchange authorization code for Stripe account ID using Stripe API
3. Get user's property
4. Update property with `stripe_account_id` and `stripe_connected_at`
5. Redirect to completion page

**Stripe API Call**:
```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const response = await stripe.oauth.token({
  grant_type: 'authorization_code',
  code: authorizationCode,
})

const connectedAccountId = response.stripe_user_id
```

**Database Update**:
```typescript
await supabase
  .from('properties')
  .update({
    stripe_account_id: connectedAccountId,
    stripe_connected_at: new Date().toISOString(),
  })
  .eq('owner_id', user.id)
```

**Error Handling**:
- Invalid state → Log and redirect with error
- Stripe API error → Log and redirect with error
- Database error → Log and redirect with error

---

### 4. Completion Status API

**File**: `app/api/onboarding/completion-status/route.ts`

**Endpoint**: `GET /api/onboarding/completion-status`

**Authentication**: Required

**Response**:
```typescript
{
  propertyName: string,
  city: string,
  state: string,
  totalSites: number,
  siteBreakdown: string,        // "10 RV, 5 Tent, 2 Cabins"
  stripeConnected: boolean,
  bookingPageUrl: string
}
```

**Business Logic**:
1. Get user's property
2. Count sites by type
3. Format breakdown string
4. Check Stripe connection status
5. Generate/retrieve booking URL
6. Return data

**Query**:
```typescript
// Get property
const { data: property } = await supabase
  .from('properties')
  .select('id, name, city, state, booking_page_slug, stripe_account_id')
  .eq('owner_id', user.id)
  .single()

// Count sites by type
const { data: sites } = await supabase
  .from('sites')
  .select('site_type')
  .eq('property_id', property.id)

const breakdown = calculateBreakdown(sites)
```

---

## Database Migration

### Migration File
**File**: `supabase/migrations/YYYYMMDDHHMMSS_onboarding_enhancements.sql`

```sql
-- Add onboarding tracking columns to properties
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS booking_page_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add hookups to sites
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS hookups JSONB DEFAULT '{"water": false, "electric": false, "sewer": false}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_slug ON properties(booking_page_slug);
CREATE INDEX IF NOT EXISTS idx_properties_onboarding ON properties(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_properties_stripe ON properties(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN properties.stripe_account_id IS 'Stripe Connect account ID for payment processing';
COMMENT ON COLUMN properties.booking_page_slug IS 'URL-friendly slug for booking page (e.g., "pine-lake-campground-a1b2c3d4")';
COMMENT ON COLUMN properties.onboarding_completed IS 'Whether operator has completed onboarding flow';
COMMENT ON COLUMN sites.hookups IS 'Available hookups as JSON: {"water": bool, "electric": bool, "sewer": bool}';
```

### Rollback Migration
```sql
-- Remove columns (if needed for rollback)
ALTER TABLE properties
DROP COLUMN IF EXISTS stripe_account_id,
DROP COLUMN IF EXISTS stripe_connected_at,
DROP COLUMN IF EXISTS booking_page_slug,
DROP COLUMN IF EXISTS onboarding_completed,
DROP COLUMN IF EXISTS onboarding_completed_at;

ALTER TABLE sites
DROP COLUMN IF EXISTS hookups;

-- Drop indexes
DROP INDEX IF EXISTS idx_properties_slug;
DROP INDEX IF EXISTS idx_properties_onboarding;
DROP INDEX IF EXISTS idx_properties_stripe;
```

---

## Implementation Phases

### Phase 1: Backend Foundation (Day 8 - 6 hours)

**Goal**: Build all API endpoints and update database

**Tasks**:
1. ✅ Create database migration
   - Run migration locally
   - Verify columns added
   - Test rollback works

2. ✅ Create Site Creation API (`/api/onboarding/add-site`)
   - Implement POST handler
   - Add validation
   - Test with Postman/curl
   - Verify tenant isolation

3. ✅ Create Completion API (`/api/onboarding/complete`)
   - Implement POST handler
   - Add validation logic
   - Test completion criteria

4. ✅ Create Completion Status API (`/api/onboarding/completion-status`)
   - Implement GET handler
   - Test data aggregation

5. ✅ Update existing property API if needed
   - Review current implementation
   - Add any missing fields

**Testing**:
- Unit tests for validation logic
- Integration tests for API routes
- Test tenant isolation for all endpoints

**Deliverable**: Working APIs ready for frontend integration

---

### Phase 2: Stripe Integration (Day 9 - 4 hours)

**Goal**: Implement Stripe Connect OAuth flow

**Tasks**:
1. ✅ Set up Stripe Connect in Stripe Dashboard
   - Create Connect application
   - Get client_id
   - Configure redirect URIs
   - Set up webhook endpoints (future)

2. ✅ Create OAuth Callback API (`/api/stripe/connect/authorize`)
   - Implement GET handler
   - Exchange code for account ID
   - Save to database
   - Handle errors gracefully

3. ✅ Add environment variables
   - `NEXT_PUBLIC_STRIPE_CLIENT_ID`
   - Verify in `.env.local`
   - Document in `.env.example`

4. ✅ Test OAuth flow end-to-end
   - Test mode: Create test Connect account
   - Authorize connection
   - Verify account ID saved
   - Test error scenarios

**Testing**:
- Test with Stripe test mode
- Test CSRF protection (state parameter)
- Test error handling (invalid code, network errors)

**Deliverable**: Working Stripe Connect integration

---

### Phase 3: Page Generation with v0.dev (Days 10-11 - 8 hours)

**Goal**: Generate all 4 pages using v0.dev specifications

**Process for Each Page**:
1. Copy specification from `ONBOARDING_V0_SPECIFICATIONS.md`
2. Paste into v0.dev with prompt:
   ```
   Generate this Next.js 15 App Router page using shadcn/ui components.
   Use the provided TypeScript types, Zod schemas, and layout structure.
   Match the existing design system (primary, muted colors, font-heading, font-sans).
   Include all imports, state management, and API integration code.
   ```
3. Review generated code
4. Copy to project
5. Fix imports if needed
6. Test in browser
7. Iterate if needed

**Page 1: Property Setup** (1 hour)
- Generate with v0.dev
- Save to `app/onboarding/property/page.tsx`
- Test form validation
- Test API integration
- Test redirect to sites page

**Page 2: Site Management** (2 hours)
- Generate with v0.dev
- Save to `app/onboarding/sites/page.tsx`
- Test site addition
- Test hookups checkboxes
- Test site deletion
- Test continue button

**Page 3: Stripe Connect** (1 hour)
- Generate with v0.dev
- Save to `app/onboarding/stripe-connect/page.tsx`
- Test OAuth redirect
- Test loading states
- Test error handling

**Page 4: Completion** (2 hours)
- Generate with v0.dev
- Save to `app/onboarding/complete/page.tsx`
- Test data fetching
- Test URL copying
- Test navigation links

**Integration** (2 hours)
- Ensure routing works
- Fix any TypeScript errors
- Ensure consistent styling
- Mobile responsiveness check

**Deliverable**: All 4 pages working end-to-end

---

### Phase 4: Testing & Polish (Day 12 - 6 hours)

**Goal**: Comprehensive testing and production readiness

**End-to-End Testing** (2 hours):
```
Test Flow:
1. Create new test account
2. Complete property setup form
3. Add 3 sites (tent, RV, cabin)
4. Connect Stripe (test mode)
5. View completion page
6. Copy booking URL
7. Open booking page (verify it loads)
8. Create test booking
9. Check dashboard shows booking
```

**Edge Case Testing** (2 hours):
- Empty states (no sites added)
- Validation errors (missing fields, invalid emails)
- API errors (network failures, server errors)
- Stripe OAuth failures (cancel, decline)
- Multiple site types
- Sites with no hookups
- Mobile device testing
- Back button behavior

**Performance Testing** (1 hour):
- Page load times
- Form submission speed
- API response times
- Large site lists (50+ sites)

**Cleanup** (1 hour):
- Delete old broken onboarding files:
  - `app/onboarding/page.tsx` (old version)
  - `app/onboarding/sites/page.tsx` (old version)
- Remove unused API routes
- Update routing if needed
- Clean up any debug code

**Deliverable**: Production-ready onboarding flow

---

## Quality Assurance

### Automated Testing

**Unit Tests** (`*.test.ts`):
```typescript
// lib/onboarding/validation.test.ts
describe('Property validation', () => {
  test('accepts valid property data', () => {
    const data = { name: 'Test Camp', state: 'NC', ... }
    expect(validateProperty(data)).toEqual({ success: true })
  })

  test('rejects invalid state code', () => {
    const data = { name: 'Test', state: 'North Carolina', ... }
    expect(validateProperty(data)).toEqual({
      success: false,
      error: 'State must be 2 characters'
    })
  })
})
```

**Integration Tests** (`tests/integration/onboarding.test.ts`):
```typescript
describe('Onboarding API', () => {
  test('creates site with valid data', async () => {
    const response = await fetch('/api/onboarding/add-site', {
      method: 'POST',
      body: JSON.stringify({ name: 'Site 1', type: 'tent', ... })
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.siteId).toBeDefined()
  })

  test('completes onboarding when all criteria met', async () => {
    // Setup: Create property, add site, connect Stripe
    const response = await fetch('/api/onboarding/complete', { method: 'POST' })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.property.onboarding_completed).toBe(true)
  })
})
```

**Security Tests** (`tests/security/onboarding-isolation.test.ts`):
```typescript
describe('Multi-tenant isolation', () => {
  test('operator cannot see another property sites', async () => {
    // Create two properties with different users
    // Try to access property A sites as property B user
    // Expect 404 or empty array
  })
})
```

### Manual Testing Checklist

**Property Setup Page**:
- [ ] All fields render correctly
- [ ] Validation errors show for each field
- [ ] Valid submission saves to database
- [ ] Redirects to sites page on success
- [ ] Shows error message on API failure
- [ ] Works on mobile (320px width)
- [ ] Progress bar shows 25%

**Site Management Page**:
- [ ] Form renders with all fields
- [ ] Site type dropdown works
- [ ] Hookups checkboxes toggle correctly
- [ ] Add site button submits form
- [ ] Added site appears in right column
- [ ] Site icon matches selected type
- [ ] Delete site removes from list
- [ ] Continue button only enabled with ≥1 site
- [ ] Form clears after successful add
- [ ] Progress bar shows 50%

**Stripe Connect Page**:
- [ ] Benefits list displays correctly
- [ ] Connect button triggers OAuth flow
- [ ] Redirects to Stripe correctly
- [ ] Returns to completion page after auth
- [ ] Handles OAuth cancellation gracefully
- [ ] Shows error for failed connections
- [ ] Progress bar shows 75%

**Completion Page**:
- [ ] Success header displays
- [ ] All 4 checklist items show green
- [ ] Property name and location correct
- [ ] Site count and breakdown accurate
- [ ] Booking URL is correct format
- [ ] Copy button copies URL to clipboard
- [ ] Test booking opens booking page
- [ ] Dashboard button navigates correctly
- [ ] Progress bar shows 100%

---

## Success Metrics

### Quantitative Metrics

**Completion Rate**:
- Track: % of users who complete all 4 steps
- Target: >80% completion rate
- Measure: Funnel analysis (step 1 → 2 → 3 → 4)

**Time to Complete**:
- Track: Duration from sign-up to onboarding complete
- Target: <30 minutes median time
- Measure: `onboarding_completed_at - user.created_at`

**Drop-off Analysis**:
- Track: Where users abandon
- Segments:
  - Property → Sites: ____%
  - Sites → Stripe: ____%
  - Stripe → Complete: ____%
- Action: Improve step with highest drop-off

**Error Rate**:
- Track: API errors, validation failures
- Target: <1% error rate
- Monitor: Sentry error tracking

### Qualitative Metrics

**User Satisfaction**:
- Method: Post-onboarding survey
- Question: "How easy was setup?" (1-5 scale)
- Target: 4.0+ average rating

**Feature Requests**:
- Track: What users wish they could do
- Common requests:
  - Bulk import sites (defer to v1.1)
  - Custom pricing rules
  - Multi-property support

**Support Tickets**:
- Track: # of support requests about onboarding
- Target: <5% of users need help
- Common issues: Fix in next iteration

---

## Risk Management

### High-Risk Items

**Risk 1: Stripe OAuth Complexity**
- **Concern**: OAuth flow can fail in unexpected ways
- **Mitigation**:
  - Comprehensive error handling
  - Test with Stripe test mode thoroughly
  - Fallback: Manual Stripe key input (v1.1)
  - Document common issues
- **Contingency**: If OAuth fails, provide manual setup instructions

**Risk 2: User Confusion on Site Details**
- **Concern**: Users may not know what "hookups" means
- **Mitigation**:
  - Add help text explaining each term
  - Use clear labels ("Water hookup available")
  - Provide examples in placeholders
  - Add tooltips for complex fields
- **Contingency**: Add "Need help?" link to support

**Risk 3: Mobile Experience**
- **Concern**: Complex forms may be hard on mobile
- **Mitigation**:
  - Test on real devices
  - Use mobile-friendly inputs (number keyboards, etc.)
  - Stack columns on small screens
  - Large touch targets (buttons, checkboxes)
- **Contingency**: Recommend desktop for initial setup

**Risk 4: Data Loss**
- **Concern**: Users lose progress if they refresh/navigate away
- **Mitigation**:
  - Save to database immediately on each step
  - Allow returning to incomplete onboarding
  - Show "Resume onboarding" if incomplete
- **Contingency**: Add localStorage backup (v1.1)

### Medium-Risk Items

**Time Estimate Accuracy**:
- Risk: Takes longer than 30 minutes
- Mitigation: Monitor actual times, optimize bottlenecks

**API Performance**:
- Risk: Slow responses frustrate users
- Mitigation: Optimize database queries, add loading states

**Browser Compatibility**:
- Risk: Breaks on older browsers
- Mitigation: Test on Chrome, Safari, Firefox, Edge

---

## Post-Launch Plan

### Week 1 After Launch

**Monitoring** (Daily):
- Check Sentry for errors
- Review completion rates
- Monitor support tickets
- Watch user session recordings (if enabled)

**Data Collection**:
- Funnel metrics (step-by-step completion)
- Average time per step
- Error frequency by type
- Device/browser breakdown

**Quick Fixes**:
- Fix critical bugs immediately
- Improve unclear copy
- Add missing help text
- Optimize slow API calls

### Week 2-4 After Launch

**Iteration Priorities**:
1. Fix most common drop-off point
2. Add most requested features
3. Improve most confusing step
4. Optimize slowest API

**User Interviews**:
- Schedule 5-10 user calls
- Ask about pain points
- Watch them complete onboarding
- Document insights

**Feature Enhancements** (v1.1):
- Bulk site import (CSV)
- Site image upload
- Custom amenities
- Advanced pricing rules
- Multi-property support

---

## Developer Handoff

### Files Created/Modified

**New Files**:
```
app/onboarding/property/page.tsx         (generated with v0)
app/onboarding/sites/page.tsx            (generated with v0)
app/onboarding/stripe-connect/page.tsx   (generated with v0)
app/onboarding/complete/page.tsx         (generated with v0)

app/api/onboarding/add-site/route.ts     (new API)
app/api/onboarding/complete/route.ts     (new API)
app/api/onboarding/completion-status/route.ts (new API)
app/api/stripe/connect/authorize/route.ts (new API)

supabase/migrations/XXX_onboarding_enhancements.sql (new migration)

docs/ONBOARDING_V0_SPECIFICATIONS.md     (this spec doc)
docs/ONBOARDING_IMPLEMENTATION_PLAN.md   (this plan doc)
```

**Modified Files**:
```
.env.example                              (add Stripe vars)
.env.local                                (add Stripe keys)
```

**Deleted Files**:
```
app/onboarding/page.tsx                   (old broken version)
app/onboarding/sites/page.tsx             (old broken version)
```

### Environment Variables

**Required**:
```env
# Stripe Connect (required for onboarding)
NEXT_PUBLIC_STRIPE_CLIENT_ID=ca_xxx
STRIPE_SECRET_KEY=sk_test_xxx  # or sk_live_xxx for production

# App URL (for OAuth redirect)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or production URL

# Existing vars (should already be set)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Deployment Checklist

**Before Deploy**:
- [ ] Run database migration in production
- [ ] Set all environment variables in Vercel
- [ ] Test Stripe OAuth in production (test mode first)
- [ ] Verify webhook endpoints configured
- [ ] Run full test suite
- [ ] Test on staging environment

**After Deploy**:
- [ ] Monitor Sentry for errors
- [ ] Test complete flow in production
- [ ] Create test booking
- [ ] Verify emails deliver
- [ ] Check analytics tracking

---

## Documentation Links

- **V0 Specifications**: `docs/ONBOARDING_V0_SPECIFICATIONS.md`
- **API Documentation**: (generate with tool like Swagger)
- **Database Schema**: `supabase/migrations/`
- **Testing Guidelines**: `.claude/testing-guidelines.md`
- **Stripe Connect Docs**: https://stripe.com/docs/connect

---

## Contact & Support

**Technical Questions**: Review this document and V0 specifications
**Product Questions**: Refer to MVP Shipment Plan
**Stripe Issues**: https://support.stripe.com
**Supabase Issues**: https://supabase.com/support

---

**Status**: Ready for implementation
**Next Action**: Start with Phase 1 (Backend Foundation) or Phase 3 (Generate pages with v0.dev)

---

*This plan was created on 2025-01-27 for the CampOS campground onboarding workflow rebuild.*
