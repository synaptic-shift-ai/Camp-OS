"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { Check, Tent, Users, CalendarIcon, Lock, ArrowLeft, Home, TreePine, Sparkles, Circle, MapPin } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCheckout } from "@/lib/booking/checkout-context"
import { getDetectedTimezone, ZIP_CODE_MIN_LENGTH, ZIP_CODE_MIN_LENGTH_MESSAGE } from '@/lib/postal-code'
import type { SiteType } from "@/lib/booking/types"
import { useToast } from "@/hooks/use-toast"

const siteTypeIcons: Record<SiteType, React.ReactNode> = {
  rv: <Home className="h-4 w-4" />,
  tent: <Tent className="h-4 w-4" />,
  cabin: <TreePine className="h-4 w-4" />,
  glamping: <Sparkles className="h-4 w-4" />,
  yurt: <Circle className="h-4 w-4" />,
  other: <MapPin className="h-4 w-4" />,
}

const siteTypeColors: Record<SiteType, string> = {
  rv: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  tent: "bg-green-500/10 text-green-500 border-green-500/20",
  cabin: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  glamping: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  yurt: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
}

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
]

const COUNTRIES = ["United States", "Canada", "Mexico", "United Kingdom", "Australia", "Other"]

export function CheckoutClient() {
  const router = useRouter()
  const { toast } = useToast()
  const { checkoutData, setCheckoutData } = useCheckout()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [_error, setError] = useState<string | null>(null)
  const [detectedTimezone] = useState(() => getDetectedTimezone())

  const guestFormSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    address: z.string().optional(),
    address_line_2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip_code: z.string().optional().refine(
      (val) => !val || val.trim() === '' || val.trim().length >= ZIP_CODE_MIN_LENGTH,
      { message: ZIP_CODE_MIN_LENGTH_MESSAGE },
    ),
    country: z.string().default("United States"),
    special_requests: z.string().optional(),
    email_preferences: z.boolean().default(false),
  })

  type GuestFormData = z.infer<typeof guestFormSchema>

  const steps = [
    { id: 1, name: "Site Selection", status: "complete" },
    { id: 2, name: "Guest Info", status: "current" },
    { id: 3, name: "Payment", status: "upcoming" },
    { id: 4, name: "Confirmation", status: "upcoming" },
  ]

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      country: "United States",
      email_preferences: false,
    },
  })

  const phoneValue = watch("phone")

  // Auto-format phone number
  useEffect(() => {
    if (phoneValue) {
      const cleaned = phoneValue.replace(/\D/g, "")
      if (cleaned.length <= 10) {
        const formatted = cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
        if (formatted !== phoneValue && cleaned.length === 10) {
          setValue("phone", formatted)
        }
      }
    }
  }, [phoneValue, setValue])

  const onSubmit = async (data: GuestFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate that we have the required checkout data
      if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate || !checkoutData.propertyId) {
        throw new Error("Missing booking information. Please start over from site selection.")
      }

      // Prepare the API request payload
      const requestBody = {
        property_id: checkoutData.propertyId,
        site_id: checkoutData.site.id,
        check_in_date: format(checkoutData.checkInDate, "yyyy-MM-dd"),
        check_out_date: format(checkoutData.checkOutDate, "yyyy-MM-dd"),
        num_adults: checkoutData.numAdults || 1,
        num_children: checkoutData.numChildren || 0,
        num_pets: checkoutData.numPets || 0,
        num_vehicles: checkoutData.numVehicles ?? 0,
        vehicle_info: checkoutData.vehicleInfo || [],
        special_requests: data.special_requests || undefined,
        guest: {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone.replace(/\D/g, ""), // Remove formatting
          address: data.address || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
          zip_code: data.zip_code || undefined,
          country: data.country,
        },
      }

      // Call the reservation creation API
      const response = await fetch("/api/guest/reservations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "Failed to create reservation")
      }

      // Save reservation details to checkout context
      const guestInfo: {
        first_name: string
        last_name: string
        email: string
        phone: string
        address?: string
        city?: string
        state?: string
        zip_code?: string
        country: string
      } = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        country: data.country,
      }

      // Only include optional fields if they have values
      if (data.address) guestInfo.address = data.address
      if (data.city) guestInfo.city = data.city
      if (data.state) guestInfo.state = data.state
      if (data.zip_code) guestInfo.zip_code = data.zip_code

      setCheckoutData({
        reservationId: result.data.reservation_id,
        confirmationNumber: result.data.confirmation_number,
        priceBreakdown: result.data.price_breakdown,
        guestInfo,
      })

      // Navigate to payment page
      router.push("/book/payment")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Redirect if missing required data (priceBreakdown is now calculated before navigation)
  if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate || !checkoutData.propertyId || !checkoutData.priceBreakdown) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Missing Booking Information</CardTitle>
            <CardDescription>
              We couldn't find your booking details. Please start over from site selection.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/book">Start New Booking</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const numberOfGuests = (checkoutData.numAdults || 0) + (checkoutData.numChildren || 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/book" className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost">Sign In</Button>
          </div>
        </div>
      </nav>

      {/* Progress Indicator */}
      <div className="border-b bg-background/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                      step.status === "complete" && "bg-primary border-primary text-primary-foreground",
                      step.status === "current" && "bg-primary/10 border-primary text-primary",
                      step.status === "upcoming" && "bg-muted border-border text-muted-foreground",
                    )}
                  >
                    {step.status === "complete" ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-2 font-medium hidden sm:block",
                      step.status === "current" && "text-foreground",
                      step.status !== "current" && "text-muted-foreground",
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2 transition-all",
                      step.status === "complete" ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8 max-w-7xl mx-auto">
          {/* Left Column - Reservation Summary & Guest Form */}
          <div className="space-y-6">
            {/* Reservation Summary */}
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Review Your Reservation</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/book">Edit</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={checkoutData.site.image_url || "/placeholder.svg"}
                      alt={checkoutData.site.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{checkoutData.site.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">Site #{checkoutData.site.site_number}</p>
                    <Badge className={cn("border", siteTypeColors[checkoutData.site.site_type])}>
                      <span className="mr-1">{siteTypeIcons[checkoutData.site.site_type]}</span>
                      {checkoutData.site.site_type.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Check-in</p>
                      <p className="text-sm text-muted-foreground">
                        {format(checkoutData.checkInDate, "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Check-out</p>
                      <p className="text-sm text-muted-foreground">
                        {format(checkoutData.checkOutDate, "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {numberOfGuests} {numberOfGuests === 1 ? "Guest" : "Guests"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {checkoutData.priceBreakdown.number_of_nights}{" "}
                      {checkoutData.priceBreakdown.number_of_nights === 1 ? "night" : "nights"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      ${((checkoutData.priceBreakdown.base_price_per_night || 0) / 100).toFixed(2)} ×{" "}
                      {checkoutData.priceBreakdown.number_of_nights || 0}{" "}
                      {(checkoutData.priceBreakdown.number_of_nights || 0) === 1 ? "night" : "nights"}
                    </span>
                    <span className="font-medium">${(checkoutData.priceBreakdown.subtotal / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${(checkoutData.priceBreakdown.total / 100).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guest Information Form */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Guest Information</CardTitle>
                <CardDescription>Please provide your contact and address details</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="guest-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Name Fields */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">
                        First Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="first_name"
                        {...register("first_name")}
                        placeholder="John"
                        className={cn(errors.first_name && "border-destructive")}
                      />
                      {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">
                        Last Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="last_name"
                        {...register("last_name")}
                        placeholder="Doe"
                        className={cn(errors.last_name && "border-destructive")}
                      />
                      {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
                    </div>
                  </div>

                  {/* Contact Fields */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        {...register("email")}
                        placeholder="john.doe@example.com"
                        className={cn(errors.email && "border-destructive")}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Phone <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        {...register("phone")}
                        placeholder="(555) 123-4567"
                        className={cn(errors.phone && "border-destructive")}
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                    </div>
                  </div>

                  {/* Address Fields */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address Line 1</Label>
                      <Input id="address" {...register("address")} placeholder="123 Main Street" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_line_2">Address Line 2 (Optional)</Label>
                      <Input id="address_line_2" {...register("address_line_2")} placeholder="Apt 4B" />
                    </div>
                  </div>

                  {/* City, State, ZIP */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" {...register("city")} placeholder="San Francisco" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Select onValueChange={(value) => setValue("state", value)}>
                        <SelectTrigger id="state">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip_code">ZIP/Postal Code</Label>
                      <Input id="zip_code" {...register("zip_code")} placeholder="94102" className={cn(errors.zip_code && "border-destructive")} />
                      {errors.zip_code && <p className="text-sm text-destructive">{errors.zip_code.message}</p>}
                      {detectedTimezone && (
                        <p className="text-xs text-muted-foreground">🕐 Detected timezone: {detectedTimezone}</p>
                      )}
                    </div>
                  </div>

                  {/* Country */}
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select defaultValue="United States" onValueChange={(value) => setValue("country", value)}>
                      <SelectTrigger id="country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Special Requests */}
                  <div className="space-y-2">
                    <Label htmlFor="special_requests">Special Requests (Optional)</Label>
                    <Textarea
                      id="special_requests"
                      {...register("special_requests")}
                      placeholder="Any special requests or needs? (early check-in, accessible site, etc.)"
                      rows={4}
                    />
                  </div>

                  {/* Email Preferences */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="email_preferences"
                      onCheckedChange={(checked) => setValue("email_preferences", checked as boolean)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="email_preferences" className="cursor-pointer font-normal">
                        Send me updates and offers from CampOS
                      </Label>
                      <p className="text-xs text-muted-foreground">You can unsubscribe at any time</p>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Summary (Sticky) */}
          <div className="lg:sticky lg:top-24 h-fit">
            <Card className="glass-strong shadow-xl">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Compact Site Info */}
                <div>
                  <p className="font-semibold">{checkoutData.site.name}</p>
                  <p className="text-sm text-muted-foreground">Site #{checkoutData.site.site_number}</p>
                </div>

                <Separator />

                {/* Dates & Guests */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-in</span>
                    <span className="font-medium">{format(checkoutData.checkInDate, "MMM dd")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-out</span>
                    <span className="font-medium">{format(checkoutData.checkOutDate, "MMM dd")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guests</span>
                    <span className="font-medium">{numberOfGuests}</span>
                  </div>
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      ${((checkoutData.priceBreakdown.base_price_per_night || 0) / 100).toFixed(2)} ×{" "}
                      {checkoutData.priceBreakdown.number_of_nights || 0}{" "}
                      {(checkoutData.priceBreakdown.number_of_nights || 0) === 1 ? "night" : "nights"}
                    </span>
                    <span className="font-medium">${(checkoutData.priceBreakdown.subtotal / 100).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>${(checkoutData.priceBreakdown.total / 100).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  type="submit"
                  form="guest-form"
                  size="lg"
                  className="w-full bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing..." : "Continue to Payment"}
                </Button>
                <Button variant="outline" size="lg" className="w-full bg-transparent" asChild>
                  <Link href="/book">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Link>
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Secure checkout</span>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
