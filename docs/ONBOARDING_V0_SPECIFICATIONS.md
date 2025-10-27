# Campground Onboarding Workflow - V0-Ready Page Specifications

**Last Updated**: 2025-01-27
**Purpose**: Complete rebuild of onboarding flow with detailed specifications for v0.dev code generation
**Status**: Ready for implementation

---

## Overview

This document contains comprehensive specifications for rebuilding the campground onboarding workflow. Each page includes design patterns, TypeScript types, validation schemas, and API integration details that can be directly used with v0.dev for code generation.

### Onboarding Flow
1. **Property Setup** → `/onboarding/property` - Collect campground information
2. **Site Management** → `/onboarding/sites` - Add inventory (sites/RV spots/cabins)
3. **Stripe Connect** → `/onboarding/stripe-connect` - Payment processing setup
4. **Completion** → `/onboarding/complete` - Success checklist and next steps

### Completion Criteria
- ✅ Property information filled out
- ✅ At least one site created with full details (including hookups)
- ✅ Stripe payment processing configured (OAuth)
- ✅ Pricing configured for all sites

---

## Design System Reference

### Colors & Theme
Uses shadcn/ui theming with HSL CSS variables:
- **Primary**: `bg-primary`, `text-primary`, `text-primary-foreground`
- **Background**: Subtle gradient `bg-gradient-to-br from-background via-background to-muted/20`
- **Cards**: `bg-card/50` with `border-border`
- **Text**: `text-foreground`, `text-muted-foreground`
- **Success**: `bg-green-500/10`, `text-green-600`, `border-green-500/20`
- **Destructive**: `bg-destructive`, `text-destructive`, `text-destructive-foreground`

### Typography
- **Headings**: `font-heading` class
- **Body**: `font-sans` class
- **Page titles**: `text-3xl font-heading font-bold`
- **Card titles**: `CardTitle` component
- **Descriptions**: `text-muted-foreground`

### Components Available
All shadcn/ui components:
- Layout: Card, CardHeader, CardContent, CardTitle, CardDescription, Separator
- Forms: Button, Input, Label, Select, Checkbox, Textarea
- Feedback: Alert, AlertDescription, Badge, Progress
- Overlays: Sheet, Dropdown Menu, Popover
- Display: Avatar, Tabs, Table

### Icons
**Library**: lucide-react

**Common Icons**:
- Property: Building2, Home, MapPin
- Sites: Tent, TreePine, Circle (yurt), Sparkles (glamping)
- Actions: Plus, Trash2, Edit, Copy, ArrowRight
- Status: CheckCircle2, AlertCircle, Loader2
- Payment: CreditCard, DollarSign

---

## PAGE 1: Property Setup
**File**: `app/onboarding/property/page.tsx`

### Purpose
First step in onboarding - collect campground property information

### Route
`/onboarding/property`

### Component Imports
```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Building2, AlertCircle, Loader2, ArrowRight } from "lucide-react"
```

### TypeScript Types
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

