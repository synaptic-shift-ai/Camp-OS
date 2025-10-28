# v0 Prompts for Guest Booking Pages

This file contains detailed prompts to use with v0.dev to generate the guest-facing booking pages.

## Prerequisites

Before prompting v0, make sure to:
1. Share the `lib/booking/types.ts` file with v0 for type definitions
2. Mention that the project uses Shadcn/UI components
3. Provide a screenshot of the existing landing page for design consistency

---

## Page 1: Booking Search Page (`/book`)

### v0 Prompt

```
Create a campground booking search page with the following requirements:

**Design System:**
- Use Shadcn/UI components (Card, Button, Input, Calendar, Select)
- TailwindCSS styling with glassmorphic design elements
- Match the existing site design with relevant adaptations for outdoor hospitality
-dark/ligh mode toggle
- Responsive layout (mobile-first)

**Page Structure:**

1. **Hero Section:**
   - Heading: "Find Your Perfect Campsite"
   - Subheading: "Search available sites for your next outdoor adventure"
   - Background: Subtle gradient with glassmorphic card overlay

2. **Search Form (Main Card):**
   - Property selector (Dropdown/Select)
     - Label: "Campground"
     - Placeholder: "Select a campground"
     - Options will be loaded dynamically
   - Date range picker (Two calendar inputs side by side)
     - Check-in date
     - Check-out date
     - Display number of nights calculated automatically
   - Number of guests (Number input with +/- buttons)
     - Label: "Number of Guests"
     - Min: 1, Max: 20
     - Default: 2
   - Site type filter (Optional - Checkbox group)
     - RV Sites
     - Tent Sites
     - Cabins
     - Glamping
   - Amenities filter (Optional - Expandable section with checkboxes)
     - Electric hookup
     - Water hookup
     - Sewer hookup
     - WiFi
     - Pet-friendly
     - Fire pit
   - Search button
     - Text: "Search Available Sites"
     - Primary styling (red gradient)
     - Icon: Search icon

3. **Search Results Section:**
   - Displayed after search is performed
   - Grid layout of site cards (3 columns on desktop, 1 on mobile)
   - Each site card shows:
     - Site image (placeholder if none)
     - Site name and number (e.g., "Pine Ridge RV Site #12")
     - Site type badge (colored)
     - Max occupancy with person icon
     - Amenities icons (electric, water, wifi, etc.)
     - Price per night (large, prominent)
     - Total price for stay (calculated)
     - "Book Now" button
   - If no results: Display friendly message with illustration
   - Loading state: Skeleton loaders while searching

**State Management:**
- Form state for search inputs
- Search results state
- Loading state
- Error state (if search fails)

**TypeScript Types:**
Import from `@/lib/booking/types`:
- AvailabilitySearchParams
- AvailabilitySearchResult
- AvailableSite
- SiteType
- SiteAmenities

**API Integration:**
Import function from `@/lib/booking/api`:
- searchAvailableSites(params) - Call this when search button is clicked

**Validation:**
- Check-in date must be today or future
- Check-out date must be after check-in
- At least 1 guest required
- Show validation errors inline

**Additional Features:**
- Smooth scrolling to results after search
- Responsive design (mobile, tablet, desktop)
- Accessible (keyboard navigation, ARIA labels)
- Framer Motion animations for card reveals

Generate the complete React component with TypeScript.
```

---

## Page 2: Site Details & Booking Form (`/book/[siteId]`)

### v0 Prompt

