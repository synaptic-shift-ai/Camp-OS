# Guest Portal v0 Prompts - Production Ready

**Date**: 2025-01-29
**Purpose**: Convert TEMP booking portal into production-ready components with proper types, routes, and API integration

---

## Table of Contents
1. [Shared TypeScript Types](#shared-typescript-types)
2. [v0 Prompt 1: Property Landing Page](#v0-prompt-1-property-landing-page)
3. [v0 Prompt 2: Checkout Page](#v0-prompt-2-checkout-page)
4. [v0 Prompt 3: Payment Page](#v0-prompt-3-payment-page)
5. [v0 Prompt 4: Confirmation Page](#v0-prompt-4-confirmation-page)
6. [Integration Checklist](#integration-checklist)

---

## Shared TypeScript Types

**File: `lib/booking/types.ts`** (Already exists - reference these types)

```typescript
// Site Types
export type SiteType = 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'

export interface AvailableSite {
  id: string
  name: string
  site_number: string
  site_type: SiteType
  max_occupancy: number
  base_price_per_night: number
  amenities: SiteAmenities
  image_url?: string
}

// Guest Types
export interface CreateGuestInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
}

// Checkout Context
export interface CheckoutData {
  site?: AvailableSite
  checkInDate?: Date
  checkOutDate?: Date
  guestInfo?: CreateGuestInput
  numAdults?: number
  numChildren?: number
  numPets?: number
  specialRequests?: string
  priceBreakdown?: PriceBreakdown
  stripePaymentIntentId?: string
  confirmationNumber?: string
  reservationId?: string
}

// Pricing
export interface PriceBreakdown {
  base_price_per_night: number
  number_of_nights: number
  subtotal: number
  cleaning_fee?: number
  pet_fee?: number
  total: number
}
```

**Context Hook: `lib/booking/checkout-context.tsx`** (Already exists)
```typescript
import { useCheckout } from "@/lib/booking/checkout-context"

// Usage:
const { checkoutData, setCheckoutData, clearCheckoutData } = useCheckout()
```

---

## v0 Prompt 1: Property Landing Page

**Target File**: `app/book/[slug]/page.tsx` (Server Component) + `components/guest/property-booking-portal.tsx` (Client Component)

### v0 Prompt:

```
Create a guest-facing campground property booking portal landing page for a Next.js 15 App Router application.

DESIGN REQUIREMENTS:
- Nature-themed, welcoming design (greens, earth tones)
- Mobile-first responsive layout
- Clean, professional aesthetic (NOT tool-like, NOT CampOS platform theme)
- Standard shadcn/ui components (Card, Button, Badge)
- Approachable typography and spacing
- Trust indicators and social proof elements

DESIGN REFERENCE:
Use the welcoming, nature-focused design style from modern campground booking sites like Hipcamp or Recreation.gov. The design should feel like a property's website, not a software platform.

COLOR PALETTE:
- Primary: #2D5A27 (Forest green) or similar nature green
- Accent: #8FBC8F (Light green/sage)
- Background: White (#FFFFFF) with subtle gray accents
- Text: Dark gray for readability
- Trust elements: Green for verified/secure badges

COMPONENT STRUCTURE:
This is a CLIENT COMPONENT that receives property data as props from a server component parent.

TYPESCRIPT INTERFACE (Props):
```typescript
interface PropertyBookingPortalProps {
  property: {
    id: string
    name: string
    city: string
    state: string
    description: string | null
    tagline: string | null
    hero_image_url: string | null
    check_in_time: string // "15:00:00" format
    check_out_time: string // "11:00:00" format
    phone: string | null
    email: string | null
    cancellation_policy: string | null
    amenities: string[] // ['wifi', 'showers', 'fire_pits']
  }
}
```

SECTIONS TO INCLUDE (in order):

1. **Header/Navigation Bar**
   - Property logo/name on left
   - Navigation links: Sites | Amenities | Gallery | Contact
   - "Book Now" CTA button
   - Mobile hamburger menu
   - Sticky header on scroll

2. **Hero Section**
   - Full-width background image (property.hero_image_url or default)
   - Gradient overlay for text readability
   - Property name as H1 (large, bold, white text)
   - Tagline if available
   - Location (city, state)
   - Two CTAs: "Book Your Stay" (primary) + "View Sites" (secondary outline)
   - Height: 70vh

3. **Quick Booking Widget Card**
   - Elevated card just below hero (floating appearance)
   - Title: "Find Your Perfect Campsite"
   - Date range picker (Check-in / Check-out)
   - Guest count selector (Adults, Children)
   - Site type filter dropdown (optional, "All Site Types" default)
   - "Check Availability" button
   - When clicked: Calls API and shows available sites below OR navigates to search results
   - Uses existing CampgroundSearch component logic (you can reference this for API structure)

4. **Site Types Section**
   - Title: "Choose Your Camping Style"
   - Grid of site type cards (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
   - Each card shows:
     * Icon (Tent, RV/Car, Cabin/TreePine based on type)
     * Site type name
     * Description
     * Starting price "From $XX/night"
     * Max occupancy
     * Key amenities (3-4 items)
     * "View Sites" button
   - Site types to display: Tent, RV, Cabin (pull from search results or default)

5. **Trust & Social Proof Section**
   - Light background (subtle green tint)
   - Recent bookings ticker: "Sarah M. from Austin, TX booked an RV Site 2 minutes ago"
   - Trust statistics grid (4 columns on desktop, 2 on mobile):
     * Average rating (4.8★)
     * Total happy campers
     * Cancellation policy highlight
     * Secure booking badge
   - Trust badges row: 🔒 Secure Booking | 💳 Safe Payments | 📞 24/7 Support | ✅ Instant Confirmation

6. **Amenities Grid**
   - Title: "Campground Amenities"
   - Grid layout (4 columns desktop, 2 mobile)
   - Each amenity card:
     * Icon (Wifi, Droplets, Flame, etc. from lucide-react)
     * Amenity name
     * Short description
   - Pull from property.amenities array
   - Default amenities: WiFi, Hot Showers, Fire Pits, Lake Access, Camp Store, Hiking Trails

7. **Photo Gallery**
   - Title: "Experience [Property Name]"
   - Responsive grid (3 columns desktop, 1-2 mobile)
   - Placeholder images with hover effects (scale + overlay)
   - Camera icon on hover
   - Click to open lightbox (future enhancement)

8. **Property Information Section**
   - Two-column layout (desktop) / stacked (mobile)
   - Left column: "About [Property Name]"
     * Full description (property.description or default welcoming text)
   - Right column: "Important Information"
     * Check-in time (formatted from 24hr to 12hr: "3:00 PM")
     * Check-out time
     * Cancellation policy
     * Contact info (phone, email with click-to-call/email)

9. **Call-to-Action Footer Section**
   - Gradient background (green to light green)
   - Centered content
   - Title: "Ready to Book Your Adventure?"
   - Large "Check Availability" button
   - Secondary text: "Questions? Call us at [phone]"

10. **Footer**
    - Property name and address
    - Contact info
    - Links: Privacy Policy | Terms of Service
    - Copyright notice

IMPORTANT TECHNICAL REQUIREMENTS:

1. **TypeScript Types** - Import from existing types file:
```typescript
import type { AvailableSite, SiteType } from "@/lib/booking/types"
```

2. **CheckoutContext Integration** - Use for booking flow:
```typescript
"use client"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useRouter } from "next/navigation"

const { setCheckoutData } = useCheckout()
const router = useRouter()

// When user clicks "Book Now" on a site:
const handleBookSite = (site: AvailableSite, checkIn: Date, checkOut: Date) => {
  setCheckoutData({
    site,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    // ... other data
  })
  router.push('/book/checkout')
}
```

3. **API Integration** - Availability search:
```typescript
// POST /api/booking/search-availability
const searchSites = async () => {
  const response = await fetch('/api/booking/search-availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_id: property.id,
      check_in_date: format(checkInDate, 'yyyy-MM-dd'),
      check_out_date: format(checkOutDate, 'yyyy-MM-dd'),
      num_adults: adults,
      num_children: children,
      site_type: selectedSiteType // optional
    })
  })
  const result = await response.json()
  // result.success, result.sites, result.total_nights
}
```

4. **Time Formatting**:
```typescript
// Convert 24hr time string to 12hr display
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}
```

5. **State Management**:
- Use React useState for UI state (menu open, date selection, search results)
- Use CheckoutContext ONLY for booking flow data (selected site, dates, guest info)
- DO NOT store property data in context (passed as props)

6. **Required Imports**:
```typescript
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import Link from "next/link"
import Image from "next/image"
import {
  Tent, Home, TreePine, MapPin, CalendarIcon, Users,
  Wifi, Droplets, Flame, Waves, Coffee, Mountain,
  Phone, Mail, Clock, Star, Menu, X, Camera
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCheckout } from "@/lib/booking/checkout-context"
import type { AvailableSite, SiteType } from "@/lib/booking/types"
```

7. **Responsive Design Breakpoints**:
- Mobile: < 768px (1 column layouts)
- Tablet: 768px - 1024px (2 column layouts)
- Desktop: > 1024px (3-4 column layouts)

ACCESSIBILITY:
- Semantic HTML (header, nav, section, footer)
- ARIA labels for icons and interactive elements
- Focus visible states on all interactive elements
- Alt text for all images
- Keyboard navigation support

STATE MANAGEMENT EXAMPLE:
```typescript
const [checkInDate, setCheckInDate] = useState<Date>()
const [checkOutDate, setCheckOutDate] = useState<Date>()
const [adults, setAdults] = useState(2)
const [children, setChildren] = useState(0)
const [selectedSiteType, setSelectedSiteType] = useState<SiteType | "">("")
const [isSearching, setIsSearching] = useState(false)
const [searchResults, setSearchResults] = useState<AvailableSite[]>([])
const [showResults, setShowResults] = useState(false)
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
```

ERROR HANDLING:
- Show user-friendly error messages
- Validate dates (check-out must be after check-in)
- Validate guest counts (at least 1 adult)
- Handle API errors gracefully with toast notifications

PERFORMANCE:
- Use Next.js Image component for optimized images
- Lazy load gallery images
- Debounce search if implementing live search
- Memoize expensive calculations

DO NOT INCLUDE:
- Payment processing (separate page)
- Guest info form (separate checkout page)
- Admin features
- CampOS platform branding/theme
- Glassmorphic or neumorphic effects (use clean, standard UI)

MOBILE CONSIDERATIONS:
- Touch-friendly button sizes (min 44x44px)
- Collapsible sections for long content
- Sticky header for easy navigation
- Easy-to-use date pickers
- Swipe-friendly gallery

Create a complete, production-ready React component that can be dropped into the app with minimal modification. Include all necessary TypeScript interfaces, state management, and API integration code.
```

---

## v0 Prompt 2: Checkout Page

**Target File**: `components/guest/checkout-page.tsx`

### v0 Prompt:

```
Create a guest checkout page component for collecting guest information during a campground booking flow.

DESIGN REQUIREMENTS:
- Nature-themed, welcoming design (matching property landing page)
- Clean form layout with clear sections
- Progress indicator showing step 2 of 4
- Mobile-first responsive
- Trust indicators throughout

COMPONENT TYPE: Client Component

TYPESCRIPT INTERFACE (Props):
```typescript
// This component gets data from CheckoutContext
// No props needed - uses context internally
```

PAGE STRUCTURE:

1. **Progress Steps** (Top of page)
   - Step 1: Site Selection ✓ (complete, green checkmark)
   - Step 2: Guest Info → (current, highlighted)
   - Step 3: Payment (upcoming)
   - Step 4: Confirmation (upcoming)
   - Visual: Connected dots/lines, responsive (collapse to numbers on mobile)

2. **Reservation Summary Card** (Sticky sidebar on desktop, top on mobile)
   - Site details from context:
     * Site name and type
     * Site image
     * Dates (check-in to check-out)
     * Number of nights
     * Number of guests
   - Price breakdown:
     * Base price × nights
     * Any additional fees
     * Subtotal
     * Total (bold, large)
   - "Edit" link to go back to search

3. **Guest Information Form** (Main content area)
   - Section title: "Guest Information"
   - Subtitle: "Who will be checking in?"

   Form fields:
   - First Name * (required)
   - Last Name * (required)
   - Email Address * (required, with validation)
   - Phone Number * (required, formatted)
   - Address (optional)
   - City (optional)
   - State (optional, dropdown with US states)
   - Zip Code (optional)
   - Country (optional, defaults to "United States")

   Additional section: "Trip Details"
   - Number of Vehicles (dropdown 0-4)
   - Special Requests (textarea, optional)
   - Emergency Contact Name (optional)
   - Emergency Contact Phone (optional)

4. **Terms & Policies Section**
   - Checkbox: "I agree to the terms and conditions" *
   - Checkbox: "I agree to the cancellation policy" *
   - Links to open modals or pages with full text
   - Property-specific cancellation policy display

5. **Action Buttons**
   - "Back to Site Selection" (secondary, outline)
   - "Continue to Payment" (primary, full width on mobile)
   - Show loading state while processing

IMPORTANT TECHNICAL REQUIREMENTS:

1. **Import Types**:
```typescript
import type { CreateGuestInput, CheckoutData } from "@/lib/booking/types"
```

2. **CheckoutContext Integration**:
```typescript
"use client"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const { checkoutData, setCheckoutData } = useCheckout()
const router = useRouter()

// Validate user came from site selection
useEffect(() => {
  if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate) {
    router.push('/book')
  }
}, [checkoutData, router])
```

3. **Form Validation** (React Hook Form + Zod):
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const guestFormSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  num_vehicles: z.number().min(0).max(4).optional(),
  special_requests: z.string().optional(),
  agree_terms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms"
  }),
  agree_cancellation: z.boolean().refine(val => val === true, {
    message: "You must agree to the cancellation policy"
  })
})

type GuestFormData = z.infer<typeof guestFormSchema>

const form = useForm<GuestFormData>({
  resolver: zodResolver(guestFormSchema),
  defaultValues: {
    // Pre-fill from context if available
    first_name: checkoutData.guestInfo?.first_name || "",
    last_name: checkoutData.guestInfo?.last_name || "",
    email: checkoutData.guestInfo?.email || "",
    // ... etc
  }
})
```

