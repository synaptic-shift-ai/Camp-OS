"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tent,
  Car,
  TreePine,
  MapPin,
  Users,
  Calendar,
  Check,
  Star,
  Zap,
  Shield,
  Clock,
  ChevronLeft,
  Sparkles,
  Home,
  Circle,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { useCheckout } from "@/lib/booking/checkout-context"
import { useToast } from "@/hooks/use-toast"
import type { AvailableSite, SiteType } from "@/lib/booking/types"
import { calculatePriceBreakdown } from "@/lib/booking/pricing"

function AvailabilityResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setCheckoutData } = useCheckout()
  const { toast } = useToast()

  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [propertyName, setPropertyName] = useState("Pine Valley Campground")

  const slug = searchParams.get("slug") || ""
  const propertyId = searchParams.get("propertyId")
  const checkInStr = searchParams.get("checkIn")
  const checkOutStr = searchParams.get("checkOut")
  const adults = Number.parseInt(searchParams.get("adults") || "2")
  const children = Number.parseInt(searchParams.get("children") || "0")
  const siteTypeFilter = searchParams.get("siteType") as SiteType | null

  const checkIn = checkInStr ? new Date(checkInStr) : null
  const checkOut = checkOutStr ? new Date(checkOutStr) : null
  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0

  useEffect(() => {
    let mounted = true

    const fetchAvailableSites = async () => {
      if (!propertyId || !checkIn || !checkOut) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch("/api/booking/search-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: propertyId,
            check_in_date: format(checkIn, "yyyy-MM-dd"),
            check_out_date: format(checkOut, "yyyy-MM-dd"),
            num_adults: adults,
            num_children: children,
            site_type: siteTypeFilter || undefined,
          }),
        })

        const result = await response.json()

        if (!mounted) return

        if (result.success && result.data) {
          setAvailableSites(result.data.sites || [])
        } else {
          toast({
            title: "Search Error",
            description: result.error?.message || "Failed to search availability",
            variant: "destructive",
          })
        }
      } catch (error) {
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to search for available sites",
            variant: "destructive",
          })
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchAvailableSites()

    return () => {
      mounted = false
    }
  }, [propertyId, checkIn, checkOut, adults, children, siteTypeFilter])

  const getSiteIcon = (type: SiteType) => {
    switch (type) {
      case "tent":
        return Tent
      case "rv":
        return Car
      case "cabin":
        return TreePine
      case "yurt":
        return Circle
      case "glamping":
        return Sparkles
      default:
        return Home
    }
  }

  const getSiteTypeLabel = (type: SiteType) => {
    switch (type) {
      case "tent":
        return "Tent Site"
      case "rv":
        return "RV Site"
      case "cabin":
        return "Cabin"
      case "yurt":
        return "Yurt"
      case "glamping":
        return "Glamping"
      default:
        return "Site"
    }
  }

  const handleSelectSite = (site: AvailableSite) => {
    if (!checkIn || !checkOut || !propertyId) return

    const priceBreakdown = calculatePriceBreakdown({
      basePricePerNight: site.base_price_per_night,
      numberOfNights: nights,
      siteType: site.site_type,
      numPets: 0,
    })

    setCheckoutData({
      propertyId,
      site,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      numAdults: adults,
      numChildren: children,
      priceBreakdown,
    })

    toast({
      title: "Site selected!",
      description: `${site.name} has been added to your booking.`,
    })

    router.push(`/book/${slug}/guest-info`)
  }

  if (!checkIn || !checkOut || !propertyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <TreePine className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Invalid Search</h2>
          <p className="text-gray-600 mb-4">Missing required search parameters</p>
          <Button onClick={() => router.push(`/book/${slug}`)} className="bg-[#2D5A27] hover:bg-[#1e3d1a] text-white">
            Back to Search
          </Button>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#2D5A27] rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2D5A27]">{propertyName}</h1>
                <p className="text-xs text-gray-600">Searching...</p>
              </div>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D5A27] mx-auto mb-4"></div>
          <p className="text-gray-600">Searching for available sites...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#2D5A27] rounded-lg flex items-center justify-center">
                <TreePine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2D5A27]">{propertyName}</h1>
                <p className="text-xs text-gray-600">Availability Results</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => router.push(`/book/${slug}`)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Search
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Trust Bar */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2 text-green-700">
              <Shield className="h-5 w-5" />
              <span className="font-medium">Secure Booking</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700">
              <Zap className="h-5 w-5" />
              <span className="font-medium">Instant Confirmation</span>
            </div>
            <div className="flex items-center space-x-2 text-green-700">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Easy Cancellation</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {availableSites.length} Available Site{availableSites.length !== 1 ? "s" : ""} Found
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-[#2D5A27]" />
                        <span>
                          {checkIn && format(checkIn, "MMM dd")} - {checkOut && format(checkOut, "MMM dd")}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-[#2D5A27]" />
                        <span>
                          {adults + children} Guest{adults + children !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {nights > 0 && (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-[#2D5A27]" />
                          <span>
                            {nights} Night{nights !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/book/${slug}`)}>
                    Modify Search
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Available Sites */}
            <div className="space-y-4">
              {availableSites.map((site) => {
                const Icon = getSiteIcon(site.site_type)
                const totalPrice = (site.base_price_per_night * nights) / 100

                return (
                  <Card key={site.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-[#2D5A27] text-white">
                              <Icon className="h-3 w-3 mr-1" />
                              {getSiteTypeLabel(site.site_type)}
                            </Badge>
                            <Badge className="bg-green-500 text-white">Available</Badge>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{site.name}</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <MapPin className="h-4 w-4" />
                            <span>Site {site.site_number}</span>
                            <span>•</span>
                            <Users className="h-4 w-4" />
                            <span>Sleeps {site.max_occupancy}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[#2D5A27]">${totalPrice.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">
                            ${(site.base_price_per_night / 100).toFixed(2)}/night × {nights}
                          </div>
                        </div>
                      </div>

                      {/* Amenities */}
                      {Object.keys(site.amenities).length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(site.amenities).map(
                              ([key, value]) =>
                                value && (
                                  <div key={key} className="flex items-center space-x-1 text-xs text-gray-600">
                                    <Check className="h-3 w-3 text-green-600" />
                                    <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                                  </div>
                                )
                            )}
                          </div>
                        </div>
                      )}

                      <Separator className="my-4" />

                      {/* CTA */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>Easy cancellation</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Zap className="h-4 w-4 text-green-600" />
                            <span>Instant confirmation</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleSelectSite(site)}
                          className="bg-[#2D5A27] hover:bg-[#1e3d1a] text-white"
                        >
                          Select This Site
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {availableSites.length === 0 && (
              <Card className="p-12 text-center">
                <TreePine className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No sites available</h3>
                <p className="text-gray-600 mb-6">
                  We couldn't find any available sites for your selected dates. Try adjusting your search criteria.
                </p>
                <Button onClick={() => router.push(`/book/${slug}`)} className="bg-[#2D5A27] hover:bg-[#1e3d1a] text-white">
                  Modify Search
                </Button>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Search Details */}
              <Card>
                <CardHeader className="bg-[#2D5A27] text-white">
                  <CardTitle>Your Search</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Check-in:</span>
                    <span className="font-medium">{checkIn && format(checkIn, "MMM dd, yyyy")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Check-out:</span>
                    <span className="font-medium">{checkOut && format(checkOut, "MMM dd, yyyy")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Guests:</span>
                    <span className="font-medium">
                      {adults + children} ({adults}A, {children}C)
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Nights:</span>
                    <span className="font-medium">{nights}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Why Book With Us */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Why Book With Us?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-[#2D5A27] mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Best Price Guarantee</p>
                      <p className="text-xs text-gray-600">Lowest rates, guaranteed</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Clock className="h-5 w-5 text-[#2D5A27] mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Easy Cancellation</p>
                      <p className="text-xs text-gray-600">Flexible cancellation policy</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Star className="h-5 w-5 text-[#2D5A27] mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Secure Booking</p>
                      <p className="text-xs text-gray-600">Your information is safe</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Need Help */}
              <Card className="bg-gray-50">
                <CardContent className="p-6 text-center">
                  <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
                  <p className="text-sm text-gray-600 mb-4">Our team is here to assist you</p>
                  <Button variant="outline" className="w-full bg-white">
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AvailabilityResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D5A27]"></div>
        </div>
      }
    >
      <AvailabilityResultsContent />
    </Suspense>
  )
}
