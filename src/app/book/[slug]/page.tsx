import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { extractPropertyIdFromSlug } from "@/lib/booking/slug-utils"
import { PropertyBookingPortal } from "@/components/guest/property-booking-portal"

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
      directions,
      amenities
    `)
    .eq("booking_page_slug", slug)
    .eq("onboarding_completed", true)
    .single()

  // Handle not found or unpublished properties
  if (error || !property) {
    console.error("[Booking] Property not found or not published:", slug, error)
    notFound()
  }

  // Prepare property data for PropertyBookingPortal component
  const propertyData = {
    id: property.id,
    name: property.name,
    city: property.city || "",
    state: property.state || "",
    description: property.booking_page_description || property.description,
    tagline: property.booking_page_tagline,
    hero_image_url: property.hero_image_url,
    check_in_time: property.check_in_time || "15:00:00",
    check_out_time: property.check_out_time || "11:00:00",
    phone: property.phone,
    email: property.email,
    cancellation_policy: property.cancellation_policy,
    amenities: (property.amenities as string[]) || [],
  }

  return <PropertyBookingPortal property={propertyData} slug={slug} />
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