4. **Form Submission**:
```typescript
const onSubmit = async (data: GuestFormData) => {
  try {
    // Save to context
    setCheckoutData({
      guestInfo: {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        country: data.country || "United States",
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
      },
      numVehicles: data.num_vehicles,
      specialRequests: data.special_requests,
    })

    // Navigate to payment
    router.push('/book/payment')
  } catch (error) {
    console.error('Error saving guest info:', error)
    // Show error toast
  }
}
```

5. **Required Imports**:
```typescript
"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { ArrowLeft, Check, Lock, Calendar, Users, MapPin } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCheckout } from "@/lib/booking/checkout-context"
import type { CreateGuestInput } from "@/lib/booking/types"
```

6. **US States Array**:
```typescript
const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California",
  "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  // ... full list
]
```

LAYOUT:
- Desktop: Two-column (form 60%, summary 40%)
- Tablet: Two-column (form 65%, summary 35%)
- Mobile: Single column (summary on top, form below)

ACCESSIBILITY:
- Clear labels for all form fields
- Error messages announced to screen readers
- Keyboard navigation support
- Focus management (first field auto-focused)

ERROR HANDLING:
- Inline validation errors below each field
- Summary of errors at top of form
- Scroll to first error on submit
- Clear error states with red border + icon

TRUST ELEMENTS:
- Lock icon with "Secure checkout" text near submit button
- "Your information is encrypted" message
- "No credit card required yet" reassurance
- Progress indicator showing transparency

