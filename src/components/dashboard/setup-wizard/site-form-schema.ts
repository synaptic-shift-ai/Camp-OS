import * as z from "zod"

export const siteTypes = ["tent", "rv", "cabin", "glamping", "yurt", "other"] as const
export const siteStatuses = ["available", "reserved", "booked", "occupied", "housekeeping", "maintenance", "unavailable"] as const
export const reservationTypes = ["nightly", "weekly", "monthly", "seasonal"] as const

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
  // Note: min(0) allows property defaults mode; conditional validation via .refine()
  base_price: z.coerce.number().min(0),
  weekend_price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  weekly_rate: z.coerce.number().min(0).optional(), // Weekly per-night rate
  monthly_rate: z.coerce.number().min(0).optional(), // Monthly per-night rate

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

  // Pet-related fields
  allow_pets: z.boolean().default(false),
  pet_fee: z.coerce.number().min(0).optional(), // In dollars, converted to cents for API

  // ADA Accessibility
  ada_accessible: z.boolean().default(false),
  accessibility_features: z.object({
    wheelchair_accessible: z.boolean().default(false),
    wide_paths: z.boolean().default(false),
    accessible_table: z.boolean().default(false),
    accessible_restroom: z.boolean().default(false),
    handrails: z.boolean().default(false),
    level_ground: z.boolean().default(false),
  }).optional(),

  // Advanced settings (optional)
  availability_rules: z
    .object({
      min_stay: z.coerce.number().min(1).optional(),
      max_stay: z.coerce.number().min(1).optional(),
      booking_window_days: z.coerce.number().min(1).optional(),
      advance_booking_days: z.coerce.number().min(0).optional(),
    })
    .optional(),

  // Reservation type overrides (null = use property defaults)
  use_property_reservation_types: z.boolean().default(true),
  enabled_reservation_types_override: z.array(z.enum(reservationTypes)).optional(),
  default_reservation_type: z.enum(reservationTypes).optional(),

  // Seasonal rate override (in dollars, converted to cents for API)
  seasonal_rate: z.coerce.number().min(0).optional(),
}).refine(
  (data) => {
    // Only require base_price >= 0.01 when NOT using property defaults
    // and nightly reservation type is enabled
    if (!data.use_property_reservation_types) {
      const hasNightly = data.enabled_reservation_types_override?.includes('nightly')
      if (hasNightly && data.base_price < 0.01) {
        return false
      }
    }
    return true
  },
  {
    message: "Base price must be at least $0.01 when nightly reservations are enabled",
    path: ["base_price"],
  }
)

export type SiteFormData = z.infer<typeof siteFormSchema>

/**
 * Helper: Convert form data (dollars) to v1 API format (camelCase, cents)
 *
 * v1 API expects camelCase field names matching CreateSiteRequestSchema:
 * - siteNumber, siteName, siteType, basePrice, weekendPrice
 * - maxOccupancy, maxVehicles, sizeSqft, amenities, hookups
 *
 * NOTE: Optional fields should be undefined (not null) for Zod validation
 */
export function toApiFormat(data: SiteFormData) {
  return {
    // Basic info (camelCase for v1 API)
    siteNumber: data.site_number,
    siteName: data.site_name || undefined,
    siteType: data.site_type,
    description: data.description || undefined,
    // Capacity (camelCase)
    maxOccupancy: data.max_occupancy,
    maxVehicles: data.max_vehicles,
    sizeSqft: data.size_sqft || undefined,
    // Convert dollars to cents (camelCase)
    basePrice: Math.round(data.base_price * 100),
    weekendPrice: data.weekend_price ? Math.round(data.weekend_price * 100) : undefined,
    weeklyRateCents: data.weekly_rate ? Math.round(data.weekly_rate * 100) : undefined,
    monthlyRateCents: data.monthly_rate ? Math.round(data.monthly_rate * 100) : undefined,
    status: data.status,
    // Convert boolean objects to arrays of keys where value is true
    amenities: Object.entries(data.amenities)
      .filter(([_, v]) => v)
      .map(([k]) => k),
    hookups: Object.entries(data.hookups)
      .filter(([_, v]) => v)
      .map(([k]) => k),
    // Reservation type overrides (null means use property defaults)
    enabledReservationTypesOverride: data.use_property_reservation_types
      ? null
      : data.enabled_reservation_types_override || null,
    // Default reservation type for this site
    defaultReservationType: data.default_reservation_type || undefined,
    // Seasonal rate in cents (null means use property default)
    seasonalRateCents: data.seasonal_rate ? Math.round(data.seasonal_rate * 100) : undefined,
  }
}

