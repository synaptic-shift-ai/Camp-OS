import * as z from "zod"
import {
  parsePricingSourceFromPricingOverride,
  parsePricingSourceOverride,
  serializePricingSourceForPricingOverride,
} from "@/lib/site-pricing-source"

export const siteTypes = ["tent", "rv", "cabin", "glamping", "yurt", "other"] as const
export const siteStatuses = ["available", "reserved", "booked", "occupied", "housekeeping", "maintenance", "unavailable"] as const
export const reservationTypes = ["nightly", "weekly", "monthly", "seasonal"] as const
export const pricingSourceOptions = ["manual", "property_defaults", "site_type_defaults"] as const
export type PricingSource = (typeof pricingSourceOptions)[number]

export const siteFormSchema = z.object({
  // Basic Info
  site_number: z.string().min(1, "Site number is required").max(50),
  site_name: z.string().max(255).optional().or(z.literal("")),
  site_type: z.enum(siteTypes, { required_error: "Site type is required" }),
  max_occupancy: z.coerce.number().min(1, "At least 1 person").max(50, "Maximum 50 people"),
  max_vehicles: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? 1 : Number(v)),
    z.number().min(0).max(10)
  ),
  size_sqft: z.coerce.number().min(0).optional(),
  status: z.enum(siteStatuses).default("available"),
  description: z.string().max(1000).optional().or(z.literal("")),

  // Pricing (in dollars - will convert to cents for API)
  // Note: min(0) allows property defaults mode; conditional validation via .refine()
  base_price: z.coerce.number().min(0),
  weekend_price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  weekly_rate: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  monthly_rate: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(0).optional()
  ),

  // Hookups (boolean flags)
  hookups: z.object({
    water: z.boolean().default(false),
    electric: z.boolean().default(false),
    sewer: z.boolean().default(false),
  }),

  // Amenities (dynamic boolean flags; keys come from property amenities)
  amenities: z.record(z.boolean()),

  // Pet-related fields
  allow_pets: z.boolean().default(false),
  pet_fee: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(0).optional()
  ), // In dollars, converted to cents for API

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

  // Pricing source: manual (form fields), property_defaults (reservation_type_config), site_type_defaults (site_type_config)
  pricing_source: z.enum(pricingSourceOptions).default("property_defaults"),
  // Reservation type overrides (null = use property defaults)
  use_property_reservation_types: z.boolean().default(true),
  enabled_reservation_types_override: z.array(z.enum(reservationTypes)).optional(),
  default_reservation_type: z.enum(reservationTypes).optional(),

  // Seasonal rate override (in dollars, converted to cents for API)
  seasonal_rate: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
}).refine(
  (data) => {
    // Require base_price >= 0.01 only when pricing is manual and nightly is enabled
    if (data.pricing_source !== "manual") return true
    const hasNightly = data.enabled_reservation_types_override?.includes("nightly")
    if (hasNightly && data.base_price < 0.01) return false
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
  const isManual = data.pricing_source === "manual"
  const basePriceCents = isManual ? Math.round(data.base_price * 100) : 0

  const pricingSourceType = data.pricing_source === "manual"
    ? "manual"
    : data.pricing_source === "site_type_defaults"
      ? "site_type_default"
      : "property_default"

  return {
    // Basic info (camelCase for v1 API)
    siteNumber: data.site_number,
    siteName: data.site_name || undefined,
    siteType: data.site_type,
    description: data.description || undefined,
    // Capacity (camelCase)
    maxOccupancy: Number(data.max_occupancy),
    maxVehicles: Number(data.max_vehicles),
    sizeSqft:
      data.size_sqft != null && Number(data.size_sqft) > 0
        ? Math.round(Number(data.size_sqft))
        : undefined,
    // Always send basePrice; API will derive property defaults when non-manual and amount is 0
    basePrice: basePriceCents,
    // Only send additional rate fields when manual so saving "property default" or "site type default" doesn't overwrite stored rates
    ...(isManual && {
      weekendPrice: data.weekend_price ? Math.round(data.weekend_price * 100) : undefined,
      weeklyRateCents: data.weekly_rate ? Math.round(data.weekly_rate * 100) : undefined,
      monthlyRateCents: data.monthly_rate ? Math.round(data.monthly_rate * 100) : undefined,
      seasonalRateCents: data.seasonal_rate ? Math.round(data.seasonal_rate * 100) : undefined,
    }),
    status: data.status,
    // Convert boolean objects to arrays of keys where value is true
    amenities: Object.entries(data.amenities)
      .filter(([_, v]) => v)
      .map(([k]) => k),
    hookups: Object.entries(data.hookups)
      .filter(([_, v]) => v)
      .map(([k]) => k),
    allowPets: data.allow_pets,
    petFee: data.pet_fee != null ? Math.round(data.pet_fee * 100) : undefined,
    adaAccessible: data.ada_accessible,
    accessibilityFeatures: data.accessibility_features
      ? Object.entries(data.accessibility_features)
          .filter(([_, v]) => v)
          .map(([k]) => k)
      : [],
    // Manual checkbox selection is always stored as an array (indicator only).
    enabledReservationTypesOverride: data.enabled_reservation_types_override ?? [],
    // Pricing source selector is stored in `sites.pricing_override` (new encoding).
    pricingOverride: serializePricingSourceForPricingOverride(pricingSourceType),
    // Default reservation type for this site
    defaultReservationType: data.default_reservation_type || undefined,
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
  const amenitiesArray = site.amenities ?? site.site_amenities ?? []
  const hookupsArray = site.hookups || []

  // Convert amenities array to boolean object (dynamic + known defaults)
  const amenitiesObj: Record<string, boolean> = {
    fire_pit: false,
    picnic_table: false,
    grill: false,
    shade: false,
    pet_friendly: false,
    lake_view: false,
    waterfront: false,
  }
  for (const amenity of amenitiesArray) {
    if (typeof amenity === "string" && amenity.trim().length > 0) {
      amenitiesObj[amenity] = true
    }
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
    ...(function () {
      const enabledRaw = site.enabledReservationTypesOverride ?? site.enabled_reservation_types_override
      const enabledManualTypes = Array.isArray(enabledRaw) ? enabledRaw : undefined

      const pricingOverrideRaw = site.pricingOverride ?? site.pricing_override
      const sourceFromNew = parsePricingSourceFromPricingOverride(pricingOverrideRaw)
      const legacyParsed = !sourceFromNew ? parsePricingSourceOverride(enabledRaw) : null
      const effectiveSource =
        sourceFromNew ??
        // Backward compat: legacy parsing lives in `enabled_reservation_types_override`
        (legacyParsed?.source ?? "property_default")

      return {
        pricing_source:
          effectiveSource === "manual"
            ? "manual"
            : effectiveSource === "site_type_default"
              ? "site_type_defaults"
              : "property_defaults",
        use_property_reservation_types: effectiveSource !== "manual",
        enabled_reservation_types_override: enabledManualTypes as any,
      }
    })(),
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
