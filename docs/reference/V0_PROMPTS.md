# V0 Prompts for Onboarding Pages

**Quick Reference**: Copy each prompt section below and paste directly into v0.dev

---

## PAGE 1: Property Setup (`/onboarding/property`)

```
Build a Next.js 15 onboarding page for collecting campground property information.

### Requirements:
- Next.js 15 App Router with "use client"
- React Hook Form + Zod validation
- shadcn/ui components (Card, Button, Input, Label, Textarea, Alert, Progress)
- lucide-react icons
- Progress bar showing "Step 1 of 4" at 25%

### Form Fields:
- Property Name* (string, required)
- Description (textarea, optional)
- Address* (string, required)
- City* (string, required)
- State* (2 chars uppercase, required)
- Zip Code* (5+ chars, required)
- Phone* (tel input, 10+ chars, required)
- Contact Email* (email validation, required)

### Layout:
- Gradient background: `bg-gradient-to-br from-background via-background to-muted/20`
- Centered max-w-2xl container
- Hero section with Building2 icon in rounded circle with `bg-primary/10`
- Page title: "Welcome to CampOS!"
- Subtitle: "Let's get your campground set up"
- Form in Card component
- Submit button with ArrowRight icon and loading state (Loader2 spinning)
- Field-level error messages in `text-destructive`
- Alert component for general errors

### API Integration:
```typescript
async function onSubmit(data) {
  const response = await fetch('/api/onboarding/setup-property', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (response.ok) {
    router.push('/onboarding/sites')
  }
}
```

### Validation Schema:
```typescript
const propertySchema = z.object({
  name: z.string().min(1, 'Property name is required'),
  description: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be 2 characters').toUpperCase(),
  zipCode: z.string().min(5, 'Zip code is required'),
  phone: z.string().min(10, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
})
```

### Design:
- Use consistent spacing (space-y-6 for form sections)
- City/State/Zip in responsive grid (grid-cols-3)
- Phone/Email in 2-column grid (grid-cols-2)
- Primary button for submit
- Mobile-responsive (stacks on small screens)
```

---

## PAGE 2: Site Management (`/onboarding/sites`)

```
Build a Next.js 15 onboarding page for adding campsite inventory with a two-column layout.

### Requirements:
- Next.js 15 App Router with "use client"
- React Hook Form + Zod validation
- shadcn/ui components (Card, Button, Input, Label, Textarea, Select, Checkbox, Badge, Alert, Progress)
- lucide-react icons (Tent, Home, TreePine, Sparkles, Circle, MapPin, Plus, Trash2)
- Progress bar showing "Step 2 of 4" at 50%

### Layout:
Two-column grid (grid-cols-1 lg:grid-cols-2):
- **Left Column**: Add Site Form
- **Right Column**: List of Added Sites

### Form Fields (Left):
- Site Name/Number* (string, e.g., "Site A1", "RV Spot 15")
- Site Type* (Select dropdown with icons):
  - tent (Tent icon)
  - rv (Home icon)
  - cabin (TreePine icon)
  - glamping (Sparkles icon)
  - yurt (Circle icon)
  - other (MapPin icon)
- Max Occupancy* (number input, 1-50)
- Nightly Rate (USD)* (number input with "$" prefix, step 0.01)
- Hookups* (3 checkboxes in bordered box):
  - Water
  - Electric (30/50 amp)
  - Sewer
- Description (optional textarea)

### Sites List (Right):
- Empty state: Dashed border box with Tent icon and "No sites added yet"
- Site cards showing:
  - Site type icon in colored circle
  - Site name
  - Type badge (outline variant, capitalized)
  - Max occupancy + nightly rate
  - Hookups summary (e.g., "Water, Electric" or "None")
  - Delete button (Trash2 icon, ghost variant)
- Continue button at bottom (only shown when ≥1 site added)
  - Text: "Continue to Payment Setup"
  - ArrowRight icon
  - Full width, large size
  - Small helper text: "You can add more sites later in your dashboard"

### API Integration:
```typescript
async function onAddSite(data) {
  const nightlyRateCents = Math.round(parseFloat(data.nightlyRate) * 100)

  const response = await fetch('/api/onboarding/add-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      nightly_rate: nightlyRateCents,
    }),
  })

  if (response.ok) {
    const result = await response.json()
    setAddedSites([...addedSites, { ...data, id: result.siteId }])
    reset() // Clear form
  }
}