/**
 * Helper: Convert v1 API response (camelCase, cents) to form format (snake_case, dollars)
 *
 * v1 API returns SiteDTO with structure:
 * - siteNumber, siteName, siteType, description, status
 * - pricing: { basePrice, weekendPrice } (in cents)
 * - capacity: { maxOccupancy, maxVehicles }
 * - sizeSqft, amenities: string[], hookups: string[]
 */
export function fromApiFormat(site: any): Partial<SiteFormData> {
  // Handle both nested (v1 API) and flat structures
  const amenitiesArray = site.amenities || site.site_amenities || []
  const hookupsArray = site.hookups || []

  // Convert amenities array to boolean object
  const amenitiesObj = {
    fire_pit: amenitiesArray.includes("fire_pit") || false,
    picnic_table: amenitiesArray.includes("picnic_table") || false,
    grill: amenitiesArray.includes("grill") || false,
    shade: amenitiesArray.includes("shade") || false,
    pet_friendly: amenitiesArray.includes("pet_friendly") || false,
    lake_view: amenitiesArray.includes("lake_view") || false,
    waterfront: amenitiesArray.includes("waterfront") || false,
  }

  // Convert hookups array to boolean object
  const hookupsObj = {
    water: hookupsArray.includes("water") || false,
    electric: hookupsArray.includes("electric") || false,
    sewer: hookupsArray.includes("sewer") || false,
  }

  // Handle pricing - v1 API uses nested pricing object
  const basePrice = site.pricing?.basePrice ?? site.base_price ?? 0
  const weekendPrice = site.pricing?.weekendPrice ?? site.weekend_price ?? 0

  // Handle capacity - v1 API uses nested capacity object
  const maxOccupancy = site.capacity?.maxOccupancy ?? site.max_occupancy ?? 4
  const maxVehicles = site.capacity?.maxVehicles ?? site.max_vehicles ?? 1

  return {
    // Map camelCase API fields to snake_case form fields
    site_number: site.siteNumber || site.site_number || "",
    site_name: site.siteName || site.site_name || "",
    site_type: site.siteType || site.site_type || "tent",
    max_occupancy: maxOccupancy,
    max_vehicles: maxVehicles,
    size_sqft: site.sizeSqft || site.size_sqft || undefined,
    status: site.status || "available",
    description: site.description || "",
    // Convert cents to dollars
    base_price: basePrice ? basePrice / 100 : 0,
    weekend_price: weekendPrice ? weekendPrice / 100 : undefined,
    weekly_rate: (site.weeklyRateCents || site.weekly_rate_cents)
      ? (site.weeklyRateCents || site.weekly_rate_cents) / 100
      : undefined,
    monthly_rate: (site.monthlyRateCents || site.monthly_rate_cents)
      ? (site.monthlyRateCents || site.monthly_rate_cents) / 100
      : undefined,
    hookups: hookupsObj,
    amenities: amenitiesObj,
    availability_rules: site.availabilityRules || site.availability_rules || undefined,
    // Pet and ADA fields
    allow_pets: site.allowPets || site.allow_pets || false,
    pet_fee: site.petFee ? site.petFee / 100 : (site.pet_fee ? site.pet_fee / 100 : undefined),
    ada_accessible: site.adaAccessible || site.ada_accessible || false,
    accessibility_features: {
      wheelchair_accessible: site.accessibilityFeatures?.includes("wheelchair_accessible") || site.accessibility_features?.includes("wheelchair_accessible") || false,
      wide_paths: site.accessibilityFeatures?.includes("wide_paths") || site.accessibility_features?.includes("wide_paths") || false,
      accessible_table: site.accessibilityFeatures?.includes("accessible_table") || site.accessibility_features?.includes("accessible_table") || false,
      accessible_restroom: site.accessibilityFeatures?.includes("accessible_restroom") || site.accessibility_features?.includes("accessible_restroom") || false,
      handrails: site.accessibilityFeatures?.includes("handrails") || site.accessibility_features?.includes("handrails") || false,
      level_ground: site.accessibilityFeatures?.includes("level_ground") || site.accessibility_features?.includes("level_ground") || false,
    },
    // Reservation type overrides
    use_property_reservation_types:
      (site.enabledReservationTypesOverride === null || site.enabledReservationTypesOverride === undefined) &&
      (site.enabled_reservation_types_override === null || site.enabled_reservation_types_override === undefined),
    enabled_reservation_types_override:
      site.enabledReservationTypesOverride || site.enabled_reservation_types_override || undefined,
    // Default reservation type for this site
    default_reservation_type:
      site.defaultReservationType || site.default_reservation_type || undefined,
    // Seasonal rate (convert from cents to dollars)
    seasonal_rate: site.seasonalRateCents
      ? site.seasonalRateCents / 100
      : site.seasonal_rate_cents
        ? site.seasonal_rate_cents / 100
        : undefined,
  }
}