Create a complete, production-ready component with full form validation, context integration, and user-friendly error handling.
```

---

## v0 Prompt 3: Payment Page

**Target File**: `components/guest/payment-page.tsx`

### v0 Prompt:

```
Create a guest payment page component for processing campground reservations using Stripe Payment Element.

DESIGN REQUIREMENTS:
- Nature-themed, welcoming design (matching property landing page)
- Clear payment form with trust indicators
- Progress indicator showing step 3 of 4
- Mobile-first responsive
- Stripe-compliant payment UI

COMPONENT TYPE: Client Component

TYPESCRIPT INTERFACE (Props):
```typescript
// Uses CheckoutContext - no props needed
```

PAGE STRUCTURE:

1. **Progress Steps** (Top)
   - Step 1: Site Selection ✓ (complete)
   - Step 2: Guest Info ✓ (complete)
   - Step 3: Payment → (current, highlighted)
   - Step 4: Confirmation (upcoming)

2. **Reservation Summary Card** (Sticky sidebar)
   - Site details (name, type, image)
   - Guest name (from context)
   - Dates and nights
   - Complete price breakdown:
     * Nightly rate × nights
     * Fees itemized
     * Tax (if applicable)
     * **Total to be charged** (bold, large)

3. **Payment Form Section**
   - Section title: "Payment Information"
   - Stripe Payment Element (embedded)
   - Trust badges: Secure SSL | Verified by Visa/Mastercard | PCI Compliant
   - Text: "Your card will be charged [total amount]"

