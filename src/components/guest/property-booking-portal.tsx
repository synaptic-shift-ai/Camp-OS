"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { differenceInCalendarDays, format } from "date-fns"
import Image from "next/image"
import {
  Tent,
  Home,
  TreePine,
  MapPin,
  Wifi,
  Droplets,
  Flame,
  Waves,
  Coffee,
  Mountain,
  Phone,
  Mail,
  Clock,
  Menu,
  X,
  Camera,
  Car,
  ImageOff,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SiteType } from "@/lib/booking/types"
import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/utils/format-time"
import type { BookingRulesConfig, HolidayRule } from "@/lib/config/types"
import { BookingDateRangePicker, type DateRangeValue } from "@/components/guest/booking-date-range-picker"
import { useToast } from "@/hooks/use-toast"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import Marquee from "react-fast-marquee"
import { GuestCancellationPolicyText } from "@/components/guest/guest-cancellation-policy-text"
import { PropertyAmenitiesDetailsDialog } from "@/components/guest/property-amenities-details-dialog"
import { FileText } from "lucide-react"
import {
  openPeriodRestrictsBookings,
  isStayWithinOpenPeriodByIsoDates,
  buildOpenPeriodBookingErrorMessage,
} from "@/lib/booking/open-period"

type BookingType = 'nightly' | 'weekly' | 'monthly' | 'seasonal'

const RESERVATION_TYPE_LABELS: Record<BookingType, string> = {
  nightly: 'Nightly Rate',
  weekly: 'Weekly Rate',
  monthly: 'Monthly Rate',
  seasonal: 'Seasonal Rate',
}

const SITE_TYPE_OPTIONS: { value: SiteType; label: string }[] = [
  { value: 'tent', label: 'Tent Sites' },
  { value: 'rv', label: 'RV Sites' },
  { value: 'cabin', label: 'Cabins' },
  { value: 'glamping', label: 'Glamping' },
  { value: 'yurt', label: 'Yurts' },
]

export type SiteTypeSummary = {
  id?: string
  type: SiteType
  name: string
  description: string
  price: number
  priceWeekly?: number
  priceMonthly?: number
  capacity: string
  amenities: string[]
  imageUrl?: string | null
  discountedPrice?: number
  discountEndDate?: string
  discountLabel?: string
  discountCondition?: string
}

type GalleryImageInput = string | { url: string; caption?: string }

interface PropertyBookingPortalProps {
  property: {
    id: string
    name: string
    city: string
    state: string
    description: string | null
    tagline: string | null
    hero_image_url: string | null
    gallery_images?: unknown
    check_in_time: string | null
    check_out_time: string | null
    phone: string | null
    email: string | null
    cancellation_policy: string | null
    amenities: Array<
      | string
      | {
        id?: string
        name?: string
        description?: string | null
        icon_url?: string | null
        iconUrl?: string | null
      }
    >
    enabled_reservation_types?: BookingType[]
    openPeriodFrom?: string | null
    openPeriodUntil?: string | null
  }
  slug: string
  siteTypeSummaries?: SiteTypeSummary[]
  recentBookings?: {
    name: string
    numberOfNights: number
    siteType: string
    timeAgo: string
  }[]
  /** Property booking rules (same-day booking, blackout dates, etc.) */
  bookingRulesConfig?: BookingRulesConfig | null
}