type PropertyFormData = z.infer<typeof propertySchema>
```

### Layout Structure
```tsx
<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12 px-4">
  <div className="max-w-2xl mx-auto">
    {/* Header */}
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-heading font-bold mb-2">Welcome to CampOS!</h1>
      <p className="text-muted-foreground">Let's get your campground set up</p>
    </div>

    {/* Progress Indicator */}
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Step 1 of 4</span>
        <span className="text-sm text-muted-foreground">Property Information</span>
      </div>
      <Progress value={25} className="h-2" />
    </div>

    {/* Form Card */}
    <Card>
      <CardHeader>
        <CardTitle>Property Information</CardTitle>
        <CardDescription>
          Tell us about your campground
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Property Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Property Name *</Label>
            <Input
              id="name"
              placeholder="Pine Valley Campground"
              {...register('name')}
              disabled={submitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="A beautiful campground nestled in the mountains..."
              rows={3}
              {...register('description')}
              disabled={submitting}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              placeholder="123 Mountain Road"
              {...register('address')}
              disabled={submitting}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          {/* City, State, Zip */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="Asheville"
                {...register('city')}
                disabled={submitting}
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="NC"
                maxLength={2}
                {...register('state')}
                disabled={submitting}
              />
              {errors.state && (
                <p className="text-sm text-destructive">{errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zipCode">Zip Code *</Label>
            <Input
              id="zipCode"
              placeholder="28801"
              {...register('zipCode')}
              disabled={submitting}
            />
            {errors.zipCode && (
              <p className="text-sm text-destructive">{errors.zipCode.message}</p>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                {...register('phone')}
                disabled={submitting}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Contact Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@yourproperty.com"
                {...register('email')}
                disabled={submitting}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={submitting} className="min-w-32">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</div>
```

### API Integration
```typescript
async function onSubmit(data: PropertyFormData) {
  setSubmitting(true)
  setError(null)

  try {
    const response = await fetch('/api/onboarding/setup-property', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to set up property')
    }

    // Success - redirect to sites page
    router.push('/onboarding/sites')
  } catch (err) {
    console.error('Property setup error:', err)
    setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    setSubmitting(false)
  }
}
```

### State Management
```typescript
const router = useRouter()
const [submitting, setSubmitting] = useState(false)
const [error, setError] = useState<string | null>(null)

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<PropertyFormData>({
  resolver: zodResolver(propertySchema),
})
```

### Success Criteria
- All required fields validated
- Property created in database
- User redirected to `/onboarding/sites`

---

## PAGE 2: Site Management
**File**: `app/onboarding/sites/page.tsx`

### Purpose
Add campsites/RV spots/cabins to property inventory

### Route
`/onboarding/sites`

### Component Imports
```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Tent, Home, TreePine, Sparkles, Circle, MapPin,
  Plus, Trash2, AlertCircle, Loader2, ArrowRight
} from "lucide-react"
```

### TypeScript Types
```typescript
import type { SiteType } from '@/lib/booking/types'

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  type: z.enum(['tent', 'rv', 'cabin', 'glamping', 'yurt', 'other'], {
    required_error: 'Site type is required',
  }),
  maxOccupancy: z.number().min(1).max(50),
  nightlyRate: z.string().min(1, 'Nightly rate is required'),
  hookups: z.object({
    water: z.boolean(),
    electric: z.boolean(),
    sewer: z.boolean(),
  }),
  description: z.string().optional(),
})

type SiteFormData = z.infer<typeof siteSchema>

interface AddedSite extends SiteFormData {
  id: string
}
```

### Layout Structure
```tsx
<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12 px-4">
  <div className="max-w-6xl mx-auto">
    {/* Header */}
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
        <Tent className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-heading font-bold mb-2">Add Your Sites</h1>
      <p className="text-muted-foreground">Build your campsite inventory</p>
    </div>

    {/* Progress Indicator */}
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Step 2 of 4</span>
        <span className="text-sm text-muted-foreground">Site Setup</span>
      </div>
      <Progress value={50} className="h-2" />
    </div>

    {/* Two Column Layout */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT COLUMN: Add Site Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add a Site</CardTitle>
          <CardDescription>
            Add campsites, RV spots, cabins, or other accommodations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onAddSite)} className="space-y-4">
            {/* Site Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Site Name / Number *</Label>
              <Input
                id="name"
                placeholder="Site A1, RV Spot 15, Cabin Oak"
                {...register('name')}
                disabled={submitting}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Site Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Site Type *</Label>
              <Select
                value={siteType}
                onValueChange={(value) => setValue('type', value as SiteType)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select site type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tent">
                    <div className="flex items-center gap-2">
                      <Tent className="h-4 w-4" />
                      <span>Tent Site</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rv">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      <span>RV Site</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cabin">
                    <div className="flex items-center gap-2">
                      <TreePine className="h-4 w-4" />
                      <span>Cabin</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="glamping">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span>Glamping</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="yurt">
                    <div className="flex items-center gap-2">
                      <Circle className="h-4 w-4" />
                      <span>Yurt</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>Other</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            {/* Max Occupancy */}
            <div className="space-y-2">
              <Label htmlFor="maxOccupancy">Max Occupancy *</Label>
              <Input
                id="maxOccupancy"
                type="number"
                min="1"
                max="50"
                {...register('maxOccupancy', { valueAsNumber: true })}
                disabled={submitting}
              />
              {errors.maxOccupancy && (
                <p className="text-sm text-destructive">{errors.maxOccupancy.message}</p>
              )}
            </div>

            {/* Nightly Rate */}
            <div className="space-y-2">
              <Label htmlFor="nightlyRate">Nightly Rate (USD) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="nightlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50.00"
                  className="pl-7"
                  {...register('nightlyRate')}
                  disabled={submitting}
                />
              </div>
              {errors.nightlyRate && (
                <p className="text-sm text-destructive">{errors.nightlyRate.message}</p>
              )}
            </div>

            {/* Hookups */}
            <div className="space-y-3">
              <Label>Hookups *</Label>
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="water"
                    checked={hookups.water}
                    onCheckedChange={(checked) =>
                      setHookups({ ...hookups, water: !!checked })
                    }
                    disabled={submitting}
                  />
                  <Label htmlFor="water" className="font-normal cursor-pointer">
                    Water
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="electric"
                    checked={hookups.electric}
                    onCheckedChange={(checked) =>
                      setHookups({ ...hookups, electric: !!checked })
                    }
                    disabled={submitting}
                  />
                  <Label htmlFor="electric" className="font-normal cursor-pointer">
                    Electric (30/50 amp)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sewer"
                    checked={hookups.sewer}
                    onCheckedChange={(checked) =>
                      setHookups({ ...hookups, sewer: !!checked })
                    }
                    disabled={submitting}
                  />
                  <Label htmlFor="sewer" className="font-normal cursor-pointer">
                    Sewer
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Select all that apply (or none if no hookups)
              </p>
            </div>

            {/* Description (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Shaded site with picnic table and fire pit..."
                rows={3}
                {...register('description')}
                disabled={submitting}
              />
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Add Site Button */}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Site...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Site
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RIGHT COLUMN: Added Sites List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Sites ({addedSites.length})</CardTitle>
              <CardDescription>Sites added to your property</CardDescription>
            </div>
            {addedSites.length > 0 && (
              <Badge variant="secondary">{addedSites.length} sites</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {addedSites.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
              <Tent className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No sites added yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first site to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {addedSites.map((site) => {
                const Icon = getSiteIcon(site.type)
                return (
                  <div
                    key={site.id}
                    className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{site.name}</h4>
                            <Badge variant="outline" className="text-xs capitalize">
                              {site.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Max {site.maxOccupancy} guests • ${site.nightlyRate}/night</p>
                            <p className="text-xs">
                              Hookups: {getHookupsSummary(site.hookups)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSite(site.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Continue Button */}
          {addedSites.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border space-y-3">
              <Button
                onClick={handleContinue}
                className="w-full"
                size="lg"
              >
                Continue to Payment Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                You can add more sites later in your dashboard
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
</div>
```

### API Integration
```typescript
async function onAddSite(data: SiteFormData) {
  setSubmitting(true)
  setError(null)

  try {
    // Convert dollars to cents
    const nightlyRateCents = Math.round(parseFloat(data.nightlyRate) * 100)

    const response = await fetch('/api/onboarding/add-site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        nightly_rate: nightlyRateCents,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to add site')
    }

    // Add to list
    setAddedSites([...addedSites, { ...data, id: result.siteId }])

    // Reset form
    reset({
      type: 'tent',
      maxOccupancy: 4,
      hookups: { water: false, electric: false, sewer: false }
    })
    setSubmitting(false)
  } catch (err) {
    console.error('Add site error:', err)
    setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    setSubmitting(false)
  }
}

function handleContinue() {
  router.push('/onboarding/stripe-connect')
}

async function handleDeleteSite(siteId: string) {
  // Optional: Call API to delete
  setAddedSites(addedSites.filter(s => s.id !== siteId))
}
```

### Helper Functions
```typescript
function getSiteIcon(type: SiteType) {
  const icons = {
    tent: Tent,
    rv: Home,
    cabin: TreePine,
    glamping: Sparkles,
    yurt: Circle,
    other: MapPin,
  }
  return icons[type] || MapPin
}

function getHookupsSummary(hookups: { water: boolean; electric: boolean; sewer: boolean }) {
  const active = []
  if (hookups.water) active.push('Water')
  if (hookups.electric) active.push('Electric')
  if (hookups.sewer) active.push('Sewer')
  return active.length > 0 ? active.join(', ') : 'None'
}
```

### State Management
```typescript
const router = useRouter()
const [addedSites, setAddedSites] = useState<AddedSite[]>([])
const [hookups, setHookups] = useState({ water: false, electric: false, sewer: false })
const [submitting, setSubmitting] = useState(false)
const [error, setError] = useState<string | null>(null)

const {
  register,
  handleSubmit,
  formState: { errors },
  setValue,
  watch,
  reset,
} = useForm<SiteFormData>({
  resolver: zodResolver(siteSchema),
  defaultValues: {
    type: 'tent',
    maxOccupancy: 4,
  },
})

const siteType = watch('type')
```

### Success Criteria
- At least 1 site created
- All sites have name, type, occupancy, rate, and hookups configured
- User clicks Continue → redirects to `/onboarding/stripe-connect`

---

## PAGE 3: Stripe Connect
**File**: `app/onboarding/stripe-connect/page.tsx`

### Purpose
Connect Stripe account for payment processing via OAuth

### Route
`/onboarding/stripe-connect`

### Component Imports
```typescript
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
```

### Layout Structure
```tsx
<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12 px-4">
  <div className="max-w-2xl mx-auto">
    {/* Header */}
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
        <CreditCard className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-heading font-bold mb-2">
        Connect Payment Processing
      </h1>
      <p className="text-muted-foreground">
        One click to start accepting payments
      </p>
    </div>

    {/* Progress */}
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Step 3 of 4</span>
        <span className="text-sm text-muted-foreground">Payment Setup</span>
      </div>
      <Progress value={75} className="h-2" />
    </div>

    {/* Main Card */}
    <Card>
      <CardHeader>
        <CardTitle>Stripe Payment Processing</CardTitle>
        <CardDescription>
          Securely accept credit cards, debit cards, and digital wallets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Benefits */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Secure & Trusted</p>
              <p className="text-sm text-muted-foreground">
                Powered by Stripe - trusted by millions of businesses worldwide
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Fast Payouts</p>
              <p className="text-sm text-muted-foreground">
                Receive funds directly to your bank account in 2-3 business days
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">No Hidden Fees</p>
              <p className="text-sm text-muted-foreground">
                Simple pricing: 2.9% + $0.30 per transaction
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Connect Button */}
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={handleStripeConnect}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting to Stripe...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                Connect with Stripe
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You'll be redirected to Stripe to complete the connection
          </p>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>

    {/* Help Text */}
    <div className="mt-6 text-center">
      <p className="text-sm text-muted-foreground">
        Don't have a Stripe account?{' '}
        <a
          href="https://stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Create one for free
        </a>
      </p>
    </div>
  </div>
</div>
```

### API Integration
```typescript
async function handleStripeConnect() {
  setConnecting(true)
  setError(null)

  try {
    // Generate Stripe Connect OAuth URL
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

    // Save state to session storage for verification
    sessionStorage.setItem('stripe_oauth_state', state)

    // Redirect to Stripe
    window.location.href = stripeUrl
  } catch (err) {
    console.error('Stripe connection error:', err)
    setError('Failed to initiate Stripe connection')
    setConnecting(false)
  }
}

function generateRandomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

### State Management
```typescript
const [connecting, setConnecting] = useState(false)
const [error, setError] = useState<string | null>(null)
```

### Success Criteria
- User clicks Connect → redirected to Stripe OAuth page
- After authorization → redirected to `/onboarding/complete`
- Stripe account ID saved to database

---

## PAGE 4: Onboarding Complete
**File**: `app/onboarding/complete/page.tsx`

### Purpose
Show completion checklist, share booking page URL, and guide next steps

### Route
`/onboarding/complete`

### Component Imports
```typescript
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Building2,
  Tent,
  DollarSign,
  CreditCard,
  CheckCircle2,
  Copy,
  ArrowRight,
  Loader2,
} from "lucide-react"
```

### TypeScript Types
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

### Layout Structure
```tsx
<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12 px-4">
  <div className="max-w-3xl mx-auto">
    {/* Success Header */}
    <div className="text-center mb-12">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="text-4xl font-heading font-bold mb-2">
        🎉 Your Campground is Live!
      </h1>
      <p className="text-lg text-muted-foreground">
        Congratulations! {propertyName} is ready to accept bookings
      </p>
    </div>

    {/* Progress - Complete */}
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Step 4 of 4</span>
        <span className="text-sm text-green-600 font-medium">Complete!</span>
      </div>
      <Progress value={100} className="h-2" />
    </div>

    {/* Completion Checklist */}
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Setup Complete ✓</CardTitle>
        <CardDescription>
          Everything is configured and ready to go
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Property Info */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-900 dark:text-green-100">
              Property Information
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              {propertyName} • {city}, {state}
            </p>
          </div>
        </div>

        {/* Sites */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
            <Tent className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-900 dark:text-green-100">
              Sites Added
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              {totalSites} sites ({siteBreakdown})
            </p>
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-900 dark:text-green-100">
              Pricing Configured
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              All sites have nightly rates set
            </p>
          </div>
        </div>

        {/* Stripe */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-900 dark:text-green-100">
              Payment Processing
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Stripe connected and ready
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Next Steps */}
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>What's Next?</CardTitle>
        <CardDescription>
          Here's how to start accepting bookings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Share Booking Page */}
        <div className="border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold shrink-0">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Share Your Booking Page</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Start accepting reservations by sharing this link with your guests
              </p>
              <div className="flex gap-2">
                <Input
                  value={bookingPageUrl}
                  readOnly
                  className="font-mono text-sm bg-muted"
                />
                <Button onClick={handleCopyUrl} variant="secondary">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 mt-2">✓ Copied to clipboard!</p>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Test Booking */}
        <div className="border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold shrink-0">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Create a Test Booking</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Walk through the booking flow to see how your guests will experience it
              </p>
              <Button onClick={handleTestBooking} variant="outline">
                Try Test Booking
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Step 3: Explore Dashboard */}
        <div className="border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold shrink-0">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Explore Your Dashboard</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Manage reservations, view payments, and track your property performance
              </p>
              <Button onClick={() => router.push('/dashboard')}>
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Help & Resources */}
    <div className="text-center space-y-3">
      <p className="text-sm text-muted-foreground">Need help getting started?</p>
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" onClick={() => window.open('/docs', '_blank')}>
          View Documentation
        </Button>
        <Button variant="outline" onClick={handleContactSupport}>
          Contact Support
        </Button>
      </div>
    </div>
  </div>
</div>
```

### API Integration
```typescript
useEffect(() => {
  fetchCompletionData()
}, [])

async function fetchCompletionData() {
  try {
    const response = await fetch('/api/onboarding/completion-status')
    const data = await response.json()
    setCompletionData(data)
    setLoading(false)
  } catch (err) {
    console.error('Failed to load completion data:', err)
    setLoading(false)
  }
}
```

### Helper Functions
```typescript
async function handleCopyUrl() {
  try {
    await navigator.clipboard.writeText(bookingPageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function handleTestBooking() {
  window.open(bookingPageUrl, '_blank')
}

function handleContactSupport() {
  window.location.href = 'mailto:support@campos.com'
}
```

### State Management
```typescript
const router = useRouter()
const [loading, setLoading] = useState(true)
const [completionData, setCompletionData] = useState<CompletionData | null>(null)
const [copied, setCopied] = useState(false)

const {
  propertyName,
  city,
  state,
  totalSites,
  siteBreakdown,
  bookingPageUrl,
} = completionData || {}
```

### Success Criteria
- All 4 checklist items show complete with green checkmarks
- Booking page URL is copyable
- User can navigate to dashboard or open booking page
- Displays accurate property and site statistics

---

## API Endpoints Required

### 1. Site Creation API
**File**: `app/api/onboarding/add-site/route.ts`

**Endpoint**: `POST /api/onboarding/add-site`

**Request Body**:
```typescript
{
  name: string
  type: 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'
  maxOccupancy: number
  nightly_rate: number  // In cents
  hookups: {
    water: boolean
    electric: boolean
    sewer: boolean
  }
  description?: string
}
```

**Response**:
```typescript
{
  success: boolean
  siteId: string
  site: { /* created site object */ }
}
```

### 2. Onboarding Completion API
**File**: `app/api/onboarding/complete/route.ts`

**Endpoint**: `POST /api/onboarding/complete`

**Logic**:
1. Validate all completion criteria
2. Update `properties.onboarding_completed = true`
3. Generate booking page URL slug
4. Return success status

### 3. Stripe Connect OAuth Callback
**File**: `app/api/stripe/connect/authorize/route.ts`

**Endpoint**: `GET /api/stripe/connect/authorize?code={code}&state={state}`

**Logic**:
1. Verify state parameter (CSRF protection)
2. Exchange authorization code for Stripe account ID
3. Save `stripe_account_id` to properties table
4. Redirect to `/onboarding/complete`

### 4. Completion Status API
**File**: `app/api/onboarding/completion-status/route.ts`

**Endpoint**: `GET /api/onboarding/completion-status`

**Response**:
```typescript
{
  propertyName: string
  city: string
  state: string
  totalSites: number
  siteBreakdown: string
  stripeConnected: boolean
  bookingPageUrl: string
}
```

---

## Database Schema Updates

### Properties Table
```sql
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS booking_page_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```

### Sites Table
```sql
ALTER TABLE sites
ADD COLUMN IF NOT EXISTS hookups JSONB DEFAULT '{"water": false, "electric": false, "sewer": false}';

-- Example data: {"water": true, "electric": true, "sewer": false}
```

---

## Implementation Workflow

### Phase 1: Backend APIs (Day 8)
1. Create `/api/onboarding/add-site` route
2. Create `/api/onboarding/complete` route
3. Update database schema (hookups column, Stripe fields)
4. Test APIs with Postman/curl

### Phase 2: Stripe Integration (Day 9)
1. Set up Stripe Connect in Stripe Dashboard
2. Create `/api/stripe/connect/authorize` OAuth callback
3. Create `/api/onboarding/completion-status` route
4. Test OAuth flow end-to-end

### Phase 3: Generate Pages with v0.dev (Days 10-11)
1. **Property Setup Page**: Copy Page 1 spec → v0.dev → generate → integrate
2. **Site Management Page**: Copy Page 2 spec → v0.dev → generate → integrate
3. **Stripe Connect Page**: Copy Page 3 spec → v0.dev → generate → integrate
4. **Completion Page**: Copy Page 4 spec → v0.dev → generate → integrate

### Phase 4: Integration & Testing (Day 12)
1. Test complete flow: signup → property → sites → stripe → complete
2. Verify database records created correctly
3. Test booking page URL generation
4. Test Stripe webhook integration
5. Delete old broken onboarding files

---

## Success Metrics

1. **Time to Complete**: Target < 30 minutes from sign-up to first booking
2. **Completion Rate**: Track % of users completing all 4 steps
3. **Drop-off Analysis**: Identify where users abandon (property, sites, stripe)
4. **User Satisfaction**: Post-onboarding survey (1-5 scale, target 4.0+)

---

## Notes for v0.dev

When generating pages with v0.dev, include these instructions:

1. "Use Next.js 15 App Router with 'use client' directive"
2. "Import all components from @/components/ui/* (shadcn/ui)"
3. "Use react-hook-form with zodResolver for forms"
4. "Match existing color scheme (primary, muted, destructive from theme)"
5. "Use lucide-react for all icons"
6. "Include loading states (Loader2 spinning icon)"
7. "Include error states (Alert with destructive variant)"
8. "Use existing font classes: font-heading for titles, font-sans for body"

---

**End of Specifications**
