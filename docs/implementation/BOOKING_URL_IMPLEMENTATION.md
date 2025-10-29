# Booking URL Implementation Guide

**Purpose**: Make the "Share Your Booking Page" feature functional
**Status**: Not implemented - critical for MVP
**Effort**: ~8 hours
**Priority**: HIGH - blocks onboarding completion

---

## Overview

The onboarding completion page promises a shareable booking URL, but the infrastructure doesn't exist yet. This document details the implementation.

---

## URL Structure

### Current (Broken)
```
https://yourdomain.com/book
  → Shows generic search with mock property selector
  → No property-specific branding
  → Hardcoded "CampOS" instead of campground name
```

### Target (Working)
```
https://yourdomain.com/book/pine-valley-campground-abc12345
  → Shows Pine Valley Campground only
  → Branded with property name
  → Filters sites to this property
  → Shows property-specific info
```

---

## URL Generation Algorithm

### Slug Format
`{sanitized-property-name}-{short-id}`

**Example**:
- Property: "Pine Valley Campground"
- ID: "550e8400-e29b-41d4-a716-446655440000"
- Slug: `pine-valley-campground-550e8400`

### Implementation

```typescript
// lib/booking/generate-slug.ts
export function generateBookingSlug(propertyName: string, propertyId: string): string {
  // 1. Sanitize property name
  const sanitized = propertyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 50)              // Max 50 chars

  // 2. Take first 8 chars of UUID for uniqueness
  const shortId = propertyId.slice(0, 8)

  // 3. Combine
  return `${sanitized}-${shortId}`
}

// Examples:
// "Pine Valley Campground" + "550e8400-..." → "pine-valley-campground-550e8400"
// "Lake Tahoe RV Resort" + "123abc..." → "lake-tahoe-rv-resort-123abc00"
// "Bob's #1 Camping!" + "xyz..." → "bobs-1-camping-xyz00000"
```

### Reverse Lookup

```typescript
// lib/booking/parse-slug.ts
export function extractPropertyIdFromSlug(slug: string): string {
  // Slug format: "property-name-abc12345"
  // Last segment after final hyphen is the short ID
  const parts = slug.split('-')
  const shortId = parts[parts.length - 1]

  return shortId // Use this to query database
}

// Example:
// "pine-valley-campground-550e8400" → "550e8400"
// Then query: WHERE id LIKE '550e8400%'
```

---

## Database Schema Changes

### Add Column to Properties Table

```sql
-- Migration: Add booking_page_slug column
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS booking_page_slug TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_properties_booking_slug
ON properties(booking_page_slug);

-- Add constraint: slug must be lowercase and URL-safe
ALTER TABLE properties
ADD CONSTRAINT booking_slug_format
CHECK (booking_page_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
```

### When to Generate Slug

**Option 1**: During property creation
```typescript
// In setup-property API
const slug = generateBookingSlug(propertyName, propertyId)

await supabase
  .from('properties')
  .insert({
    ...propertyData,
    booking_page_slug: slug
  })
```

**Option 2**: During onboarding completion (Recommended)
```typescript
// In /api/onboarding/complete
const { data: property } = await supabase
  .from('properties')
  .select('id, name, booking_page_slug')
  .eq('owner_id', user.id)
  .single()

// Generate if doesn't exist
if (!property.booking_page_slug) {
  const slug = generateBookingSlug(property.name, property.id)

  await supabase
    .from('properties')
    .update({ booking_page_slug: slug })
    .eq('id', property.id)
}
```

---

## File Structure

### New Files to Create

```
app/
└── book/
    └── [slug]/                              ⭐ NEW
        ├── page.tsx                         ⭐ Property-specific booking page
        └── layout.tsx                       ⭐ Property context provider

lib/
└── booking/
    ├── generate-slug.ts                     ⭐ Slug generation utilities
    └── parse-slug.ts                        ⭐ Slug parsing utilities

app/api/
└── booking/
    └── property/
        └── [slug]/
            └── route.ts                     ⭐ API to fetch property by slug
```

---

## Implementation Details

### 1. Dynamic Route: `/app/book/[slug]/page.tsx`

