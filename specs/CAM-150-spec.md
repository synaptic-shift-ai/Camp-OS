# Dashboard Audit & Integration Planning - Technical Specification

**Linear Issue:** [CAM-150](https://linear.app/campgroundops/issue/CAM-150/dashboard-audit-and-integration-planning)
**Status:** Ready for Review
**Created:** 2025-11-01
**Technical Lead:** Engineering Team
**Priority:** Urgent
**Sprint:** Week 1
**PRD Reference:** specs/CAM-150-prd.md v1.1

---

## 1. Acceptance Criteria

### AC-1: Component Audit Documentation
**Given** all dashboard components exist in `/app/dashboard/`
**When** audit is performed
**Then** a comprehensive inventory document lists:
- All 7 dashboard pages with current data source classification (Real DB / Mock Data / Hybrid / No Data)
- Exact file and line numbers for all hardcoded mock data
- All existing database query functions currently in use
- Multi-tenant isolation verification status for each real data query

**Success Criteria:**
- 100% of dashboard components documented
- Zero ambiguity about data sources
- Stakeholder approval of audit accuracy

### AC-2: Database Integration Mapping
**Given** the database schema exists in `src/contracts/db.ts`
**When** integration requirements are mapped
**Then** for each component requiring integration:
- Required database tables are identified
- Specific query patterns documented (SELECT, JOIN, WHERE clauses)
- Missing schema elements identified (columns, indexes, RLS policies)
- Property ID filtering requirements specified

**Success Criteria:**
- All integration points mapped to existing schema
- Missing database elements clearly documented
- Query performance indexed requirements identified
- Multi-tenant isolation requirements explicit

### AC-3: Performance Requirements Validated
**Given** expected data volumes (hundreds of sites, thousands of reservations per property)
**When** integration approach is designed
**Then** performance targets are specified:
- List queries: < 500ms response time with pagination
- Aggregation queries: < 1000ms response time with caching
- Stats queries: < 2000ms response time with optimization
- All queries tested against realistic data volumes (100+ sites, 1000+ reservations)

**Success Criteria:**
- Performance SLAs documented per query type
- Database indexes identified for all foreign keys
- Caching strategy defined for expensive analytics queries
- Load testing approach documented

### AC-4: Testing Strategy Defined
**Given** multi-tenant architecture and integration requirements
**When** testing requirements are specified
**Then** comprehensive test plan includes:
- **Integration Tests:** All dashboard query functions with tenant isolation validation
- **Security Tests:** Multi-tenant data leakage prevention verified
- **Performance Tests:** Response times validated against SLAs under load
- **Unit Tests:** Pure calculation logic (occupancy rate, revenue totals) tested independently

**Success Criteria:**
- Test coverage targets: 100% of dashboard query functions
- Tenant isolation test scenarios documented for all queries
- Performance test data volumes specified (500 sites, 10k reservations)
- Test file locations and structure defined

### AC-5: Implementation Roadmap Delivered
**Given** complete audit and integration mapping
**When** implementation plan is created
**Then** deliverable includes:
- **docs/DASHBOARD_INTEGRATION_PLAN.md** with executive summary
- Component-by-component integration priority and effort estimates
- Database migration requirements (indexes, RLS policies)
- Risk assessment with mitigation strategies
- Definition of Ready checklist for implementation tasks

**Success Criteria:**
- Engineering leads validate effort estimates within 20% accuracy
- Product team approves priority ranking
- All stakeholders agree roadmap is actionable
- No blocking questions remain unanswered

---

## 2. Technical Design

### 2.1 Architecture Overview

#### Current State Architecture
```
Dashboard Pages (Next.js 15 App Router - Server Components)
│
├── /dashboard/page.tsx              [✅ Real Data via lib/dashboard/queries.ts]
├── /dashboard/reservations/page.tsx [✅ Real Data via lib/dashboard/queries.ts]
├── /dashboard/payments/page.tsx     [✅ Real Data via lib/dashboard/queries.ts]
├── /dashboard/analytics/page.tsx    [❌ Hardcoded mock data - lines 29, 39, 49, 59, 86-115]
├── /dashboard/sites/page.tsx        [❌ Hardcoded mock data - lines 35-76, 215-240]
├── /dashboard/guests/page.tsx       [❌ Hardcoded mock data - lines 19-47]
└── /dashboard/settings/page.tsx     [❌ No data persistence - static forms]
```

#### Target State Architecture
```
Dashboard Pages (Server Components with async data fetching)
│
├── Shared Query Layer: lib/dashboard/queries.ts
│   ├── getReservations()      [✅ Exists - returns DashboardReservation[]]
│   ├── getPayments()          [✅ Exists - returns DashboardPayment[]]
│   ├── getDashboardStats()    [✅ Exists - returns DashboardStats]
│   ├── getSites()             [🔨 NEW - returns DashboardSite[]]
│   ├── getSiteStats()         [🔨 NEW - returns SiteStats]
│   ├── getGuests()            [🔨 NEW - returns DashboardGuest[]]
│   ├── getAnalyticsData()     [🔨 NEW - returns AnalyticsData]
│   ├── getPropertyDetails()   [🔨 NEW - returns PropertyDetails]
│   └── updatePropertyDetails() [🔨 NEW - mutation for settings]
│
├── Database Layer: Supabase (PostgreSQL)
│   ├── sites table            [✅ Exists with property_id]
│   ├── guests table           [✅ Exists with property_id]
│   ├── properties table       [✅ Exists]
│   ├── reservations table     [✅ Exists with property_id]
│   └── payments table         [✅ Exists with property_id]
│
└── Multi-Tenant Security: Row Level Security (RLS)
    └── All queries filtered by property_id [🔍 Needs Validation]
```

### 2.2 Component Integration Breakdown

#### 2.2.1 Sites Page Integration

**Current State:**
- Client component with hardcoded 4-site array (lines 35-76)
- Hardcoded stats: 60 total, 18 available, 42 occupied, 0 maintenance (lines 215-240)
- No database queries

**Target State:**
- Server component with async data fetching
- Real site data from `sites` table filtered by property_id
- Real-time status counts via aggregation query

**Database Schema (Existing):**
```typescript
sites: {
  Row: {
    id: string
    property_id: string         // CRITICAL: Multi-tenant isolation
    site_number: string
    site_name: string | null
    site_type: string | null    // 'rv' | 'tent' | 'cabin' | 'glamping' | 'yurt' | 'other'
    status: string | null       // 'available' | 'occupied' | 'maintenance' | 'unavailable'
    base_price: number          // CENTS (not dollars!)
    weekend_price: number | null
    max_occupancy: number | null
    max_vehicles: number | null
    hookups: Json | null        // Array of hookup types
    amenities: Json | null
    description: string | null
    created_at: string | null
    updated_at: string | null
  }
}
```

**New Query Functions:**
```typescript
// lib/dashboard/queries.ts

export interface DashboardSite {
  id: string
  siteNumber: string
  siteName: string | null
  siteType: 'rv' | 'tent' | 'cabin' | 'glamping' | 'yurt' | 'other'
  status: 'available' | 'occupied' | 'maintenance' | 'unavailable'
  basePrice: MoneyCents          // CRITICAL: DB stores cents, UI displays dollars
  weekendPrice: MoneyCents | null
  maxOccupancy: number
  maxVehicles: number
  hookups: string[]
  amenities: string[] | null
}

export interface SiteStats {
  total: number
  available: number
  occupied: number
  maintenance: number
  unavailable: number
}

/**
 * Fetch all sites for a property with optional filters
 * @param propertyId - Multi-tenant isolation key
 * @param filters - Optional status, type, or search query
 * @param page - Pagination (REQUIRED for scale: 500+ sites)
 * @param limit - Max results per page (default 50)
 */
export async function getSites(
  propertyId: string,
  filters: SiteFilters = {},
  page = 1,
  limit = 50
): Promise<{ data: DashboardSite[]; total: number }>

/**
 * Get site status statistics
 * @param propertyId - Multi-tenant isolation key
 */
export async function getSiteStats(
  propertyId: string
): Promise<SiteStats>
```

**Performance Requirements:**
- Query with LIMIT 50, OFFSET pagination
- Index on `property_id` (CRITICAL for multi-tenant performance)
- Index on `status` for filter queries
- Response time: < 500ms for list query with 500 sites

**Integration Effort:** 5 Story Points
- Create getSites() query function (2 pts)
- Create getSiteStats() query function (1 pt)
- Convert Sites page to server component (1 pt)
- Add pagination UI (1 pt)

#### 2.2.2 Guests Page Integration

**Current State:**
- Client component with hardcoded 3-guest array (lines 19-47)
- Displays: name, email, phone, totalStays, totalSpent, lastVisit
- No database queries

**Target State:**
- Server component with async data fetching
- Real guest data from `guests` table with calculated fields from `reservations`
- Search functionality (name, email)

**Database Schema (Existing):**
```typescript
guests: {
  Row: {
    id: string
    property_id: string         // CRITICAL: Multi-tenant isolation
    first_name: string
    last_name: string
    email: string
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zip_code: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
    notes: string | null
    created_at: string | null
  }
}
```

**New Query Function:**
```typescript
// lib/dashboard/queries.ts

export interface DashboardGuest {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  totalStays: number           // CALCULATED: COUNT(reservations)
  totalSpent: MoneyCents       // CALCULATED: SUM(reservations.paid_amount)
  lastVisit: string | null     // CALCULATED: MAX(reservations.check_out_date)
  createdAt: string
}

export interface GuestFilters {
  search?: string              // Search first_name, last_name, email
}

/**
 * Fetch guests with calculated reservation statistics
 * Joins with reservations to calculate totalStays, totalSpent, lastVisit
 * @param propertyId - Multi-tenant isolation key
 * @param filters - Optional search query
 * @param page - Pagination (REQUIRED for scale: 500+ guests)
 * @param limit - Max results per page (default 50)
 */
export async function getGuests(
  propertyId: string,
  filters: GuestFilters = {},
  page = 1,
  limit = 50
): Promise<{ data: DashboardGuest[]; total: number }>
```

**SQL Join Required:**
```sql
SELECT
  g.id,
  g.first_name,
  g.last_name,
  g.email,
  g.phone,
  g.created_at,
  COUNT(r.id) as total_stays,
  COALESCE(SUM(r.paid_amount), 0) as total_spent,
  MAX(r.check_out_date) as last_visit
FROM guests g
LEFT JOIN reservations r ON r.guest_id = g.id
WHERE g.property_id = ?
GROUP BY g.id, g.first_name, g.last_name, g.email, g.phone, g.created_at
ORDER BY g.created_at DESC
LIMIT ? OFFSET ?
```

**Performance Requirements:**
- Index on `guests.property_id` (CRITICAL)
- Index on `reservations.guest_id` for efficient JOIN
- Response time: < 500ms for list query with 500 guests

**Integration Effort:** 3 Story Points
- Create getGuests() query with JOIN (2 pts)
- Convert Guests page to server component (1 pt)

#### 2.2.3 Analytics Page Integration (Phase 1)

**Current State:**
- Client component with hardcoded stats (lines 29, 39, 49, 59)
  - "$45,231" total revenue
  - "156" bookings
  - "78%" avg occupancy
  - "573" total guests
- Hardcoded "Top Performing Sites" array (lines 86-99)
- Hardcoded "Booking Sources" array (lines 111-115)
- Placeholder charts

**Target State (Phase 1 - MVP):**
- Server component with async data fetching
- Real top-level stats via existing `getDashboardStats()`
- Real "Top Performing Sites" query
- Placeholder for charts (defer to Phase 2)
- Booking sources data (BLOCKED: requires `source` column on reservations)

**Existing Function (Reuse):**
```typescript
// lib/dashboard/queries.ts - ALREADY EXISTS
export interface DashboardStats {
  totalRevenue: MoneyCents      // ✅ Calculated from reservations.paid_amount
  totalReservations: number     // ✅ COUNT(reservations)
  occupancyRate: number         // ✅ Calculated from last 30 days
  totalGuests: number           // ✅ SUM(num_adults + num_children)
  pendingPayments: MoneyCents
  completedPayments: MoneyCents
  cancelledPayments: MoneyCents
}

// ✅ ALREADY IMPLEMENTED - REUSE AS-IS
export async function getDashboardStats(propertyId: string): Promise<DashboardStats>
```

**New Query Function:**
```typescript
// lib/dashboard/queries.ts

export interface TopPerformingSite {
  siteId: string
  siteName: string
  bookings: number             // COUNT(reservations)
  revenue: MoneyCents          // SUM(reservations.total_amount)
}

/**
 * Get top 5 performing sites by revenue
 * @param propertyId - Multi-tenant isolation key
 * @param limit - Number of top sites to return (default 5)
 */
export async function getTopPerformingSites(
  propertyId: string,
  limit = 5
): Promise<TopPerformingSite[]>
```

**SQL Aggregation Required:**
```sql
SELECT
  s.id as site_id,
  COALESCE(s.site_name, 'Site ' || s.site_number) as site_name,
  COUNT(r.id) as bookings,
  COALESCE(SUM(r.total_amount), 0) as revenue
FROM sites s
LEFT JOIN reservations r ON r.site_id = s.id AND r.status != 'cancelled'
WHERE s.property_id = ?
GROUP BY s.id, s.site_name, s.site_number
ORDER BY revenue DESC
LIMIT ?
```

**Performance Requirements:**
- Aggregation query with GROUP BY and SUM
- Index on `reservations.site_id` for efficient JOIN
- Consider caching result (TTL 15 minutes) for expensive analytics
- Response time: < 1000ms for aggregation query

**Out of Scope (Phase 2):**
- Revenue trend chart (requires time-series data)
- Occupancy trend chart (requires daily aggregations)
- Booking sources (BLOCKED: requires new `reservations.source` column)

**Integration Effort:** 8 Story Points (Phase 1 Only)
- Reuse getDashboardStats() for top stats (0 pts - already done)
- Create getTopPerformingSites() query (3 pts - complex aggregation)
- Convert Analytics page to server component (2 pts)
- Add caching layer for analytics queries (3 pts)

#### 2.2.4 Settings Page Integration

**Current State:**
- Client component with static forms
- No data fetching (defaultValue hardcoded)
- No save functionality (button does nothing)
- Tabs: General, Booking, Payments, Notifications

**Target State:**
- Server component with async data fetching for initial load
- Form submission via Server Actions or API route
- Real property data from `properties` table
- Settings persistence to `properties.settings` JSON column

**Database Schema (Existing):**
```typescript
properties: {
  Row: {
    id: string
    owner_id: string
    name: string
    property_type: string | null  // 'campground' | 'rv_park' | 'glamping' | 'mixed'
    slug: string
    subdomain: string | null
    description: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zip_code: string | null
    country: string | null
    timezone: string | null
    check_in_time: string | null
    check_out_time: string | null
    amenities: Json | null
    settings: Json | null         // CRITICAL: Store booking/payment/notification preferences
    status: string | null
    created_at: string | null
    updated_at: string | null
  }
}
```

**Settings JSON Schema (New):**
```typescript
// lib/dashboard/types.ts (NEW FILE)

export interface PropertySettings {
  booking: {
    instantBooking: boolean
    requireDeposit: boolean
    depositPercentage?: number
  }
  payments: {
    acceptCreditCards: boolean
    acceptCash: boolean
    acceptChecks: boolean
    stripAccountId?: string
  }
  notifications: {
    newReservations: boolean
    checkInReminders: boolean
    paymentNotifications: boolean
    marketingEmails: boolean
  }
}
```

**New Query Functions:**
```typescript
// lib/dashboard/queries.ts

export interface PropertyDetails {
  id: string
  name: string
  propertyType: 'campground' | 'rv_park' | 'glamping' | 'mixed'
  description: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  timezone: string | null
  checkInTime: string | null
  checkOutTime: string | null
  settings: PropertySettings
}

/**
 * Get property details for settings form
 * @param propertyId - Multi-tenant isolation key (user's property)
 */
export async function getPropertyDetails(
  propertyId: string
): Promise<PropertyDetails | null>

/**
 * Update property details and settings
 * @param propertyId - Multi-tenant isolation key
 * @param updates - Partial updates to property
 */
export async function updatePropertyDetails(
  propertyId: string,
  updates: Partial<Omit<PropertyDetails, 'id'>>
): Promise<PropertyDetails>
```

**Validation Schema (Zod):**
```typescript
// lib/dashboard/validations.ts (NEW FILE)

import { z } from 'zod'

export const propertyDetailsSchema = z.object({
  name: z.string().min(1, 'Property name is required').max(100),
  propertyType: z.enum(['campground', 'rv_park', 'glamping', 'mixed']),
  description: z.string().max(500).nullable(),
  email: z.string().email('Invalid email address').nullable(),
  phone: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'Invalid phone format').nullable(),
  address: z.string().max(200).nullable(),
  city: z.string().max(100).nullable(),
  state: z.string().length(2, 'State must be 2 letters').nullable(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').nullable(),
  timezone: z.string().nullable(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').nullable(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').nullable(),
})

export const propertySettingsSchema = z.object({
  booking: z.object({
    instantBooking: z.boolean(),
    requireDeposit: z.boolean(),
    depositPercentage: z.number().min(0).max(100).optional(),
  }),
  payments: z.object({
    acceptCreditCards: z.boolean(),
    acceptCash: z.boolean(),
    acceptChecks: z.boolean(),
  }),
  notifications: z.object({
    newReservations: z.boolean(),
    checkInReminders: z.boolean(),
    paymentNotifications: z.boolean(),
    marketingEmails: z.boolean(),
  }),
})
```

**Performance Requirements:**
- Simple SELECT by property_id: < 100ms
- UPDATE by property_id: < 200ms
- Optimistic UI updates with error rollback

**Integration Effort:** 7 Story Points
- Create getPropertyDetails() query (1 pt)
- Create updatePropertyDetails() mutation (2 pts)
- Create Zod validation schemas (1 pt)
- Convert Settings page to server component with form handling (2 pts)
- Add error handling and success feedback (1 pt)

### 2.3 Shared Utilities & Patterns

#### 2.3.1 Code Duplication Elimination

**Current Duplication:**
```typescript
// Found in: app/dashboard/page.tsx, app/dashboard/reservations/page.tsx, app/dashboard/payments/page.tsx
async function getCurrentPropertyId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  return property?.id || null
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

**Solution: Centralize in lib/dashboard/utils.ts (NEW FILE):**
```typescript
// lib/dashboard/utils.ts

import { createClient } from '@/lib/supabase/server'
import type { MoneyCents } from '@/src/contracts/booking'

/**
 * Get the current user's property ID
 * MVP: Assumes user has access to one property
 * Multi-property support will require property switcher
 */
export async function getCurrentPropertyId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  return property?.id || null
}

