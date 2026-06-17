"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format, differenceInDays } from "date-fns"
import { ArrowLeft, Check, Lock, Users, ChevronRight, Shield } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { CancellationPolicyDialog } from "@/components/guest/cancellation-policy-dialog"
import { TermsAndConditionsDialog } from "@/components/guest/terms-and-conditions-dialog"
import { VehicleInfoStep } from "@/components/dashboard/reservations/vehicle-info-step"
import { SpousePartnerSection } from "@/components/dashboard/reservations/spouse-partner-section"
import { ChildrenList } from "@/components/dashboard/reservations/children-list"
import { PetsInfoList } from "@/components/dashboard/reservations/pets-info-list"
import { BookingPortalHeader } from "@/components/guest/booking-portal-header"
// import { BookingSummaryFooter } from "@/components/booking/BookingSummaryFooter"
import { useCheckout } from "@/lib/booking/checkout-context"
import { ZIP_CODE_MIN_LENGTH, ZIP_CODE_MIN_LENGTH_MESSAGE } from '@/lib/postal-code'
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_TAX_RATE } from "@/lib/booking/types"
import { cn, capitalizeWordsPreserveSpacing } from "@/lib/utils"
import {
  type GuestCancellationPolicyApiData,
} from "@/lib/guest/guest-cancellation-policy"

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

const guestVehicleScehema = z.object({
  vehicle_type: z.enum(['personal', 'rv', 'tow_vehicle']),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  color: z.string().optional(),
  license_plate: z.string().optional(),
  license_plate_state: z.string().optional(),

  personal_vehicle_type: z.enum(
    ['car', 'truck', 'suv', 'motorcycle', 'boat_trailer', 'other']
  ).optional(),

  rv_type: z.enum(
    ['class_a', 'class_b', 'class_c', 'fifth_wheel', 'travel_trailer', 'popup', 'truck_camper', 'toy_hauler']
  ).optional(),

  rv_length_feet: z.coerce.number().optional(),
  rv_width_feet: z.coerce.number().optional(),
  num_slide_outs: z.coerce.number().int().optional(),

  insurance_company: z.string().optional(),
  insurance_policy_number: z.string().optional(),

  is_primary: z.boolean().optional(),
})

const spouseSchema = z.object({
  first_name: z.string().min(1, "First name is required").or(z.literal("")).optional(),
  last_name: z.string().min(1, "Last name is required").or(z.literal("")).optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email("Valid email is required"), z.literal("")]).optional(),
  is_alternate_contact: z.boolean().optional(),
})

const childSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  age: z.coerce.number().int().optional(),
  date_of_birth: z.string().optional(),
  special_needs_allergies: z.string().optional(),
})

const petSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(['dog', 'cat', 'bird', 'other']),
  breed: z.string().optional(),
  weight_lbs: z.coerce.number().int().optional(),
  notes: z.string().optional(),
})

const getGuestDraftStorageKey = (slug: string) => `campground-guest-draft:${slug}`

type PetInput = z.infer<typeof petSchema>

const countValidPets = (pets: PetInput[] | undefined): number => {
  if (!pets || pets.length === 0) return 0
  return pets.filter((pet) => {
    if (!pet) return false
    const hasName = typeof pet.name === "string" && pet.name.trim().length > 0
    const hasType = typeof pet.type === "string" && pet.type.trim().length > 0
    return hasName && hasType
  }).length
}

