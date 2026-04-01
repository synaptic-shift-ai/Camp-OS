"use client"

import { useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import type { HolidayRule } from "@/lib/config/types"
import { format } from "date-fns"
import { useRouter, useParams } from "next/navigation"
import { useForm, FormProvider } from "react-hook-form"
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
  Loader2,
  Calendar,
  DollarSign,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AvailableSitesAccordion } from "@/components/dashboard/reservations/available-sites-accordion"
import { PricingSummary } from "@/components/dashboard/reservations/pricing-summary"
import { SpousePartnerSection } from "@/components/dashboard/reservations/spouse-partner-section"
import { ChildrenList } from "@/components/dashboard/reservations/children-list"
import { PetsInfoList } from "@/components/dashboard/reservations/pets-info-list"
import { VehicleInfoStep } from "@/components/dashboard/reservations/vehicle-info-step"
import type { PricingConfig, RateDiscountsConfig, DepositConfig, BookingType, BookingRulesConfig } from '@/lib/config/types'
import { parseEnabledReservationTypesFromDB, resolveBookingRulesConfig } from '@/lib/config/resolution'
import { BookingDateRangePicker, type DateRangeValue } from '@/components/guest/booking-date-range-picker'
import {
  extractOpenPeriodFromPropertySettings,
  openPeriodRestrictsBookings,
  isStayWithinOpenPeriodByIsoDates,
  buildOpenPeriodBookingErrorMessage,
} from '@/lib/booking/open-period'
import { Checkbox } from '@/components/ui/checkbox'

// Form validation schema - Enhanced with spouse, children, and vehicles
const manualBookingSchema = z.object({
  // Site selection
  siteId: z.string().min(1, "Please select a site"),
  checkInDate: z.string().min(1, "Check-in date is required"),
  checkOutDate: z.string().min(1, "Check-out date is required"),
  stayType: z.enum(["nightly", "weekly", "monthly", "seasonal", "long_term"]).default("nightly"),

  // Occupancy counts
  numAdults: z.number().min(1, "At least one adult is required"),
  numChildren: z.number().min(0).optional(),
  numPets: z.number().min(0).optional(),
  numVehicles: z.number().min(0).optional(),

  // Primary guest information
  guestFirstName: z.string().min(1, "First name is required"),
  guestLastName: z.string().min(1, "Last name is required"),
  guestEmail: z.string().email("Invalid email address"),
  guestPhone: z.string().min(1, "Phone number is required"),
  guestAddress: z.string().optional(),
  guestCity: z.string().optional(),
  guestState: z.string().optional(),
  guestZipCode: z.string().optional(),

  // Spouse/Partner (optional)
  spouse: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    is_alternate_contact: z.boolean().default(false),
  }).optional(),

  // Children (optional array)
  children: z.array(z.object({
    first_name: z.string().min(1, "Child name is required"),
    age: z.number().min(0).max(17).optional(),
    date_of_birth: z.string().optional(),
    special_needs_allergies: z.string().optional(),
  })).optional(),

  pets: z.array(z.object({
    name: z.string().min(1, "Pet name is required"),
    type: z.enum(['dog', 'cat', 'bird', 'other']),
    breed: z.string().optional(),
    weight_lbs: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).optional(),

  // Vehicles (optional array)
  vehicles: z.array(z.object({
    vehicle_type: z.enum(['personal', 'rv', 'tow_vehicle']),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional(),
    color: z.string().optional(),
    license_plate: z.string().optional(),
    license_plate_state: z.string().optional(),
    personal_vehicle_type: z.enum(['car', 'truck', 'suv', 'motorcycle', 'boat_trailer', 'other']).optional(),
    rv_type: z.enum(['class_a', 'class_b', 'class_c', 'fifth_wheel', 'travel_trailer', 'popup', 'truck_camper', 'toy_hauler']).optional(),
    rv_length_feet: z.number().optional(),
    rv_width_feet: z.number().optional(),
    num_slide_outs: z.number().optional(),
    insurance_company: z.string().optional(),
    insurance_policy_number: z.string().optional(),
    is_primary: z.boolean().optional(),
  })).optional(),

  // Evacuation contact (optional)
  evacuationContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.string().optional(),
  }).optional(),

  // Payment
  paymentMode: z.enum(['cash', 'check', 'card', 'send_link']).default('cash'),
  paymentMethod: z.enum(["credit_card", "debit_card", "cash", "check"]).optional(),
  paidAmount: z.string().optional(), // Will convert to cents
  paymentNotes: z.string().optional(),

  // Manual discounts/fees
  selectedDiscountIds: z.array(z.string()).optional(),
  selectedFeeIds: z.array(z.string()).optional(),

  // Notes
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
  weekly_rate_cents?: number
  monthly_rate_cents?: number
  amenities: Record<string, boolean>
  image_url?: string
}


// Booking type friendly labels and descriptions
const BOOKING_TYPE_INFO: Record<BookingType, { label: string; description: string }> = {
  nightly: { label: 'Nightly', description: 'Standard short-term stay (1-6 nights)' },
  weekly: { label: 'Weekly', description: '7+ nights with weekly rate' },
  monthly: { label: 'Monthly', description: '28+ nights with monthly rate' },
  seasonal: { label: 'Seasonal', description: 'Multi-month seasonal stay' },
  long_term: { label: 'Long Term', description: 'Extended stay arrangement' },
}

