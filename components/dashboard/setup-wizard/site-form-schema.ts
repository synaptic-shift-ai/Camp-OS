import * as z from "zod"

export const siteTypes = ["tent", "rv", "cabin", "glamping", "yurt", "other"] as const
export const siteStatuses = ["available", "unavailable", "maintenance"] as const

export const siteFormSchema = z.object({
  // Basic Info
  site_number: z.string().min(1, "Site number is required").max(50),
  site_name: z.string().max(255).optional().or(z.literal("")),
  site_type: z.enum(siteTypes, { required_error: "Site type is required" }),
  max_occupancy: z.coerce.number().min(1, "At least 1 person").max(50, "Maximum 50 people"),
  max_vehicles: z.coerce.number().min(1).max(10).default(1),
  size_sqft: z.coerce.number().min(0).optional(),
  status: z.enum(siteStatuses).default("available"),
  description: z.string().max(1000).optional().or(z.literal("")),

  // Pricing (in dollars - will convert to cents for API)
  base_price: z.coerce.number().min(0.01, "Base price must be at least $0.01"),
  weekend_price: z.coerce.number().min(0).optional(),

  // Hookups (boolean flags)
  hookups: z.object({
    water: z.boolean().default(false),
    electric: z.boolean().default(false),
    sewer: z.boolean().default(false),
  }),

  // Amenities (boolean flags)
  amenities: z.object({
    fire_pit: z.boolean().default(false),
    picnic_table: z.boolean().default(false),
    grill: z.boolean().default(false),
    shade: z.boolean().default(false),
    pet_friendly: z.boolean().default(false),
    lake_view: z.boolean().default(false),
    waterfront: z.boolean().default(false),
  }),

  // Advanced settings (optional)
  availability_rules: z
    .object({
      min_stay: z.coerce.number().min(1).optional(),
      max_stay: z.coerce.number().min(1).optional(),
      booking_window_days: z.coerce.number().min(1).optional(),
      advance_booking_days: z.coerce.number().min(0).optional(),
    })
    .optional(),
})

export type SiteFormData = z.infer<typeof siteFormSchema>

/**
 * Helper: Convert form data (dollars) to API format (cents)
 */
export function toApiFormat(data: SiteFormData) {
  return {
    site_number: data.site_number,
    site_name: data.site_name || null,
    site_type: data.site_type,
    max_occupancy: data.max_occupancy,
    max_vehicles: data.max_vehicles,
    size_sqft: data.size_sqft || null,
    status: data.status,
    description: data.description || null,
    // Convert dollars to cents
    base_price: Math.round(data.base_price * 100),
    weekend_price_cents: data.weekend_price ? Math.round(data.weekend_price * 100) : null,
    // Convert boolean objects to arrays of keys where value is true
    site_amenities: Object.entries(data.amenities)
      .filter(([_, v]) => v)
      .map(([k]) => k),
    hookups: Object.entries(data.hookups)
      .filter(([_, v]) => v)
      .map(([k]) => k),
    availability_rules: data.availability_rules || {},
  }
}

/**
 * Helper: Convert API data (cents) to form format (dollars)
 */
export function fromApiFormat(site: any): Partial<SiteFormData> {
  // Convert amenities array to boolean object
  const amenitiesObj = {
    fire_pit: site.site_amenities?.includes("fire_pit") || false,
    picnic_table: site.site_amenities?.includes("picnic_table") || false,
    grill: site.site_amenities?.includes("grill") || false,
    shade: site.site_amenities?.includes("shade") || false,
    pet_friendly: site.site_amenities?.includes("pet_friendly") || false,
    lake_view: site.site_amenities?.includes("lake_view") || false,
    waterfront: site.site_amenities?.includes("waterfront") || false,
  }

  // Convert hookups array to boolean object
  const hookupsObj = {
    water: site.hookups?.includes("water") || false,
    electric: site.hookups?.includes("electric") || false,
    sewer: site.hookups?.includes("sewer") || false,
  }

  return {
    site_number: site.site_number || "",
    site_name: site.site_name || "",
    site_type: site.site_type || "tent",
    max_occupancy: site.max_occupancy || 4,
    max_vehicles: site.max_vehicles || 1,
    size_sqft: site.size_sqft || undefined,
    status: site.status || "available",
    description: site.description || "",
    // Convert cents to dollars
    base_price: site.base_price ? site.base_price / 100 : 0,
    weekend_price: site.weekend_price_cents ? site.weekend_price_cents / 100 : undefined,
    hookups: hookupsObj,
    amenities: amenitiesObj,
    availability_rules: site.availability_rules || undefined,
  }
}