function handleContinue() {
  router.push('/onboarding/stripe-connect')
}
```

### State:
- addedSites array (AddedSite[])
- hookups state object: { water: boolean, electric: boolean, sewer: boolean }
- submitting boolean
- error string | null

### Helper Functions:
```typescript
function getSiteIcon(type: SiteType) {
  const icons = { tent: Tent, rv: Home, cabin: TreePine, glamping: Sparkles, yurt: Circle, other: MapPin }
  return icons[type] || MapPin
}

function getHookupsSummary(hookups) {
  const active = []
  if (hookups.water) active.push('Water')
  if (hookups.electric) active.push('Electric')
  if (hookups.sewer) active.push('Sewer')
  return active.length > 0 ? active.join(', ') : 'None'
}
```

### Design:
- Gradient background: `bg-gradient-to-br from-background via-background to-muted/20`
- Centered max-w-6xl container
- Hero with Tent icon
- Hookups in bordered box with rounded corners
- Site cards with hover effect: `hover:bg-accent/50`
- Mobile-responsive: two columns stack on small screens
```

---

## PAGE 3: Stripe Connect (`/onboarding/stripe-connect`)

```
Build a Next.js 15 onboarding page for connecting Stripe payment processing via OAuth.

### Requirements:
- Next.js 15 App Router with "use client"
- shadcn/ui components (Card, Button, Alert, Progress, Separator)
- lucide-react icons (CreditCard, CheckCircle2, AlertCircle, Loader2)
- Progress bar showing "Step 3 of 4" at 75%

### Layout:
- Gradient background: `bg-gradient-to-br from-background via-background to-muted/20`
- Centered max-w-2xl container
- Hero section with CreditCard icon in rounded circle
- Page title: "Connect Payment Processing"
- Subtitle: "One click to start accepting payments"

### Card Content:
**Title**: "Stripe Payment Processing"
**Description**: "Securely accept credit cards, debit cards, and digital wallets"

**Benefits List** (3 items with green checkmark icons):
1. ✓ Secure & Trusted
   - Powered by Stripe - trusted by millions of businesses worldwide
2. ✓ Fast Payouts
   - Receive funds directly to your bank account in 2-3 business days
3. ✓ No Hidden Fees
   - Simple pricing: 2.9% + $0.30 per transaction

**Separator**

**Connect Button**:
- Full width, large size, primary variant
- Text: "Connect with Stripe" with CreditCard icon
- Loading state: "Connecting to Stripe..." with Loader2 spinning
- Helper text below: "You'll be redirected to Stripe to complete the connection"

**Help Text** (below card):
"Don't have a Stripe account? [Create one for free](https://stripe.com)" (external link)

### API Integration:
```typescript
async function handleStripeConnect() {
  setConnecting(true)

  const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID
  const redirectUri = `${window.location.origin}/api/stripe/connect/authorize`
  const state = generateRandomState() // CSRF protection

  const stripeUrl =
    `https://connect.stripe.com/oauth/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `scope=read_write&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}`

  sessionStorage.setItem('stripe_oauth_state', state)
  window.location.href = stripeUrl
}

function generateRandomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

### State:
- connecting boolean
- error string | null

### Design:
- Benefits with green circular icons (bg-green-500/10, text-green-600)
- Large primary button for Stripe connect
- Clean, minimal design focused on trust and simplicity
```

---

## PAGE 4: Completion (`/onboarding/complete`)