4. **Cancellation Policy Reminder**
   - Brief summary of cancellation policy
   - "Review full policy" link

5. **Action Buttons**
   - "Back to Guest Info" (secondary)
   - "Complete Booking" (primary, large)
   - Loading state: "Processing payment..." with spinner

IMPORTANT TECHNICAL REQUIREMENTS:

1. **Stripe Integration**:
```typescript
"use client"
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useRouter } from "next/navigation"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Main component wraps payment form in Elements provider
export function PaymentPage() {
  const { checkoutData } = useCheckout()
  const router = useRouter()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Validate checkout data
  useEffect(() => {
    if (!checkoutData.site || !checkoutData.guestInfo || !checkoutData.priceBreakdown) {
      router.push('/book')
      return
    }

    // Create payment intent
    const createPaymentIntent = async () => {
      try {
        // First, create the reservation in pending state
        const reservationResponse = await fetch('/api/booking/create-reservation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: checkoutData.site.property_id, // Need to add this to context
            site_id: checkoutData.site.id,
            guest: checkoutData.guestInfo,
            check_in_date: format(checkoutData.checkInDate!, 'yyyy-MM-dd'),
            check_out_date: format(checkoutData.checkOutDate!, 'yyyy-MM-dd'),
            num_adults: checkoutData.numAdults || 2,
            num_children: checkoutData.numChildren || 0,
            num_pets: checkoutData.numPets || 0,
            num_vehicles: checkoutData.numVehicles || 1,
            special_requests: checkoutData.specialRequests,
            source: 'online'
          })
        })

        if (!reservationResponse.ok) {
          throw new Error('Failed to create reservation')
        }

        const { reservation_id } = await reservationResponse.json()

        // Save reservation ID to context
        setCheckoutData({ reservationId: reservation_id })

        // Create payment intent
        const paymentResponse = await fetch('/api/booking/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: reservation_id,
            property_id: checkoutData.site.property_id
          })
        })

        if (!paymentResponse.ok) {
          throw new Error('Failed to create payment intent')
        }

        const { clientSecret } = await paymentResponse.json()
        setClientSecret(clientSecret)
      } catch (err) {
        console.error('Payment setup error:', err)
        setError('Unable to process payment. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    createPaymentIntent()
  }, [checkoutData, router])

  if (isLoading) {
    return <LoadingState />
  }

  if (error || !clientSecret) {
    return <ErrorState message={error} />
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm />
    </Elements>
  )
}
```

