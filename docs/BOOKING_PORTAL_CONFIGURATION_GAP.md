# Booking Portal Configuration Gap Analysis

**Issue**: Current onboarding flow creates a booking URL but doesn't configure the guest-facing booking page.

**Last Updated**: 2025-01-27
**Priority**: HIGH - Blocks MVP completion
**Impact**: Operators get a broken/generic booking experience

---

## Current Onboarding Flow

```
Step 1: Property Info → Name, address, contact
Step 2: Site Setup → Add campsites with pricing
Step 3: Stripe Connect → Payment processing
Step 4: Complete → Shows booking URL
```

**Result**: Booking URL generated, but clicking it shows:
- ❌ Generic "CampOS" branding (not the campground's name)
- ❌ Mock property selector with fake campgrounds
- ❌ No property-specific description or photos
- ❌ No policies, check-in times, or instructions
- ❌ No customization or white-labeling

---

## What Guests Need to See

### Essential Information (MVP)
1. **Property Branding**
   - Campground name (not "CampOS")
   - Property description/tagline
   - Primary hero image (or default)
   - Logo (or use property name)

2. **Operational Details**
   - Check-in time (e.g., "3:00 PM")
   - Check-out time (e.g., "11:00 AM")
   - Office hours
   - Contact phone number
   - Contact email

3. **Policies**
   - Cancellation policy (e.g., "Full refund up to 7 days before arrival")
   - Pet policy (from sites already configured)
   - Minimum stay (e.g., "2 nights on weekends")

4. **Property Description**
   - Welcome message
   - Location highlights
   - Nearby attractions
   - Amenities overview

### Enhanced (v1.1)
5. **Advanced White-labeling**
   - Custom logo upload
   - Brand color customization
   - Custom domain (subdomain)
   - Photo gallery (multiple property photos)

6. **Additional Content**
   - Directions/GPS coordinates
   - Area map
   - FAQ section
   - House rules
   - Arrival instructions

---

## Database Schema Impact

### Required Columns (properties table)

```sql
-- Booking Page Configuration
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS booking_page_description TEXT,
ADD COLUMN IF NOT EXISTS booking_page_tagline TEXT,
ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS check_in_time TIME DEFAULT '15:00:00',
ADD COLUMN IF NOT EXISTS check_out_time TIME DEFAULT '11:00:00',
ADD COLUMN IF NOT EXISTS office_hours TEXT,
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
ADD COLUMN IF NOT EXISTS minimum_stay_nights INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS special_instructions TEXT,
ADD COLUMN IF NOT EXISTS directions TEXT;

-- White-labeling (v1.1)
ADD COLUMN IF NOT EXISTS brand_color_primary VARCHAR(7), -- Hex color
ADD COLUMN IF NOT EXISTS brand_color_secondary VARCHAR(7),
ADD COLUMN IF NOT EXISTS custom_domain TEXT;
```

---

## Solution Options

### Option 1: Sensible Defaults (MVP - Fastest)
**Approach**: Auto-generate booking page from existing data
**Timeline**: No additional onboarding step needed
**Effort**: 4 hours

**Implementation**:
1. Create `/book/[property-slug]` dynamic route
2. Fetch property data from database
3. Use property name instead of "CampOS"
4. Show property description (if provided) or generic text
5. Use default hero image (stock camping photo)
6. Display check-in/out times (default to 3 PM / 11 AM)
7. Show cancellation policy (default to "Contact property")

**Pros**:
- ✅ Ships immediately (no new onboarding page)
- ✅ Operators get working booking page right away
- ✅ Can customize later in dashboard

**Cons**:
- ❌ Generic first impression
- ❌ No branding/customization at launch
- ❌ Operators may be disappointed

---

### Option 2: Add Booking Page Settings Step (Recommended)
**Approach**: Insert "Step 3.5: Booking Page Setup" between Sites and Stripe
**Timeline**: +1 day to implementation
**Effort**: 8 hours (page + API)

**New Flow**:
```
Step 1: Property Info → Basic details
Step 2: Site Setup → Add campsites
Step 3: Booking Page → Customize guest experience ⭐ NEW
Step 4: Stripe Connect → Payment processing
Step 5: Complete → Shows booking URL
```

**Fields to Collect** (Step 3):
- Property description (textarea, 2-3 sentences)
- Tagline (optional, 1 sentence)
- Hero image (upload or select from gallery - defer upload to v1.1, use default for MVP)
- Check-in time (time picker, default 3 PM)
- Check-out time (time picker, default 11 AM)
- Cancellation policy (select from templates + custom)
- Minimum stay (number, default 1 night)
- Special instructions (textarea, optional)

**Cancellation Policy Templates**:
- Flexible: Full refund up to 24 hours before arrival
- Moderate: Full refund up to 7 days before arrival
- Strict: Full refund up to 30 days before arrival
- Custom: [textarea for custom policy]

**Pros**:
- ✅ Operators get professional booking page immediately
- ✅ Customization happens during onboarding (not forgotten)
- ✅ Better first impression for guests
- ✅ Competitive advantage (most platforms require manual setup)

**Cons**:
- ❌ Adds 5-10 minutes to onboarding
- ❌ Requires additional page development
- ❌ +1 day to MVP timeline

---

### Option 3: Dashboard Settings Only (Deferred)
**Approach**: Launch with defaults, add "Booking Page Settings" in dashboard
**Timeline**: MVP ships on time, settings added in v1.1
**Effort**: MVP: 4 hours, v1.1: 8 hours

**Implementation**:
1. MVP: Use sensible defaults (Option 1)
2. v1.1: Add "Settings → Booking Page" in dashboard
3. Allow operators to customize post-onboarding

**Pros**:
- ✅ MVP ships on schedule
- ✅ Operators can customize when ready
- ✅ Doesn't overwhelm during onboarding

**Cons**:
- ❌ First bookings use generic page
- ❌ Operators may forget to customize
- ❌ Guests see unprofessional page initially

---

## Recommended Approach

### For MVP (Ship in 1-2 weeks): **Option 1 + Option 3**

**Phase 1 (MVP - Days 8-14)**:
1. Implement sensible defaults booking page
2. Create `/book/[property-slug]` route
3. Pull property name, city, state from database
4. Use default check-in/out times (3 PM / 11 AM)
5. Default cancellation policy: "Please contact the property"
6. Default hero image (stock camping photo)
7. Ship MVP with working but basic booking page

**Phase 2 (v1.1 - Week 3)**:
8. Add "Booking Page Settings" in dashboard (Settings tab)
9. Allow customization of all fields
10. Add logo/image upload
11. Add brand color picker
12. Preview feature (see booking page before publishing)

### For v1.1 (After MVP): **Option 2**

If feedback shows operators need customization earlier:
- Add "Step 3.5: Booking Page Setup" between Sites and Stripe
- Move customization into onboarding flow
- Make it optional (can skip with defaults)

---

## Technical Implementation (MVP)

### 1. Dynamic Booking Route

**File**: `app/book/[slug]/page.tsx`

```typescript
export default async function BookingPage({ params }: { params: { slug: string } }) {
  // Extract property ID from slug (e.g., "pine-valley-abc123" → "abc123")
  const propertyId = extractIdFromSlug(params.slug)

  // Fetch property details
  const property = await getPropertyById(propertyId)

  if (!property) {
    return <NotFound />
  }

  return (
    <BookingPortal
      propertyId={property.id}
      propertyName={property.name}
      description={property.booking_page_description || `Welcome to ${property.name}`}
      heroImage={property.hero_image_url || '/default-campground-hero.jpg'}
      checkInTime={property.check_in_time || '15:00'}
      checkOutTime={property.check_out_time || '11:00'}
      cancellationPolicy={property.cancellation_policy || 'Please contact property for cancellation policy'}
    />
  )
}
```

### 2. Update Properties Table

```sql
-- Add default booking page configuration
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS booking_page_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hero_image_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS check_in_time TIME DEFAULT '15:00:00',
ADD COLUMN IF NOT EXISTS check_out_time TIME DEFAULT '11:00:00',
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'Please contact the property for our cancellation policy.';
```

### 3. Update CampgroundSearch Component

**Changes**:
- Remove hardcoded "CampOS" → Use `propertyName` prop
- Remove mock property selector → Filter by `propertyId` automatically
- Update hero text → Use `description` prop
- Add property details section → Show check-in/out, policies

### 4. Booking Page API

**File**: `app/api/booking/property/[slug]/route.ts`

```typescript
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const propertyId = extractIdFromSlug(params.slug)

  const { data: property } = await supabase
    .from('properties')
    .select('id, name, city, state, booking_page_description, hero_image_url, check_in_time, check_out_time, cancellation_policy')
    .eq('id', propertyId)
    .eq('onboarding_completed', true)
    .single()

  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  return NextResponse.json({ property })
}
```

---

## User Experience Impact

### With Defaults (Option 1)
**Guest sees**:
- Property name: "Pine Valley Campground"
- Location: "Asheville, NC"
- Generic description: "Welcome to Pine Valley Campground"
- Default times: Check-in 3 PM, Check-out 11 AM
- Generic policy: "Contact property for cancellation policy"

**Rating**: 6/10 - Functional but unprofessional

### With Onboarding Step (Option 2)
**Guest sees**:
- Property name: "Pine Valley Campground"
- Custom tagline: "Your mountain getaway in the Blue Ridge Mountains"
- Description: "Nestled in the heart of the Blue Ridge, we offer..."
- Custom times: Check-in 2 PM, Check-out noon
- Clear policy: "Full refund up to 7 days before arrival"

**Rating**: 9/10 - Professional and inviting

---

## Recommendations

### For MVP Launch (This Week)
1. ✅ Implement **Option 1** (sensible defaults)
2. ✅ Add database columns for booking page config
3. ✅ Create `/book/[slug]` dynamic route
4. ✅ Update CampgroundSearch to accept property props
5. ✅ Document limitations in operator guide

### For v1.1 (Week 3)
6. ✅ Add "Booking Page Settings" to dashboard
7. ✅ Add logo/image upload
8. ✅ Add brand color picker
9. ✅ Add preview feature
10. ✅ Potentially move to onboarding if operators complain

### For v1.2 (Future)
11. Advanced white-labeling (custom domain)
12. Multiple property photos
13. Photo gallery
14. Video backgrounds
15. Custom CSS

---

## Effort Estimates

| Task | Effort | Priority |
|------|--------|----------|
| Add database columns | 30 min | HIGH |
| Create `/book/[slug]` route | 2 hours | HIGH |
| Update CampgroundSearch component | 2 hours | HIGH |
| Add property API endpoint | 1 hour | HIGH |
| Test with real property data | 1 hour | HIGH |
| **MVP Total** | **6-7 hours** | **HIGH** |
| | | |
| Dashboard settings page | 4 hours | MEDIUM |
| Logo/image upload | 2 hours | MEDIUM |
| Brand color picker | 1 hour | LOW |
| Preview feature | 2 hours | MEDIUM |
| **v1.1 Total** | **9 hours** | **MEDIUM** |

---

## Decision Matrix

| Criteria | Option 1 (Defaults) | Option 2 (Onboarding Step) | Option 3 (Dashboard Only) |
|----------|---------------------|---------------------------|---------------------------|
| Time to MVP | ✅ No delay | ⚠️ +1 day | ✅ No delay |
| Guest experience | ⚠️ 6/10 | ✅ 9/10 | ⚠️ 6/10 initially |
| Operator satisfaction | ⚠️ May complain | ✅ Happy | ⚠️ May forget to configure |
| Competitive advantage | ❌ None | ✅ Unique | ❌ None |
| Development effort | ✅ 6 hours | ⚠️ 14 hours | ✅ 6 hours (MVP) |
| Technical complexity | ✅ Low | ⚠️ Medium | ✅ Low |

**Winner for MVP**: **Option 1** (ships fast, acceptable quality)
**Winner for v1.1**: **Option 3** (better UX without delaying MVP)

---

## Next Steps

1. **Decide**: Which option to implement for MVP?
2. **Update**: Database schema with booking page columns
3. **Create**: Dynamic booking route `/book/[slug]`
4. **Refactor**: CampgroundSearch to use property props
5. **Test**: End-to-end booking flow with real property
6. **Document**: Operator guide on customization (if Option 3)

---

**Status**: Awaiting decision on approach
**Recommendation**: Implement Option 1 for MVP, add Option 3 for v1.1