```
Build a Next.js 15 onboarding completion page showing success checklist and next steps.

### Requirements:
- Next.js 15 App Router with "use client"
- shadcn/ui components (Card, Button, Input, Progress)
- lucide-react icons (Building2, Tent, DollarSign, CreditCard, CheckCircle2, Copy, ArrowRight, Loader2)
- Progress bar showing "Step 4 of 4" at 100%
- Fetch data from `/api/onboarding/completion-status` on mount

### Layout:
- Gradient background: `bg-gradient-to-br from-background via-background to-muted/20`
- Centered max-w-3xl container

### Hero Section:
- Large green checkmark icon in rounded circle (bg-green-100 dark:bg-green-900/20)
- Page title: "🎉 Your Campground is Live!"
- Subtitle: "Congratulations! {propertyName} is ready to accept bookings"
- Progress showing "Complete!" in green

### Completion Checklist Card:
4 green items with checkmark icons:
1. ✓ Property Information
   - {propertyName} • {city}, {state}
2. ✓ Sites Added
   - {totalSites} sites ({siteBreakdown})
3. ✓ Pricing Configured
   - All sites have nightly rates set
4. ✓ Payment Processing
   - Stripe connected and ready

Each item in green bordered box (bg-green-50 border-green-200)

### Next Steps Card:
**Title**: "What's Next?"

**3 numbered steps**:

**Step 1: Share Your Booking Page**
- Copyable URL input (monospace font, muted background, readonly)
- Copy button with Copy icon
- "✓ Copied to clipboard!" success message (temporary)

**Step 2: Create a Test Booking**
- Description: "Walk through the booking flow to see how your guests will experience it"
- Button: "Try Test Booking →" (outline variant, opens booking page in new tab)

**Step 3: Explore Your Dashboard**
- Description: "Manage reservations, view payments, and track your property performance"
- Button: "Go to Dashboard →" (primary variant, navigates to /dashboard)

### Help & Resources (footer):
- "Need help getting started?"
- Two outline buttons:
  - "View Documentation" (opens /docs)
  - "Contact Support" (mailto link)

### API Integration:
```typescript
useEffect(() => {
  async function fetchData() {
    const response = await fetch('/api/onboarding/completion-status')
    const data = await response.json()
    setCompletionData(data)
  }
  fetchData()
}, [])

async function handleCopyUrl() {
  await navigator.clipboard.writeText(bookingPageUrl)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

function handleTestBooking() {
  window.open(bookingPageUrl, '_blank')
}
```

### Types:
```typescript
interface CompletionData {
  propertyName: string
  city: string
  state: string
  totalSites: number
  siteBreakdown: string // e.g. "10 RV, 5 Tent, 2 Cabins"
  stripeConnected: boolean
  bookingPageUrl: string
}
```

### Design:
- Green success theme throughout
- Numbered steps in primary-colored circles
- All action buttons clearly labeled
- Booking URL in monospace font with muted background
- Celebratory tone with emoji in title
```

---

## General Design System for All Pages

### Colors:
- Primary: `bg-primary`, `text-primary-foreground`
- Background gradient: `bg-gradient-to-br from-background via-background to-muted/20`
- Cards: `bg-card/50` with `border-border`
- Success: `bg-green-500/10`, `text-green-600`, `border-green-500/20`
- Destructive: `bg-destructive`, `text-destructive-foreground`

### Typography:
- Page titles: `text-3xl font-heading font-bold`
- Card titles: Use `<CardTitle>` component
- Descriptions: `text-muted-foreground`
- Small text: `text-sm` or `text-xs`

### Spacing:
- Form sections: `space-y-6`
- Form fields: `space-y-2`
- Card content: Standard padding from CardContent

### Buttons:
- Primary actions: Default Button variant
- Secondary actions: `variant="outline"`
- Destructive: `variant="destructive"`
- Ghost: `variant="ghost"`
- Loading state: Loader2 icon with `animate-spin`

### Icons:
All from lucide-react, sized at `h-4 w-4` for inline, `h-8 w-8` for headers

### Mobile:
All pages responsive, grids stack on small screens (`grid-cols-1 lg:grid-cols-2`)
