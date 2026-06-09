/**
 * Server-only helpers for property access in dashboard/[propertyId] routes.
 * - getFirstPropertyId(): first property for current user's company (for redirects).
 * - getPropertyForUser(propertyId): resolve property and verify user has access.
 */

import { createClient } from "@/lib/supabase/server"

/**
 * Returns the first property ID for the current user's company (for redirect from /dashboard).
 */
export async function getFirstPropertyId(): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (company) {
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (property?.id) return property.id
  }

  const { data: fallback } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fallback?.id) return fallback.id

  const { data: staffAssignment } = await supabase
    .from("property_staff")
    .select("property_id")
    .eq("user_id", user.id)
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return staffAssignment?.property_id ?? null
}

/**
 * Fetches a property by ID and verifies the current user has access (company, owner, or staff assignment).
 * Returns null if not found or no access.
 */
export async function getPropertyForUser(propertyId: string): Promise<{
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  check_in_time: string | null
  check_out_time: string | null
  hero_image_url: string | null
  owner_id: string | null
  company_id: string | null
  deposit_config: unknown
  pricing_config: unknown
  booking_rules_config: unknown
  rate_discounts_config: unknown
  enabled_reservation_types: unknown
  reservation_type_config: unknown
  site_type_config: unknown
  settings: unknown
  cancellation_policy: string | null
  cancellation_policy_config: unknown
  terms_and_conditions: string | null
  stripe_account_id: string | null
  stripe_connected_at: string | null
  timezone: string | null
} | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: property, error } = await supabase
    .from("properties")
    .select(`
      id,
      name,
      description,
      address,
      city,
      state,
      zip_code,
      phone,
      email,
      check_in_time,
      check_out_time,
      hero_image_url,
      owner_id,
      company_id,
      deposit_config,
      pricing_config,
      booking_rules_config,
      rate_discounts_config,
      enabled_reservation_types,
      reservation_type_config,
      site_type_config,
      settings,
      cancellation_policy,
      cancellation_policy_config,
      terms_and_conditions,
      stripe_account_id,
      stripe_connected_at,
      payment_processor,
      timezone
    `)
    .eq("id", propertyId)
    .maybeSingle()

  if (error || !property) return null

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  const isOwnerOrCompanyUser =
    (company && property.company_id === company.id) || property.owner_id === user.id

  if (isOwnerOrCompanyUser) return property

  const { data: staffRow } = await supabase
    .from("property_staff")
    .select("id")
    .eq("property_id", property.id)
    .eq("user_id", user.id)
    .in("status", ["active", "pending"])
    .limit(1)
    .maybeSingle()

  const hasStaffAccess = Boolean(staffRow)

  if (!hasStaffAccess) return null

  return property
}