```
Create a campground site details and booking page with the following requirements:

**Design System:**
- Use Shadcn/UI components (Card, Button, Input, Calendar, Tabs, Badge)
- TailwindCSS with glassmorphic design
- Using same theme from booking page
- Responsive layout

**Page Structure:**

1. **Breadcrumb Navigation:**
   - "Home > Book > [Site Name]"
   - Clickable links

2. **Site Details Section (Left Column - 60% width on desktop):**
   - Site image gallery (main image + thumbnails)
     - Placeholder if no images
     - Click to enlarge
   - Site name and number (Large heading)
   - Site type badge (RV/Tent/Cabin/Glamping with icon)
   - Max occupancy badge with person icon
   - Base price per night (Prominent display)
   - Tabs for details:
     - **Overview Tab:**
       - Description (text)
       - Amenities grid (icons with labels)
       - Max occupancy details
     - **Location Tab:**
       - Site number on campground map (future: embed map)
       - Nearby facilities
     - **Policies Tab:**
       - Check-in/out times
       - Cancellation policy
       - Pet policy
       - Quiet hours

3. **Booking Form (Right Column - 40% width on desktop, sticky):**
   - Card with glassmorphic styling
   - Heading: "Book This Site"
   - Date range picker
     - Check-in date
     - Check-out date
     - Display "X nights" below
   - Number of guests (Number input)
   - Price breakdown section:
     - Base rate: $XX.XX × Y nights = $XXX.XX
     - Subtotal: $XXX.XX
     - Total: $XXX.XX (bold, large)
   - "Continue to Guest Info" button (primary, full width)
   - Note below button: "You won't be charged yet"

4. **Similar Sites Section (Bottom):**
   - Heading: "Other Available Sites"
   - Horizontal scrollable cards (3-4 visible)
   - Each card shows similar sites at this property
   - "View Details" button on each

**State Management:**
- Site data (fetched by siteId)
- Selected dates
- Number of guests
- Price calculation (updates in real-time)
- Loading states
- Error handling

**TypeScript Types:**
Import from `@/lib/booking/types`:
- Site
- PriceBreakdown
- AvailableSite

**API Integration:**
Import from `@/lib/booking/api`:
- checkSiteAvailability(siteId, checkIn, checkOut)
- calculateReservationPrice(siteId, checkIn, checkOut, guests)

**Validation:**
- Dates must be valid range
- Must check availability before showing booking form
- Show "Site unavailable for these dates" if occupied
- Update pricing in real-time as dates/guests change

**URL Parameters:**
- siteId from URL (Next.js dynamic route)
- Optional: checkIn, checkOut, guests from query params (pre-fill if coming from search)

**Additional Features:**
- Sticky booking form on desktop
- Mobile: booking form at bottom of page
- Share button (copy link to site)
- Save/favorite button (future)
- Framer Motion animations
- Accessible (keyboard, screen readers)

Generate the complete Next.js page component with TypeScript.
```

---

## Page 3: Guest Information Form (`/book/checkout`)

### v0 Prompt

```
Create a guest checkout page for campground booking with the following requirements:

**Design System:**
- Use Shadcn/UI components (Card, Button, Input, Form, Label, Select)
- TailwindCSS with glassmorphic design
- Dark theme with red accents
- Responsive layout

**Page Structure:**

1. **Progress Indicator (Top):**
   - Steps: Site Selection → Guest Info → Payment → Confirmation
   - Current step highlighted (Guest Info)
   - Previous steps show checkmarks
   - Clean, minimal design

2. **Two Column Layout:**

   **Left Column (60% on desktop):**

   **Reservation Summary Card:**
   - Heading: "Review Your Reservation"
   - Site details:
     - Site name and number
     - Site type badge
     - Check-in/out dates (formatted nicely)
     - Number of nights
     - Number of guests
   - Pricing breakdown:
     - Nightly rate × nights
     - Subtotal
     - Total (bold)
   - "Edit" button to go back

   **Guest Information Form:**
   - Heading: "Guest Information"
   - Form fields:
     - First Name (required)
     - Last Name (required)
     - Email (required, email validation)
     - Phone (required, format: (XXX) XXX-XXXX)
     - Address Line 1
     - Address Line 2 (optional)
     - City
     - State/Province (Select dropdown with US states)
     - ZIP/Postal Code
     - Country (Select dropdown, default: United States)
   - Special Requests (Textarea)
     - Placeholder: "Any special requests or needs? (early check-in, accessible site, etc.)"
     - Optional
   - Email preferences (Checkbox)
     - "Send me updates and offers from [Property Name]"

   **Right Column (40% on desktop, sticky):**

   **Order Summary Card:**
   - Heading: "Order Summary"
   - Site info (compact)
   - Dates and guests
   - Price breakdown
   - Total (large, prominent)
   - "Continue to Payment" button (primary, full width)
   - "Back" button (secondary, full width)
   - Lock icon with text: "Secure checkout"

**State Management:**
- Form state (controlled inputs)
- Form validation
- Guest data
- Reservation data (from context or props)
- Loading state
- Error handling

**TypeScript Types:**
Import from `@/lib/booking/types`:
- CreateGuestInput
- Reservation
- PriceBreakdown

**Form Validation:**
- Use react-hook-form with Zod schema
- Real-time validation on blur
- Show errors inline below fields
- Disable submit until form is valid

**API Integration:**
- This page prepares data, actual creation happens on payment page
- Store guest info in context or state management

**Accessibility:**
- Proper form labels
- Error messages linked to inputs
- Keyboard navigation
- ARIA attributes
- Focus management

**Mobile Considerations:**
- Single column layout on mobile
- Order summary collapses to expandable section
- Form fields stack vertically
- Large touch targets

**Additional Features:**
- Auto-format phone number as user types
- State/Country dropdowns with search
- Save progress to localStorage (recover if page reloads)
- Framer Motion animations for page transition

Generate the complete Next.js page component with TypeScript and form validation.
```

