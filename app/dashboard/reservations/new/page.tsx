"use client"

import { useState, useEffect } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Calendar,
  DollarSign,
  Zap,
  Droplet,
  Wifi,
  Flame,
  Users,
  PawPrint,
  Tent,
  Home,
  Caravan,
  Check
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { AvailableSitesAccordion } from "@/components/dashboard/reservations/available-sites-accordion"
import { PricingSummary } from "@/components/dashboard/reservations/pricing-summary"
import type { PricingConfig, RateDiscountsConfig, DepositConfig } from '@/lib/config/types'

// Form validation schema
const manualBookingSchema = z.object({
  siteId: z.string().min(1, "Please select a site"),
  checkInDate: z.string().min(1, "Check-in date is required"),
  checkOutDate: z.string().min(1, "Check-out date is required"),
  stayType: z.enum(["nightly", "weekly", "monthly", "seasonal"]).default("nightly"),
  numAdults: z.number().min(1, "At least one adult is required"),
  numChildren: z.number().min(0).optional(),
  numPets: z.number().min(0).optional(),
  numVehicles: z.number().min(0).optional(),
  guestFirstName: z.string().min(1, "First name is required"),
  guestLastName: z.string().min(1, "Last name is required"),
  guestEmail: z.string().email("Invalid email address"),
  guestPhone: z.string().min(1, "Phone number is required"),
  guestAddress: z.string().optional(),
  guestCity: z.string().optional(),
  guestState: z.string().optional(),
  guestZipCode: z.string().optional(),
  paymentMethod: z.enum(["credit_card", "debit_card", "cash"]),
  paidAmount: z.string().optional(), // Will convert to cents
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
})

type ManualBookingFormData = z.infer<typeof manualBookingSchema>

interface AvailableSite {
  id: string
  name: string
  site_number: string
  site_type: string
  max_occupancy: number
  base_price_per_night: number
  amenities: Record<string, boolean>
  image_url?: string
}

// Amenity icon mapping
const amenityIcons: Record<string, { icon: typeof Zap; label: string }> = {
  electric: { icon: Zap, label: "Electric" },
  electricity: { icon: Zap, label: "Electric" },
  water: { icon: Droplet, label: "Water" },
  wifi: { icon: Wifi, label: "WiFi" },
  firepit: { icon: Flame, label: "Fire Pit" },
  petFriendly: { icon: PawPrint, label: "Pet Friendly" },
}

// Site type icon mapping
const siteTypeIcons: Record<string, typeof Tent> = {
  tent: Tent,
  rv: Caravan,
  cabin: Home,
  glamping: Home,
  yurt: Home,
  other: Home,
}