export function PropertyBookingPortal({ property, slug, siteTypeSummaries, recentBookings = [], bookingRulesConfig }: PropertyBookingPortalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const lastHolidayToastKeyRef = useRef<string | null>(null)

  const [checkInDate, setCheckInDate] = useState<Date>()
  const [checkOutDate, setCheckOutDate] = useState<Date>()
  const [dateRange, setDateRange] = useState<DateRangeValue>()
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [pets, setPets] = useState(0)
  const [selectedSiteType, setSelectedSiteType] = useState<SiteType | "" | "all">("")
  const [selectedReservationType, setSelectedReservationType] = useState<"" | "nightly" | "weekly" | "monthly" | "seasonal">("")
  const [isSearching, _setIsSearching] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const [activeGalleryImageIndex, setActiveGalleryImageIndex] = useState<number | null>(null)
  const lastScrollYRef = useRef(0)
  const scrollTickingRef = useRef(false)

  useEffect(() => {
    if (isMobileMenuOpen) {
      setHeaderHidden(false)
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    if (activeGalleryImageIndex === null) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGalleryImageIndex(null)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [activeGalleryImageIndex])

  useEffect(() => {
    const delta = 10
    const onScroll = () => {
      if (scrollTickingRef.current) return
      scrollTickingRef.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const last = lastScrollYRef.current

        if (y < 48) {
          setHeaderHidden(false)
        } else if (y > last + delta) {
          setHeaderHidden(true)
        } else if (y < last - delta) {
          setHeaderHidden(false)
        }

        lastScrollYRef.current = y
        scrollTickingRef.current = false
      })
    }

    lastScrollYRef.current = window.scrollY
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToSection = useCallback((sectionId: string) => {
    setIsMobileMenuOpen(false)
    setHeaderHidden(false)
    window.requestAnimationFrame(() => {
      const el = document.getElementById(sectionId)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        try {
          window.history.replaceState(null, "", `#${sectionId}`)
        } catch {
          /* ignore */
        }
      }
    })
  }, [])

  // Clear check-out when it becomes invalid after check-in change
  useEffect(() => {
    if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
      setCheckOutDate(undefined)
    }
  }, [checkInDate, checkOutDate])

  // Keep single-date state in sync with range picker
  useEffect(() => {
    setCheckInDate(dateRange?.from)
    setCheckOutDate(dateRange?.to)
  }, [dateRange])

  // Get available reservation types from property config (default to nightly, weekly, monthly)
  const availableReservationTypes: BookingType[] = property.enabled_reservation_types || ['nightly', 'weekly', 'monthly']

  const availableSiteTypeValues: SiteType[] = (() => {
    const summaries = (siteTypeSummaries ?? []) as SiteTypeSummary[]
    if (summaries.length === 0) {
      return SITE_TYPE_OPTIONS.map((opt) => opt.value)
    }
    const present = new Set<SiteType>(summaries.map((s) => s.type))
    return SITE_TYPE_OPTIONS.map((opt) => opt.value).filter((v) => present.has(v))
  })()

  const availableSiteTypeOptions = SITE_TYPE_OPTIONS.filter((opt) =>
    availableSiteTypeValues.includes(opt.value)
  )


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
          (rule.max_stay_nights != null && holidayNights > rule.max_stay_nights))
      ) {
        return { rule, holidayNights }
      }
    }

    return null
  }

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to || !bookingRulesConfig) {
      lastHolidayToastKeyRef.current = null
      return
    }

    const checkInStr = format(dateRange.from, "yyyy-MM-dd")
    const checkOutStr = format(dateRange.to, "yyyy-MM-dd")
    const holidayViolation = getHolidayMinStayViolation(
      bookingRulesConfig.holiday_rules,
      checkInStr,
      checkOutStr
    )

    if (!holidayViolation) {
      lastHolidayToastKeyRef.current = null
      return
    }

    const toastKey = `${holidayViolation.rule.id}:${checkInStr}:${checkOutStr}:${holidayViolation.holidayNights}:${holidayViolation.rule.min_stay_nights}`
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
  }, [dateRange, bookingRulesConfig, toast])

  const searchAvailability = async () => {
    if (!checkInDate || !checkOutDate) {
      toast({
        title: "Missing dates",
        description: "Please select check-in and check-out dates",
        variant: "destructive",
      })
      return
    }

    if (checkOutDate <= checkInDate) {
      if (checkInDate.getTime() === checkOutDate.getTime()) {
        toast({
          title: "Same-day booking",
          description: "Check-in and check-out cannot be on the same day. Please select a different check-out date.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Invalid dates",
          description: "Check-out date must be after check-in date.",
          variant: "destructive",
        })
      }
      return
    }

    const numberOfNights = differenceInCalendarDays(checkOutDate, checkInDate)
    const minStayNights = bookingRulesConfig?.min_stay_nights ?? 1
    const maxStayNights = bookingRulesConfig?.max_stay_nights ?? null

    if (minStayNights > 1 && numberOfNights < minStayNights) {
      toast({
        title: "Minimum stay required",
        description: `You must book at least ${minStayNights} night${minStayNights === 1 ? "" : "s"}.`,
        variant: "destructive",
      })
      return
    }

    if (typeof maxStayNights === "number" && Number.isFinite(maxStayNights) && numberOfNights > maxStayNights) {
      toast({
        title: "Maximum stay exceeded",
        description: `You can only book up to ${maxStayNights} night${maxStayNights === 1 ? "" : "s"} per booking.`,
        variant: "destructive",
      })
      return
    }

    if (adults < 1) {
      toast({
        title: "Invalid guest count",
        description: "At least 1 adult is required",
        variant: "destructive",
      })
      return
    }

    const checkInStr = format(checkInDate, "yyyy-MM-dd")
    const checkOutStr = format(checkOutDate, "yyyy-MM-dd")

    const holidayViolation = getHolidayMinStayViolation(
      bookingRulesConfig?.holiday_rules,
      checkInStr,
      checkOutStr
    )
    if (holidayViolation) {
      toast({
        title: "Holiday stay rule",
        description:
          holidayViolation.rule.max_stay_nights != null &&
            holidayViolation.holidayNights > holidayViolation.rule.max_stay_nights
            ? `The date you selected is in ${holidayViolation.rule.title} and the maximum nights of stay is ${holidayViolation.rule.max_stay_nights}. You currently have ${holidayViolation.holidayNights} night${holidayViolation.holidayNights === 1 ? "" : "s"} in this holiday period.`
            : `The date you selected is in ${holidayViolation.rule.title} and the minimum nights of stay is ${holidayViolation.rule.min_stay_nights}. You currently have ${holidayViolation.holidayNights} night${holidayViolation.holidayNights === 1 ? "" : "s"} in this holiday period.`,
        variant: "destructive",
      })
      return
    }

    if (
      openPeriodRestrictsBookings(property.openPeriodFrom, property.openPeriodUntil) &&
      !isStayWithinOpenPeriodByIsoDates(
        checkInStr,
        checkOutStr,
        property.openPeriodFrom,
        property.openPeriodUntil,
      )
    ) {
      const fromIso = property.openPeriodFrom?.trim()
      const untilIso = property.openPeriodUntil?.trim()
      toast({
        title: "Outside booking season",
        description:
          fromIso && untilIso
            ? buildOpenPeriodBookingErrorMessage(property.name, fromIso, untilIso)
            : "Selected dates are outside the property booking season.",
        variant: "destructive",
      })
      return
    }

    // Navigate to availability results page with search params
    const params = new URLSearchParams({
      slug: slug,
      propertyId: property.id,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      adults: adults.toString(),
      children: children.toString(),
      pets: pets.toString(),
    })

    if (selectedSiteType && selectedSiteType !== "all") {
      params.append("siteType", selectedSiteType)
    }

    if (selectedReservationType) {
      params.append("reservationType", selectedReservationType)
    }

    router.push(`/availability-results?${params.toString()}`)
  }

  const getSiteTypeIcon = (type: SiteType) => {
    switch (type) {
      case "tent":
        return Tent
      case "rv":
        return Car
      case "cabin":
        return TreePine
      default:
        return Home
    }
  }

  const amenityIcons: Record<string, any> = {
    wifi: Wifi,
    showers: Droplets,
    fire_pits: Flame,
    lake_access: Waves,
    camp_store: Coffee,
    hiking_trails: Mountain,
  }

  const defaultAmenities = [
    { key: "wifi", name: "Free WiFi", description: "Stay connected" },
    { key: "showers", name: "Hot Showers", description: "Clean facilities" },
    { key: "fire_pits", name: "Fire Pits", description: "Campfire ready" },
    { key: "lake_access", name: "Lake Access", description: "Swimming & fishing" },
    { key: "camp_store", name: "Camp Store", description: "Essentials & snacks" },
    { key: "hiking_trails", name: "Hiking Trails", description: "Nature walks" },
  ]

  const normalizeAmenityKey = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")

  const defaultAmenitiesByKey = useMemo(
    () => new Map(defaultAmenities.map((amenity) => [amenity.key, amenity])),
    []
  )

  const displayedAmenities = useMemo(() => {
    const fromDb = Array.isArray(property.amenities) ? property.amenities : []
    const parsed = fromDb
      .map((rawAmenity) => {
        if (typeof rawAmenity === "string") {
          const normalizedName = rawAmenity.trim()
          if (!normalizedName) return null
          const key = normalizeAmenityKey(normalizedName)
          const fallback = defaultAmenitiesByKey.get(key)
          return {
            key,
            name: normalizedName,
            description: fallback?.description ?? "Available at our campground",
            iconUrl: null,
          }
        }

        if (rawAmenity && typeof rawAmenity === "object") {
          const normalizedName = (rawAmenity.name ?? "").trim()
          if (!normalizedName) return null
          const key = normalizeAmenityKey(normalizedName)
          const fallback = defaultAmenitiesByKey.get(key)
          const iconUrl = (rawAmenity.icon_url ?? rawAmenity.iconUrl ?? "").trim() || null
          return {
            key,
            name: normalizedName,
            description:
              (rawAmenity.description ?? "").trim() ||
              fallback?.description ||
              "Available at our campground",
            iconUrl,
          }
        }

        return null
      })
      .filter((amenity): amenity is { key: string; name: string; description: string; iconUrl: string | null } => amenity !== null)

    const uniqueParsed = parsed.filter((amenity, index, array) => (
      array.findIndex((candidate) => candidate.key === amenity.key || candidate.name === amenity.name) === index
    ))

    if (uniqueParsed.length > 0) return uniqueParsed
    return defaultAmenities.map((amenity) => ({ ...amenity, iconUrl: null }))
  }, [defaultAmenitiesByKey, property.amenities])

  // Generate alt text from image URL
  function altFromUrl(url: string): string {
    try {
      const name = url.split("/").pop() || ""
      return name.replace(/\.[^.]+$/, "") || property.name
    } catch {
      return property.name
    }
  }

  const galleryImages = ((): { src: string; alt: string }[] => {
    const raw = property.gallery_images
    if (raw == null || !Array.isArray(raw) || raw.length === 0) return []
    return (raw as GalleryImageInput[]).map((item) => {
      const src = typeof item === "string" ? item : item?.url
      const alt =
        typeof item === "object" && item?.caption
          ? item.caption
          : src
            ? altFromUrl(src)
            : property.name
      return { src: src || "", alt: alt || property.name }
    }).filter((img) => img.src)
  })()

  // const bookingMessage = bookingStats && bookingStats.recentCount > 0
  // ? `${bookingStats.recentCount} booking${bookingStats.recentCount > 1 ? 's' : ''} in the last 7 days`
  // : null

  // const recentBookings = [
  //   { name: "Sarah M.", location: "Austin, TX", siteType: "RV Site", timeAgo: "2 minutes ago" },
  //   { name: "Mike K.", location: "Denver, CO", siteType: "Cabin", timeAgo: "8 minutes ago" },
  //   { name: "Lisa R.", location: "Phoenix, AZ", siteType: "Tent Site", timeAgo: "15 minutes ago" },
  // ]

  const trustBadges = [
    { icon: "🔒", text: "Secure Booking" },
    { icon: "💳", text: "Safe Payments" },
    { icon: "📞", text: "24/7 Support" },
    { icon: "✅", text: "Instant Confirmation" },
  ]

  const aboutText =
    (typeof property.description === "string" && property.description.trim().length > 0
      ? property.description.trim()
      : "Welcome to our beautiful campground! We offer a perfect blend of nature and comfort, with modern amenities and stunning natural surroundings. Whether you're looking for a peaceful retreat or an adventure-filled getaway, we have everything you need for an unforgettable camping experience.").trim()

  const aboutParagraphs = aboutText
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-background text-foreground">
      {/* Header */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 w-full max-w-full border-b border-gray-100 bg-white shadow-sm transition-transform duration-300 ease-out will-change-transform dark:border-border dark:bg-background",
          headerHidden ? "-translate-y-full" : "translate-y-0"
        )}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900")}>
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className={cn("text-xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>{property.name}</h1>
                {property.city || property.state ? (
                  <p className="text-sm text-muted-foreground">
                    {property.city}{property.city && property.state ? ', ' : ''}{property.state}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <button
                type="button"
                onClick={() => scrollToSection("sites")}
                className={cn(
                  "rounded-sm bg-transparent p-0 font-inherit text-foreground/80 transition-colors",
                  "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:text-emerald-400"
                )}
              >
                Sites
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("amenities")}
                className={cn(
                  "rounded-sm bg-transparent p-0 font-inherit text-foreground/80 transition-colors",
                  "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:text-emerald-400"
                )}
              >
                Amenities
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("gallery")}
                className={cn(
                  "rounded-sm bg-transparent p-0 font-inherit text-foreground/80 transition-colors",
                  "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:text-emerald-400"
                )}
              >
                Gallery
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("contact")}
                className={cn(
                  "rounded-sm bg-transparent p-0 font-inherit text-foreground/80 transition-colors",
                  "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:text-emerald-400"
                )}
              >
                Contact
              </button>
              <Button
                type="button"
                className={cn("bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900", "text-white")}
                onClick={() => scrollToSection("booking-widget")}
              >
                Book Now
              </Button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden p-2 text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <nav className="md:hidden mt-4 border-t border-border pb-4 pt-4">
              <div className="flex flex-col space-y-3">
                <button
                  type="button"
                  onClick={() => scrollToSection("sites")}
                  className={cn(
                    "w-full rounded-sm bg-transparent py-1 text-left font-inherit text-foreground/80 transition-colors",
                    "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-emerald-400"
                  )}
                >
                  Sites
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("amenities")}
                  className={cn(
                    "w-full rounded-sm bg-transparent py-1 text-left font-inherit text-foreground/80 transition-colors",
                    "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-emerald-400"
                  )}
                >
                  Amenities
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("gallery")}
                  className={cn(
                    "w-full rounded-sm bg-transparent py-1 text-left font-inherit text-foreground/80 transition-colors",
                    "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-emerald-400"
                  )}
                >
                  Gallery
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("contact")}
                  className={cn(
                    "w-full rounded-sm bg-transparent py-1 text-left font-inherit text-foreground/80 transition-colors",
                    "hover:text-[#2D5A27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-emerald-400"
                  )}
                >
                  Contact
                </button>
                <Button
                  type="button"
                  className={cn("bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900", "w-full text-white")}
                  onClick={() => scrollToSection("booking-widget")}
                >
                  Book Now
                </Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative w-full min-w-0 h-[70vh] flex items-center justify-center text-white">
        {property.hero_image_url ? (
          <Image
            src={property.hero_image_url || "/placeholder.svg"}
            alt={property.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#2D5A27] to-[#8FBC8F] dark:from-emerald-950 dark:to-emerald-900" />
        )}
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 pt-24 text-center md:pt-28">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">{property.tagline || "Create Memories in Nature"}</h1>
          <p className="text-xl md:text-2xl mb-2 opacity-90">{property.name}</p>
          <p className="text-lg mb-8 opacity-80">
            {(property.city || property.state) && (
              <>
                <MapPin className="inline h-5 w-5 mr-1" />
                {property.city}{property.city && property.state ? ', ' : ''}{property.state}
              </>
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#2D5A27] hover:bg-gray-100 dark:bg-zinc-100 dark:text-emerald-950 dark:hover:bg-white text-lg px-8 py-3"
              type="button"
              onClick={() => scrollToSection("booking-widget")}
            >
              Book Your Stay
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-[#2D5A27] dark:hover:text-emerald-950 text-lg px-8 py-3 bg-transparent"
              type="button"
              onClick={() => scrollToSection("sites")}
            >
              View Sites
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Booking Widget */}
      <section id="booking-widget" className="scroll-mt-24 py-8 bg-muted/50 md:scroll-mt-28 dark:bg-muted/20">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-5xl shadow-lg">
            <CardHeader className="bg-[#2D5A27] text-white dark:bg-emerald-950">
              <CardTitle className="text-center text-2xl text-white">Find Your Perfect Campsite</CardTitle>
              <CardDescription className="text-center text-gray-200 dark:text-emerald-100/90">
                Check availability and get instant pricing
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                {/* Reservation Type Filter - FIRST POSITION */}
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", "text-[#2D5A27] dark:text-emerald-400")}>Rate Type</label>
                  <Select
                    value={selectedReservationType}
                    onValueChange={(value) => setSelectedReservationType(value as "" | "nightly" | "weekly" | "monthly" | "seasonal")}
                  >
                    <SelectTrigger className="border-2 border-input bg-background">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect Best Rate</SelectItem>
                      {availableReservationTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {RESERVATION_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Picker */}
                <div className="lg:col-span-2 space-y-2 self-end">
                  <BookingDateRangePicker
                    label="Check-in & Check-out"
                    value={dateRange}
                    onChange={setDateRange}
                    sameDayBookingEnabled={bookingRulesConfig?.same_day_booking_enabled ?? true}
                    blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
                    openPeriodFrom={property.openPeriodFrom ?? null}
                    openPeriodUntil={property.openPeriodUntil ?? null}
                    {...(bookingRulesConfig?.booking_window_days != null
                      ? { bookingWindowDays: bookingRulesConfig.booking_window_days }
                      : {})}
                    {...(bookingRulesConfig?.advance_notice_days != null
                      ? { advanceNoticeDays: bookingRulesConfig.advance_notice_days }
                      : {})}
                    numberOfMonths={1}
                  />
                  {checkInDate && checkOutDate && checkInDate.getTime() === checkOutDate.getTime() && (
                    <Alert className="border-yellow-500/50 bg-yellow-500/10">
                      <TriangleAlert className="h-4 w-4 text-yellow-600" />
                      <AlertTitle className="text-yellow-700">Same-day check-in and check-out</AlertTitle>
                      <AlertDescription className="text-yellow-700">
                        Check-in and check-out dates cannot be the same. Please select a check-out date that is after your check-in date.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Site Type Filter */}
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", "text-[#2D5A27] dark:text-emerald-400")}>Site Type</label>
                  <Select
                    value={selectedSiteType}
                    onValueChange={(value) => setSelectedSiteType(value as SiteType | "" | "all")}
                  >
                    <SelectTrigger className="border-2 border-input bg-background">
                      <SelectValue placeholder="All Site Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Site Types</SelectItem>
                      {availableSiteTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Guest Count */}
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", "text-[#2D5A27] dark:text-emerald-400")}>Guests</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between border-2 border-input bg-background">
                        <span>
                          {adults + children} Guest{adults + children !== 1 ? "s" : ""}
                          {pets > 0 && `, ${pets} Pet${pets !== 1 ? "s" : ""}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {adults}A {children > 0 && `${children}C`} {pets > 0 && `${pets}P`}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Adults</span>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAdults(Math.max(1, adults - 1))}
                              disabled={adults <= 1}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{adults}</span>
                            <Button size="sm" variant="outline" onClick={() => setAdults(adults + 1)}>
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Children</span>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setChildren(Math.max(0, children - 1))}
                              disabled={children <= 0}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{children}</span>
                            <Button size="sm" variant="outline" onClick={() => setChildren(children + 1)}>
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Pets</span>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPets(Math.max(0, pets - 1))}
                              disabled={pets <= 0}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{pets}</span>
                            <Button size="sm" variant="outline" onClick={() => setPets(Math.min(5, pets + 1))} disabled={pets >= 5}>
                              +
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Check Availability Button */}
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium opacity-0", "text-[#2D5A27] dark:text-emerald-400")}>Action</label>
                  <Button
                    className={cn(
                      "w-full rounded-xl text-sm py-4 text-white shadow-md transition-colors transition-shadow",
                      "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900",
                      "hover:shadow-lg border border-[#23451f] dark:border-emerald-900"
                    )}
                    onClick={searchAvailability}
                    disabled={isSearching}
                  >
                    {isSearching ? "Searching..." : "Check Availability"}
                  </Button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap justify-center gap-4 border-t border-border pt-4">
                {trustBadges.map((badge, index) => (
                  <div key={index} className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <span>{badge.icon}</span>
                    <span>{badge.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Search Results */}

      {/* Site Types Section */}
      <section id="sites" className="scroll-mt-24 py-16 w-full min-w-0 md:scroll-mt-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className={cn("mb-4 text-3xl font-bold md:text-4xl", "text-[#2D5A27] dark:text-emerald-400")}>Choose Your Camping Style</h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              From rustic tent camping to comfortable cabins, find your perfect outdoor experience
            </p>
          </div>

          <Carousel opts={{ align: "start", loop: false }} className="relative w-full max-w-full px-10 sm:px-12 md:px-14 lg:px-16">
            <CarouselContent className="-ml-2 sm:-ml-4">
              {(
                (siteTypeSummaries?.length
                  ? siteTypeSummaries
                  : [
                    { type: "tent" as SiteType, name: "Tent Sites", description: "Perfect for traditional camping with your own tent", price: 35, capacity: "2-4", amenities: ["Fire Pit", "Picnic Table", "Water Access"] },
                    { type: "rv" as SiteType, name: "RV Sites", description: "Full hookup sites for RVs and motorhomes", price: 55, capacity: "4-6", amenities: ["Electric", "Water", "Sewer", "Fire Pit"] },
                    { type: "cabin" as SiteType, name: "Cabins", description: "Cozy cabins with modern amenities", price: 125, capacity: "4-6", amenities: ["Electricity", "Heating/AC", "Kitchenette", "Bath"] },
                  ]
                ) as SiteTypeSummary[]
              ).map((siteType) => {
                const IconComponent = getSiteTypeIcon(siteType.type)
                return (
                  <CarouselItem
                    key={siteType.id ?? siteType.name}
                    className="min-w-0 basis-[88%] pl-2 select-none sm:basis-1/2 sm:pl-4 lg:basis-1/3"
                  >
                    <div className="h-full flex">
                      <Card className="flex h-full w-full flex-col overflow-hidden border-2 transition-shadow hover:shadow-xl">
                        <div className="relative min-h-28 w-full shrink-0 overflow-hidden sm:min-h-36 md:min-h-44 lg:min-h-52">
                          {siteType.imageUrl ? (
                            <Image
                              src={siteType.imageUrl}
                              alt={siteType.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 88vw, (max-width: 1024px) 50vw, 33vw"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-green-50 dark:from-emerald-950/50 dark:to-zinc-900/80" />
                          )}
                          {siteType.imageUrl ? (
                            <div
                              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent dark:from-black/55"
                              aria-hidden
                            />
                          ) : null}
                          <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
                            <div className="rounded-full bg-white/95 p-2.5 shadow-lg dark:bg-zinc-900/95 sm:p-3">
                              <IconComponent className={cn("h-5 w-5 sm:h-6 sm:w-6", "text-[#2D5A27] dark:text-emerald-400")} />
                            </div>
                          </div>
                          <div className="absolute right-2 top-2 z-10 flex max-w-[min(100%-4rem,14rem)] flex-col items-end gap-1 sm:right-3 sm:top-3 sm:max-w-[min(100%-5rem,16rem)]">
                            <Badge
                              className={cn(
                                "bg-[#2D5A27] dark:bg-emerald-800",
                                "px-2.5 py-1.5 text-right text-xs text-white shadow-md sm:px-4 sm:py-2 sm:text-lg",
                                siteType.discountedPrice != null && "line-through opacity-90"
                              )}
                            >
                              From ${siteType.price}/night
                            </Badge>
                            {siteType.discountedPrice != null && siteType.discountEndDate && (
                              <Badge className={cn("bg-[#2D5A27] dark:bg-emerald-800", "px-2 py-1 text-right text-[10px] leading-tight text-white shadow-md sm:px-3 sm:py-1.5 sm:text-base")}>
                                ${siteType.discountedPrice}/night until {format(new Date(siteType.discountEndDate), "MMM d")}
                              </Badge>
                            )}
                            {siteType.priceWeekly != null && siteType.priceWeekly > 0 && (
                              <Badge className={cn("bg-[#2D5A27] dark:bg-emerald-800", "px-2 py-1 text-right text-xs text-white shadow-md sm:px-3 sm:text-sm")}>
                                ${siteType.priceWeekly.toFixed(0)}/week
                              </Badge>
                            )}
                            {siteType.priceMonthly != null && siteType.priceMonthly > 0 && (
                              <Badge className={cn("bg-[#2D5A27] dark:bg-emerald-800", "px-2 py-1 text-right text-xs text-white shadow-md sm:px-3 sm:text-sm")}>
                                ${siteType.priceMonthly.toFixed(0)}/month
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardHeader className="shrink-0">
                          <CardTitle className="text-2xl">{`${siteType.type.toLocaleUpperCase()} Sites`}</CardTitle>
                          <CardTitle className={cn("text-xl", "text-[#2D5A27] dark:text-emerald-400")}>{siteType.name}</CardTitle>
                          <CardDescription className="line-clamp-3 text-base">{siteType.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-4">
                          <div className="flex-1">
                            <p className="mb-2 text-sm font-semibold text-muted-foreground">Sleeps {siteType.capacity}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {siteType.amenities.map((amenity) => (
                                <div key={amenity} className="flex items-center space-x-2">
                                  <div className="h-2 w-2 rounded-full bg-[#8FBC8F] dark:bg-emerald-600" />
                                  <span className="text-sm text-foreground/90">{amenity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button
                            type="button"
                            className={cn("w-full text-white", "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900")}
                            onClick={() => scrollToSection("booking-widget")}
                          >
                            View Sites
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                )
              })}
            </CarouselContent>
            <CarouselPrevious className="left-0 top-1/2 z-20 h-9 w-9 -translate-y-1/2 border-border bg-background/95 shadow-md backdrop-blur-sm dark:bg-card/95 sm:left-1 sm:h-10 sm:w-10 md:left-2 lg:left-3 [&_svg]:size-5 sm:[&_svg]:size-6 disabled:opacity-40" />
            <CarouselNext className="right-0 top-1/2 z-20 h-9 w-9 -translate-y-1/2 border-border bg-background/95 shadow-md backdrop-blur-sm dark:bg-card/95 sm:right-1 sm:h-10 sm:w-10 md:right-2 lg:right-3 [&_svg]:size-5 sm:[&_svg]:size-6 disabled:opacity-40" />
          </Carousel>
        </div>
      </section>

      {/* Trust & Social Proof */}
      <section className="w-full min-w-0 overflow-x-hidden bg-gradient-to-r from-[#8FBC8F]/10 to-[#2D5A27]/10 py-12 dark:from-emerald-950/30 dark:to-emerald-950/50">

        {recentBookings.length > 0 && (
          <div className="mb-8 w-full max-w-full min-w-0 overflow-hidden bg-card p-4 shadow-sm">
            <Marquee speed={80} gradient={false} pauseOnHover>
              <div className="flex animate-marquee items-center justify-center space-x-8 text-sm">
                {recentBookings.map((booking, index) => (
                  <div key={index} className="flex items-center space-x-2 whitespace-nowrap text-foreground/90">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 dark:bg-emerald-500" />
                    <span className="font-medium">{booking.name}</span>
                    {/* <span>from {booking.siteType}</span> */}
                    <span>booked a {booking.siteType} Site for {booking.numberOfNights} nights</span>
                    <span className="text-muted-foreground">{booking.timeAgo}</span>
                  </div>
                ))}
              </div>
            </Marquee>
          </div>
        )}

        <div className="container mx-auto px-4 w-full max-w-full min-w-0">
          {/* Trust Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <div className={cn("mb-2 text-3xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>4.8★</div>
              <div className="text-sm text-muted-foreground">Average Rating</div>
              <div className="mt-1 text-xs text-muted-foreground">From verified guests</div>
            </div>
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <div className={cn("mb-2 text-3xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>5,000+</div>
              <div className="text-sm text-muted-foreground">Happy Campers</div>
              <div className="mt-1 text-xs text-muted-foreground">This year alone</div>
            </div>
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <div className={cn("mb-2 text-3xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>24hr</div>
              <div className="text-sm text-muted-foreground">Free Cancellation</div>
              <div className="mt-1 text-xs text-muted-foreground">No questions asked</div>
            </div>
            <div className="rounded-lg bg-card p-6 shadow-sm">
              <div className={cn("mb-2 text-3xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>100%</div>
              <div className="text-sm text-muted-foreground">Secure Booking</div>
              <div className="mt-1 text-xs text-muted-foreground">SSL encrypted</div>
            </div>
          </div>
        </div>
      </section>

      {/* Amenities Grid */}
      <section id="amenities" className="scroll-mt-24 bg-muted/50 py-16 md:scroll-mt-28 dark:bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className={cn("mb-4 text-3xl font-bold md:text-4xl", "text-[#2D5A27] dark:text-emerald-400")}>Campground Amenities</h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Everything you need for a comfortable camping experience
            </p>
          </div>

          <div className="grid justify-center gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,220px)]">
            {displayedAmenities.map((amenity) => {
              return (
                <div
                  key={amenity.key}
                  className="group relative w-[220px] overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#8FBC8F]/60 hover:shadow-lg dark:hover:border-emerald-700/70"
                >
                  <div className="absolute inset-x-5 top-0 h-[2px] bg-gradient-to-r from-[#8FBC8F]/30 via-[#2D5A27]/70 to-[#8FBC8F]/30 opacity-80 transition-opacity group-hover:opacity-100 dark:from-emerald-700/20 dark:via-emerald-500/70 dark:to-emerald-700/20" />
                  <div className={cn(
                    "mx-auto mb-3 flex h-14 w-14 items-center justify-center",
                    amenity.iconUrl
                      ? "rounded-full bg-[#8FBC8F] dark:bg-emerald-700"
                      : "rounded-full border border-dashed border-border/70 bg-muted/30 text-muted-foreground"
                  )}>
                    {amenity.iconUrl ? (
                      <img
                        src={amenity.iconUrl}
                        alt={`${amenity.name} icon`}
                        className="h-8 w-8 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <ImageOff aria-hidden="true" className="h-6 w-6 opacity-70" />
                    )}
                  </div>
                  <h3 className={cn("mb-1.5 line-clamp-1 text-base font-semibold leading-tight", "text-[#2D5A27] dark:text-emerald-400")}>{amenity.name}</h3>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{amenity.description}</p>
                  <PropertyAmenitiesDetailsDialog
                    amenity={{ name: amenity.name, description: amenity.description, iconUrl: amenity.iconUrl }}
                  >
                    <button
                      type="button"
                      className="mt-3 text-sm font-medium text-[#2D5A27] underline underline-offset-2 hover:text-[#1e3d1a] dark:text-emerald-400 dark:hover:text-emerald-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      See details
                    </button>
                  </PropertyAmenitiesDetailsDialog>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Photo Gallery */}
      {galleryImages.length > 0 && (
        <section id="gallery" className="scroll-mt-24 py-16 md:scroll-mt-28">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <h2 className={cn("mb-4 text-3xl font-bold md:text-4xl", "text-[#2D5A27] dark:text-emerald-400")}>Experience {property.name}</h2>
              <p className="mx-auto max-w-2xl text-xl text-muted-foreground">See what makes our campground special</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {galleryImages.map((image, index) => (
                <div
                  key={`${image.src}-${index}`}
                  className="relative w-full aspect-[4/3] sm:aspect-auto sm:h-64 rounded-lg overflow-hidden group cursor-pointer"
                  onClick={() => setActiveGalleryImageIndex(index)}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                    <Camera className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeGalleryImageIndex !== null && galleryImages[activeGalleryImageIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setActiveGalleryImageIndex(null)}
        >
          <div className="relative">
            <button
              type="button"
              aria-label="Close image preview"
              className="absolute -top-10 right-2 z-10 p-1.5 text-white transition-opacity hover:opacity-80 sm:right-0 sm:top-0 sm:translate-x-[115%] sm:-translate-y-[20%]"
              onClick={(event) => {
                event.stopPropagation()
                setActiveGalleryImageIndex(null)
              }}
            >
              <X className="h-5 w-5" />
            </button>
            <div
              className="relative max-h-[80vh] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <Image
                src={galleryImages[activeGalleryImageIndex].src}
                alt={galleryImages[activeGalleryImageIndex].alt}
                width={1600}
                height={1200}
                className="h-auto max-h-[80vh] w-auto max-w-[calc(100vw-2rem)] object-contain"
                sizes="100vw"
                priority
              />
            </div>
          </div>
        </div>
      )}

      {/* Property Information */}
      <section className="bg-muted/50 py-16 dark:bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <h2 className={cn("mb-6 text-3xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>About {property.name}</h2>
              <div className="max-w-prose space-y-4 text-foreground/90">
                {aboutParagraphs.map((paragraph, index) => (
                  <p key={index} className="leading-relaxed [text-wrap:pretty] whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            <div>
              <h2 className={cn("mb-6 text-3xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>Important Information</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Clock className={cn("mt-1 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                  <div>
                    <p className="font-semibold text-foreground">Check-in: {formatTime(property.check_in_time)}</p>
                    <p className="font-semibold text-foreground">Check-out: {formatTime(property.check_out_time)}</p>
                  </div>
                </div>

                {property.cancellation_policy && (
                  <div className="flex items-start space-x-3">
                    <FileText className={cn("mt-1 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                    <div className="w-full">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="cancellation-policy" className="border-0">
                          <AccordionTrigger className="py-0 text-left font-semibold text-foreground hover:no-underline [&>svg]:hidden">
                            Cancellation Policy
                          </AccordionTrigger>

                          <AccordionContent className="mt-2">
                            <GuestCancellationPolicyText
                              text={property.cancellation_policy}
                              className="mt-1 space-y-2 text-sm text-muted-foreground"
                            />
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>
                )}

                {property.phone && (
                  <div className="flex items-start space-x-3">
                    <Phone className={cn("mt-1 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                    <div>
                      <p className="font-semibold text-foreground">Phone</p>
                      <a href={`tel:${property.phone}`} className={cn("hover:underline", "text-[#2D5A27] dark:text-emerald-400")}>
                        {property.phone}
                      </a>
                    </div>
                  </div>
                )}

                {property.email && (
                  <div className="flex items-start space-x-3">
                    <Mail className={cn("mt-1 h-5 w-5 shrink-0", "text-[#2D5A27] dark:text-emerald-400")} />
                    <div>
                      <p className="font-semibold text-foreground">Email</p>
                      <a href={`mailto:${property.email}`} className={cn("hover:underline", "text-[#2D5A27] dark:text-emerald-400")}>
                        {property.email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call-to-Action Footer Section */}
      <section
        id="contact"
        className="scroll-mt-24 bg-gradient-to-r from-[#2D5A27] to-[#8FBC8F] py-16 text-white md:scroll-mt-28 dark:from-emerald-950 dark:to-emerald-900"
      >
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Ready to Book Your Adventure?</h2>
          <p className="mb-8 text-xl opacity-90">Start planning your perfect camping getaway today</p>
          <Button
            size="lg"
            type="button"
            className="bg-white text-[#2D5A27] hover:bg-gray-100 dark:bg-zinc-100 dark:text-emerald-950 dark:hover:bg-white text-lg"
            onClick={() => scrollToSection("booking-widget")}
          >
            Check Availability
          </Button>
          {property.phone && (
            <p className="mt-6 text-lg">
              Questions? Call us at{" "}
              <a href={`tel:${property.phone}`} className="font-semibold underline">
                {property.phone}
              </a>
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2D5A27] py-12 text-white dark:bg-emerald-950">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="mb-4 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-zinc-100">
                  <TreePine className="h-5 w-5 text-[#2D5A27] dark:text-emerald-900" />
                </div>
                <span className="text-xl font-bold">{property.name}</span>
              </div>
              {(property.city || property.state) && (
                <p className="mb-4 text-emerald-100/90">
                  {property.city}{property.city && property.state ? ', ' : ''}{property.state}
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold">Quick Links</h3>
              <ul className="space-y-2 text-emerald-100/90">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("sites")}
                    className="text-left transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D5A27]"
                  >
                    Site Types
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("amenities")}
                    className="text-left transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D5A27]"
                  >
                    Amenities
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("gallery")}
                    className="text-left transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D5A27]"
                  >
                    Gallery
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold">Contact Info</h3>
              <div className="space-y-2 text-emerald-100/90">
                {property.phone && (
                  <p className="flex items-center">
                    <Phone className="h-4 w-4 mr-2" /> {property.phone}
                  </p>
                )}
                {property.email && (
                  <p className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" /> {property.email}
                  </p>
                )}
                {(property.city || property.state) && (
                  <p className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" /> {property.city}{property.city && property.state ? ', ' : ''}{property.state}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/20 pt-8 text-center text-emerald-100/80">
            <p>
              &copy; {new Date().getFullYear()} {property.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
