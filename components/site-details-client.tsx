"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
  CalendarIcon,
  Users,
  Zap,
  Droplet,
  Wifi,
  Flame,
  PawPrint,
  Tent,
  Home,
  TreePine,
  Sparkles,
  ChevronRight,
  Share2,
  MapPin,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRightIcon,
  Circle,
} from "lucide-react"
import type { DateRange } from "react-day-picker"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { getSiteById, checkSiteAvailability, calculateReservationPrice, getSimilarSites } from "@/lib/booking/api"
import type { SiteType, AvailableSite, PriceBreakdown } from "@/lib/booking/types"
import { ThemeToggle } from "@/components/theme-toggle"

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

const amenityConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  electric: { icon: <Zap className="h-4 w-4" />, label: "Electric Hookup" },
  water: { icon: <Droplet className="h-4 w-4" />, label: "Water Hookup" },
  sewer: { icon: <Droplet className="h-4 w-4" />, label: "Sewer Hookup" },
  wifi: { icon: <Wifi className="h-4 w-4" />, label: "WiFi Available" },
  firepit: { icon: <Flame className="h-4 w-4" />, label: "Fire Pit" },
  picnicTable: { icon: <Home className="h-4 w-4" />, label: "Picnic Table" },
  petFriendly: { icon: <PawPrint className="h-4 w-4" />, label: "Pet-Friendly" },
  pullThrough: { icon: <Home className="h-4 w-4" />, label: "Pull-Through" },
}