2. **Payment Form Component**:
```typescript
function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const { checkoutData, setCheckoutData } = useCheckout()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setPaymentError(null)

    try {
      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required'
      })

      if (stripeError) {
        setPaymentError(stripeError.message || 'Payment failed')
        setIsProcessing(false)
        return
      }

      if (paymentIntent.status === 'succeeded') {
        // Update reservation status to confirmed
        const confirmResponse = await fetch('/api/booking/confirm-reservation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: checkoutData.reservationId,
            payment_intent_id: paymentIntent.id
          })
        })

        if (!confirmResponse.ok) {
          throw new Error('Failed to confirm reservation')
        }

        const { confirmation_number } = await confirmResponse.json()

        // Save to context
        setCheckoutData({
          stripePaymentIntentId: paymentIntent.id,
          confirmationNumber: confirmation_number
        })

        // Redirect to confirmation
        router.push('/book/confirmation')
      }
    } catch (err) {
      console.error('Payment error:', err)
      setPaymentError('Payment processing failed. Please try again.')
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Reservation summary */}
      {/* Payment Element */}
      <PaymentElement />
      {paymentError && (
        <Alert variant="destructive">{paymentError}</Alert>
      )}
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Complete Booking - $${checkoutData.priceBreakdown!.total}`
        )}
      </Button>
    </form>
  )
}
```

3. **Required Imports**:
```typescript
"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { ArrowLeft, Check, Lock, Shield, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useCheckout } from "@/lib/booking/checkout-context"
```

4. **API Routes Needed**:
```typescript
// POST /api/booking/create-reservation
// Request: CreateReservationInput (from types.ts)
// Response: { reservation_id: string, confirmation_number: string }