export default function GuestInfoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const shouldRestoreDraft = searchParams.get("restoreGuestDraft") === "1"
  const { checkoutData, setCheckoutData, isHydrated } = useCheckout()
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const displayPropertyName =
    checkoutData.propertyName || capitalizeWordsPreserveSpacing(slug.replace(/-[a-f0-9]{8}$/i, '').replace(/-/g, ' '))
  const guestFormSchema = z.object({
    first_name: z.string().min(2, "First name is required"),
    last_name: z.string().min(2, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(1, "Phone number is required"),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip_code: z.string().optional().refine(
      (val) => !val || val.trim() === '' || val.trim().length >= ZIP_CODE_MIN_LENGTH,
      { message: ZIP_CODE_MIN_LENGTH_MESSAGE },
    ),
    country: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    spouse: spouseSchema.optional(),
    children: z.array(childSchema).optional(),
    pets: z.array(petSchema).optional(),
    num_vehicles: z.string().optional(),
    vehicles: z.array(guestVehicleScehema).optional(),
    special_requests: z.string().optional(),
    agree_terms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the terms and conditions",
    }),
    agree_cancellation: z.boolean().refine((val) => val === true, {
      message: "You must agree to the cancellation policy",
    }),
  })

  type GuestFormData = z.infer<typeof guestFormSchema>
  const [cancellationPolicyData, setCancellationPolicyData] =
    useState<GuestCancellationPolicyApiData | null>(null)
  const [termsAndConditionsText, setTermsAndConditionsText] = useState<string | null>(null)
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false)
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = useState(false)
  const [isCancellationPolicyLoading, setIsCancellationPolicyLoading] = useState(false)
  const fetchedCancellationPolicyForPropertyRef = useRef<string | null>(null)
  const [spouseOpen, setSpouseOpen] = useState(false)
  const [childrenOpen, setChildrenOpen] = useState(false)
  const [petsOpen, setPetsOpen] = useState(false)

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

  useEffect(() => {
    if (!isHydrated) return
    const propertyId = checkoutData.propertyId
    if (!propertyId) {
      setIsCancellationPolicyLoading(false)
      fetchedCancellationPolicyForPropertyRef.current = null
      setTermsAndConditionsText(null)
      return
    }
    if (fetchedCancellationPolicyForPropertyRef.current === propertyId) {
      return
    }

    let cancelled = false

    setIsCancellationPolicyLoading(true)

    const loadCancellationPolicy = async () => {
      try {
        const response = await fetch(
          `/api/guest/properties/${propertyId}/cancellation`
        )
        if (!response.ok) return
        const result = await response.json()
        const raw = result?.data as
          | (GuestCancellationPolicyApiData & { terms_and_conditions?: string | null })
          | undefined
        if (!cancelled && raw?.policy_display_text) {
          fetchedCancellationPolicyForPropertyRef.current = propertyId
          setCancellationPolicyData({
            policy_display_text: raw.policy_display_text,
            refund_tiers: raw.refund_tiers ?? [],
          })
          const terms = raw.terms_and_conditions
          setTermsAndConditionsText(
            typeof terms === 'string' && terms.trim().length > 0 ? terms.trim() : null
          )
          if (checkoutData.cancellationPolicy !== raw.policy_display_text) {
            setCheckoutData({ cancellationPolicy: raw.policy_display_text })
          }
        }
      } catch {
        // Silent failure - we already have a safe fallback
      } finally {
        if (!cancelled) {
          setIsCancellationPolicyLoading(false)
        }
      }
    }

    void loadCancellationPolicy()

    return () => {
      cancelled = true
    }
  }, [isHydrated, checkoutData.propertyId, setCheckoutData])

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
      vehicles: [],
      special_requests: checkoutData.specialRequests || "",
      agree_terms: false,
      agree_cancellation: false,
    },
  })
  const watchedPets = form.watch("pets")
  const validPetRowsCount = countValidPets(watchedPets)

  useEffect(() => {
    if (!isHydrated || !shouldRestoreDraft || typeof window === "undefined") return

    try {
      const raw = sessionStorage.getItem(getGuestDraftStorageKey(slug))
      if (!raw) return

      const draft = JSON.parse(raw) as Partial<GuestFormData>
      form.reset({
        ...form.getValues(),
        ...draft,
        agree_terms: false,
        agree_cancellation: false,
      })
    } catch {
      console.error("Failed to restore guest draft from session storage")
    }
  }, [form, isHydrated, shouldRestoreDraft, slug])

  const onSubmit = async (data: GuestFormData) => {
    setIsSubmitting(true)
    try {
      // Validate that we have the required checkout data
      if (!checkoutData.site || !checkoutData.checkInDate || !checkoutData.checkOutDate || !checkoutData.propertyId) {
        throw new Error("Missing booking information. Please start over from site selection.")
      }

      const vehicles = data.vehicles ?? []
      const vehicleCount = vehicles.length

      const children = data.children ?? []
      const numChildren = children.length > 0 ? children.length : (checkoutData.numChildren || 0)
      const pets = data.pets ?? []
      const validPetsCount = countValidPets(pets)
      const numPets = validPetsCount > 0 ? validPetsCount : (checkoutData.numPets || 0)

      const spouseInput = data.spouse
      const spousePartnerPresent =
        spouseInput != null &&
        (String(spouseInput.first_name ?? '').trim().length > 0 ||
          String(spouseInput.last_name ?? '').trim().length > 0 ||
          String(spouseInput.phone ?? '').trim().length > 0 ||
          String(spouseInput.email ?? '').trim().length > 0 ||
          spouseInput.is_alternate_contact === true)

      const spousePartnerOrUndefined = spousePartnerPresent
        ? {
            first_name: String(spouseInput?.first_name ?? '').trim(),
            last_name: String(spouseInput?.last_name ?? '').trim(),
            phone: String(spouseInput?.phone ?? '').trim() || undefined,
            email: String(spouseInput?.email ?? '').trim() || undefined,
            is_alternate_contact: spouseInput?.is_alternate_contact ?? false,
          }
        : undefined

      const childrenInputOrUndefined =
        children.length > 0
          ? children.map((c) => ({
              first_name: c.first_name,
              age: c.age,
              date_of_birth: c.date_of_birth || undefined,
              special_needs_allergies: c.special_needs_allergies || undefined,
            }))
          : undefined

      const petsInputOrUndefined =
        validPetsCount > 0
          ? pets.map((p) => ({
              name: p.name,
              type: p.type,
              breed: p.breed || undefined,
              weight_lbs: p.weight_lbs ?? undefined,
              notes: p.notes || undefined,
            }))
          : undefined

      // Prepare the API request payload
      const requestBody = {
        property_id: checkoutData.propertyId,
        site_id: checkoutData.site.id,
        check_in_date: format(checkoutData.checkInDate, "yyyy-MM-dd"),
        check_out_date: format(checkoutData.checkOutDate, "yyyy-MM-dd"),
        num_adults: checkoutData.numAdults || 1,
        num_children: numChildren,
        num_pets: numPets,
        num_vehicles: vehicleCount,
        vehicle_info: vehicles,
        spouse_partner: spousePartnerOrUndefined,
        children: childrenInputOrUndefined,
        pets: petsInputOrUndefined,
        special_requests: data.special_requests || undefined,
        guest: {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
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
        paymentProcessor: result.data.payment_processor,
        ...(Array.isArray(result.data.enabled_payment_methods)
          ? { enabledPaymentMethods: result.data.enabled_payment_methods }
          : {}),
        numPets,
        ...(result.data.reserved_until != null
          ? { reservedUntil: result.data.reserved_until }
          : {}),
        guestInfo,
      })

      toast({
        title: "Reservation created!",
        description: "Proceeding to payment...",
        variant: "success",
      })

      try {
        sessionStorage.removeItem(getGuestDraftStorageKey(slug))
      } catch {
        console.error("Failed to remove guest draft from session storage")
      }

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

  const saveGuestDraftToCheckout = () => {
    const values = form.getValues()
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
      first_name: values.first_name || "",
      last_name: values.last_name || "",
      email: values.email || "",
      phone: values.phone || "",
      country: values.country || "United States",
    }

    if (values.address) guestInfo.address = values.address
    if (values.city) guestInfo.city = values.city
    if (values.state) guestInfo.state = values.state
    if (values.zip_code) guestInfo.zip_code = values.zip_code
    if (values.emergency_contact_name) guestInfo.emergency_contact_name = values.emergency_contact_name
    if (values.emergency_contact_phone) guestInfo.emergency_contact_phone = values.emergency_contact_phone

    setCheckoutData({
      guestInfo,
      numVehicles: Number(values.num_vehicles || 0),
      numPets: countValidPets(values.pets) > 0 ? countValidPets(values.pets) : (checkoutData.numPets || 0),
      specialRequests: values.special_requests || "",
    })

    try {
      sessionStorage.setItem(getGuestDraftStorageKey(slug), JSON.stringify(values))
    } catch {
      console.error("Failed to save guest draft to session storage")
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

  const serviceFeeCents = priceBreakdown.serviceFee ?? priceBreakdown.service_fee ?? 0
  const legacyPetFeeCents = priceBreakdown.pet_fee ?? priceBreakdown.petFee ?? 0
  const userFeeItems = priceBreakdown.user_fees ?? []
  const nonPetUserFeeItems = userFeeItems.filter((fee) => fee.id !== "legacy-pet")
  const userPetFeeCents = userFeeItems
    .filter((fee) => fee.id === "legacy-pet")
    .reduce((sum, fee) => sum + fee.amount, 0)
  const totalPetFeeCents = legacyPetFeeCents + userPetFeeCents
  const taxesCents = priceBreakdown.taxes ?? 0
  const taxRate = priceBreakdown.tax_rate ?? priceBreakdown.taxRate ?? DEFAULT_TAX_RATE
  const legacyDiscountCents = priceBreakdown.discount_applied?.amount_saved ?? 0
  const totalCents =
    priceBreakdown.total ??
    ((priceBreakdown.total_before_tax ??
      priceBreakdown.subtotal +
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
        <h3 className="text-lg font-semibold text-foreground">{checkoutData.site.name}</h3>
        <p className="text-sm capitalize text-muted-foreground">{checkoutData.site.site_type} Site</p>
      </div>

      <div className="space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Check-in:</span>
          <span className="font-medium text-foreground">{format(checkoutData.checkInDate, "MMM dd, yyyy")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Check-out:</span>
          <span className="font-medium text-foreground">{format(checkoutData.checkOutDate, "MMM dd, yyyy")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Nights:</span>
          <span className="font-medium text-foreground">{numberOfNights}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Guests:</span>
          <span className="font-medium text-foreground">
            {(checkoutData.numAdults || 0) + (checkoutData.numChildren || 0)} ({checkoutData.numAdults || 0}A,{" "}
            {checkoutData.numChildren || 0}C)
            {(validPetRowsCount > 0 ? validPetRowsCount : (checkoutData.numPets || 0)) > 0 && (
              <>{" + "}{validPetRowsCount > 0 ? validPetRowsCount : (checkoutData.numPets || 0)}P</>
            )}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {priceBreakdown.base_price_label ??
              `${(nightlyRateCents / 100).toFixed(2)} × ${nightsForDisplay} night${nightsForDisplay !== 1 ? "s" : ""}`}
          </span>
          <span className="font-medium text-foreground">${((priceBreakdown.subtotal || 0) / 100).toFixed(2)}</span>
        </div>
        {nonPetUserFeeItems.map((fee) => (
          <div key={fee.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{fee.title}</span>
            <span className="font-medium text-foreground">${(fee.amount / 100).toFixed(2)}</span>
          </div>
        ))}
        {totalPetFeeCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Additional charge for pets
              {(validPetRowsCount > 0 ? validPetRowsCount : (checkoutData.numPets || 0)) > 0 && (
                <> ({validPetRowsCount > 0 ? validPetRowsCount : (checkoutData.numPets || 0)} {((validPetRowsCount > 0 ? validPetRowsCount : (checkoutData.numPets || 0)) === 1 ? "pet" : "pets")})</>
              )}
            </span>
            <span className="font-medium text-foreground">${(totalPetFeeCents / 100).toFixed(2)}</span>
          </div>
        )}
        {priceBreakdown.user_discounts?.map((discount) => (
          <div key={discount.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{discount.title}</span>
            <span className="font-medium text-green-700 dark:text-emerald-400">-${(discount.amount / 100).toFixed(2)}</span>
          </div>
        ))}
        {legacyDiscountCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-medium text-green-700 dark:text-emerald-400">-${(legacyDiscountCents / 100).toFixed(2)}</span>
          </div>
        )}
        {taxesCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taxes {taxRate != null ? `(${(taxRate * 100).toFixed(1)}%)` : ""}</span>
            <span className="font-medium text-foreground">${(taxesCents / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
          <span className="text-foreground">Total</span>
          <span className="text-[#2D5A27] dark:text-emerald-400">${(totalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <Button 
        variant="outline" 
        className="w-full bg-transparent" 
        onClick={() => {
          saveGuestDraftToCheckout()
          const propertyId = checkoutData.propertyId
          const checkIn = checkoutData.checkInDate
          const checkOut = checkoutData.checkOutDate
          if (!propertyId || !checkIn || !checkOut) {
            router.push(`/book/${slug}`)
            return
          }

          const params = new URLSearchParams({
            slug,
            propertyId,
            checkIn: format(checkIn, "yyyy-MM-dd"),
            checkOut: format(checkOut, "yyyy-MM-dd"),
            adults: String(checkoutData.numAdults ?? 2),
            children: String(checkoutData.numChildren ?? 0),
            pets: String(checkoutData.numPets ?? 0),
            restoreGuestDraft: "1",
          })
          if (checkoutData.propertyName?.trim()) {
            params.set("propertyName", checkoutData.propertyName.trim())
          }
          router.push(`/availability-results?${params.toString()}`)
        }}
      >
        Edit Reservation
      </Button>
    </>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 to-background text-foreground dark:from-muted/20">
      <BookingPortalHeader
        propertyName={displayPropertyName}
        subtitle="Secure Booking Portal"
        backHref={`/book/${slug}`}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30 sm:mb-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2 text-green-700 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Secure Checkout</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700 dark:text-emerald-400">
              <Lock className="h-5 w-5" />
              <span className="font-medium">SSL Encrypted</span>
            </div>
            {/* <div className="flex items-center space-x-2 text-green-700 dark:text-emerald-400">
              <Check className="h-5 w-5" />
              <span className="font-medium">No Payment Required Yet</span>
            </div> */}
          </div>
        </div>

        <div className="mb-3 sm:mb-4">
          <div className="-mx-1 flex justify-center overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-nowrap items-center gap-0.5 text-[10px] font-medium sm:gap-1 sm:text-xs md:gap-1.5 md:text-sm">
              <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white dark:bg-emerald-600">
                  <Check className="h-3 w-3" aria-hidden />
                </div>
                <span className="whitespace-nowrap leading-none">Select Dates & Site</span>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <div className={cn("flex shrink-0 items-center gap-1", "text-[#2D5A27] dark:text-emerald-400")}>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2D5A27] text-[10px] font-semibold tabular-nums leading-none text-white dark:bg-emerald-800">
                  2
                </div>
                <span className="whitespace-nowrap leading-none">Guest Info</span>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums leading-none text-muted-foreground">
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
                <CardTitle className={cn("text-2xl", "text-[#2D5A27] dark:text-emerald-400")}>Guest Information</CardTitle>
                <CardDescription>Please provide your contact details for the reservation</CardDescription>
              </CardHeader>
              <CardContent>
                <FormProvider {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="flex items-center space-x-2 text-lg font-semibold text-foreground">
                      <Users className={cn("h-5 w-5", "text-[#2D5A27] dark:text-emerald-400")} />
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
                        <Controller
                          name="phone"
                          control={form.control}
                          render={({ field }) => (
                            <PhoneInput
                              {...field}
                              id="phone"
                              error={!!form.formState.errors.phone}
                            />
                          )}
                        />
                        {form.formState.errors.phone && (
                          <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Address (Optional)</h3>
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
                        <Input id="zip_code" {...form.register("zip_code")} className={form.formState.errors.zip_code ? "border-red-500" : ""} />
                        {form.formState.errors.zip_code && (
                          <p className="text-sm text-red-500">{form.formState.errors.zip_code.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" {...form.register("country")} defaultValue="United States" />
                    </div>
                  </div>

                  <SpousePartnerSection
                    isOpen={spouseOpen}
                    onOpenChange={setSpouseOpen}
                  />

                  <ChildrenList
                    isOpen={childrenOpen}
                    onOpenChange={setChildrenOpen}
                    maxChildren={10}
                  />

                  <PetsInfoList
                    isOpen={petsOpen}
                    onOpenChange={setPetsOpen}
                    maxPets={5}
                  />

                  <VehicleInfoStep
                    maxVehicles={5}
                    showRVSection={true}
                  />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Emergency Contact (Optional)</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_name">Contact Name</Label>
                        <Input id="emergency_contact_name" {...form.register("emergency_contact_name")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                        <Controller
                          name="emergency_contact_phone"
                          control={form.control}
                          render={({ field }) => (
                            <PhoneInput {...field} value={field.value ?? ""} id="emergency_contact_phone" />
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border pt-6">
                    <h3 className="text-lg font-semibold text-foreground">Terms & Policies</h3>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          variant="booking"
                          id="agree_terms"
                          checked={form.watch("agree_terms")}
                          onCheckedChange={(checked) => {
                            const next = checked === true

                            if (next) {
                              setIsTermsDialogOpen(true)
                              form.setValue("agree_terms", false)
                              form.clearErrors("agree_terms")
                            } else {
                              setIsTermsDialogOpen(false)
                              form.setValue("agree_terms", false)
                            }
                          }}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="agree_terms" className="text-sm font-normal cursor-pointer">
                            I agree to the{" "}
                            <TermsAndConditionsDialog
                              termsText={termsAndConditionsText}
                              open={isTermsDialogOpen}
                              onOpenChange={setIsTermsDialogOpen}
                              onAccept={() => {
                                form.setValue("agree_terms", true)
                                form.clearErrors("agree_terms")
                              }}
                            />{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          {form.formState.errors.agree_terms && (
                            <p className="text-sm text-red-500">{form.formState.errors.agree_terms.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          variant="booking"
                          id="agree_cancellation"
                          checked={form.watch("agree_cancellation")}
                          onCheckedChange={(checked) => {
                            const next = checked === true

                            if (next) {
                              // Opening the dialog is not the same as accepting the policy.
                              setIsCancellationDialogOpen(true)
                              form.setValue("agree_cancellation", false)
                              form.clearErrors("agree_cancellation")
                            } else {
                              setIsCancellationDialogOpen(false)
                              form.setValue("agree_cancellation", false)
                            }
                          }}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="agree_cancellation" className="text-sm font-normal cursor-pointer">
                            I agree to the{" "}
                            <CancellationPolicyDialog
                              data={cancellationPolicyData}
                              isLoading={isCancellationPolicyLoading}
                              open={isCancellationDialogOpen}
                              onOpenChange={setIsCancellationDialogOpen}
                              onAccept={() => {
                                form.setValue("agree_cancellation", true)
                                form.clearErrors("agree_cancellation")
                              }}
                            />{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          {form.formState.errors.agree_cancellation && (
                            <p className="text-sm text-red-500">{form.formState.errors.agree_cancellation.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => router.push(`/book/${slug}`)} className="sm:w-auto">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Booking
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn("h-12 flex-1 text-white", "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900")}
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

                  <div className="flex items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-green-600 dark:text-emerald-500" />
                      <span>Secure & Encrypted</span>
                    </div>
                    <div className="hidden sm:block text-border">•</div>
                    <span className="hidden sm:inline">No payment required yet</span>
                  </div>
                  </form>
                </FormProvider>
              </CardContent>
            </Card>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <div className="mb-2 lg:hidden">
                <Accordion
                  type="single"
                  collapsible
                  className="overflow-hidden rounded-lg border-2 border-border bg-card shadow-lg"
                >
                  <AccordionItem value="booking-summary" className="border-0">
                    <AccordionTrigger className="rounded-t-lg bg-[#2D5A27] px-4 py-3 text-left text-base font-semibold text-white hover:no-underline data-[state=open]:rounded-b-none dark:bg-emerald-950 [&>svg]:text-white">
                      <span className="flex flex-col items-start gap-0.5">
                        <span>Booking Summary</span>
                        <span className="text-xs font-normal text-white/80">
                          Review your reservation
                        </span>
                      </span>
                    </AccordionTrigger>
                    {/* <AccordionContent className="px-0">
                      <div className="space-y-4 border-t border-border px-4 py-4">
                        {bookingSummaryMain}
                        <BookingSummaryFooter />
                      </div>
                    </AccordionContent> */}
                  </AccordionItem>
                </Accordion>
              </div>

              <div className="hidden lg:block">
                <Card className="shadow-lg">
                  <CardHeader className="bg-[#2D5A27] text-white dark:bg-emerald-950">
                    <CardTitle className="text-white">Booking Summary</CardTitle>
                    <CardDescription className="text-gray-200 dark:text-emerald-100/90">Review your reservation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">{bookingSummaryMain}</CardContent>
                </Card>
                {/* <BookingSummaryFooter /> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}