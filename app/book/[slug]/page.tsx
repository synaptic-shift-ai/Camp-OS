import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { extractPropertyIdFromSlug } from "@/lib/booking/slug-utils"
import { CampgroundSearch } from "@/components/campground-search"

export default async function PropertyBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Extract property ID from slug
  let propertyIdPrefix: string
  try {
    propertyIdPrefix = extractPropertyIdFromSlug(slug)
  } catch (error) {
    console.error("[Booking] Invalid slug format:", slug, error)
    notFound()
  }

  // Fetch property details from database
  const supabase = await createClient()

  const { data: property, error } = await supabase
    .from("properties")
    .select(`
      id,
      name,
      city,
      state,
      description,
      booking_page_slug,
      booking_page_description,
      booking_page_tagline,
      hero_image_url,
      check_in_time,
      check_out_time,
      check_in_instructions,
      check_out_instructions,
      cancellation_policy,
      house_rules,
      phone,
      email,
      address,
      zip_code,
      timezone,
      office_hours,
      minimum_stay_nights,
      special_instructions,
      directions
    `)
    .eq("booking_page_slug", slug)
    .eq("onboarding_completed", true)
    .single()

  // Handle not found or unpublished properties
  if (error || !property) {
    console.error("[Booking] Property not found or not published:", slug, error)
    notFound()
  }

  // Generate property display data with sensible defaults
  const propertyName = property.name
  const location = `${property.city || ""}${property.city && property.state ? ", " : ""}${property.state || ""}`
  const description =
    property.booking_page_description ||
    property.description ||
    `Welcome to ${propertyName}. Book your campsite for an unforgettable outdoor experience.`
  const tagline = property.booking_page_tagline || null
  const heroImage = property.hero_image_url || "/default-campground-hero.jpg"
  const checkInTime = property.check_in_time || "15:00:00"
  const checkOutTime = property.check_out_time || "11:00:00"
  const cancellationPolicy =
    property.cancellation_policy || "Please contact the property for our cancellation policy."

  // Format check-in/out times for display (e.g., "3:00 PM")
  const formatTime = (time: string) => {
    const [hours = '0', minutes = '00'] = time.split(":")
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const checkInDisplay = formatTime(checkInTime)
  const checkOutDisplay = formatTime(checkOutTime)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <div
        className="relative h-[400px] bg-cover bg-center"
        style={{
          backgroundImage: `url(${heroImage})`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold mb-2 text-shadow-lg">{propertyName}</h1>
          {tagline && <p className="text-xl md:text-2xl mb-4 text-shadow-md">{tagline}</p>}
          {location && <p className="text-lg md:text-xl text-white/90 text-shadow-md">{location}</p>}
        </div>
      </div>

      {/* Property Info Bar */}
      <div className="border-b bg-muted/30 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Check-in:</span>
              <span className="text-muted-foreground">{checkInDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Check-out:</span>
              <span className="text-muted-foreground">{checkOutDisplay}</span>
            </div>
            {property.phone && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">Phone:</span>
                <a href={`tel:${property.phone}`} className="text-primary hover:underline">
                  {property.phone}
                </a>
              </div>
            )}
            {property.email && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">Email:</span>
                <a href={`mailto:${property.email}`} className="text-primary hover:underline">
                  {property.email}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Search Component */}
      <div className="container mx-auto px-4 py-8">
        <CampgroundSearch
          propertyId={property.id}
          propertyName={propertyName}
          hidePropertySelector={true}
        />
      </div>

      {/* Property Details Section */}
      <div className="container mx-auto px-4 py-12 border-t">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* About Section */}
          <div>
            <h2 className="text-3xl font-bold mb-4">About {propertyName}</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">{description}</p>
          </div>

          {/* Check-in/out Instructions */}
          {(property.check_in_instructions || property.check_out_instructions) && (
            <div className="grid md:grid-cols-2 gap-6">
              {property.check_in_instructions && (
                <div>
                  <h3 className="text-xl font-semibold mb-3">Check-in Instructions</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {property.check_in_instructions}
                  </p>
                </div>
              )}
              {property.check_out_instructions && (
                <div>
                  <h3 className="text-xl font-semibold mb-3">Check-out Instructions</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {property.check_out_instructions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cancellation Policy */}
          <div>
            <h3 className="text-xl font-semibold mb-3">Cancellation Policy</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{cancellationPolicy}</p>
          </div>

          {/* House Rules */}
          {property.house_rules && (
            <div>
              <h3 className="text-xl font-semibold mb-3">House Rules</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{property.house_rules}</p>
            </div>
          )}

          {/* Special Instructions */}
          {property.special_instructions && (
            <div>
              <h3 className="text-xl font-semibold mb-3">Important Information</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {property.special_instructions}
              </p>
            </div>
          )}

          {/* Directions */}
          {property.directions && (
            <div>
              <h3 className="text-xl font-semibold mb-3">Directions</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{property.directions}</p>
            </div>
          )}

          {/* Office Hours */}
          {property.office_hours && (
            <div>
              <h3 className="text-xl font-semibold mb-3">Office Hours</h3>
              <p className="text-muted-foreground">{property.office_hours}</p>
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Contact Us</h3>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                <span className="font-medium">Property:</span> {propertyName}
              </p>
              {property.address && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Address:</span> {property.address}
                  {property.city && `, ${property.city}`}
                  {property.state && `, ${property.state}`}
                  {property.zip_code && ` ${property.zip_code}`}
                </p>
              )}
              {property.phone && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Phone:</span>{" "}
                  <a href={`tel:${property.phone}`} className="text-primary hover:underline">
                    {property.phone}
                  </a>
                </p>
              )}
              {property.email && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Email:</span>{" "}
                  <a href={`mailto:${property.email}`} className="text-primary hover:underline">
                    {property.email}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const propertyIdPrefix = extractPropertyIdFromSlug(slug)
    const supabase = await createClient()

    const { data: property } = await supabase
      .from("properties")
      .select("name, city, state, booking_page_description, booking_page_tagline")
      .eq("booking_page_slug", slug)
      .single()

    if (!property) {
      return {
        title: "Campground Booking",
      }
    }

    const location = `${property.city || ""}${property.city && property.state ? ", " : ""}${property.state || ""}`
    const title = `${property.name}${location ? ` - ${location}` : ""} | Campground Reservations`
    const description =
      property.booking_page_description ||
      property.booking_page_tagline ||
      `Book your stay at ${property.name}${location ? ` in ${location}` : ""}. Browse available campsites and make your reservation online.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
      },
    }
  } catch (error) {
    console.error("[Metadata] Error generating metadata:", error)
    return {
      title: "Campground Booking",
    }
  }
}