export function SiteDetailsClient({ siteId }: { siteId: string }) {
  const [site, setSite] = useState<AvailableSite | null>(null)
  const [similarSites, setSimilarSites] = useState<AvailableSite[]>([])
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Booking form state
  const [date, setDate] = useState<DateRange | undefined>()
  const [guests, setGuests] = useState(2)
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null)

  // Load site data
  useEffect(() => {
    async function loadSite() {
      setLoading(true)
      try {
        const [siteResult, similarResult] = await Promise.all([
          getSiteById(siteId),
          getSimilarSites(siteId, 4)
        ])

        if (siteResult.success) {
          setSite(siteResult.data)
        }

        if (similarResult.success) {
          setSimilarSites(similarResult.data)
        }
      } catch (error) {
        console.error("[v0] Error loading site:", error)
      } finally {
        setLoading(false)
      }
    }
    loadSite()
  }, [siteId])

  // Check availability and calculate price when dates change
  useEffect(() => {
    async function checkAndCalculate() {
      if (!date?.from || !date?.to || !site) {
        setIsAvailable(null)
        setPriceBreakdown(null)
        return
      }

      setIsCheckingAvailability(true)
      try {
        const [availabilityResult, pricingResult] = await Promise.all([
          checkSiteAvailability(siteId, format(date.from, "yyyy-MM-dd"), format(date.to, "yyyy-MM-dd")),
          calculateReservationPrice(siteId, format(date.from, "yyyy-MM-dd"), format(date.to, "yyyy-MM-dd"), { num_adults: guests }),
        ])

        if (availabilityResult.success) {
          setIsAvailable(availabilityResult.data)
        }

        if (pricingResult.success) {
          setPriceBreakdown(pricingResult.data)
        }
      } catch (error) {
        console.error("[v0] Error checking availability:", error)
      } finally {
        setIsCheckingAvailability(false)
      }
    }
    checkAndCalculate()
  }, [date, guests, site, siteId])

  const calculateNights = () => {
    if (date?.from && date?.to) {
      const diffTime = Math.abs(date.to.getTime() - date.from.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    }
    return 0
  }

  const nights = calculateNights()

  // Mock images (in production, these would come from the site data)
  const images = site?.image_url ? [site.image_url, site.image_url, site.image_url] : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Tent className="h-6 w-6" />
              <span className="font-bold text-xl">CampOS</span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button variant="ghost">Sign In</Button>
            </div>
          </div>
        </nav>
        <div className="container mx-auto px-4 py-20 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Tent className="h-6 w-6" />
              <span className="font-bold text-xl">CampOS</span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button variant="ghost">Sign In</Button>
            </div>
          </div>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Site Not Found</h1>
          <p className="text-muted-foreground mb-8">The campsite you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/">Return to Search</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost">Sign In</Button>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="border-b bg-background/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/book" className="hover:text-foreground transition-colors">
              Book
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{site.name}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          {/* Left Column - Site Details */}
          <div className="space-y-6">
            {/* Image Gallery */}
            <Card className="overflow-hidden glass">
              <div className="relative aspect-video bg-muted">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[currentImageIndex] || "/placeholder.svg"}
                      alt={site.name}
                      className="object-cover w-full h-full"
                    />
                    {images.length > 1 && (
                      <>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute left-4 top-1/2 -translate-y-1/2"
                          onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onClick={() => setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                        >
                          <ChevronRightIcon className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {images.map((_, idx) => (
                            <button
                              key={idx}
                              className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                idx === currentImageIndex ? "bg-white w-6" : "bg-white/50",
                              )}
                              onClick={() => setCurrentImageIndex(idx)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Tent className="h-20 w-20 text-muted-foreground/20" />
                  </div>
                )}
              </div>
            </Card>

            {/* Site Header */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-4xl font-bold mb-2">{site.name}</h1>
                  <p className="text-lg text-muted-foreground">Site #{site.site_number}</p>
                </div>
                <Button variant="outline" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className={cn("border", siteTypeColors[site.site_type])}>
                  <span className="mr-1">{siteTypeIcons[site.site_type]}</span>
                  {site.site_type.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  Up to {site.max_occupancy} guests
                </Badge>
              </div>

              <div className="text-3xl font-bold">
                ${site.base_price_per_night}
                <span className="text-lg font-normal text-muted-foreground"> / night</span>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
                <TabsTrigger value="policies">Policies</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* TODO: Add description to AvailableSite type
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{site.description}</p>
                  </CardContent>
                </Card>
                */}

                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Amenities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {Object.entries(site.amenities)
                        .filter(([_, value]) => value)
                        .map(([key]) => {
                          const config = amenityConfig[key]
                          if (!config) return null
                          return (
                            <div key={key} className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                                {config.icon}
                              </div>
                              <span className="font-medium">{config.label}</span>
                            </div>
                          )
                        })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Occupancy Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Maximum {site.max_occupancy} guests</p>
                        <p className="text-sm text-muted-foreground">
                          This site can comfortably accommodate up to {site.max_occupancy} people
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="location" className="space-y-6">
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Site Location</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">Site #{site.site_number}</p>
                        <p className="text-sm text-muted-foreground">Located in the main camping area</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Nearby Facilities</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• Restrooms - 2 minute walk</li>
                        <li>• Shower facilities - 3 minute walk</li>
                        <li>• Camp store - 5 minute walk</li>
                        <li>• Playground - 4 minute walk</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="policies" className="space-y-6">
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Check-in & Check-out</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">Check-in: 2:00 PM</p>
                        <p className="text-sm text-muted-foreground">Early check-in may be available upon request</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">Check-out: 11:00 AM</p>
                        <p className="text-sm text-muted-foreground">
                          Late check-out may be available for an additional fee
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Cancellation Policy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Free cancellation up to 7 days before check-in. Cancellations made within 7 days of check-in will
                      receive a 50% refund. No refunds for cancellations made within 48 hours of check-in.
                    </p>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Pet Policy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <PawPrint className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        {site.amenities.petFriendly ? (
                          <>
                            <p className="font-medium text-green-600 dark:text-green-400">Pets Welcome</p>
                            <p className="text-sm text-muted-foreground">
                              Pets are allowed at this site. Please keep pets leashed and clean up after them.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-destructive">No Pets Allowed</p>
                            <p className="text-sm text-muted-foreground">This site does not allow pets.</p>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Quiet Hours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Quiet hours are from 10:00 PM to 7:00 AM. Please be respectful of other campers during these
                      hours.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Booking Form (Sticky) */}
          <div className="lg:sticky lg:top-20 h-fit">
            <Card className="glass-strong shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">Book This Site</CardTitle>
                <CardDescription>Select your dates to check availability</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Range Picker */}
                <div className="space-y-2">
                  <Label>Check-in & Check-out</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                          date.to ? (
                            <>
                              {format(date.from, "MMM dd")} - {format(date.to, "MMM dd, yyyy")}
                            </>
                          ) : (
                            format(date.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick dates</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        {...(date?.from && { defaultMonth: date.from })}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                  {nights > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {nights} {nights === 1 ? "night" : "nights"}
                    </p>
                  )}
                </div>

                {/* Number of Guests */}
                <div className="space-y-2">
                  <Label htmlFor="guests">Number of Guests</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      disabled={guests <= 1}
                    >
                      -
                    </Button>
                    <Input
                      id="guests"
                      type="number"
                      min={1}
                      max={site.max_occupancy}
                      value={guests}
                      onChange={(e) =>
                        setGuests(Math.max(1, Math.min(site.max_occupancy, Number.parseInt(e.target.value) || 1)))
                      }
                      className="text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setGuests(Math.min(site.max_occupancy, guests + 1))}
                      disabled={guests >= site.max_occupancy}
                    >
                      +
                    </Button>
                  </div>
                  {guests > site.max_occupancy && (
                    <p className="text-sm text-destructive">Maximum {site.max_occupancy} guests allowed</p>
                  )}
                </div>

                {/* Availability Status */}
                {isCheckingAvailability && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking availability...
                  </div>
                )}

                {!isCheckingAvailability && isAvailable === false && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Site unavailable for these dates</span>
                  </div>
                )}

                {!isCheckingAvailability && isAvailable === true && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Site available!</span>
                  </div>
                )}

                {/* Price Breakdown */}
                {priceBreakdown && isAvailable && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold">Price Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          ${priceBreakdown.base_price_per_night} × {priceBreakdown.number_of_nights}{" "}
                          {priceBreakdown.number_of_nights === 1 ? "night" : "nights"}
                        </span>
                        <span className="font-medium">${priceBreakdown.subtotal.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>${priceBreakdown.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
                  disabled={!date?.from || !date?.to || isAvailable === false || isCheckingAvailability}
                >
                  Continue to Guest Info
                </Button>
                <p className="text-xs text-center text-muted-foreground">You won't be charged yet</p>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Similar Sites Section */}
        {similarSites.length > 0 && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold mb-6">Other Available Sites</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {similarSites.map((similarSite) => (
                <Card
                  key={similarSite.id}
                  className="overflow-hidden hover:shadow-xl transition-all duration-300 glass group"
                >
                  <div className="aspect-video relative overflow-hidden bg-muted">
                    <img
                      src={similarSite.image_url || "/placeholder.svg"}
                      alt={similarSite.name}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                    <Badge className={cn("absolute top-3 right-3 border", siteTypeColors[similarSite.site_type])}>
                      <span className="mr-1">{siteTypeIcons[similarSite.site_type]}</span>
                      {similarSite.site_type.toUpperCase()}
                    </Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">{similarSite.name}</CardTitle>
                    <CardDescription>Site #{similarSite.site_number}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-2xl font-bold">${similarSite.base_price_per_night}</span>
                      <span className="text-sm text-muted-foreground">/ night</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full bg-transparent" asChild>
                      <Link href={`/book/${similarSite.id}`}>View Details</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