```typescript
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { extractPropertyIdFromSlug } from '@/lib/booking/parse-slug'
import { PropertyBookingPage } from '@/components/booking/property-booking-page'

export default async function BookPropertyPage({
  params
}: {
  params: { slug: string }
}) {
  const supabase = createClient()

  // 1. Extract property ID from slug
  const shortId = extractPropertyIdFromSlug(params.slug)

  // 2. Query database (match beginning of UUID)
  const { data: property, error } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      city,
      state,
      booking_page_slug,
      booking_page_description,
      hero_image_url,
      check_in_time,
      check_out_time,
      cancellation_policy,
      phone,
      email
    `)
    .eq('booking_page_slug', params.slug)
    .eq('onboarding_completed', true)
    .single()

  // 3. Handle not found
  if (error || !property) {
    notFound()
  }

  // 4. Render property-specific booking page
  return (
    <PropertyBookingPage
      propertyId={property.id}
      propertyName={property.name}
      location={`${property.city}, ${property.state}`}
      description={property.booking_page_description || `Welcome to ${property.name}`}
      heroImage={property.hero_image_url || '/default-hero.jpg'}
      checkInTime={property.check_in_time}
      checkOutTime={property.check_out_time}
      cancellationPolicy={property.cancellation_policy}
      contactPhone={property.phone}
      contactEmail={property.email}
    />
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: property } = await supabase
    .from('properties')
    .select('name, city, state')
    .eq('booking_page_slug', params.slug)
    .single()

  if (!property) return {}

  return {
    title: `${property.name} - Campground Reservations`,
    description: `Book your stay at ${property.name} in ${property.city}, ${property.state}`,
  }
}
```

### 2. PropertyBookingPage Component

```typescript
// components/booking/property-booking-page.tsx
'use client'

import { CampgroundSearch } from '@/components/campground-search'

interface PropertyBookingPageProps {
  propertyId: string
  propertyName: string
  location: string
  description: string
  heroImage: string
  checkInTime: string
  checkOutTime: string
  cancellationPolicy: string
  contactPhone: string
  contactEmail: string
}

export function PropertyBookingPage({
  propertyId,
  propertyName,
  location,
  description,
  heroImage,
  checkInTime,
  checkOutTime,
  cancellationPolicy,
  contactPhone,
  contactEmail,
}: PropertyBookingPageProps) {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div
        className="relative h-[300px] bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center text-white">
          <h1 className="text-4xl font-bold mb-2">{propertyName}</h1>
          <p className="text-xl">{location}</p>
        </div>
      </div>

      {/* Property Info Bar */}
      <div className="border-b bg-muted/50">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Check-in:</span> {checkInTime}
            </div>
            <div>
              <span className="font-medium">Check-out:</span> {checkOutTime}
            </div>
            <div>
              <span className="font-medium">Contact:</span> {contactPhone}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Search */}
      <CampgroundSearch
        propertyId={propertyId}
        propertyName={propertyName}
        hidePropertySelector={true}
      />

      {/* Property Details Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold mb-4">About {propertyName}</h2>
          <p className="text-muted-foreground mb-6">{description}</p>

          <h3 className="text-xl font-semibold mb-3">Cancellation Policy</h3>
          <p className="text-muted-foreground">{cancellationPolicy}</p>
        </div>
      </div>
    </div>
  )
}
```

### 3. Update CampgroundSearch Component

```typescript
// components/campground-search.tsx
interface CampgroundSearchProps {
  propertyId?: string              // ⭐ NEW: Pre-selected property
  propertyName?: string             // ⭐ NEW: For display
  hidePropertySelector?: boolean    // ⭐ NEW: Hide selector when property is fixed
}

export function CampgroundSearch({
  propertyId: initialPropertyId,
  propertyName,
  hidePropertySelector = false
}: CampgroundSearchProps) {
  const [propertyId, setPropertyId] = useState(initialPropertyId || '')

  return (
    <div>
      {/* Only show property selector if not hidden */}
      {!hidePropertySelector && (
        <div className="space-y-2">
          <Label>Campground</Label>
          <Select value={propertyId} onValueChange={setPropertyId}>
            {/* ... property options ... */}
          </Select>
        </div>
      )}

      {/* Rest of search form... */}
    </div>
  )
}
```

### 4. Completion Page Integration

Update `/app/onboarding/complete/page.tsx` to fetch and display the real URL:

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function OnboardingCompletePage() {
  const [bookingUrl, setBookingUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const response = await fetch('/api/onboarding/completion-status')
      const data = await response.json()

      // Build full URL
      const fullUrl = `${window.location.origin}/book/${data.bookingPageSlug}`
      setBookingUrl(fullUrl)
    }
    fetchData()
  }, [])

  async function handleCopyUrl() {
    if (bookingUrl) {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleTestBooking() {
    if (bookingUrl) {
      window.open(bookingUrl, '_blank')
    }
  }

  return (
    <div>
      {/* ... checklist ... */}

      {/* Step 1: Share Booking Page */}
      <div>
        <h3>Share Your Booking Page</h3>
        <div className="flex gap-2">
          <Input
            value={bookingUrl || 'Loading...'}
            readOnly
            className="font-mono"
          />
          <Button onClick={handleCopyUrl}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        {copied && <p className="text-green-600">✓ Copied!</p>}
      </div>

      {/* Step 2: Test Booking */}
      <Button onClick={handleTestBooking}>
        Try Test Booking →
      </Button>

      {/* Step 3: Dashboard */}
      <Button onClick={() => router.push('/dashboard')}>
        Go to Dashboard →
      </Button>
    </div>
  )
}
```

### 5. Completion Status API