export default function NewReservationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [totalNights, setTotalNights] = useState(0)
  const [estimatedTotal, setEstimatedTotal] = useState(0)
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null)
  const [rateDiscountsConfig, setRateDiscountsConfig] = useState<RateDiscountsConfig | null>(null)
  const [depositConfig, setDepositConfig] = useState<DepositConfig | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ManualBookingFormData>({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      numAdults: 1,
      numChildren: 0,
      numPets: 0,
      numVehicles: 0,
      paymentMethod: "credit_card",
    },
  })

  const selectedSiteId = watch("siteId")
  const checkInDate = watch("checkInDate")
  const checkOutDate = watch("checkOutDate")
  const stayType = watch("stayType")
  const numAdults = watch("numAdults")
  const numChildren = watch("numChildren")
  const numPets = watch("numPets")
  const paymentMethod = watch("paymentMethod")

  // Fetch property ID on mount
  useEffect(() => {
    const fetchPropertyId = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError("Please log in to create reservations")
        return
      }

      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('id, pricing_config, rate_discounts_config, deposit_config')
        .eq('owner_id', user.id)
        .single()

      if (propertyError || !property) {
        setError("No property found for your account")
        return
      }

      setPropertyId(property.id)
      setPricingConfig(property.pricing_config as PricingConfig | null)
      setRateDiscountsConfig(property.rate_discounts_config as RateDiscountsConfig | null)
      setDepositConfig(property.deposit_config as DepositConfig | null)
    }

    fetchPropertyId()
  }, [])

  // Check availability when dates or guest count changes
  useEffect(() => {
    if (!propertyId || !checkInDate || !checkOutDate) {
      setAvailableSites([])
      setTotalNights(0)
      return
    }

    // Validate dates
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)

    if (checkIn >= checkOut) {
      setAvailableSites([])
      setTotalNights(0)
      return
    }

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    setTotalNights(nights)

    const checkAvailability = async () => {
      setCheckingAvailability(true)
      setError(null)

      try {
        const response = await fetch('/api/booking/search-availability', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            property_id: propertyId,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            num_adults: numAdults || 1,
            num_children: numChildren || 0,
          }),
        })

        const result = await response.json()

        if (result.success && result.data) {
          setAvailableSites(result.data.sites || [])

          // Clear selected site if it's no longer available
          if (selectedSiteId && !result.data.sites.find((s: AvailableSite) => s.id === selectedSiteId)) {
            setValue("siteId", "")
          }
        } else {
          setError(result.error?.message || 'Failed to check availability')
          setAvailableSites([])
        }
      } catch (err) {
        console.error('Availability check error:', err)
        setError('Failed to check availability. Please try again.')
        setAvailableSites([])
      } finally {
        setCheckingAvailability(false)
      }
    }

    checkAvailability()
  }, [propertyId, checkInDate, checkOutDate, numAdults, numChildren, selectedSiteId, setValue])

  // Calculate estimated total when site is selected
  useEffect(() => {
    if (selectedSiteId && totalNights > 0) {
      const site = availableSites.find(s => s.id === selectedSiteId)
      if (site) {
        const total = site.base_price_per_night * totalNights
        setEstimatedTotal(total)
      }
    } else {
      setEstimatedTotal(0)
    }
  }, [selectedSiteId, totalNights, availableSites])

  const onSubmit = async (data: ManualBookingFormData) => {
    try {
      setLoading(true)
      setError(null)

      // Convert paid amount from dollars to cents
      const paidAmountCents = data.paidAmount
        ? Math.round(parseFloat(data.paidAmount) * 100)
        : undefined

      const response = await fetch("/api/admin/reservations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId: data.siteId,
          checkInDate: data.checkInDate,
          checkOutDate: data.checkOutDate,
          stayType: data.stayType,
          numAdults: data.numAdults,
          numChildren: data.numChildren,
          numPets: data.numPets,
          numVehicles: data.numVehicles,
          guest: {
            firstName: data.guestFirstName,
            lastName: data.guestLastName,
            email: data.guestEmail,
            phone: data.guestPhone,
            address: data.guestAddress,
            city: data.guestCity,
            state: data.guestState,
            zipCode: data.guestZipCode,
          },
          paymentMethod: data.paymentMethod,
          paidAmount: paidAmountCents,
          specialRequests: data.specialRequests,
          notes: data.notes,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create reservation")
      }

      setSuccess(true)

      // Redirect to reservations page after a brief delay
      setTimeout(() => {
        router.push("/dashboard/reservations")
        router.refresh()
      }, 2000)
    } catch (err) {
      console.error("Create reservation error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="container max-w-2xl py-8">
        <Alert className="bg-green-500/10 text-green-500 border-green-500/20">
          <AlertDescription>
            Reservation created successfully! Redirecting...
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  // Group sites by type
  const sitesByType = availableSites.reduce((acc, site) => {
    const type = site.site_type
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(site)
    return acc
  }, {} as Record<string, AvailableSite[]>)

  const selectedSite = availableSites.find(s => s.id === selectedSiteId)

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/reservations")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reservations
        </Button>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Create Manual Reservation</h1>
        <p className="text-muted-foreground">For phone or walk-in bookings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - Left Column */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Date Selection - Priority #1 for phone bookings */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Step 1: Select Dates
            </CardTitle>
            <CardDescription>Enter guest&apos;s desired dates to check availability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="checkInDate">Check-in Date *</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  {...register("checkInDate")}
                  min={new Date().toISOString().split('T')[0]}
                />
                {errors.checkInDate && (
                  <p className="text-sm text-destructive mt-1">{errors.checkInDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="checkOutDate">Check-out Date *</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  {...register("checkOutDate")}
                  min={checkInDate || new Date().toISOString().split('T')[0]}
                />
                {errors.checkOutDate && (
                  <p className="text-sm text-destructive mt-1">{errors.checkOutDate.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="stayType">Stay Type</Label>
              <Select
                value={watch("stayType")}
                onValueChange={(value) => setValue("stayType", value as "nightly" | "weekly" | "monthly" | "seasonal")}
              >
                <SelectTrigger id="stayType">
                  <SelectValue placeholder="Select stay type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nightly">Nightly (Standard short-term stay)</SelectItem>
                  <SelectItem value="weekly">Weekly (7+ days)</SelectItem>
                  <SelectItem value="monthly">Monthly (30+ days)</SelectItem>
                  <SelectItem value="seasonal">Seasonal (Multi-month stay)</SelectItem>
                </SelectContent>
              </Select>
              {errors.stayType && (
                <p className="text-sm text-destructive mt-1">{errors.stayType.message}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Determines pricing and discount eligibility
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="numAdults">Adults *</Label>
                <Input
                  id="numAdults"
                  type="number"
                  min="1"
                  {...register("numAdults", { valueAsNumber: true })}
                />
                {errors.numAdults && (
                  <p className="text-sm text-destructive mt-1">{errors.numAdults.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="numChildren">Children</Label>
                <Input
                  id="numChildren"
                  type="number"
                  min="0"
                  {...register("numChildren", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="numPets">Pets</Label>
                <Input
                  id="numPets"
                  type="number"
                  min="0"
                  {...register("numPets", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="numVehicles">Vehicles</Label>
                <Input
                  id="numVehicles"
                  type="number"
                  min="0"
                  {...register("numVehicles", { valueAsNumber: true })}
                />
              </div>
            </div>

            {totalNights > 0 && (
              <Alert>
                <AlertDescription>
                  <strong>{totalNights} night{totalNights > 1 ? 's' : ''}</strong> selected
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Site Selection - Visual Cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Step 2: Select Site
                  {checkingAvailability && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </CardTitle>
                <CardDescription>
                  {availableSites.length > 0
                    ? `${availableSites.length} site${availableSites.length > 1 ? 's' : ''} available for selected dates`
                    : checkInDate && checkOutDate && !checkingAvailability
                    ? "No sites available for selected dates"
                    : "Select dates above to see available sites"}
                </CardDescription>
              </div>
              {selectedSite && (
                <Badge variant="secondary" className="text-sm">
                  {selectedSite.name} Selected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {checkingAvailability ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-muted-foreground">Checking availability...</p>
                </div>
              </div>
            ) : availableSites.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {checkInDate && checkOutDate
                    ? "No sites available for the selected dates. Try different dates."
                    : "Enter dates and guest count above to see available sites."}
                </p>
              </div>
            ) : (
              <AvailableSitesAccordion
                sites={availableSites}
                selectedSiteId={selectedSiteId}
                onSiteSelect={(siteId) => setValue("siteId", siteId)}
              />
            )}

            {errors.siteId && (
              <p className="text-sm text-destructive mt-4">{errors.siteId.message}</p>
            )}

            {selectedSite && estimatedTotal > 0 && (
              <Alert className="bg-blue-500/10 text-blue-500 border-blue-500/20 mt-6">
                <DollarSign className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>Total for {selectedSite.name}</strong>
                      <div className="text-xs mt-1">
                        {formatMoney(selectedSite.base_price_per_night)}/night × {totalNights} night{totalNights > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatMoney(estimatedTotal)}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Guest Information */}
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Guest Information</CardTitle>
            <CardDescription>Contact details for the guest</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guestFirstName">First Name *</Label>
                <Input
                  id="guestFirstName"
                  {...register("guestFirstName")}
                />
                {errors.guestFirstName && (
                  <p className="text-sm text-destructive mt-1">{errors.guestFirstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="guestLastName">Last Name *</Label>
                <Input
                  id="guestLastName"
                  {...register("guestLastName")}
                />
                {errors.guestLastName && (
                  <p className="text-sm text-destructive mt-1">{errors.guestLastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guestEmail">Email *</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  {...register("guestEmail")}
                />
                {errors.guestEmail && (
                  <p className="text-sm text-destructive mt-1">{errors.guestEmail.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="guestPhone">Phone *</Label>
                <Input
                  id="guestPhone"
                  type="tel"
                  {...register("guestPhone")}
                />
                {errors.guestPhone && (
                  <p className="text-sm text-destructive mt-1">{errors.guestPhone.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="guestAddress">Address (Optional)</Label>
              <Input
                id="guestAddress"
                {...register("guestAddress")}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="guestCity">City</Label>
                <Input
                  id="guestCity"
                  {...register("guestCity")}
                />
              </div>
              <div>
                <Label htmlFor="guestState">State</Label>
                <Input
                  id="guestState"
                  {...register("guestState")}
                  maxLength={2}
                  placeholder="CA"
                />
              </div>
              <div>
                <Label htmlFor="guestZipCode">Zip Code</Label>
                <Input
                  id="guestZipCode"
                  {...register("guestZipCode")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Payment Information</CardTitle>
            <CardDescription>Payment method and amount</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setValue("paymentMethod", value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paidAmount">Amount Paid (Optional)</Label>
              <Input
                id="paidAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("paidAmount")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty if payment will be collected later
              </p>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Internal notes about this reservation..."
                rows={3}
                {...register("notes")}
              />
            </div>

            <div>
              <Label htmlFor="specialRequests">Special Requests (Optional)</Label>
              <Textarea
                id="specialRequests"
                placeholder="Guest special requests..."
                rows={3}
                {...register("specialRequests")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/reservations")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !selectedSiteId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Creating..." : "Create Reservation"}
          </Button>
        </div>
          </form>
        </div>

        {/* Pricing Summary - Right Column */}
        <div className="lg:col-span-1">
          <PricingSummary
            selectedSite={selectedSite || null}
            numNights={totalNights}
            stayType={stayType || 'nightly'}
            numAdults={numAdults || 1}
            numChildren={numChildren || 0}
            numPets={numPets || 0}
            pricingConfig={pricingConfig}
            rateDiscountsConfig={rateDiscountsConfig}
            depositConfig={depositConfig}
          />
        </div>
      </div>
    </div>
  )
}
