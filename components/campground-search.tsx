"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"
import {
  CalendarIcon,
  Users,
  Search,
  Zap,
  Droplet,
  Wifi,
  Flame,
  PawPrint,
  ChevronDown,
  Loader2,
  Tent,
  Home,
  TreePine,
  Sparkles,
  Circle,
  MapPin,
} from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { searchAvailableSites } from "@/lib/booking/api"
import type { SiteType, AvailabilitySearchResult } from "@/lib/booking/types"
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

const amenityIcons: Record<string, React.ReactNode> = {
  electric: <Zap className="h-3.5 w-3.5" />,
  water: <Droplet className="h-3.5 w-3.5" />,
  sewer: <Droplet className="h-3.5 w-3.5" />,
  wifi: <Wifi className="h-3.5 w-3.5" />,
  firepit: <Flame className="h-3.5 w-3.5" />,
  petFriendly: <PawPrint className="h-3.5 w-3.5" />,
}

export function CampgroundSearch() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(new Date().setDate(new Date().getDate() + 3)),
  })
  const [guests, setGuests] = useState(2)
  const [propertyId] = useState("property-1") // Mock property ID
  const [siteTypeFilter, setSiteTypeFilter] = useState<SiteType | "all">("all")
  const [amenitiesOpen, setAmenitiesOpen] = useState(false)
  const [selectedAmenities, setSelectedAmenities] = useState<Record<string, boolean>>({})

  const [searchResults, setSearchResults] = useState<AvailabilitySearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateNights = () => {
    if (date?.from && date?.to) {
      const diffTime = Math.abs(date.to.getTime() - date.from.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    }
    return 0
  }

  const nights = calculateNights()

  const handleSearch = async () => {
    if (!date?.from || !date?.to) {
      return
    }

    setIsSearching(true)
    setHasSearched(true)
    setError(null)

    try {
      const result = await searchAvailableSites({
        property_id: propertyId,
        check_in_date: format(date.from, "yyyy-MM-dd"),
        check_out_date: format(date.to, "yyyy-MM-dd"),
        number_of_guests: guests,
        site_type: siteTypeFilter === "all" ? undefined : siteTypeFilter,
        amenities: Object.keys(selectedAmenities).filter(key => selectedAmenities[key]),
      })

      if (result.success) {
        setSearchResults(result.data)
        setError(null)

        // Scroll to results
        setTimeout(() => {
          document.getElementById("search-results")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }, 100)
      } else {
        setError(result.error.message)
        setSearchResults(null)
      }
    } catch (error) {
      console.error("[v0] Search error:", error)
      setError("An unexpected error occurred while searching. Please try again.")
      setSearchResults(null)
    } finally {
      setIsSearching(false)
    }
  }

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) => ({
      ...prev,
      [amenity]: !prev[amenity],
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost">Sign In</Button>
          </div>
        </div>
      </nav>

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-destructive/5" />
        <div className="container relative mx-auto px-4 pt-12 pb-8 md:pt-20 md:pb-12">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-4 bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Find Your Perfect Campsite
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
              Search available sites for your next outdoor adventure
            </p>
          </div>

          <Card className="max-w-4xl mx-auto glass-strong shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Search Availability</CardTitle>
              <CardDescription>Find the perfect campsite for your dates and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Property Selector (Mock) */}
              <div className="space-y-2">
                <Label htmlFor="property">Campground</Label>
                <Select defaultValue="property-1">
                  <SelectTrigger id="property">
                    <SelectValue placeholder="Select a campground" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="property-1">Pine Valley Campground</SelectItem>
                    <SelectItem value="property-2">Mountain Ridge Resort</SelectItem>
                    <SelectItem value="property-3">Lakeside Retreat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Picker */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Check-in & Check-out</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
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
                        defaultMonth={date?.from}
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
                      max={20}
                      value={guests}
                      onChange={(e) => setGuests(Math.max(1, Math.min(20, Number.parseInt(e.target.value) || 1)))}
                      className="text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setGuests(Math.min(20, guests + 1))}
                      disabled={guests >= 20}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              {/* Site Type Filter */}
              <div className="space-y-2">
                <Label>Site Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Button
                    type="button"
                    variant={siteTypeFilter === "all" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSiteTypeFilter("all")}
                  >
                    All Sites
                  </Button>
                  <Button
                    type="button"
                    variant={siteTypeFilter === "rv" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSiteTypeFilter("rv")}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    RV
                  </Button>
                  <Button
                    type="button"
                    variant={siteTypeFilter === "tent" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSiteTypeFilter("tent")}
                  >
                    <Tent className="mr-2 h-4 w-4" />
                    Tent
                  </Button>
                  <Button
                    type="button"
                    variant={siteTypeFilter === "cabin" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSiteTypeFilter("cabin")}
                  >
                    <TreePine className="mr-2 h-4 w-4" />
                    Cabin
                  </Button>
                  <Button
                    type="button"
                    variant={siteTypeFilter === "glamping" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setSiteTypeFilter("glamping")}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Glamping
                  </Button>
                </div>
              </div>

              {/* Amenities Filter */}
              <Collapsible open={amenitiesOpen} onOpenChange={setAmenitiesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                    <span className="text-sm font-medium">Amenities Filter (Optional)</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", amenitiesOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { id: "electric", label: "Electric Hookup" },
                      { id: "water", label: "Water Hookup" },
                      { id: "sewer", label: "Sewer Hookup" },
                      { id: "wifi", label: "WiFi" },
                      { id: "petFriendly", label: "Pet-Friendly" },
                      { id: "firepit", label: "Fire Pit" },
                    ].map((amenity) => (
                      <div key={amenity.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={amenity.id}
                          checked={selectedAmenities[amenity.id] || false}
                          onCheckedChange={() => toggleAmenity(amenity.id)}
                        />
                        <Label htmlFor={amenity.id} className="text-sm font-normal cursor-pointer">
                          {amenity.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
            <CardFooter>
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
                onClick={handleSearch}
                disabled={isSearching || !date?.from || !date?.to}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Search Available Sites
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {hasSearched && (
        <div id="search-results" className="container mx-auto px-4 py-12">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">Searching for available sites...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-destructive/10 p-6 mb-6">
                <Search className="h-12 w-12 text-destructive" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Search Error</h3>
              <p className="text-muted-foreground max-w-md">{error}</p>
            </div>
          ) : searchResults && searchResults.sites.length > 0 ? (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Available Sites</h2>
                <p className="text-muted-foreground">
                  {searchResults.sites.length} {searchResults.sites.length === 1 ? "site" : "sites"} available for{" "}
                  {searchResults.total_nights} {searchResults.total_nights === 1 ? "night" : "nights"}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {searchResults.sites.map((site) => (
                  <Card
                    key={site.id}
                    className="overflow-hidden hover:shadow-xl transition-all duration-300 glass group"
                  >
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img
                        src={site.image_url || "/placeholder.svg"}
                        alt={site.name}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                      <Badge className={cn("absolute top-3 right-3 border", siteTypeColors[site.site_type])}>
                        <span className="mr-1">{siteTypeIcons[site.site_type]}</span>
                        {site.site_type.toUpperCase()}
                      </Badge>
                    </div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-xl">{site.name}</CardTitle>
                          <CardDescription className="mt-1">Site #{site.site_number}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                        <Users className="h-4 w-4" />
                        <span>Up to {site.max_occupancy} guests</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Amenities */}
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(site.amenities)
                            .filter(([_, value]) => value)
                            .slice(0, 6)
                            .map(([key]) => (
                              <Badge key={key} variant="outline" className="text-xs gap-1">
                                {amenityIcons[key]}
                                {key === "petFriendly" ? "Pet-Friendly" : key.charAt(0).toUpperCase() + key.slice(1)}
                              </Badge>
                            ))}
                        </div>

                        {/* Pricing */}
                        <div className="pt-3 border-t space-y-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                              $
                              {searchResults.total_nights > 0
                                ? site.base_price_per_night * searchResults.total_nights
                                : site.base_price_per_night}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {searchResults.total_nights > 0
                                ? `for ${searchResults.total_nights} ${
                                    searchResults.total_nights === 1 ? "night" : "nights"
                                  }`
                                : "per night"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">${site.base_price_per_night} per night</p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                      >
                        <Tent className="mr-2 h-4 w-4" />
                        Book Now
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-muted p-6 mb-6">
                <Search className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">No sites available</h3>
              <p className="text-muted-foreground max-w-md">
                We couldn't find any sites matching your criteria. Try adjusting your dates, guest count, or filters.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