---

## Page 4: Payment Page (`/book/payment`)

### v0 Prompt

```
Create a payment checkout page for campground booking with Stripe integration:

**Design System:**
- Shadcn/UI components (Card, Button)
- TailwindCSS with glassmorphic design
- Dark theme with red accents
- Responsive layout

**Page Structure:**

1. **Progress Indicator:**
   - Steps: Site Selection → Guest Info → **Payment** → Confirmation
   - Payment step highlighted

2. **Two Column Layout:**

   **Left Column (60%):**

   **Payment Method Card:**
   - Heading: "Payment Information"
   - Stripe Elements integration:
     - Card number field
     - Expiration date
     - CVC
     - Styled to match dark theme
   - Billing address checkbox:
     - "Billing address same as guest address" (checked by default)
     - If unchecked, show separate billing address fields
   - Security badges:
     - "Secured by Stripe" badge
     - Lock icon
     - "Your payment information is encrypted"
   - Terms acceptance (Checkbox, required):
     - "I agree to the cancellation policy and terms of service"
     - Links to policies

   **Right Column (40%, sticky):**

   **Final Order Summary:**
   - Site details
   - Guest name
   - Dates
   - Price breakdown
   - **Total amount (very prominent)**
   - "Complete Booking" button
     - Large, primary styling
     - Loading state (spinner + "Processing...")
     - Disabled until form valid
   - "Back" button

**State Management:**
- Stripe Elements state
- Form validation
- Payment processing state
- Error state (payment failed)
- Reservation data

**TypeScript Types:**
Import from `@/lib/booking/types`:
- CreateReservationInput
- Reservation

**Payment Flow:**
1. User enters card details
2. On submit:
   - Show loading state
   - Create payment intent via Stripe
   - Call createReservation() API
   - If success: redirect to confirmation page
   - If error: show error message, allow retry

**API Integration:**
Import from `@/lib/booking/api`:
- createReservation(input) - Call when payment succeeds

**Error Handling:**
- Stripe validation errors (invalid card, etc.)
- API errors (site no longer available, etc.)
- Network errors
- Show user-friendly error messages
- Allow retry without re-entering all info

**Security:**
- Never store card details
- All sensitive data handled by Stripe
- HTTPS only
- CSP headers
- PCI compliance via Stripe

**Additional Features:**
- Loading overlay during payment processing
- Success animation before redirect
- Disable back button during processing
- Prevent double-submission
- Test mode indicator (if in test mode)

**Mobile:**
- Single column layout
- Sticky "Complete Booking" button at bottom
- Stripe Elements optimized for mobile

Generate the complete Next.js page component with Stripe Elements integration (use @stripe/stripe-js and @stripe/react-stripe-js).
```

---

## Page 5: Confirmation Page (`/book/confirmation/[confirmationNumber]`)

### v0 Prompt

