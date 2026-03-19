"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { differenceInCalendarDays, format } from "date-fns"
import Link from "next/link"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SiteType } from "@/lib/booking/types"
import { cn } from "@/lib/utils"
import type { BookingRulesConfig } from "@/lib/config/types"
import { BookingDateRangePicker, type DateRangeValue } from "@/components/guest/booking-date-range-picker"
import { useToast } from "@/hooks/use-toast"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import Marquee from "react-fast-marquee"

type BookingType = 'nightly' | 'weekly' | 'monthly' | 'seasonal'

const RESERVATION_TYPE_LABELS: Record<BookingType, string> = {
  nightly: 'Nightly Rate',
  weekly: 'Weekly Rate',
  monthly: 'Monthly Rate',
  seasonal: 'Seasonal Rate',
}

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
    amenities: string[]
    enabled_reservation_types?: BookingType[]
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

  // Clear check-out when it becomes invalid after check-in change
  useEffect(() => {
    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
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

  const formatTime = (time: string | undefined | null) => {
    if (!time) return ""
    const parts = time.split(":")
    const hours = parts[0]
    const minutes = parts[1]
    if (!hours || !minutes) return ""
    const hour = Number.parseInt(hours, 10)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

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
      toast({
        title: "Invalid dates",
        description: "Check-out date must be after check-in date",
        variant: "destructive",
      })
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

    // Navigate to availability results page with search params
    const params = new URLSearchParams({
      slug: slug,
      propertyId: property.id,
      checkIn: format(checkInDate, "yyyy-MM-dd"),
      checkOut: format(checkOutDate, "yyyy-MM-dd"),
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-[#2D5A27] rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2D5A27]">{property.name}</h1>
                <p className="text-sm text-gray-600">
                  {property.city}, {property.state}
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="#sites" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                Sites
              </Link>
              <Link href="#amenities" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                Amenities
              </Link>
              <Link href="#gallery" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                Gallery
              </Link>
              <Link href="#contact" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                Contact
              </Link>
              <Button className="bg-[#2D5A27] hover:bg-[#1e3d1a] text-white">Book Now</Button>
            </nav>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t pt-4">
              <div className="flex flex-col space-y-3">
                <Link href="#sites" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                  Sites
                </Link>
                <Link href="#amenities" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                  Amenities
                </Link>
                <Link href="#gallery" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                  Gallery
                </Link>
                <Link href="#contact" className="text-gray-700 hover:text-[#2D5A27] transition-colors">
                  Contact
                </Link>
                <Button className="bg-[#2D5A27] hover:bg-[#1e3d1a] text-white w-full">Book Now</Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center text-white">
        {property.hero_image_url ? (
          <Image
            src={property.hero_image_url || "/placeholder.svg"}
            alt={property.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#2D5A27] to-[#8FBC8F]" />
        )}
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">{property.tagline || "Create Memories in Nature"}</h1>
          <p className="text-xl md:text-2xl mb-2 opacity-90">{property.name}</p>
          <p className="text-lg mb-8 opacity-80">
            <MapPin className="inline h-5 w-5 mr-1" />
            {property.city}, {property.state}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#2D5A27] hover:bg-gray-100 text-lg px-8 py-3"
              onClick={() => document.getElementById("booking-widget")?.scrollIntoView({ behavior: "smooth" })}
            >
              Book Your Stay
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-[#2D5A27] text-lg px-8 py-3 bg-transparent"
              onClick={() => document.getElementById("sites")?.scrollIntoView({ behavior: "smooth" })}
            >
              View Sites
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Booking Widget */}
      <section id="booking-widget" className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <Card className="max-w-5xl mx-auto shadow-lg">
            <CardHeader className="bg-[#2D5A27] text-white">
              <CardTitle className="text-center text-2xl">Find Your Perfect Campsite</CardTitle>
              <CardDescription className="text-center text-gray-200">
                Check availability and get instant pricing
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                {/* Reservation Type Filter - FIRST POSITION */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#2D5A27]">Rate Type</label>
                  <Select
                    value={selectedReservationType}
                    onValueChange={(value) => setSelectedReservationType(value as "" | "nightly" | "weekly" | "monthly" | "seasonal")}
                  >
                    <SelectTrigger className="border-2">
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
                    {...(bookingRulesConfig?.booking_window_days != null
                      ? { bookingWindowDays: bookingRulesConfig.booking_window_days }
                      : {})}
                    {...(bookingRulesConfig?.advance_notice_days != null
                      ? { advanceNoticeDays: bookingRulesConfig.advance_notice_days }
                      : {})}
                    numberOfMonths={1}
                  />
                </div>

                {/* Site Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#2D5A27]">Site Type</label>
                  <Select
                    value={selectedSiteType}
                    onValueChange={(value) => setSelectedSiteType(value as SiteType | "" | "all")}
                  >
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="All Site Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Site Types</SelectItem>
                      <SelectItem value="tent">Tent Sites</SelectItem>
                      <SelectItem value="rv">RV Sites</SelectItem>
                      <SelectItem value="cabin">Cabins</SelectItem>
                      <SelectItem value="glamping">Glamping</SelectItem>
                      <SelectItem value="yurt">Yurts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Guest Count */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#2D5A27]">Guests</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between border-2 bg-transparent">
                        <span>
                          {adults + children} Guest{adults + children !== 1 ? "s" : ""}
                          {pets > 0 && `, ${pets} Pet${pets !== 1 ? "s" : ""}`}
                        </span>
                        <span className="text-xs text-gray-500">
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
                  <label className="text-sm font-medium text-[#2D5A27] opacity-0">Action</label>
                  <Button
                    className={cn(
                      "w-full rounded-xl bg-[#2D5A27] text-white text-sm py-4",
                      "shadow-md hover:bg-[#23451f] hover:shadow-lg transition-colors transition-shadow",
                      "border border-[#23451f]"
                    )}
                    onClick={searchAvailability}
                    disabled={isSearching}
                  >
                    {isSearching ? "Searching..." : "Check Availability"}
                  </Button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap justify-center gap-4 pt-4 border-t">
                {trustBadges.map((badge, index) => (
                  <div key={index} className="flex items-center space-x-1 text-sm text-gray-600">
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
      <section id="sites" className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2D5A27] mb-4">Choose Your Camping Style</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From rustic tent camping to comfortable cabins, find your perfect outdoor experience
            </p>
          </div>

          <Carousel opts={{ align: "start", loop: false }} className="w-full">
            <CarouselContent className="-ml-4">
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
                  <CarouselItem key={siteType.id ?? siteType.name} className="pl-4 md:basis-1/2 lg:basis-1/3">
                    <div className="h-full" style={{ display: "flex" }}>
                      <Card className="overflow-hidden hover:shadow-xl transition-shadow border-2 w-full flex flex-col">
                        <div className="relative h-64 bg-gradient-to-br from-green-100 to-green-50 shrink-0">
                          {siteType.imageUrl ? (
                            <Image
                              src={siteType.imageUrl}
                              alt={siteType.name}
                              fill
                              className="object-cover"
                            />
                          ) : null}
                          <div className="absolute top-4 left-4">
                            <div className="bg-white/95 p-3 rounded-full shadow-lg">
                              <IconComponent className="h-6 w-6 text-[#2D5A27]" />
                            </div>
                          </div>
                          <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                            <Badge
                              className={cn(
                                "bg-[#2D5A27] text-white text-lg px-4 py-2",
                                siteType.discountedPrice != null && "line-through opacity-90"
                              )}
                            >
                              From ${siteType.price}/night
                            </Badge>
                            {siteType.discountedPrice != null && siteType.discountEndDate && (
                              <Badge className="bg-[#2D5A27] text-white text-base px-3 py-1.5">
                                ${siteType.discountedPrice}/night until {format(new Date(siteType.discountEndDate), "MMM d")}
                              </Badge>
                            )}
                            {siteType.priceWeekly != null && siteType.priceWeekly > 0 && (
                              <Badge className="bg-[#2D5A27] text-white text-sm px-3 py-1">
                                ${siteType.priceWeekly.toFixed(0)}/week
                              </Badge>
                            )}
                            {siteType.priceMonthly != null && siteType.priceMonthly > 0 && (
                              <Badge className="bg-[#2D5A27] text-white text-sm px-3 py-1">
                                ${siteType.priceMonthly.toFixed(0)}/month
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardHeader className="shrink-0">
                          <CardTitle className="text-2xl">{`${siteType.type.toLocaleUpperCase()} Sites`}</CardTitle>
                          <CardTitle className="text-xl text-[#2D5A27]">{siteType.name}</CardTitle>
                          <CardDescription className="text-base">{siteType.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col flex-1 justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-600 mb-2">Sleeps {siteType.capacity}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {siteType.amenities.map((amenity) => (
                                <div key={amenity} className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-[#8FBC8F] rounded-full"></div>
                                  <span className="text-sm text-gray-700">{amenity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button
                            className="w-full bg-[#2D5A27] hover:bg-[#1e3d1a] text-white"
                            onClick={() => document.getElementById("booking-widget")?.scrollIntoView({ behavior: "smooth" })}
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
            <CarouselPrevious className="-translate-x-1/2 h-10 w-10 [&_svg]:size-6" />
            <CarouselNext className="translate-x-1/2 h-10 w-10 [&_svg]:size-6" />
          </Carousel>
        </div>
      </section>

      {/* Trust & Social Proof */}
      <section className="py-12 bg-gradient-to-r from-[#8FBC8F]/10 to-[#2D5A27]/10">

        <div className="bg-white shadow-sm p-4 mb-8 overflow-hidden w-full">
          <Marquee speed={80} gradient={false} pauseOnHover>
            <div className="flex items-center justify-center space-x-8 text-sm animate-marquee">
              {recentBookings.map((booking, index) => (
                <div key={index} className="flex items-center space-x-2 text-gray-700 whitespace-nowrap">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">{booking.name}</span>
                  {/* <span>from {booking.siteType}</span> */}
                  <span>booked a {booking.siteType} Site for {booking.numberOfNights} nights</span>
                  <span className="text-gray-500">{booking.timeAgo}</span>
                </div>
              ))}
            </div>
          </Marquee>
        </div>

        <div className="container mx-auto px-4 w-full">
          {/* Trust Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-[#2D5A27] mb-2">4.8★</div>
              <div className="text-sm text-gray-600">Average Rating</div>
              <div className="text-xs text-gray-500 mt-1">From verified guests</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-[#2D5A27] mb-2">5,000+</div>
              <div className="text-sm text-gray-600">Happy Campers</div>
              <div className="text-xs text-gray-500 mt-1">This year alone</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-[#2D5A27] mb-2">24hr</div>
              <div className="text-sm text-gray-600">Free Cancellation</div>
              <div className="text-xs text-gray-500 mt-1">No questions asked</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-[#2D5A27] mb-2">100%</div>
              <div className="text-sm text-gray-600">Secure Booking</div>
              <div className="text-xs text-gray-500 mt-1">SSL encrypted</div>
            </div>
          </div>
        </div>
      </section>

      {/* Amenities Grid */}
      <section id="amenities" className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2D5A27] mb-4">Campground Amenities</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need for a comfortable camping experience
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {defaultAmenities.map((amenity) => {
              const IconComponent = amenityIcons[amenity.key] || Coffee
              return (
                <div
                  key={amenity.key}
                  className="text-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-16 h-16 bg-[#8FBC8F] rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-[#2D5A27] mb-2">{amenity.name}</h3>
                  <p className="text-sm text-gray-600">{amenity.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Photo Gallery */}
      {galleryImages.length > 0 && (
        <section id="gallery" className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#2D5A27] mb-4">Experience {property.name}</h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">See what makes our campground special</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {galleryImages.map((image, index) => (
                <div key={`${image.src}-${index}`} className="relative h-64 rounded-lg overflow-hidden group cursor-pointer">
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

      {/* Property Information */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-[#2D5A27] mb-6">About {property.name}</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                {property.description ||
                  "Welcome to our beautiful campground! We offer a perfect blend of nature and comfort, with modern amenities and stunning natural surroundings. Whether you're looking for a peaceful retreat or an adventure-filled getaway, we have everything you need for an unforgettable camping experience."}
              </p>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-[#2D5A27] mb-6">Important Information</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-[#2D5A27] mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Check-in: {formatTime(property.check_in_time)}</p>
                    <p className="font-semibold text-gray-900">Check-out: {formatTime(property.check_out_time)}</p>
                  </div>
                </div>

                {property.cancellation_policy && (
                  <div className="flex items-start space-x-3">
                    <div className="text-[#2D5A27] mt-1">📋</div>
                    <div>
                      <p className="font-semibold text-gray-900">Cancellation Policy</p>
                      <p className="text-gray-700 text-sm">{property.cancellation_policy}</p>
                    </div>
                  </div>
                )}

                {property.phone && (
                  <div className="flex items-start space-x-3">
                    <Phone className="h-5 w-5 text-[#2D5A27] mt-1" />
                    <div>
                      <p className="font-semibold text-gray-900">Phone</p>
                      <a href={`tel:${property.phone}`} className="text-[#2D5A27] hover:underline">
                        {property.phone}
                      </a>
                    </div>
                  </div>
                )}

                {property.email && (
                  <div className="flex items-start space-x-3">
                    <Mail className="h-5 w-5 text-[#2D5A27] mt-1" />
                    <div>
                      <p className="font-semibold text-gray-900">Email</p>
                      <a href={`mailto:${property.email}`} className="text-[#2D5A27] hover:underline">
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
      <section id="contact" className="py-16 bg-gradient-to-r from-[#2D5A27] to-[#8FBC8F] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Book Your Adventure?</h2>
          <p className="text-xl mb-8 opacity-90">Start planning your perfect camping getaway today</p>
          <Button
            size="lg"
            className="bg-white text-[#2D5A27] hover:bg-gray-100 text-lg"
            onClick={() => document.getElementById("booking-widget")?.scrollIntoView({ behavior: "smooth" })}
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
      <footer className="bg-[#2D5A27] text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <TreePine className="h-5 w-5 text-[#2D5A27]" />
                </div>
                <span className="text-xl font-bold">{property.name}</span>
              </div>
              <p className="text-gray-300 mb-4">
                {property.city}, {property.state}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <Link href="#sites" className="hover:text-white transition-colors">
                    Site Types
                  </Link>
                </li>
                <li>
                  <Link href="#amenities" className="hover:text-white transition-colors">
                    Amenities
                  </Link>
                </li>
                <li>
                  <Link href="#gallery" className="hover:text-white transition-colors">
                    Gallery
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
              <div className="space-y-2 text-gray-300">
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
                <p className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2" /> {property.city}, {property.state}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-600 mt-8 pt-8 text-center text-gray-300">
            <p>
              &copy; {new Date().getFullYear()} {property.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