// POST /api/booking/confirm-reservation
// Request: { reservation_id: string, payment_intent_id: string }
// Response: { success: boolean, confirmation_number: string }
```

LAYOUT:
- Desktop: Two-column (form 60%, summary 40%)
- Mobile: Single column (summary top, form below)

TRUST ELEMENTS:
- SSL/Security badges
- "Money-back guarantee" text
- "Secure payment processing" with lock icon
- Stripe branding (required by Stripe)

ERROR HANDLING:
- Network errors
- Payment declined
- Insufficient funds
- Card validation errors
- Reservation creation failures

LOADING STATES:
- Initial: "Loading payment form..."
- Processing: "Processing payment..." with spinner
- Disable all inputs during processing

Create a complete, production-ready component with full Stripe integration, proper error handling, and security best practices.
```

---

## v0 Prompt 4: Confirmation Page

**Target File**: `components/guest/confirmation-page.tsx`

### v0 Prompt:

```
Create a booking confirmation success page for guests after completing their campground reservation.

DESIGN REQUIREMENTS:
- Nature-themed, celebratory design
- Clear confirmation of successful booking
- All reservation details displayed
- Next steps and important information
- Mobile-first responsive

COMPONENT TYPE: Client Component

TYPESCRIPT INTERFACE (Props):
```typescript
// Uses CheckoutContext - no props needed
```

PAGE STRUCTURE:

1. **Success Hero Section**
   - Large green checkmark icon (animated entrance)
   - Heading: "Booking Confirmed!"
   - Subheading: "Your adventure awaits, [Guest Name]"
   - Confetti animation (optional, subtle)

2. **Confirmation Number**
   - Large, prominent display
   - Format: CAMP-2025-XXXXXX
   - Copy button next to it
   - Success toast when copied

3. **Reservation Summary Card**
   - Property name and location
   - Site details (name, type, photo)
   - Check-in/check-out dates
   - Number of nights
   - Guest count
   - Price breakdown (collapsed, expandable)
   - Total paid

4. **Email Confirmation Notice**
   - Icon: Mail/envelope
   - Text: "Confirmation email sent to [email]"
   - Subtext: "Check your inbox (and spam folder)"

5. **What's Next Section**
   - Timeline or checklist format
   - Items:
     * ✓ Reservation confirmed
     * ✓ Payment processed
     * → Check email for directions
     * → Prepare for check-in at [time]
     * → Contact property if you have questions

6. **Important Information**
   - Check-in time and instructions
   - Check-out time
   - Property contact info (phone, email - clickable)
   - Cancellation policy reminder
   - "Add to Calendar" buttons (Google, iCal)

7. **Action Buttons**
   - "Print Confirmation" (primary)
   - "Add to Calendar" (secondary)
   - "View on Map" (secondary, opens Google Maps)
   - "Contact Property" (outline)

8. **Footer Links**
   - "Book another site" → Back to property page
   - "View my bookings" → Future: guest portal/login

IMPORTANT TECHNICAL REQUIREMENTS:

1. **Context Validation**:
```typescript
"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCheckout } from "@/lib/booking/checkout-context"

const { checkoutData, clearCheckoutData } = useCheckout()
const router = useRouter()

useEffect(() => {
  // Verify user completed payment flow
  if (!checkoutData.confirmationNumber || !checkoutData.reservationId) {
    router.push('/book')
    return
  }

  // Optional: Clear context after delay (so user can refresh page)
  // setTimeout(() => {
  //   clearCheckoutData()
  // }, 60000) // 1 minute
}, [checkoutData, router])
```

2. **Copy to Clipboard**:
```typescript
const [copied, setCopied] = useState(false)

