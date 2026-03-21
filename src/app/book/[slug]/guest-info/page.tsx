"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format, differenceInDays } from "date-fns"
import { ArrowLeft, Check, Lock, Users, ChevronRight, TreePine, Shield } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_TAX_RATE } from "@/lib/booking/types"

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
  num_vehicles: z.string().optional(),
  special_requests: z.string().optional(),
  agree_terms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
  agree_cancellation: z.boolean().refine((val) => val === true, {
    message: "You must agree to the cancellation policy",
  }),
})

type GuestFormData = z.infer<typeof guestFormSchema>

export default function GuestInfoPage() {
  const params = useParams()
  const slug = params.slug as string
  const { checkoutData, setCheckoutData, isHydrated } = useCheckout()
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const displayPropertyName =
    checkoutData.propertyName || slug.replace(/-[a-f0-9]{8}$/i, '').replace(/-/g, ' ')

  useEffect(() => {
    // Don't validate until hydration is complete
    if (!isHydrated) return

    if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate) {
      toast({
        title: "Missing booking information",
        description: "Please start by selecting a site and dates.",
        variant: "destructive",
      })
      router.push(`/book/${slug}`)
    }
  }, [isHydrated, checkoutData.site, checkoutData.checkInDate, checkoutData.checkOutDate, router, slug])

  const form = useForm<GuestFormData>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      first_name: checkoutData.guestInfo?.first_name || "",
      last_name: checkoutData.guestInfo?.last_name || "",
      email: checkoutData.guestInfo?.email || "",
      phone: checkoutData.guestInfo?.phone || "",
      address: checkoutData.guestInfo?.address || "",
      city: checkoutData.guestInfo?.city || "",
      state: checkoutData.guestInfo?.state || "",
      zip_code: checkoutData.guestInfo?.zip_code || "",
      country: checkoutData.guestInfo?.country || "United States",
      emergency_contact_name: checkoutData.guestInfo?.emergency_contact_name || "",
      emergency_contact_phone: checkoutData.guestInfo?.emergency_contact_phone || "",
      num_vehicles: checkoutData.numVehicles?.toString() ?? "0",
      special_requests: checkoutData.specialRequests || "",
      agree_terms: false,
      agree_cancellation: false,
    },
  })

  const onSubmit = async (data: GuestFormData) => {
    setIsSubmitting(true)
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
        num_pets: 0,
        num_vehicles: (() => {
          const raw =
            data.num_vehicles != null && data.num_vehicles !== ''
              ? Number.parseInt(String(data.num_vehicles), 10)
              : 0
          return Number.isNaN(raw) ? 0 : Math.max(0, raw)
        })(),
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
          country: data.country || "United States",
          emergency_contact_name: data.emergency_contact_name || undefined,
          emergency_contact_phone: data.emergency_contact_phone || undefined,
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
        emergency_contact_name?: string
        emergency_contact_phone?: string
      } = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        country: data.country || "United States",
      }

      // Only include optional fields if they have values
      if (data.address) guestInfo.address = data.address
      if (data.city) guestInfo.city = data.city
      if (data.state) guestInfo.state = data.state
      if (data.zip_code) guestInfo.zip_code = data.zip_code
      if (data.emergency_contact_name) guestInfo.emergency_contact_name = data.emergency_contact_name
      if (data.emergency_contact_phone) guestInfo.emergency_contact_phone = data.emergency_contact_phone

      setCheckoutData({
        reservationId: result.data.reservation_id,
        confirmationNumber: result.data.confirmation_number,
        priceBreakdown: result.data.price_breakdown,
        reservedUntil: result.data.reserved_until, // Checkout timer expiration
        guestInfo,
      })

      toast({
        title: "Reservation created!",
        description: "Proceeding to payment...",
      })

      router.push(`/book/${slug}/payment`)
    } catch (error) {
      console.error("Error creating reservation:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate) {
    return null
  }

  const numberOfNights = differenceInDays(checkoutData.checkOutDate, checkoutData.checkInDate)

  // Normalize price breakdown so UI always has consistent fields while preferring
  // server-calculated values from the enhanced pricing engine.
  const defaultSubtotal = checkoutData.site.base_price_per_night * numberOfNights
  const rawPriceBreakdown = checkoutData.priceBreakdown

  const fallbackPriceBreakdown = {
    base_price_per_night: checkoutData.site.base_price_per_night,
    basePrice: checkoutData.site.base_price_per_night,
    number_of_nights: numberOfNights,
    nights: numberOfNights,
    subtotal: defaultSubtotal,
    cleaningFee: checkoutData.site.site_type === "cabin" ? 50 : 0,
    serviceFee: Math.round(defaultSubtotal * 0.1),
  }

  const priceBreakdown = {
    ...fallbackPriceBreakdown,
    ...rawPriceBreakdown,
  }

  const nightsForDisplay =
    priceBreakdown.nights ?? priceBreakdown.number_of_nights ?? numberOfNights

  const nightlyRateCents =
    priceBreakdown.basePrice ??
    priceBreakdown.base_price_per_night ??
    (nightsForDisplay > 0 ? Math.round(priceBreakdown.subtotal / nightsForDisplay) : 0)

  const cleaningFeeCents = priceBreakdown.cleaningFee ?? priceBreakdown.cleaning_fee ?? 0
  const serviceFeeCents = priceBreakdown.serviceFee ?? priceBreakdown.service_fee ?? 0
  const taxesCents = priceBreakdown.taxes ?? 0
  const taxRate = priceBreakdown.tax_rate ?? priceBreakdown.taxRate ?? DEFAULT_TAX_RATE
  const legacyDiscountCents = priceBreakdown.discount_applied?.amount_saved ?? 0
  const userDiscountCents =
    priceBreakdown.user_discounts?.reduce((sum, discount) => sum + discount.amount, 0) ?? 0
  const totalDiscountCents = legacyDiscountCents + userDiscountCents
  const totalCents =
    priceBreakdown.total ??
    ((priceBreakdown.total_before_tax ??
      priceBreakdown.subtotal +
      cleaningFeeCents +
      serviceFeeCents) +
      taxesCents)

  const bookingSummaryMain = (
    <>
      {checkoutData.site.image_url && (
        <div className="relative h-48 overflow-hidden rounded-lg">
          <Image
            src={checkoutData.site.image_url || "/placeholder.svg"}
            alt={checkoutData.site.name}
            fill
            className="object-cover"
          />
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900">{checkoutData.site.name}</h3>
        <p className="text-sm capitalize text-gray-600">{checkoutData.site.site_type} Site</p>
      </div>

      <div className="space-y-2 border-t pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Check-in:</span>
          <span className="font-medium">{format(checkoutData.checkInDate, "MMM dd, yyyy")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Check-out:</span>
          <span className="font-medium">{format(checkoutData.checkOutDate, "MMM dd, yyyy")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Nights:</span>
          <span className="font-medium">{numberOfNights}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Guests:</span>
          <span className="font-medium">
            {(checkoutData.numAdults || 0) + (checkoutData.numChildren || 0)} ({checkoutData.numAdults || 0}A,{" "}
            {checkoutData.numChildren || 0}C)
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {priceBreakdown.base_price_label ??
              `${(nightlyRateCents / 100).toFixed(2)} × ${nightsForDisplay} night${nightsForDisplay !== 1 ? "s" : ""}`}
          </span>
          <span className="font-medium">${((priceBreakdown.subtotal || 0) / 100).toFixed(2)}</span>
        </div>
        {cleaningFeeCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Cleaning fee</span>
            <span className="font-medium">${(cleaningFeeCents / 100).toFixed(2)}</span>
          </div>
        )}
        {priceBreakdown.user_discounts?.map((discount) => (
          <div key={discount.id} className="flex justify-between text-sm">
            <span className="text-gray-600">{discount.title}</span>
            <span className="font-medium text-green-700">-${(discount.amount / 100).toFixed(2)}</span>
          </div>
        ))}
        {legacyDiscountCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Discount</span>
            <span className="font-medium text-green-700">-${(legacyDiscountCents / 100).toFixed(2)}</span>
          </div>
        )}
        {taxesCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Taxes {taxRate != null ? `(${(taxRate * 100).toFixed(1)}%)` : ""}</span>
            <span className="font-medium">${(taxesCents / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-lg font-bold">
          <span>Total</span>
          <span className="text-[#2D5A27]">${(totalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <Button variant="outline" className="w-full bg-transparent" onClick={() => router.push("/book")}>
        Edit Reservation
      </Button>
    </>
  )

  const bookingSummaryFooter = (
    <div className="mt-4 space-y-3">
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Check className="h-4 w-4 text-green-600" />
        <span>Free cancellation within 24 hours</span>
      </div>
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Check className="h-4 w-4 text-green-600" />
        <span>Instant booking confirmation</span>
      </div>
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Check className="h-4 w-4 text-green-600" />
        <span>Secure payment processing</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#2D5A27] rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2D5A27]">{displayPropertyName}</h1>
                <p className="text-xs text-gray-600">Secure Booking Portal</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 sm:mb-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2 text-green-700">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Secure Checkout</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700">
              <Lock className="h-5 w-5" />
              <span className="font-medium">SSL Encrypted</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700">
              <Check className="h-5 w-5" />
              <span className="font-medium">No Payment Required Yet</span>
            </div>
          </div>
        </div>

        <div className="mb-3 sm:mb-4">
          <div className="-mx-1 flex justify-center overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-nowrap items-center gap-0.5 text-[10px] font-medium sm:gap-1 sm:text-xs md:gap-1.5 md:text-sm">
              <div className="flex shrink-0 items-center gap-1 text-gray-600">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check className="h-3 w-3" aria-hidden />
                </div>
                <span className="whitespace-nowrap leading-none">Select Dates & Site</span>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
              <div className="flex shrink-0 items-center gap-1 text-[#2D5A27]">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2D5A27] text-[10px] font-semibold tabular-nums leading-none text-white">
                  2
                </div>
                <span className="whitespace-nowrap leading-none">Guest Info</span>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
              <div className="flex shrink-0 items-center gap-1 text-gray-400">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold tabular-nums leading-none text-gray-600">
                  3
                </div>
                <span className="whitespace-nowrap leading-none">Payment</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="order-2 lg:order-1 lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-[#2D5A27]">Guest Information</CardTitle>
                <CardDescription>Please provide your contact details for the reservation</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-900 flex items-center space-x-2">
                      <Users className="h-5 w-5 text-[#2D5A27]" />
                      <span>Contact Information</span>
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">
                          First Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="first_name"
                          {...form.register("first_name")}
                          className={form.formState.errors.first_name ? "border-red-500" : ""}
                        />
                        {form.formState.errors.first_name && (
                          <p className="text-sm text-red-500">{form.formState.errors.first_name.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">
                          Last Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="last_name"
                          {...form.register("last_name")}
                          className={form.formState.errors.last_name ? "border-red-500" : ""}
                        />
                        {form.formState.errors.last_name && (
                          <p className="text-sm text-red-500">{form.formState.errors.last_name.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">
                          Email Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          {...form.register("email")}
                          className={form.formState.errors.email ? "border-red-500" : ""}
                        />
                        {form.formState.errors.email && (
                          <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">
                          Phone Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          {...form.register("phone")}
                          className={form.formState.errors.phone ? "border-red-500" : ""}
                        />
                        {form.formState.errors.phone && (
                          <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-900">Address (Optional)</h3>
                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input id="address" {...form.register("address")} />
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" {...form.register("city")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Select value={form.watch("state") || ""} onValueChange={(value) => form.setValue("state", value)}>
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
                        <Label htmlFor="zip_code">Zip Code</Label>
                        <Input id="zip_code" {...form.register("zip_code")} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" {...form.register("country")} defaultValue="United States" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-900">Trip Details</h3>
                    <div className="space-y-2">
                      <Label htmlFor="num_vehicles">Number of Vehicles</Label>
                      <Select
                        value={form.watch("num_vehicles") || ""}
                        onValueChange={(value) => form.setValue("num_vehicles", value)}
                      >
                        <SelectTrigger id="num_vehicles">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} {num === 1 ? "vehicle" : "vehicles"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="special_requests">Special Requests</Label>
                      <Textarea
                        id="special_requests"
                        {...form.register("special_requests")}
                        placeholder="Any special requests or requirements?"
                        rows={4}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-900">Emergency Contact (Optional)</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_name">Contact Name</Label>
                        <Input id="emergency_contact_name" {...form.register("emergency_contact_name")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                        <Input id="emergency_contact_phone" type="tel" {...form.register("emergency_contact_phone")} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-6">
                    <h3 className="font-semibold text-lg text-gray-900">Terms & Policies</h3>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="agree_terms"
                          checked={form.watch("agree_terms")}
                          onCheckedChange={(checked) => form.setValue("agree_terms", checked as boolean)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="agree_terms" className="text-sm font-normal cursor-pointer">
                            I agree to the{" "}
                            <Link href="/terms" className="text-[#2D5A27] underline">
                              terms and conditions
                            </Link>{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          {form.formState.errors.agree_terms && (
                            <p className="text-sm text-red-500">{form.formState.errors.agree_terms.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="agree_cancellation"
                          checked={form.watch("agree_cancellation")}
                          onCheckedChange={(checked) => form.setValue("agree_cancellation", checked as boolean)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="agree_cancellation" className="text-sm font-normal cursor-pointer">
                            I agree to the{" "}
                            <Link href="/cancellation-policy" className="text-[#2D5A27] underline">
                              cancellation policy
                            </Link>{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          {form.formState.errors.agree_cancellation && (
                            <p className="text-sm text-red-500">{form.formState.errors.agree_cancellation.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700">
                        <strong>Cancellation Policy:</strong> Free cancellation up to 7 days before check-in. 50% refund
                        for cancellations 3-7 days before. No refund for cancellations within 3 days of check-in.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={() => router.push("/book")} className="sm:w-auto">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Booking
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-[#2D5A27] hover:bg-[#1e3d1a] text-white h-12"
                    >
                      {isSubmitting ? (
                        "Processing..."
                      ) : (
                        <>
                          Continue to Payment
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-6 text-sm text-gray-600 pt-4">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-green-600" />
                      <span>Secure & Encrypted</span>
                    </div>
                    <div className="hidden sm:block text-gray-300">•</div>
                    <span className="hidden sm:inline">No payment required yet</span>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <div className="mb-2 lg:hidden">
                <Accordion
                  type="single"
                  collapsible
                  className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-lg"
                >
                  <AccordionItem value="booking-summary" className="border-0">
                    <AccordionTrigger className="rounded-t-lg bg-[#2D5A27] px-4 py-3 text-left text-base font-semibold text-white hover:no-underline data-[state=open]:rounded-b-none [&>svg]:text-white">
                      <span className="flex flex-col items-start gap-0.5">
                        <span>Booking Summary</span>
                        <span className="text-xs font-normal text-white/80">
                          Review your reservation
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-0">
                      <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                        {bookingSummaryMain}
                        {bookingSummaryFooter}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <div className="hidden lg:block">
                <Card className="shadow-lg">
                  <CardHeader className="bg-[#2D5A27] text-white">
                    <CardTitle>Booking Summary</CardTitle>
                    <CardDescription className="text-gray-200">Review your reservation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">{bookingSummaryMain}</CardContent>
                </Card>
                {bookingSummaryFooter}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