Update `/app/api/onboarding/completion-status/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get property with slug
  const { data: property } = await supabase
    .from('properties')
    .select('id, name, city, state, booking_page_slug, stripe_account_id')
    .eq('owner_id', user.id)
    .single()

  // Generate slug if missing
  let slug = property.booking_page_slug
  if (!slug) {
    slug = generateBookingSlug(property.name, property.id)

    await supabase
      .from('properties')
      .update({ booking_page_slug: slug })
      .eq('id', property.id)
  }

  // Count sites
  const { data: sites } = await supabase
    .from('sites')
    .select('site_type')
    .eq('property_id', property.id)

  return NextResponse.json({
    propertyName: property.name,
    city: property.city,
    state: property.state,
    totalSites: sites.length,
    siteBreakdown: formatSiteBreakdown(sites),
    stripeConnected: !!property.stripe_account_id,
    bookingPageSlug: slug,  // ⭐ Return slug (not full URL)
  })
}
```

---

## Testing Checklist

### Unit Tests
- [ ] `generateBookingSlug()` creates valid slugs
- [ ] `extractPropertyIdFromSlug()` extracts correct ID
- [ ] Handles special characters (Bob's #1 Camping!)
- [ ] Handles very long property names (truncates to 50 chars)
- [ ] Handles duplicate slugs (unlikely with UUID, but test)

### Integration Tests
- [ ] Create property → slug is generated
- [ ] Access `/book/[slug]` → shows correct property
- [ ] Access invalid slug → shows 404
- [ ] Completion page shows correct URL
- [ ] Copy button copies to clipboard
- [ ] Test booking button opens correct URL

### Manual Tests
- [ ] Complete onboarding flow
- [ ] Copy booking URL from completion page
- [ ] Paste URL in new browser tab
- [ ] Verify property name appears (not "CampOS")
- [ ] Verify only this property's sites show
- [ ] Verify branding is correct
- [ ] Complete a booking through shared URL
- [ ] Share URL with someone else (incognito mode)

---

## Rollout Plan

### Phase 1: Database Migration (30 min)
1. Run migration to add `booking_page_slug` column
2. Verify migration successful in Supabase dashboard
3. Test index created

### Phase 2: Utility Functions (1 hour)
4. Create `lib/booking/generate-slug.ts`
5. Create `lib/booking/parse-slug.ts`
6. Write unit tests
7. Verify tests pass

### Phase 3: API Updates (1 hour)
8. Update completion status API
9. Add slug generation logic
10. Test API returns correct slug

### Phase 4: Dynamic Route (2 hours)
11. Create `/app/book/[slug]/page.tsx`
12. Create `PropertyBookingPage` component
13. Test route works with mock slug

### Phase 5: Update CampgroundSearch (1 hour)
14. Add optional `propertyId` prop
15. Add `hidePropertySelector` flag
16. Update to filter by property

### Phase 6: Completion Page (1 hour)
17. Update to fetch and display booking URL
18. Add copy to clipboard functionality
19. Add test booking button functionality

### Phase 7: Testing & Polish (2 hours)
20. End-to-end test of full flow
21. Fix any bugs found
22. Test on mobile
23. SEO metadata verification

**Total Effort**: ~8 hours

---

## Edge Cases & Considerations

### Duplicate Property Names
**Problem**: Two campgrounds named "Pine Valley"
**Solution**: UUID suffix makes each slug unique
```
pine-valley-550e8400  (Property 1)
pine-valley-abc12345  (Property 2)
```

### Property Name Changes
**Problem**: Operator renames "Pine Valley" to "Mountain View"
**Solution**: Keep original slug, or regenerate and redirect
```
Option 1: Keep old slug (pine-valley-550e8400)
Option 2: Create new slug + 301 redirect from old
```
**Recommendation**: Keep old slug (simpler, preserves shared links)

### Deleted Properties
**Problem**: Property deleted but URL still shared
**Solution**:
- Soft delete (set `deleted_at` timestamp)
- Show "Property no longer available" page
- Don't actually delete from database

### SEO & Indexing
**Problem**: Google indexes booking pages
**Solution**:
- Add proper meta tags (title, description)
- Add structured data (LocalBusiness schema)
- Submit sitemap with all property booking pages

---

## Success Metrics

After implementation:
- [ ] 100% of completed onboardings have valid booking URL
- [ ] Booking URL loads property-specific page
- [ ] Property name displayed correctly (not "CampOS")
- [ ] Only property's sites shown in search results
- [ ] Copy URL button works in all browsers
- [ ] Test booking completes successfully via shared URL

---

## Next Steps

1. **Decision**: Approve this implementation plan
2. **Database**: Run migration to add booking_page_slug
3. **Code**: Implement in order (utilities → API → routes → UI)
4. **Test**: Complete end-to-end testing
5. **Deploy**: Roll out to production

**Status**: Ready to implement
**Blockers**: None (all dependencies available)
**Assignee**: Claude Code
**Timeline**: 1 day (8 hours)