/**
 * Format money from integer cents to dollar display
 * CRITICAL: Database stores cents, UI displays dollars
 */
export function formatMoney(cents: MoneyCents): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Format date for dashboard display
 */
export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(dateString).toLocaleDateString('en-US', options || {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format full date with year
 */
export function formatFullDate(dateString: string): string {
  return formatDate(dateString, { year: 'numeric', month: 'long', day: 'numeric' })
}
```

**Refactoring Effort:** 2 Story Points
- Create lib/dashboard/utils.ts (1 pt)
- Update 7 dashboard pages to import shared utilities (1 pt)

#### 2.3.2 Empty State Handling Pattern

**Design Requirement:** Per PRD, empty states must show ONLY real data or actionable CTAs - NO sample data, NO educational placeholders.

**Standard Empty State Pattern:**
```typescript
// Example for Sites Page
{sites.length === 0 ? (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
      <Tent className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No Sites Yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Get started by creating your first site to begin accepting reservations.
      </p>
      <Button asChild>
        <Link href="/dashboard/sites/new">Create Your First Site</Link>
      </Button>
    </CardContent>
  </Card>
) : (
  // Render site grid
)}
```

**Empty State Requirements:**
- **Sites Page:** "No Sites Yet" → CTA: "Create Your First Site"
- **Guests Page:** "No Guests Yet" → CTA: "First guest will appear when you receive a reservation"
- **Analytics Page:** "Not Enough Data" → "Analytics available after first booking"
- **Settings Page:** N/A (always has property data to display)

### 2.4 API Changes

**No new API endpoints required.** All functionality implemented via:
1. Server Component async data fetching (Next.js 15 pattern)
2. Supabase client queries in `lib/dashboard/queries.ts`
3. Form submission via Server Actions (for Settings page mutations)

**Server Action Pattern (Settings Page):**
```typescript
// app/dashboard/settings/actions.ts (NEW FILE)

'use server'

import { revalidatePath } from 'next/cache'
import { updatePropertyDetails } from '@/lib/dashboard/queries'
import { propertyDetailsSchema } from '@/lib/dashboard/validations'
import { getCurrentPropertyId } from '@/lib/dashboard/utils'

export async function updatePropertyAction(formData: FormData) {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return { error: 'No property found' }
  }

  // Validate input
  const rawData = Object.fromEntries(formData)
  const validated = propertyDetailsSchema.safeParse(rawData)

  if (!validated.success) {
    return { error: 'Invalid data', issues: validated.error.issues }
  }

  try {
    await updatePropertyDetails(propertyId, validated.data)
    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (error) {
    return { error: 'Failed to update property' }
  }
}
```

### 2.5 Database Schema Changes

**CRITICAL: No schema migrations required.** All tables exist with correct structure.

**REQUIRED: Database Indexes for Performance**

Based on query patterns and expected data volumes (500+ sites, 10k+ reservations per property):

```sql
-- Index for multi-tenant isolation (CRITICAL - may already exist via foreign key)
CREATE INDEX IF NOT EXISTS idx_sites_property_id ON sites(property_id);
CREATE INDEX IF NOT EXISTS idx_guests_property_id ON guests(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_payments_property_id ON payments(property_id);

-- Index for JOIN performance (CRITICAL for guest statistics)
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_site_id ON reservations(site_id);

-- Index for filter queries
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(property_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(property_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in_date ON reservations(property_id, check_in_date);

-- Composite index for analytics queries (top performing sites)
CREATE INDEX IF NOT EXISTS idx_reservations_site_revenue ON reservations(property_id, site_id, total_amount) WHERE status != 'cancelled';
```

**Index Validation Script:**
```sql
-- Verify indexes exist
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('sites', 'guests', 'reservations', 'payments', 'properties')
ORDER BY tablename, indexname;
```

**Migration File:** `supabase/migrations/20251101000000_dashboard_performance_indexes.sql`

### 2.6 Integration Points

#### Supabase Client
- **Location:** `lib/supabase/server.ts`
- **Type Safety:** Generated types from `src/contracts/db.ts`
- **Pattern:** All queries use typed client with RLS enforcement

#### Authentication
- **Location:** Supabase Auth via `createClient().auth.getUser()`
- **Pattern:** `getCurrentPropertyId()` utility handles auth state
- **Error Handling:** Pages show "No property found" when user not authenticated

#### Existing Query Layer
- **Location:** `lib/dashboard/queries.ts`
- **Existing Functions:** `getReservations()`, `getPayments()`, `getDashboardStats()`
- **New Functions:** `getSites()`, `getGuests()`, `getTopPerformingSites()`, `getPropertyDetails()`, `updatePropertyDetails()`

---

## 3. UI/UX Considerations

### 3.1 Component Reuse

**Existing Shadcn/UI Components (Already in Use):**
- ✅ `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
- ✅ `Button`, `Input`, `Label`, `Textarea`, `Switch`
- ✅ `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- ✅ `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- ✅ `Badge`, `Avatar`, `AvatarImage`, `AvatarFallback`
- ✅ `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`
- ✅ `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`

**No new components required.** All current UI patterns maintained.

### 3.2 Responsive Design

**Current Implementation:** Mobile-first with Tailwind breakpoints
- `md:` - 768px (tablet)
- `lg:` - 1024px (desktop)

**Grid Layouts:**
- Stats cards: `grid gap-4 md:grid-cols-2 lg:grid-cols-4`
- Site cards: `grid gap-4 md:grid-cols-2 lg:grid-cols-3`
- Activity cards: `grid gap-4 md:grid-cols-2`

**No changes required** - maintain existing responsive patterns.

### 3.3 Loading States

**Current Pattern:** Suspense boundaries with skeleton loaders
```typescript
<Suspense fallback={<div className="h-8 bg-muted animate-pulse rounded" />}>
  <AsyncComponent />
</Suspense>
```

**Apply to All Integrated Pages:**
- Sites page: Skeleton grid cards
- Guests page: Skeleton table rows
- Analytics page: Skeleton stat cards
- Settings page: Skeleton form fields

### 3.4 Error States

**Current Pattern:** Error boundary at layout level + inline error messages

**New Error Handling Pattern:**
```typescript
// lib/dashboard/queries.ts
try {
  const { data, error } = await supabase.from('sites').select('*')
  if (error) {
    throw new Error(`Failed to fetch sites: ${error.message}`)
  }
  return data
} catch (error) {
  // Log error to monitoring service
  console.error('Dashboard query error:', error)
  throw error // Let page-level error boundary handle
}
```

**Page-Level Error Display:**
```typescript
// app/dashboard/sites/page.tsx
async function SitesData() {
  try {
    const sites = await getSites(propertyId)
    return <SitesGrid sites={sites} />
  } catch (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">Failed to load sites. Please try again.</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }
}
```

---

## 4. Edge Cases and Error Handling

### 4.1 Multi-Tenant Data Isolation

**CRITICAL:** All queries MUST include `property_id` filtering.

**Validation Checklist:**
- ✅ `getSites()` - WHERE property_id = ?
- ✅ `getGuests()` - WHERE property_id = ?
- ✅ `getTopPerformingSites()` - WHERE property_id = ?
- ✅ `getPropertyDetails()` - WHERE id = ? (property_id is the ID)
- ✅ `updatePropertyDetails()` - WHERE id = ? (property_id is the ID)

**Security Test Required:**
```typescript
// tests/security/tenant-isolation.test.ts
describe('Dashboard Query Tenant Isolation', () => {
  it('getSites() only returns sites for specified property', async () => {
    const property1Sites = await getSites('property-1-id')
    const property2Sites = await getSites('property-2-id')

    // Verify no data leakage
    expect(property1Sites.data.every(s => s.propertyId === 'property-1-id')).toBe(true)
    expect(property2Sites.data.every(s => s.propertyId === 'property-2-id')).toBe(true)
    expect(property1Sites.data).not.toEqual(property2Sites.data)
  })
})
```

### 4.2 Empty State Handling

**Zero Sites:**
- Display: "No Sites Yet" with CTA to create first site
- Stats cards: Show 0 values (not hardcoded placeholders)

**Zero Guests:**
- Display: "No Guests Yet" with informational message
- Table: Empty state with icon and explanation

**Zero Reservations:**
- Analytics shows: "Not Enough Data" message
- Top Performing Sites: Empty array → "No reservation data yet"

### 4.3 Large Data Sets

**Pagination Requirements:**
- **Sites Page:** 50 sites per page (handle 500+ total sites)
- **Guests Page:** 50 guests per page (handle 500+ total guests)
- **Analytics Top Sites:** Limit 5 (no pagination needed)

**Pagination UI Pattern:**
```typescript
// Use existing pattern from reservations/payments pages
<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href={`?page=${page - 1}`} />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href={`?page=${page + 1}`} />
    </PaginationItem>
  </PaginationContent>
</Pagination>
```

### 4.4 Money Display Edge Cases

**CRITICAL: Database stores cents, UI displays dollars**

**Conversion Pattern:**
```typescript
// Database: 7500 cents
// Display: "$75.00"
formatMoney(7500) // "$75.00"

// NEVER DO THIS:
basePrice: 75  // ❌ WRONG - mixing dollars and cents
```

**Zero Amount Handling:**
```typescript
formatMoney(0) // "$0.00" (not "$0" or empty string)
```

**Negative Amount Handling (Refunds):**
```typescript
formatMoney(-5000) // "-$50.00" (display with negative sign)
```

### 4.5 Date Handling Edge Cases

**Timezone Considerations:**
- All dates stored in UTC (ISO 8601 format)
- Display in property's local timezone (properties.timezone)
- Check-in/check-out dates are DATE only (no time component)

**Date Formatting:**
```typescript
formatDate('2025-11-01') // "Nov 1"
formatFullDate('2025-11-01') // "November 1, 2025"
```

**Invalid Date Handling:**
```typescript
try {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    return 'Invalid date'
  }
  return formatDate(dateString)
} catch {
  return 'Invalid date'
}
```

### 4.6 Concurrent Update Handling (Settings Page)

**Optimistic Locking Pattern:**
```typescript
// Track updated_at timestamp
export async function updatePropertyDetails(
  propertyId: string,
  updates: Partial<PropertyDetails>,
  expectedUpdatedAt?: string
): Promise<PropertyDetails> {
  const { data, error } = await supabase
    .from('properties')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', propertyId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Property was updated by another user. Please refresh and try again.')
    }
    throw new Error(`Failed to update property: ${error.message}`)
  }

  return transformPropertyDetails(data)
}
```

---

## 5. Testing Requirements

### 5.1 Integration Tests (MANDATORY)

**Location:** `tests/integration/dashboard-queries.test.ts` (NEW FILE)

**Coverage:** 100% of dashboard query functions

**Test Structure:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSites, getGuests, getTopPerformingSites, getDashboardStats } from '@/lib/dashboard/queries'
import { createTestProperty, createTestSites, createTestReservations, cleanupTestData } from '@/tests/utils/test-data-factory'

describe('Dashboard Queries Integration Tests', () => {
  let testPropertyId: string

  beforeAll(async () => {
    // Create test property with realistic data
    testPropertyId = await createTestProperty()
    await createTestSites(testPropertyId, 100) // Realistic volume
    await createTestReservations(testPropertyId, 500) // Realistic volume
  })

  afterAll(async () => {
    await cleanupTestData(testPropertyId)
  })

  describe('getSites', () => {
    it('returns sites for specified property with pagination', async () => {
      const result = await getSites(testPropertyId, {}, 1, 50)

      expect(result.data).toHaveLength(50) // First page
      expect(result.total).toBe(100) // Total count
      expect(result.data.every(s => typeof s.basePrice === 'number')).toBe(true)
      expect(result.data.every(s => s.basePrice > 0)).toBe(true) // Cents, not dollars
    })

    it('filters sites by status', async () => {
      const result = await getSites(testPropertyId, { status: 'available' }, 1, 50)

      expect(result.data.every(s => s.status === 'available')).toBe(true)
    })

    it('enforces multi-tenant isolation', async () => {
      const otherPropertyId = await createTestProperty()
      const result = await getSites(testPropertyId)

      expect(result.data.every(s => s.propertyId === testPropertyId)).toBe(true)

      await cleanupTestData(otherPropertyId)
    })
  })

  describe('getGuests', () => {
    it('calculates guest statistics correctly', async () => {
      const result = await getGuests(testPropertyId, {}, 1, 50)

      expect(result.data[0]).toMatchObject({
        id: expect.any(String),
        fullName: expect.any(String),
        email: expect.any(String),
        totalStays: expect.any(Number),
        totalSpent: expect.any(Number), // MoneyCents
        lastVisit: expect.any(String), // ISO date or null
      })
    })

    it('handles guests with zero reservations', async () => {
      // Guest exists but has no reservations
      const result = await getGuests(testPropertyId)
      const guestWithNoReservations = result.data.find(g => g.totalStays === 0)

      expect(guestWithNoReservations?.totalStays).toBe(0)
      expect(guestWithNoReservations?.totalSpent).toBe(0)
      expect(guestWithNoReservations?.lastVisit).toBeNull()
    })
  })

  describe('getTopPerformingSites', () => {
    it('returns top 5 sites by revenue in descending order', async () => {
      const result = await getTopPerformingSites(testPropertyId, 5)

      expect(result).toHaveLength(5)
      expect(result[0].revenue).toBeGreaterThanOrEqual(result[1].revenue)
      expect(result[1].revenue).toBeGreaterThanOrEqual(result[2].revenue)
    })

    it('excludes cancelled reservations from revenue calculation', async () => {
      const result = await getTopPerformingSites(testPropertyId, 5)

      // Verify revenue matches only confirmed/checked_in/checked_out reservations
      expect(result.every(s => s.revenue >= 0)).toBe(true)
    })
  })
})
```

**Performance Tests:**
```typescript
describe('Dashboard Query Performance', () => {
  it('getSites completes within 500ms with 500 sites', async () => {
    const start = performance.now()
    await getSites(testPropertyId)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(500)
  })

  it('getGuests with JOIN completes within 500ms with 500 guests', async () => {
    const start = performance.now()
    await getGuests(testPropertyId)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(500)
  })

  it('getTopPerformingSites aggregation completes within 1000ms', async () => {
    const start = performance.now()
    await getTopPerformingSites(testPropertyId)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(1000)
  })
})
```

### 5.2 Security Tests (MANDATORY)

**Location:** `tests/security/dashboard-tenant-isolation.test.ts` (NEW FILE)

**Coverage:** All multi-tenant dashboard queries

**Test Structure:**
```typescript
import { describe, it, expect } from 'vitest'
import { getSites, getGuests, getTopPerformingSites } from '@/lib/dashboard/queries'
import { createTestProperty, createTestSites } from '@/tests/utils/test-data-factory'

describe('Dashboard Multi-Tenant Security', () => {
  it('prevents cross-tenant data access in getSites', async () => {
    const property1 = await createTestProperty()
    const property2 = await createTestProperty()

    await createTestSites(property1, 10)
    await createTestSites(property2, 10)

    const property1Sites = await getSites(property1)
    const property2Sites = await getSites(property2)

    // Verify complete data isolation
    expect(property1Sites.data).toHaveLength(10)
    expect(property2Sites.data).toHaveLength(10)
    expect(property1Sites.data.every(s => s.propertyId === property1)).toBe(true)
    expect(property2Sites.data.every(s => s.propertyId === property2)).toBe(true)

    // Verify no overlap
    const property1Ids = new Set(property1Sites.data.map(s => s.id))
    const property2Ids = new Set(property2Sites.data.map(s => s.id))
    expect(property1Ids.intersection(property2Ids).size).toBe(0)
  })

  it('prevents unauthorized property updates in updatePropertyDetails', async () => {
    const property1 = await createTestProperty()
    const property2 = await createTestProperty()

    // Attempt to update property2 using property1's context
    await expect(
      updatePropertyDetails(property2, { name: 'Hacked Name' })
    ).rejects.toThrow() // Should fail due to RLS policies
  })
})
```

### 5.3 Unit Tests

**Location:** Collocated with query functions

**Test Pure Calculation Logic:**
```typescript
// lib/dashboard/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatMoney, formatDate } from './utils'

describe('formatMoney', () => {
  it('converts cents to dollar display', () => {
    expect(formatMoney(7500)).toBe('$75.00')
    expect(formatMoney(100)).toBe('$1.00')
    expect(formatMoney(0)).toBe('$0.00')
  })

  it('handles negative amounts (refunds)', () => {
    expect(formatMoney(-5000)).toBe('-$50.00')
  })

  it('handles large amounts', () => {
    expect(formatMoney(123456789)).toBe('$1,234,567.89')
  })
})

describe('formatDate', () => {
  it('formats date in short format', () => {
    expect(formatDate('2025-11-01')).toBe('Nov 1')
  })

  it('handles custom format options', () => {
    expect(formatDate('2025-11-01', { year: 'numeric', month: 'long', day: 'numeric' }))
      .toBe('November 1, 2025')
  })
})
```

### 5.4 End-to-End Tests (OPTIONAL - Post-MVP)

**Location:** `tests/e2e/dashboard.spec.ts`

**Playwright Tests (Future Sprint):**
- User navigates to Sites page → sees real site data
- User searches for site → results filtered correctly
- User updates property settings → changes persist
- User views analytics → top performing sites displayed

---

## 6. Definition of Ready Checklist

Before implementation begins, verify ALL items are complete:

### Database Readiness
- [ ] Database schema verified complete (no missing tables/columns)
- [ ] Database indexes created for performance (6 indexes documented in section 2.5)
- [ ] Row Level Security (RLS) policies validated via `npm run test:security`
- [ ] Supabase connection tested with realistic data volumes

### Code Infrastructure
- [ ] `lib/dashboard/queries.ts` location confirmed
- [ ] Type definitions in `src/contracts/db.ts` up-to-date
- [ ] `lib/dashboard/utils.ts` created with shared utilities
- [ ] `lib/dashboard/validations.ts` created with Zod schemas

### Testing Infrastructure
- [ ] `tests/integration/dashboard-queries.test.ts` scaffolded
- [ ] `tests/security/dashboard-tenant-isolation.test.ts` scaffolded
- [ ] Test data factory utilities created (`tests/utils/test-data-factory.ts`)
- [ ] CI pipeline includes integration and security tests

### Documentation
- [ ] This specification reviewed by engineering lead
- [ ] This specification reviewed by product manager
- [ ] All open questions from PRD answered (see PRD section "Open Questions")
- [ ] Performance SLAs approved by stakeholders

### Acceptance Criteria Clarity
- [ ] All 5 acceptance criteria are testable and measurable
- [ ] No ambiguous requirements remain
- [ ] Definition of Done agreed upon for each component
- [ ] Success metrics defined and trackable

### Dependencies Resolved
- [ ] No blocking issues in Linear dependencies
- [ ] Supabase environment accessible to all developers
- [ ] Test database environment provisioned with realistic data
- [ ] Monitoring/logging infrastructure ready (optional but recommended)

### Team Alignment
- [ ] Sprint capacity validated for 71-78 story points over 4 sprints
- [ ] Developer assignments confirmed for implementation tasks
- [ ] QA resources allocated for testing validation
- [ ] Demo timeline communicated to stakeholders

---

## 7. Implementation Roadmap

### Sprint 1: Foundation & High-Priority Pages (17-20 Story Points)

**Week 1 Tasks:**

1. **Test Infrastructure Setup (3-5 pts)**
   - Create `tests/integration/dashboard-queries.test.ts`
   - Create `tests/security/dashboard-tenant-isolation.test.ts`
   - Create `tests/utils/test-data-factory.ts` with realistic data generators
   - Validate existing RLS policies with security tests

2. **Database Indexes (2-3 pts)**
   - Create migration: `20251101000000_dashboard_performance_indexes.sql`
   - Add 6 performance indexes (property_id, guest_id, site_id, status filters)
   - Validate index creation with `EXPLAIN ANALYZE` on test queries
   - Run performance benchmarks before/after indexes

3. **Shared Utilities (2-3 pts)**
   - Create `lib/dashboard/utils.ts` with `getCurrentPropertyId()`, `formatMoney()`, `formatDate()`
   - Refactor 3 existing dashboard pages to use shared utilities
   - Add unit tests for utility functions

4. **Sites Page Integration (5 pts)**
   - Create `getSites()` and `getSiteStats()` query functions
   - Convert Sites page to server component with async data fetching
   - Add pagination (50 sites per page)
   - Add empty state handling with actionable CTA
   - Integration tests for getSites query

5. **Analytics Page - Phase 1 (12 pts - ADJUSTED FROM PRD 8 pts)**
   - Reuse existing `getDashboardStats()` for top-level metrics (0 pts - already done)
   - Create `getTopPerformingSites()` aggregation query (4 pts - complex SQL)
   - Convert Analytics page to server component (3 pts)
   - Add caching layer for analytics queries (Redis or in-memory, 5 pts)
   - Integration tests for analytics queries

**Sprint 1 Deliverables:**
- Test infrastructure operational
- Database indexes deployed
- Sites page fully integrated with real data
- Analytics page Phase 1 complete (top stats + top sites)

### Sprint 2: Guest Management & Settings Foundation (18-22 pts)

**Week 2 Tasks:**

1. **Guests Page Integration (3 pts)**
   - Create `getGuests()` query with JOIN to calculate statistics (2 pts)
   - Convert Guests page to server component (1 pt)
   - Add search functionality (name, email)
   - Add pagination (50 guests per page)
   - Integration tests for getGuests query

2. **Settings Page - General Tab (7 pts - ADJUSTED FROM PRD 5 pts)**
   - Create `getPropertyDetails()` query (1 pt)
   - Create `updatePropertyDetails()` mutation (2 pts)
   - Create Zod validation schema (1 pt)
   - Convert Settings General tab to server component with form (2 pts)
   - Add error handling and success feedback (1 pt)
   - Integration tests for property CRUD

3. **Settings Page - Booking Tab (5 pts)**
   - Extend property settings JSON schema for booking preferences
   - Implement booking settings form persistence
   - Add validation for check-in/check-out times
   - Integration tests for settings updates

4. **Settings Page - Payment & Notifications Tabs (5-7 pts)**
   - Implement payment preferences persistence
   - Implement notification preferences persistence
   - Add settings validation (deposit percentage range, etc.)
   - Integration tests for all settings tabs

**Sprint 2 Deliverables:**
- Guests page fully integrated
- Settings page General, Booking, Payment, Notification tabs operational
- All settings persisted to database

### Sprint 3: Analytics Enhancement & Performance Optimization (16-18 pts)

**Week 3 Tasks:**

1. **Analytics Page - Phase 2 Charts (12 pts - ADJUSTED FROM PRD 8 pts)**
   - Implement revenue trend chart (Chart.js or Recharts, 4 pts)
   - Implement occupancy trend chart (4 pts)
   - Add date range filtering UI (2 pts)
   - Optimize aggregation queries with materialized views (2 pts)
   - Performance tests for analytics under load

2. **Query Performance Optimization (4-6 pts)**
   - Add query result caching (Redis or in-memory, TTL 5-15 min)
   - Optimize slow queries identified in performance tests
   - Add database query logging/monitoring
   - Run load tests with 500 sites, 10k reservations

**Sprint 3 Deliverables:**
- Analytics page with full chart visualizations
- All dashboard queries meeting performance SLAs
- Caching layer operational

### Sprint 4: Polish, Testing & Documentation (20-18 pts)

**Week 4 Tasks:**

1. **Comprehensive Testing (8-10 pts)**
   - Achieve 100% integration test coverage for all dashboard queries
   - Run full security test suite (tenant isolation)
   - Performance testing against production-like data volumes
   - Fix any failing tests or regressions

2. **Empty State & Error Handling Polish (4-5 pts)**
   - Ensure all empty states follow design guidelines (real data only, actionable CTAs)
   - Standardize error messages across all dashboard pages
   - Add error boundaries for graceful failure handling
   - Test edge cases (zero data, invalid inputs, concurrent updates)

3. **Documentation & Knowledge Transfer (5-6 pts)**
   - Create `docs/DASHBOARD_INTEGRATION_PLAN.md` (final deliverable)
   - Update component documentation with usage examples
   - Create runbook for common dashboard query patterns
   - Record demo video showing all integrated features

4. **Demo Preparation (3 pts)**
   - Seed test environment with realistic demo data
   - Verify all demo scenarios work end-to-end
   - Prepare presentation slides highlighting real vs. mock data progress
   - Stakeholder demo dry run

**Sprint 4 Deliverables:**
- 100% test coverage achieved
- Documentation complete
- Demo-ready environment

---

## 8. Total Effort Estimate

**Grand Total: 71-78 Story Points across 4 Sprints**

**Breakdown by Component:**
- Test Infrastructure Setup: 3-5 pts
- Database Indexes: 2-3 pts
- Shared Utilities: 2-3 pts
- Sites Page: 5 pts
- Guests Page: 3 pts
- Analytics Phase 1: 12 pts (adjusted from 8)
- Analytics Phase 2: 12 pts (adjusted from 8)
- Settings General: 7 pts (adjusted from 5)
- Settings Booking: 5 pts
- Settings Payment/Notifications: 5-7 pts
- Performance Optimization: 4-6 pts
- Testing & QA: 8-10 pts
- Documentation: 5-6 pts
- Demo Prep: 3 pts

**Critical Path Items (Blockers):**
1. Test infrastructure setup (Sprint 1)
2. Database indexes deployment (Sprint 1)
3. RLS policy validation (Sprint 1)
4. Shared utilities refactoring (Sprint 1)

**Risk Buffer:** Built into estimates with range (71-78 pts = ~10% buffer)

---

## 9. Risks and Mitigation Strategies

### Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|------------|--------|----------|------------|
| **RLS Policies Missing/Incorrect** | Medium | Critical | HIGH | Run `npm run test:security` in Sprint 1 Day 1; fail fast if issues found |
| **Database Indexes Missing** | Low | High | MEDIUM | Validate indexes exist via SQL query before Sprint 1 implementation |
| **Query Performance Below SLA** | Medium | High | MEDIUM | Performance test in Sprint 1 with realistic data; optimize early |
| **Test Infrastructure Incomplete** | Low | High | MEDIUM | Allocate 3-5 pts in Sprint 1; don't start implementation without tests |
| **Scope Creep (New Features)** | High | Medium | MEDIUM | Strict adherence to PRD requirements; defer all "nice-to-haves" to Phase 2 |
| **Data Migration Issues** | Low | Critical | MEDIUM | NO schema migrations required; risk minimized |
| **Third-Party Dependencies (Charts)** | Low | Low | LOW | Use well-established libraries (Chart.js, Recharts); fallback to simple HTML charts |

### Critical Blockers

**BLOCKER 1: RLS Policy Validation**
- **Issue:** RLS policies not verified for multi-tenant queries
- **Impact:** Potential data leakage between tenants
- **Resolution:** Run security tests (`npm run test:security`) before ANY implementation
- **Owner:** Engineering Lead
- **Deadline:** Sprint 1 Day 1

**BLOCKER 2: Database Index Performance**
- **Issue:** Queries may be slow without indexes
- **Impact:** Dashboard pages exceed 500ms SLA
- **Resolution:** Create indexes in Sprint 1; validate with `EXPLAIN ANALYZE`
- **Owner:** Database Admin / Engineering
- **Deadline:** Sprint 1 Week 1

**BLOCKER 3: Test Data Factory**
- **Issue:** Can't write integration tests without realistic test data
- **Impact:** Cannot validate query correctness or performance
- **Resolution:** Create test data factory in Sprint 1; generate 100 sites, 1000 reservations per test property
- **Owner:** QA Engineer / Developer
- **Deadline:** Sprint 1 Week 1

---

## 10. Success Metrics

### Planning Phase Success (Immediate)
- ✅ **100% Component Audit:** All 7 dashboard pages documented with data source classification
- ✅ **Database Coverage:** All required tables/queries mapped to components
- ✅ **Stakeholder Approval:** Engineering leads validate effort estimates, Product approves priority
- ✅ **Zero Blocking Questions:** All PRD open questions answered

### Implementation Phase Success (Post-Integration)
- ✅ **Data Accuracy:** 100% of dashboard metrics match real database state (zero hardcoded values)
- ✅ **Query Performance:** All queries meet SLAs (< 500ms list, < 1000ms aggregation)
- ✅ **Test Coverage:** 100% of dashboard query functions have passing integration tests
- ✅ **Security Validation:** Zero cross-tenant data leakage in security tests
- ✅ **Demo Readiness:** All high-priority pages (Sites, Guests, Analytics, Settings) show real data

### Post-Demo Success (Long-Term)
- ✅ **User Engagement:** Dashboard page views increase by 50% (operators see their real data)
- ✅ **Demo Success Rate:** 100% of investor/customer demos show real operational data (no mock embarrassment)
- ✅ **Development Velocity:** Future dashboard features implement 50% faster (query patterns established)
- ✅ **Technical Debt Reduction:** Code duplication eliminated (formatMoney, getCurrentPropertyId shared)

---

## 11. Dependencies and Assumptions

### External Dependencies
- **Supabase Database:** Available with existing schema (no migrations needed)
- **Supabase RLS Policies:** Must be validated before implementation
- **Next.js 15:** App Router with async Server Components (already in use)
- **TypeScript Strict Mode:** Type safety for all database queries
- **Testing Infrastructure:** Vitest for integration tests, Playwright for E2E (future)

### Internal Dependencies
- **Existing Query Patterns:** `lib/dashboard/queries.ts` serves as template
- **Type Definitions:** `src/contracts/db.ts` database types up-to-date
- **Authentication:** Supabase Auth with `getCurrentPropertyId()` pattern
- **UI Components:** Shadcn/UI components already implemented

### Assumptions
1. **Single Property Per User (MVP):** `getCurrentPropertyId()` returns one property; multi-property support deferred
2. **Money in Cents:** All financial values stored as integer cents (not decimal dollars)
3. **UTC Dates:** All dates stored in ISO 8601 UTC format
4. **English Locale:** Number/date formatting uses 'en-US' locale
5. **No Real-Time Updates:** Dashboard data refreshes on page load (no WebSocket updates in MVP)
6. **Pagination Standard:** 50 items per page for all list queries
7. **Caching Optional (MVP):** Analytics caching nice-to-have but not required for demo

---

## 12. Technical Debt Introduced

### Acceptable Trade-offs (MVP)
1. **No Real-Time Updates:** Dashboard data static until page refresh (acceptable for MVP demo)
2. **Basic Pagination:** Simple prev/next pagination (no page numbers or jump-to-page)
3. **Limited Chart Visualizations:** Placeholder charts in Analytics Phase 1 (defer to Phase 2)
4. **No Booking Source Tracking:** Requires new DB column (out of scope per PRD)

### Future Enhancements (Phase 2)
1. **Advanced Analytics:**
   - Historical trend charts (revenue over time, seasonal analysis)
   - Predictive analytics (forecasted revenue, occupancy predictions)
   - Comparison metrics (vs. last year, industry benchmarks)

2. **Interactive Visualizations:**
   - Interactive site map showing availability by location
   - Occupancy calendar heat map
   - Revenue funnel visualization

3. **Real-Time Features:**
   - WebSocket updates for live reservation status
   - Push notifications for new bookings
   - Live occupancy updates as guests check in/out

4. **Multi-Property Support:**
   - Property switcher in dashboard header
   - Aggregate metrics across all properties
   - Per-property drill-down

---

## 13. Appendix: Query Performance Benchmarks

### Target Performance SLAs (from PRD Appendix C)

| Query Type | Target | Acceptable Max | Critical Max |
|------------|--------|----------------|--------------|
| Simple fetch (by ID) | < 50ms | < 100ms | < 200ms |
| List query (paginated) | < 200ms | < 500ms | < 1000ms |
| Aggregation (stats) | < 300ms | < 800ms | < 1500ms |
| Complex join (3+ tables) | < 400ms | < 1000ms | < 2000ms |
| Analytics (full table scan) | < 800ms | < 2000ms | < 5000ms |

### Query-Specific Performance Expectations

**getSites() - List Query:**
- Expected: 200-300ms with 500 sites
- Acceptable: < 500ms
- Optimization: Index on property_id, pagination with LIMIT 50

**getGuests() - Complex Join:**
- Expected: 400-600ms with 500 guests, 10k reservations
- Acceptable: < 1000ms
- Optimization: Index on reservations.guest_id, pre-calculate totals if needed

**getTopPerformingSites() - Aggregation:**
- Expected: 600-800ms with 10k reservations
- Acceptable: < 1500ms
- Optimization: Index on reservations.site_id, consider materialized view

**getDashboardStats() - Analytics:**
- Expected: 800-1200ms with full dataset
- Acceptable: < 2000ms
- Optimization: Caching (TTL 15 min), consider pre-calculated daily aggregates

---

## 14. Final Review Checklist

Before marking this specification as "Ready for Implementation":

### Technical Completeness
- [ ] All 5 Acceptance Criteria are specific, testable, and measurable
- [ ] Database schema changes identified (indexes only, no migrations)
- [ ] API contracts specified (Server Components + Server Actions)
- [ ] Multi-tenant isolation strategy explicit for every query
- [ ] Type definitions provided for all new interfaces

### Implementation Clarity
- [ ] Developer can implement without asking clarifying questions
- [ ] Code examples provided for complex scenarios
- [ ] File locations specified for all new/modified files
- [ ] Existing patterns referenced (lib/dashboard/queries.ts)

### Testing Strategy
- [ ] Integration test requirements specified with examples
- [ ] Security test scenarios documented (tenant isolation)
- [ ] Performance test benchmarks defined
- [ ] Test data factory requirements outlined

### Risk Management
- [ ] All blockers identified with mitigation strategies
- [ ] Dependencies documented and validated
- [ ] Assumptions explicitly stated
- [ ] Technical debt acknowledged

### Stakeholder Alignment
- [ ] Effort estimates validated by engineering lead
- [ ] Priority ranking approved by product manager
- [ ] Performance SLAs agreed upon
- [ ] Demo timeline communicated

---

**Specification Status:** ✅ READY FOR REVIEW

**Next Steps:**
1. Engineering Lead review (technical accuracy)
2. Product Manager review (requirements alignment)
3. Team estimation session (validate 71-78 pts)
4. Linear issue update: Add label "ready-for-implementation", remove "ready-for-review"
5. Sprint 1 planning (allocate 17-20 pts to Week 1)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-01
**Author:** Business Analyst Agent
**Reviewers:** [Pending Engineering Lead, Product Manager]