export default function NewReservationPage() {
  const router = useRouter()
  const params = useParams()
  const propertyIdFromUrl = typeof params?.propertyId === "string" ? params.propertyId : null

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
  const [enabledReservationTypes, setEnabledReservationTypes] = useState<BookingType[]>(['nightly', 'weekly', 'monthly', 'seasonal'])
  const [siteTypeConfig, setSiteTypeConfig] = useState<{ allowed_site_types?: string[] } | null>(null)
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([])
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([])
  const [summaryTotalCents, setSummaryTotalCents] = useState<number | null>(null)
  const [bookingRulesConfig, setBookingRulesConfig] = useState<BookingRulesConfig | null>(null)
  const [propertyName, setPropertyName] = useState<string | null>(null)
  const [openPeriodFrom, setOpenPeriodFrom] = useState<string | null>(null)
  const [openPeriodUntil, setOpenPeriodUntil] = useState<string | null>(null)
  const { toast } = useToast()
  const lastHolidayToastKeyRef = useRef<string | null>(null)
  /** Set when search-availability fails (e.g. OPEN_PERIOD) so Step 2 can show a specific message */
  const [availabilitySearchFailure, setAvailabilitySearchFailure] = useState<{
    code: string | null
    message: string
  } | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeValue>()

  // Collapsible section states
  const [spouseOpen, setSpouseOpen] = useState(false)
  const [childrenOpen, setChildrenOpen] = useState(false)
  const [petsOpen, setPetsOpen] = useState(false)
  const getHolidayMinStayViolation = (
    holidays: HolidayRule[] | undefined,
    checkInIso: string,
    checkOutIso: string,
  ): { rule: HolidayRule; holidayNights: number } | null => {
    if (!holidays || holidays.length === 0) return null

    const toDate = (iso: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
      if (!m) return new Date(Number.NaN)
      return new Date(Number(m[1]!), Number(m[2]!) - 1, Number(m[3]!))
    }
    const dayMs = 1000 * 60 * 60 * 24
    const checkIn = toDate(checkInIso)
    const checkOut = toDate(checkOutIso)
    const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / dayMs)

    for (const rule of holidays) {
      if (!rule.enabled) continue

      const inHolidayCheckIn = checkInIso >= rule.start_date && checkInIso <= rule.end_date
      const inHolidayCheckOut = checkOutIso >= rule.start_date && checkOutIso <= rule.end_date

      let holidayNights = 0
      if (inHolidayCheckIn) {
        holidayNights = totalNights
      } else if (inHolidayCheckOut) {
        const holidayStart = toDate(rule.start_date)
        const overlapStart = checkIn > holidayStart ? checkIn : holidayStart
        holidayNights = Math.floor((checkOut.getTime() - overlapStart.getTime()) / dayMs) + 1
      }

      if (
        holidayNights > 0 && 
        (holidayNights < rule.min_stay_nights ||
          (rule.max_stay_nights != null && holidayNights > rule.max_stay_nights)
        )
      ) {
        return { rule, holidayNights }
      }
    }

    return null
  }

  const methods = useForm<ManualBookingFormData>({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      checkInDate: '',
      checkOutDate: '',
      numAdults: 1,
      numChildren: 0,
      numPets: 0,
      numVehicles: 0,
      paymentMode: "cash",
      paymentMethod: "cash",
      spouse: {
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        is_alternate_contact: false,
      },
      children: [],
      pets: [],
      vehicles: [],
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = methods

  const selectedSiteId = watch("siteId")
  const checkInDate = watch("checkInDate")
  const checkOutDate = watch("checkOutDate")
  const stayType = watch("stayType")
  const numAdults = watch("numAdults")
  const numChildren = watch("numChildren")
  const numPets = watch("numPets")
  const pets = watch("pets")
  const paymentMethod = watch("paymentMethod")
  const validPetsCount = (pets ?? []).filter((pet) => {
    if (!pet) return false
    const hasName = typeof pet.name === 'string' && pet.name.trim().length > 0
    const hasType = typeof pet.type === 'string' && pet.type.trim().length > 0
    return hasName && hasType
  }).length
  const effectiveNumPets = validPetsCount > 0 ? validPetsCount : (numPets || 0)

  useEffect(() => {
    if (!checkInDate || !checkOutDate) return
    void trigger(['stayType', 'checkInDate', 'checkOutDate'])
  }, [stayType, checkInDate, checkOutDate, trigger])

  useEffect(() => {
    if (dateRange?.from) {
      setValue('checkInDate', format(dateRange.from, 'yyyy-MM-dd'), { shouldValidate: true })
    } else {
      setValue('checkInDate', '', { shouldValidate: true })
    }
    if (dateRange?.to) {
      setValue('checkOutDate', format(dateRange.to, 'yyyy-MM-dd'), { shouldValidate: true })
    } else {
      setValue('checkOutDate', '', { shouldValidate: true })
    }
  }, [dateRange, setValue])

  useEffect(() => {
    if (!checkInDate || !checkOutDate) {
      lastHolidayToastKeyRef.current = null
      return
    }

    // Only evaluate holiday toast after a complete, valid range is chosen.
    // This avoids showing a toast on the first click (check-in only / same-day draft).
    if (!dateRange?.from || !dateRange?.to) {
      lastHolidayToastKeyRef.current = null
      return
    }

    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    if (checkIn >= checkOut) {
      lastHolidayToastKeyRef.current = null
      return
    }

    const holidayViolation = getHolidayMinStayViolation(
      bookingRulesConfig?.holiday_rules,
      checkInDate,
      checkOutDate
    )

    if (!holidayViolation) {
      lastHolidayToastKeyRef.current = null
      return
    }
    const toastKey = `${holidayViolation.rule.id}:${checkInDate}:${checkOutDate}:${holidayViolation.holidayNights}:${holidayViolation.rule.min_stay_nights}`
    if (lastHolidayToastKeyRef.current === toastKey) return
    lastHolidayToastKeyRef.current = toastKey

    toast({
      title: "Holiday stay rule",
      description:
        holidayViolation.rule.max_stay_nights != null &&
        holidayViolation.holidayNights > holidayViolation.rule.max_stay_nights
          ? `The date you selected is in ${holidayViolation.rule.title} and the maximum nights of stay is ${holidayViolation.rule.max_stay_nights}. You currently have ${holidayViolation.holidayNights} night${holidayViolation.holidayNights === 1 ? "" : "s"} in this holiday period.`
          : `The date you selected is in ${holidayViolation.rule.title} and the minimum nights of stay is ${holidayViolation.rule.min_stay_nights}. You currently have ${holidayViolation.holidayNights} night${holidayViolation.holidayNights === 1 ? "" : "s"} in this holiday period.`,
      variant: "destructive",
    })
  }, [checkInDate, checkOutDate, bookingRulesConfig, toast, dateRange])

  // Fetch property config from URL propertyId
  useEffect(() => {
    if (!propertyIdFromUrl) {
      setError("Invalid property")
      return
    }

    const fetchProperty = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError("Please log in to create reservations")
        return
      }

      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .select("id, name, pricing_config, rate_discounts_config, deposit_config, enabled_reservation_types, site_type_config, booking_rules_config, settings")
        .eq("id", propertyIdFromUrl)
        .maybeSingle()

      if (propertyError || !property) {
        setError("No property found for your account")
        return
      }

      setPropertyId(property.id)
      setPropertyName(property.name ?? null)
      const { openPeriodFrom: from, openPeriodUntil: until } = extractOpenPeriodFromPropertySettings(
        (property as { settings?: unknown }).settings,
      )
      setOpenPeriodFrom(from)
      setOpenPeriodUntil(until)
      setBookingRulesConfig(
        resolveBookingRulesConfig(
          (property as { booking_rules_config?: BookingRulesConfig | null }).booking_rules_config ?? null,
          null
        ).config
      )
      setPricingConfig(property.pricing_config as PricingConfig | null)
      setRateDiscountsConfig(property.rate_discounts_config as RateDiscountsConfig | null)
      setDepositConfig(property.deposit_config as DepositConfig | null)
      setSiteTypeConfig(
        (property as { site_type_config?: { allowed_site_types?: string[] } }).site_type_config ?? null
      )

      const parsedEnabledTypes = parseEnabledReservationTypesFromDB(property.enabled_reservation_types)
      setEnabledReservationTypes(parsedEnabledTypes)

      if (parsedEnabledTypes.length > 0) {
        setValue("stayType", parsedEnabledTypes[0] as BookingType)
      }
    }

    void fetchProperty()
  }, [propertyIdFromUrl, setValue])

  // Check availability when dates or guest count changes
  useEffect(() => {
    if (!propertyId || !checkInDate || !checkOutDate) {
      setAvailableSites([])
      setTotalNights(0)
      setAvailabilitySearchFailure(null)
      return
    }

    // Validate dates
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)

    if (checkIn >= checkOut) {
      setAvailableSites([])
      setTotalNights(0)
      setAvailabilitySearchFailure(null)
      return
    }

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    setTotalNights(nights)

    const holidayViolation = getHolidayMinStayViolation(
      bookingRulesConfig?.holiday_rules,
      checkInDate,
      checkOutDate
    )

    if (holidayViolation) {
      setAvailableSites([])
      setAvailabilitySearchFailure({
        code: 'HOLIDAY_MIN_STAY',
        message:
          holidayViolation.rule.max_stay_nights != null &&
          holidayViolation.holidayNights > holidayViolation.rule.max_stay_nights
            ? `The date you selected is in ${holidayViolation.rule.title} and the maximum nights of stay is ${holidayViolation.rule.max_stay_nights}. You currently have ${holidayViolation.holidayNights} night${holidayViolation.holidayNights === 1 ? "" : "s"} in this holiday period.`
            : `The date you selected is in ${holidayViolation.rule.title} and the minimum nights of stay is ${holidayViolation.rule.min_stay_nights}. You currently have ${holidayViolation.holidayNights} night${holidayViolation.holidayNights === 1 ? "" : "s"} in this holiday period.`,
      })
      setError(null)
      return
    }

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
          setAvailabilitySearchFailure(null)
          setAvailableSites(result.data.sites || [])

          // Clear selected site if it's no longer available
          if (selectedSiteId && !result.data.sites.find((s: AvailableSite) => s.id === selectedSiteId)) {
            setValue("siteId", "")
          }
        } else {
          const code = typeof result.error?.code === 'string' ? result.error.code : null
          const msg =
            typeof result.error?.message === 'string' && result.error.message.length > 0
              ? result.error.message
              : 'Failed to check availability'
          setAvailabilitySearchFailure({ code, message: msg })
          if (code === 'OPEN_PERIOD') {
            setError(null)
          } else {
            setError(msg)
          }
          setAvailableSites([])
        }
      } catch (err) {
        console.error('Availability check error:', err)
        setAvailabilitySearchFailure({ code: null, message: 'Failed to check availability. Please try again.' })
        setError('Failed to check availability. Please try again.')
        setAvailableSites([])
      } finally {
        setCheckingAvailability(false)
      }
    }

    checkAvailability()
  }, [propertyId, checkInDate, checkOutDate, numAdults, numChildren, selectedSiteId, setValue, bookingRulesConfig])

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

      if (!propertyId) {
        throw new Error('Property not loaded')
      }

      if (
        openPeriodRestrictsBookings(openPeriodFrom, openPeriodUntil) &&
        !isStayWithinOpenPeriodByIsoDates(
          data.checkInDate,
          data.checkOutDate,
          openPeriodFrom,
          openPeriodUntil,
        )
      ) {
        const fromIso = openPeriodFrom?.trim()
        const untilIso = openPeriodUntil?.trim()
        setError(
          fromIso && untilIso && propertyName
            ? buildOpenPeriodBookingErrorMessage(propertyName, fromIso, untilIso)
            : 'Selected dates are outside the property booking season.',
        )
        setLoading(false)
        return
      }

      // Convert paid amount from dollars to cents
      const paidAmountCents = data.paidAmount
        ? Math.round(parseFloat(data.paidAmount) * 100)
        : 0

      // Prepare spouse data (only if filled in) - use camelCase for v1 API
      const spouseData = data.spouse?.first_name && data.spouse?.last_name
        ? {
          firstName: data.spouse.first_name,
          lastName: data.spouse.last_name,
          phone: data.spouse.phone || null,
          email: data.spouse.email || null,
          isAlternateContact: data.spouse.is_alternate_contact || false,
        }
        : null

      // Prepare children data (filter out empty entries, convert to camelCase)
      const childrenData = (data.children?.filter(c => c.first_name) || []).map(c => ({
        firstName: c.first_name,
        age: c.age ?? null,
        dateOfBirth: c.date_of_birth || null,
        specialNeedsAllergies: c.special_needs_allergies || null,
      }))

      const petsData = (data.pets?.filter((p) => p.name && p.type) || []).map((p) => ({
        name: p.name,
        type: p.type,
        breed: p.breed || null,
        weightLbs: p.weight_lbs ?? null,
        notes: p.notes || null,
      }))

      // Prepare vehicles data (filter out entries without vehicle_type, convert to camelCase)
      const vehiclesData = (data.vehicles?.filter(v => v.vehicle_type) || []).map(v => ({
        vehicleType: v.vehicle_type,
        make: v.make || null,
        model: v.model || null,
        year: v.year ?? null,
        color: v.color || null,
        licensePlate: v.license_plate || null,
        licensePlateState: v.license_plate_state || null,
        personalVehicleType: v.personal_vehicle_type || null,
        rvType: v.rv_type || null,
        rvLengthFeet: v.rv_length_feet ?? null,
        rvWidthFeet: v.rv_width_feet ?? null,
        numSlideOuts: v.num_slide_outs || 0,
        insuranceCompany: v.insurance_company || null,
        insurancePolicyNumber: v.insurance_policy_number || null,
        isPrimary: v.is_primary || false,
      }))

      // Update numVehicles count based on actual vehicles added
      const actualNumVehicles = vehiclesData.length > 0 ? vehiclesData.length : (data.numVehicles || 0)

      // Total from pricing (same as Pricing Summary base: rate × nights, in cents)
      const submitNights = Math.ceil(
        (new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      const selectedSite = availableSites.find((s) => s.id === data.siteId)
      const totalAmountCents =
        summaryTotalCents ??
        (selectedSite ? selectedSite.base_price_per_night * submitNights : 0)

      // Debug: Log what we're sending
      console.log('[Manual Reservation Form] Submitting with:', {
        siteId: data.siteId,
        propertyId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        totalAmountCents,
      })

      // Use v1 API endpoint
      const response = await fetch(`/api/v1/properties/${propertyId}/reservations/manual`, {
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
          numChildren: childrenData.length > 0 ? childrenData.length : (data.numChildren || 0),
          numPets: petsData.length > 0 ? petsData.length : (data.numPets || 0),
          pets: petsData,
          numVehicles: actualNumVehicles,
          guest: {
            firstName: data.guestFirstName,
            lastName: data.guestLastName,
            email: data.guestEmail,
            phone: data.guestPhone,
            address: data.guestAddress || null,
            city: data.guestCity || null,
            state: data.guestState || null,
            zipCode: data.guestZipCode || null,
          },
          // Extended data (camelCase for v1 API)
          spousePartner: spouseData,
          children: childrenData,
          vehicles: vehiclesData,
          evacuationContact: data.evacuationContact?.name
            ? {
              name: data.evacuationContact.name,
              phone: data.evacuationContact.phone,
              relationship: data.evacuationContact.relationship || null,
            }
            : null,
          // Payment
          paymentMode: data.paymentMode,
          paymentMethod: data.paymentMethod,
          paidAmountCents: paidAmountCents,
          totalAmountCents: totalAmountCents > 0 ? totalAmountCents : undefined,
          paymentNotes: data.paymentNotes || null,
          // Discounts/fees
          selectedDiscountIds,
          selectedFeeIds,
          // Notes
          specialRequests: data.specialRequests || null,
          notes: data.notes || null,
        }),
      })

      const result = await response.json()

      // Debug: Log the response
      console.log('[Manual Reservation Form] Response:', { ok: response.ok, status: response.status, result })

      if (!response.ok || !result.success) {
        // Prefer the detailed message (buried in details by the API error helper) over the generic SYS_001 message
        const message =
          result.error?.details?.message ||
          result.error?.message ||
          result.error ||
          "Failed to create reservation"
        throw new Error(message)
      }

      setSuccess(true)

      // Redirect to reservations page after a brief delay
      setTimeout(() => {
        router.push(propertyIdFromUrl ? `/dashboard/${propertyIdFromUrl}/reservations` : "/dashboard")
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


  const selectedSite = availableSites.find(s => s.id === selectedSiteId)

  const STAY_TYPE_MIN_NIGHTS: Record<BookingType, number> = {
    nightly: 1,
    weekly: 7,
    monthly: 28,
    seasonal: 28,
    long_term: 28,
  }
  const holidayViolationForSelection =
    checkInDate && checkOutDate
      ? getHolidayMinStayViolation(bookingRulesConfig?.holiday_rules, checkInDate, checkOutDate)
      : null
  const holidayMinStayNotMet =
    holidayViolationForSelection != null

  const getStep2NoSitesMessage = () => {
    if (
      (availabilitySearchFailure?.code === 'OPEN_PERIOD' || availabilitySearchFailure?.code === 'HOLIDAY_MIN_STAY') &&
      availabilitySearchFailure.message
    ) {
      return availabilitySearchFailure.message
    }
    if (
      openPeriodRestrictsBookings(openPeriodFrom, openPeriodUntil) &&
      propertyName &&
      checkInDate &&
      checkOutDate &&
      !isStayWithinOpenPeriodByIsoDates(checkInDate, checkOutDate, openPeriodFrom, openPeriodUntil)
    ) {
      const f = openPeriodFrom?.trim()
      const u = openPeriodUntil?.trim()
      if (f && u) return buildOpenPeriodBookingErrorMessage(propertyName, f, u)
    }
    return 'No sites available for the selected dates. Try different dates.'
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Create Manual Reservation</h1>
        <p className="text-sm text-muted-foreground sm:text-base">For phone or walk-in bookings</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Main Form - Left Column */}
        <div className="lg:col-span-2">
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              {/* Date Selection - Priority #1 for phone bookings */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Calendar className="h-5 w-5" />
                    Step 1: Stay Type & Dates
                  </CardTitle>
                  <CardDescription>Select the stay type and enter guest&apos;s desired dates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:space-y-4 sm:px-6 sm:pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="stayType">Stay Type *</Label>
                      <Select
                        value={watch("stayType")}
                        onValueChange={(value) => setValue("stayType", value as BookingType)}
                      >
                        <SelectTrigger id="stayType" className="w-full">
                          <SelectValue placeholder="Select stay type" />
                        </SelectTrigger>
                        <SelectContent>
                          {enabledReservationTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {BOOKING_TYPE_INFO[type]?.label || type} ({BOOKING_TYPE_INFO[type]?.description || ''})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.stayType && (
                        <p className="text-sm text-destructive dark:text-red-300">{errors.stayType.message}</p>
                      )}
                      {stayType &&
                        totalNights > 0 &&
                        totalNights < STAY_TYPE_MIN_NIGHTS[stayType] && (
                          <p className="text-sm text-amber-600 dark:text-amber-500">
                            You should reserve {STAY_TYPE_MIN_NIGHTS[stayType]} nights to use the{' '}
                            {BOOKING_TYPE_INFO[stayType]?.label?.toLowerCase() ?? stayType} rate.
                          </p>
                        )}
                      <p className="text-sm text-muted-foreground">
                        Determines pricing and discount eligibility
                      </p>
                    </div>

                    <div className="min-w-0 space-y-2">
                      <input type="hidden" {...register('checkInDate')} />
                      <input type="hidden" {...register('checkOutDate')} />
                      <BookingDateRangePicker
                        variant="dashboard"
                        label="Check-in & Check-out"
                        value={dateRange}
                        onChange={setDateRange}
                        sameDayBookingEnabled={bookingRulesConfig?.same_day_booking_enabled ?? true}
                        blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
                        openPeriodFrom={openPeriodFrom}
                        openPeriodUntil={openPeriodUntil}
                        {...(bookingRulesConfig?.booking_window_days != null
                          ? { bookingWindowDays: bookingRulesConfig.booking_window_days }
                          : {})}
                        {...(bookingRulesConfig?.advance_notice_days != null
                          ? { advanceNoticeDays: bookingRulesConfig.advance_notice_days }
                          : {})}
                        numberOfMonths={1}
                      />
                      {(errors.checkInDate || errors.checkOutDate) && (
                        <p className="text-sm text-destructive dark:text-red-300">
                          {errors.checkInDate?.message ?? errors.checkOutDate?.message}
                        </p>
                      )}
                      {bookingRulesConfig &&
                        totalNights > 0 &&
                        totalNights < bookingRulesConfig.min_stay_nights && (
                          <p className="text-sm text-amber-600 dark:text-amber-500">
                            Property booking rules require at least {bookingRulesConfig.min_stay_nights} night
                            {bookingRulesConfig.min_stay_nights === 1 ? '' : 's'}.
                          </p>
                        )}
                      {bookingRulesConfig?.max_stay_nights != null &&
                        Number.isFinite(bookingRulesConfig.max_stay_nights) &&
                        totalNights > 0 &&
                        totalNights > bookingRulesConfig.max_stay_nights && (
                          <p className="text-sm text-amber-600 dark:text-amber-500">
                            Property booking rules allow at most {bookingRulesConfig.max_stay_nights} night
                            {bookingRulesConfig.max_stay_nights === 1 ? '' : 's'} per booking.
                          </p>
                        )}
                      {holidayMinStayNotMet && holidayViolationForSelection && (
                        <p className="text-sm text-amber-600 dark:text-amber-500">
                          The date you selected is in {holidayViolationForSelection.rule.title} and the {holidayViolationForSelection.rule.max_stay_nights != null &&
                            holidayViolationForSelection.holidayNights > holidayViolationForSelection.rule.max_stay_nights
                              ? `maximum nights of stay is ${holidayViolationForSelection.rule.max_stay_nights}. You currently have ${holidayViolationForSelection.holidayNights} night${holidayViolationForSelection.holidayNights === 1 ? "" : "s"} in this holiday period.`
                              : `minimum nights of stay is ${holidayViolationForSelection.rule.min_stay_nights}. You currently have ${holidayViolationForSelection.holidayNights} night${holidayViolationForSelection.holidayNights === 1 ? "" : "s"} in this holiday period.`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                    <div>
                      <Label htmlFor="numAdults">Adults *</Label>
                      <Input
                        id="numAdults"
                        type="number"
                        min="1"
                        {...register("numAdults", { valueAsNumber: true })}
                      />
                      {errors.numAdults && (
                        <p className="mt-1 text-sm text-destructive dark:text-red-300">{errors.numAdults.message}</p>
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
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        Step 2: Select Site
                        {checkingAvailability && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </CardTitle>
                      <CardDescription>
                        {availableSites.length > 0
                          ? `${availableSites.length} site${availableSites.length > 1 ? 's' : ''} available for selected dates`
                          : checkInDate && checkOutDate && !checkingAvailability
                            ? getStep2NoSitesMessage()
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
                <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
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
                          ? getStep2NoSitesMessage()
                          : "Enter dates and guest count above to see available sites."}
                      </p>
                    </div>
                  ) : (
                    <AvailableSitesAccordion
                      sites={availableSites}
                      selectedSiteId={selectedSiteId}
                      onSiteSelect={(siteId) => setValue("siteId", siteId)}
                      stayType={stayType}
                      propertyPricingConfig={siteTypeConfig ? { site_type_config: siteTypeConfig } : null}
                    />
                  )}

                  {errors.siteId && (
                    <p className="mt-4 text-sm text-destructive dark:text-red-300">{errors.siteId.message}</p>
                  )}

                  {selectedSite && estimatedTotal > 0 && (
                    <Alert className="bg-blue-500/10 text-blue-500 border-blue-500/20 mt-6">
                      <DollarSign className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          {(() => {
                            // Use same effective stay type and calculation as Pricing Summary.
                            const STAY_MIN: Record<BookingType, number> = {
                              nightly: 1,
                              weekly: 7,
                              monthly: 28,
                              seasonal: 28,
                              long_term: 28,
                            }
                            const hasWeekly = (selectedSite.weekly_rate_cents ?? 0) > 0
                            const hasMonthly = (selectedSite.monthly_rate_cents ?? 0) > 0

                            const pricingEffectiveStayType: BookingType =
                              stayType === 'nightly'
                                ? totalNights >= STAY_MIN.monthly
                                  ? (hasMonthly ? 'monthly' : hasWeekly ? 'weekly' : 'nightly')
                                  : totalNights >= STAY_MIN.weekly
                                    ? (hasWeekly ? 'weekly' : 'nightly')
                                    : 'nightly'
                                : stayType === 'monthly' && totalNights >= STAY_MIN.monthly
                                  ? (hasMonthly ? 'monthly' : hasWeekly ? 'weekly' : 'nightly')
                                  : (stayType === 'monthly' || stayType === 'weekly') && totalNights >= STAY_MIN.weekly
                                    ? (hasWeekly ? 'weekly' : 'nightly')
                                    : stayType

                            const nightlyCents = selectedSite.base_price_per_night
                            let totalCents: number
                            let detailLabel: string

                            if (pricingEffectiveStayType === 'monthly') {
                              const monthlyCents = selectedSite.monthly_rate_cents ?? 0
                              const fullMonths = Math.floor(totalNights / 28)
                              const remainderNights = totalNights % 28
                              totalCents = fullMonths * monthlyCents + remainderNights * nightlyCents
                              detailLabel =
                                remainderNights === 0
                                  ? `${fullMonths} month${fullMonths !== 1 ? 's' : ''} (${formatMoney(monthlyCents)}/month)`
                                  : `${fullMonths} month${fullMonths !== 1 ? 's' : ''} (${formatMoney(monthlyCents)}) + ${remainderNights} night${remainderNights !== 1 ? 's' : ''} (${formatMoney(nightlyCents)}/night)`
                            } else if (pricingEffectiveStayType === 'weekly') {
                              const weeklyCents = selectedSite.weekly_rate_cents ?? selectedSite.base_price_per_night * 7
                              const fullWeeks = Math.floor(totalNights / 7)
                              const remainderNights = totalNights % 7
                              totalCents = fullWeeks * weeklyCents + remainderNights * nightlyCents
                              detailLabel =
                                remainderNights === 0
                                  ? `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents)}/week)`
                                  : `${fullWeeks} week${fullWeeks !== 1 ? 's' : ''} (${formatMoney(weeklyCents)}) + ${remainderNights} night${remainderNights !== 1 ? 's' : ''} (${formatMoney(nightlyCents)}/night)`
                            } else {
                              totalCents = nightlyCents * totalNights
                              detailLabel = `${formatMoney(nightlyCents)}/night × ${totalNights} night${totalNights !== 1 ? 's' : ''}`
                            }

                            return (
                              <>
                                <div>
                                  <strong>Total for {selectedSite.name}</strong>
                                  <div className="text-xs mt-1">
                                    {detailLabel}
                                  </div>
                                </div>
                                <div className="text-2xl font-bold">
                                  {formatMoney(totalCents)}
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Discounts & Additional Charges Selection */}
              {(rateDiscountsConfig || pricingConfig) && (
                <Card>
                  <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
                    <CardTitle className="text-lg sm:text-xl">Discounts & Additional Charges</CardTitle>
                    <CardDescription>
                      Select any manual discounts or additional charges to apply
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:space-y-6 sm:px-6 sm:pb-6">
                    {/* Manual Discounts */}
                    {rateDiscountsConfig?.user_defined_discounts && rateDiscountsConfig.user_defined_discounts.filter(d => d.enabled && d.trigger_type === 'manual').length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium sm:text-base">Available Discounts</Label>
                        <div className="space-y-2">
                          {rateDiscountsConfig.user_defined_discounts
                            .filter(d => d.enabled && d.trigger_type === 'manual')
                            .map((discount) => (
                              <div key={discount.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                                <Checkbox
                                  id={`discount-${discount.id}`}
                                  checked={selectedDiscountIds.includes(discount.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedDiscountIds([...selectedDiscountIds, discount.id])
                                    } else {
                                      setSelectedDiscountIds(selectedDiscountIds.filter(id => id !== discount.id))
                                    }
                                  }}
                                />
                                <div className="flex-1">
                                  <label htmlFor={`discount-${discount.id}`} className="font-medium cursor-pointer">
                                    {discount.title}
                                    <span className="ml-2 text-sm text-muted-foreground">
                                      ({discount.discount_type === 'flat_amount'
                                        ? `$${((discount.value_cents ?? 0) / 100).toFixed(2)} off`
                                        : `${discount.value_percentage ?? 0}% off`})
                                    </span>
                                  </label>
                                  {discount.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{discount.description}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Manual Fees (Additional Charges) */}
                    {pricingConfig?.user_defined_fees && pricingConfig.user_defined_fees.filter(f => f.enabled && f.trigger_type === 'manual').length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium sm:text-base">Additional Charges</Label>
                        <div className="space-y-2">
                          {pricingConfig.user_defined_fees
                            .filter(f => f.enabled && f.trigger_type === 'manual')
                            .map((fee) => (
                              <div key={fee.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                                <Checkbox
                                  id={`fee-${fee.id}`}
                                  checked={selectedFeeIds.includes(fee.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedFeeIds([...selectedFeeIds, fee.id])
                                    } else {
                                      setSelectedFeeIds(selectedFeeIds.filter(id => id !== fee.id))
                                    }
                                  }}
                                />
                                <div className="flex-1">
                                  <label htmlFor={`fee-${fee.id}`} className="font-medium cursor-pointer">
                                    {fee.title}
                                    <span className="ml-2 text-sm text-muted-foreground">
                                      ({fee.fee_type === 'percentage_of_subtotal' || fee.fee_type === 'percentage_of_total'
                                        ? `${fee.value_percentage ?? 0}%`
                                        : `$${((fee.value_cents ?? 0) / 100).toFixed(2)}`}
                                      {fee.fee_type === 'per_night' && '/night'}
                                      {fee.fee_type === 'per_guest' && '/guest'}
                                      {fee.fee_type === 'per_guest_per_night' && '/guest/night'})
                                    </span>
                                  </label>
                                  {fee.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{fee.description}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Show message if no manual discounts/fees available */}
                    {(!rateDiscountsConfig?.user_defined_discounts?.some(d => d.enabled && d.trigger_type === 'manual') &&
                      !pricingConfig?.user_defined_fees?.some(f => f.enabled && f.trigger_type === 'manual')) && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No manual discounts or additional charges configured. Automatic discounts and charges will be applied based on booking details.
                        </p>
                      )}
                  </CardContent>
                </Card>
              )}

              {/* Guest Information */}
              <Card>
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Users className="h-5 w-5" />
                    Step 3: Guest Information
                  </CardTitle>
                  <CardDescription>Contact details for the primary guest and family members</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:space-y-6 sm:px-6 sm:pb-6">
                  {/* Primary Guest */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Primary Guest</h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div>
                        <Label htmlFor="guestFirstName">First Name *</Label>
                        <Input
                          id="guestFirstName"
                          {...register("guestFirstName")}
                        />
                        {errors.guestFirstName && (
                          <p className="mt-1 text-sm text-destructive dark:text-red-300">{errors.guestFirstName.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="guestLastName">Last Name *</Label>
                        <Input
                          id="guestLastName"
                          {...register("guestLastName")}
                        />
                        {errors.guestLastName && (
                          <p className="mt-1 text-sm text-destructive dark:text-red-300">{errors.guestLastName.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div>
                        <Label htmlFor="guestEmail">Email *</Label>
                        <Input
                          id="guestEmail"
                          type="email"
                          {...register("guestEmail")}
                        />
                        {errors.guestEmail && (
                          <p className="mt-1 text-sm text-destructive dark:text-red-300">{errors.guestEmail.message}</p>
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
                          <p className="mt-1 text-sm text-destructive dark:text-red-300">{errors.guestPhone.message}</p>
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
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
                  </div>

                  {/* Spouse/Partner Section */}
                  <SpousePartnerSection
                    isOpen={spouseOpen}
                    onOpenChange={setSpouseOpen}
                  />

                  {/* Children Section */}
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

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Emergency Contact (Optional)</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="evacuation_contact_name">Contact Name</Label>
                        <Input id="evacuation_contact_name" {...register("evacuationContact.name")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="evacuation_contact_phone">Contact Phone</Label>
                        <Input
                          id="evacuation_contact_phone"
                          type="tel"
                          {...register("evacuationContact.phone")}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 4: Vehicle Information */}
              <VehicleInfoStep
                maxVehicles={5}
                showRVSection={true}
              />

              {/* Payment Information */}
              <Card>
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <DollarSign className="h-5 w-5" />
                    Step 5: Payment Information
                  </CardTitle>
                  <CardDescription>Payment method and amount</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:space-y-4 sm:px-6 sm:pb-6">
                  <div>
                    <Label htmlFor="paymentMethod">Payment Method *</Label>
                    <Select
                      value={paymentMethod || ''}
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

              {/* Pricing Summary (Mobile) */}
              <div className="lg:hidden">
                <PricingSummary
                  selectedSite={selectedSite || null}
                  numNights={totalNights}
                  stayType={stayType || 'nightly'}
                  numAdults={numAdults || 1}
                  numChildren={numChildren || 0}
                  numPets={effectiveNumPets}
                  pricingConfig={pricingConfig}
                  rateDiscountsConfig={rateDiscountsConfig}
                  depositConfig={depositConfig}
                  checkInDate={checkInDate}
                  checkOutDate={checkOutDate}
                  selectedDiscountIds={selectedDiscountIds}
                  selectedFeeIds={selectedFeeIds}
                  onTotalChange={setSummaryTotalCents}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/${propertyIdFromUrl}/reservations`)}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit"
                  disabled={
                    loading ||
                    !selectedSiteId ||
                    (totalNights > 0 &&
                      stayType != null &&
                      totalNights < STAY_TYPE_MIN_NIGHTS[stayType]) ||
                    (bookingRulesConfig != null &&
                      totalNights > 0 &&
                      totalNights < bookingRulesConfig.min_stay_nights) ||
                    holidayMinStayNotMet ||
                    (bookingRulesConfig?.max_stay_nights != null &&
                      Number.isFinite(bookingRulesConfig.max_stay_nights) &&
                      totalNights > bookingRulesConfig.max_stay_nights)
                  }
                  className="w-full sm:w-auto"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Creating..." : "Create Reservation"}
                </Button>
              </div>
            </form>
          </FormProvider>
        </div>

        {/* Pricing Summary - Right Column */}
        <div className="hidden lg:col-span-1 lg:block">
          <PricingSummary
            selectedSite={selectedSite || null}
            numNights={totalNights}
            stayType={stayType || 'nightly'}
            numAdults={numAdults || 1}
            numChildren={numChildren || 0}
            numPets={effectiveNumPets}
            pricingConfig={pricingConfig}
            rateDiscountsConfig={rateDiscountsConfig}
            depositConfig={depositConfig}
            checkInDate={checkInDate}
            checkOutDate={checkOutDate}
            selectedDiscountIds={selectedDiscountIds}
            selectedFeeIds={selectedFeeIds}
            onTotalChange={setSummaryTotalCents}
          />
        </div>
      </div>
    </div>
  )
}