const handleCopy = () => {
  navigator.clipboard.writeText(checkoutData.confirmationNumber!)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
  // Show success toast
}
```

3. **Add to Calendar**:
```typescript
const generateCalendarLink = (type: 'google' | 'ical') => {
  const { site, checkInDate, checkOutDate, guestInfo } = checkoutData
  const title = `Camping at ${site?.name}`
  const location = `${property.name}, ${property.city}, ${property.state}`
  const details = `Confirmation: ${checkoutData.confirmationNumber}`

  if (type === 'google') {
    const start = format(checkInDate!, "yyyyMMdd'T'HHmmss")
    const end = format(checkOutDate!, "yyyyMMdd'T'HHmmss")
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`
  }

  // iCal format (download .ics file)
  // Implementation needed
}
```

4. **Print Functionality**:
```typescript
const handlePrint = () => {
  window.print()
}

// Add print styles
<style jsx global>{`
  @media print {
    .no-print {
      display: none !important;
    }
    .print-only {
      display: block !important;
    }
  }
`}</style>
```

5. **Required Imports**:
```typescript
"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  CheckCircle2, Mail, Calendar, MapPin, Phone, Printer,
  Copy, Check, ArrowRight, ExternalLink, CalendarPlus
} from "lucide-react"
import confetti from "canvas-confetti" // optional
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useToast } from "@/components/ui/use-toast"
```

6. **Confetti Effect (Optional)**:
```typescript
useEffect(() => {
  // Trigger once on mount
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#2D5A27', '#8FBC8F', '#FFFFFF']
  })
}, [])
```

LAYOUT:
- Desktop: Centered content (max-width: 800px)
- Mobile: Full-width with padding

ANIMATIONS:
- Success icon: Scale up + fade in
- Content: Stagger fade-in from top to bottom
- Confetti: Fire once on load (subtle)

ACCESSIBILITY:
- Screen reader announcement: "Booking confirmed"
- Clear hierarchical headings
- All interactive elements keyboard accessible
- Print-friendly layout

SECURITY:
- No sensitive payment info displayed
- Confirmation number is safe to show
- Email partially obscured (optional): j***@example.com

Create a complete, production-ready component with celebration elements, full reservation details, and helpful next steps for the guest.
```

---

## Integration Checklist

### API Routes to Create

1. **`app/api/booking/create-reservation/route.ts`**
```typescript
// POST /api/booking/create-reservation
// Creates a pending reservation (before payment)
import { createReservation } from '@/lib/booking/reservation'
import type { CreateReservationInput } from '@/lib/booking/types'

export async function POST(request: NextRequest) {
  const input: CreateReservationInput = await request.json()
  const result = await createReservation(input)
  return NextResponse.json(result)
}
```

2. **`app/api/booking/confirm-reservation/route.ts`**
```typescript
// POST /api/booking/confirm-reservation
// Confirms reservation after successful payment
import { confirmReservationPayment } from '@/lib/booking/reservation'

export async function POST(request: NextRequest) {
  const { reservation_id, payment_intent_id } = await request.json()
  const result = await confirmReservationPayment(reservation_id, payment_intent_id)
  return NextResponse.json(result)
}
```

3. **`app/api/properties/[id]/route.ts`**
```typescript
// GET /api/properties/[id]
// Public property details for guest-facing pages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data: property, error } = await supabase
    .from('properties')
    .select(`
      id, name, city, state, description,
      tagline: booking_page_tagline,
      hero_image: hero_image_url,
      check_in_time, check_out_time,
      phone, email, cancellation_policy,
      amenities: sites(amenities)
    `)
    .eq('id', id)
    .eq('onboarding_completed', true)
    .single()

  if (error || !property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  return NextResponse.json({ property })
}
```

### File Structure After Integration

```
app/
├── book/
│   ├── [slug]/
│   │   └── page.tsx                 # Server component (fetches property)
│   ├── checkout/
│   │   └── page.tsx                 # Imports CheckoutPage component
│   ├── payment/
│   │   └── page.tsx                 # Imports PaymentPage component
│   ├── confirmation/
│   │   └── page.tsx                 # Imports ConfirmationPage component
│   └── layout.tsx                   # Wraps in CheckoutProvider
├── api/
│   └── booking/
│       ├── search-availability/route.ts      # ✅ Exists
│       ├── create-payment-intent/route.ts    # ✅ Exists
│       ├── create-reservation/route.ts       # ⚠️ CREATE
│       └── confirm-reservation/route.ts      # ⚠️ CREATE
│   └── properties/
│       └── [id]/route.ts                     # ⚠️ CREATE
components/
├── guest/
│   ├── property-booking-portal.tsx  # ⚠️ CREATE from v0 Prompt 1
│   ├── checkout-page.tsx            # ⚠️ CREATE from v0 Prompt 2
│   ├── payment-page.tsx             # ⚠️ CREATE from v0 Prompt 3
│   └── confirmation-page.tsx        # ⚠️ CREATE from v0 Prompt 4
lib/
├── booking/
│   ├── types.ts                     # ✅ Exists - use these types
│   ├── checkout-context.tsx         # ✅ Exists - use this context
│   ├── api.ts                       # ✅ Exists - import functions
│   ├── availability.ts              # ✅ Exists
│   ├── pricing.ts                   # ✅ Exists
│   ├── reservation.ts               # ✅ Exists - may need updates
│   └── guest.ts                     # ✅ Exists
```

### TypeScript Type Alignment Checklist

- [x] All components import types from `@/lib/booking/types`
- [ ] CheckoutContext types match component usage
- [ ] API request/response types match backend expectations
- [ ] Form validation schemas (Zod) match TypeScript types
- [ ] Stripe types properly imported from `@stripe/stripe-js`
- [ ] Date types consistent (Date vs string, ISO format)

### Testing Checklist

**Manual Testing Flow:**
1. Navigate to `/book/property-slug`
2. Select dates, guests, search availability
3. Click "Book Now" on a site
4. Fill out guest information form
5. Submit → navigate to payment
6. Complete Stripe payment (test card: 4242 4242 4242 4242)
7. Confirm payment processes
8. View confirmation page with booking details
9. Verify email sent
10. Check database: reservation exists with status='confirmed'

**Edge Cases:**
- Missing context data (redirect to start)
- Payment declined
- Network errors
- Invalid dates
- Form validation errors

### Environment Variables Needed

```bash
# Already in .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# App configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Columns Verification

Ensure `properties` table has:
- `booking_page_tagline` (TEXT, nullable)
- `hero_image_url` (TEXT, nullable)
- `check_in_time` (TIME, default '15:00:00')
- `check_out_time` (TIME, default '11:00:00')
- `cancellation_policy` (TEXT, nullable)

### URL Routing Configuration

Update `app/api/onboarding/completion-status/route.ts`:
```typescript
// Change booking URL generation
const getBookingUrl = (property: any) => {
  return `${baseUrl}/book/${property.booking_page_slug || property.id.slice(0, 8)}`
}
```

---

## Next Steps After v0 Generation

1. **Generate components in v0:**
   - Copy Prompt 1 → generate property-booking-portal.tsx
   - Copy Prompt 2 → generate checkout-page.tsx
   - Copy Prompt 3 → generate payment-page.tsx
   - Copy Prompt 4 → generate confirmation-page.tsx

2. **Create page wrappers:**
   - `app/book/[slug]/page.tsx` - Server component that fetches property and passes to client component
   - `app/book/checkout/page.tsx` - Imports and renders CheckoutPage
   - `app/book/payment/page.tsx` - Imports and renders PaymentPage
   - `app/book/confirmation/page.tsx` - Imports and renders ConfirmationPage

3. **Create missing API routes:**
   - `/api/booking/create-reservation`
   - `/api/booking/confirm-reservation`
   - `/api/properties/[id]`

4. **Test end-to-end flow:**
   - Complete full booking from search to confirmation
   - Verify all data flows through CheckoutContext correctly
   - Check database for correct reservation records

5. **Polish and refine:**
   - Add loading states
   - Improve error messages
   - Add analytics tracking
   - Test mobile responsiveness
   - Verify accessibility

---

**Ready to implement!** 🚀