```
Create a booking confirmation page for successful campground reservations:

**Design System:**
- Shadcn/UI components (Card, Button, Badge)
- TailwindCSS with glassmorphic design
- Dark theme with red accents
- Celebration/success theme

**Page Structure:**

1. **Success Hero Section:**
   - Large checkmark icon (animated, green)
   - Heading: "Booking Confirmed!"
   - Subheading: "Your campsite is reserved"
   - Confetti animation (subtle)

2. **Confirmation Details Card (Center, max-width):**
   - Confirmation number (very prominent, large font)
     - Format: CAMP-2025-ABC123
     - Copy button next to it
   - Success message:
     - "We've sent a confirmation email to [email]"
     - Email icon
   - Reservation details:
     - Site name and number (with small image)
     - Check-in date (formatted: "Monday, June 1, 2025 at 2:00 PM")
     - Check-out date (formatted: "Friday, June 5, 2025 at 11:00 AM")
     - Number of nights badge
     - Number of guests badge
   - Guest information:
     - Name
     - Email
     - Phone
   - Pricing summary:
     - Breakdown
     - Total paid (green badge)

3. **Action Buttons (Centered):**
   - "View Reservation Details" (primary button)
     - Links to reservation lookup page
   - "Add to Calendar" (secondary button)
     - Downloads .ics file
   - "Print Confirmation" (secondary button)
     - Opens print dialog with clean format

4. **What's Next Section:**
   - Card with helpful information:
     - "Before You Arrive" heading
     - Checklist of things to bring/know:
       - Check-in location and time
       - What to bring (confirmation number)
       - Campground policies
       - Contact information
     - "Need to make changes?" link
       - Links to contact/support

5. **Similar Properties Section (Optional):**
   - "Plan Your Next Trip" heading
   - Carousel of other properties
   - Each shows image + name + "Browse Sites" button

**State Management:**
- Fetch reservation by confirmation number
- Loading state
- Error state (confirmation not found)

**TypeScript Types:**
Import from `@/lib/booking/types`:
- Reservation
- Site
- Guest
- Payment

**API Integration:**
Import from `@/lib/booking/api`:
- getReservationByConfirmation(confirmationNumber)

**URL Parameters:**
- confirmationNumber from URL (dynamic route)

**Additional Features:**
- Print-optimized CSS (hide nav, buttons, etc.)
- Calendar download (.ics file generation)
- Social sharing buttons (optional)
- Success animation on page load
- Confetti effect (subtle, short duration)
- Prevent browser back button (or show warning)

**Error Handling:**
- If confirmation not found: Show 404-style message
- Suggest checking email for confirmation number
- Contact support link

**Email Confirmation:**
- Note that this page doesn't send email
- Email is sent by backend when reservation created
- Just inform user it's been sent

**Mobile:**
- Responsive layout
- All cards stack vertically
- Touch-friendly buttons
- Easy to screenshot for saving

Generate the complete Next.js page component with TypeScript.
```

---

## Implementation Notes for v0

When using these prompts with v0:

1. **Share Context Files:**
   - Upload `lib/booking/types.ts` so v0 knows the type definitions
   - Share a screenshot of your existing landing page for design consistency
   - Mention you're using Next.js 15 App Router

2. **Iterative Refinement:**
   - Start with the basic structure
   - Ask v0 to refine specific sections
   - Request mobile responsiveness improvements
   - Add animations/polish in later iterations

3. **Component Extraction:**
   - Ask v0 to extract reusable components:
     - DateRangePicker
     - PriceBreakdown
     - SiteCard
     - ProgressStepper
   - Place these in `components/booking/`

4. **Integration Points:**
   - v0 will create the UI/UX
   - You'll need to wire up the API calls from `lib/booking/api.ts`
   - I'll implement the actual API functions with Supabase

5. **Styling Consistency:**
   - All pages should use the same glassmorphic card styling
   - Red accent color for primary actions
   - Dark theme throughout
   - Match existing landing page design

---

## Questions to Ask v0

If v0's output needs refinement:

- "Make the booking form sticky on desktop"
- "Add loading skeleton for the site cards"
- "Improve mobile layout for the payment page"
- "Add Framer Motion animations for card reveals"
- "Make the confirmation page more celebratory"
- "Add form validation with better error messages"
