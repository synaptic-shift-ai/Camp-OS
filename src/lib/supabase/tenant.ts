import { createClient } from "@/lib/supabase/server"

/**
 * Get property information by subdomain
 */
export async function getPropertyBySubdomain(subdomain: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("subdomain", subdomain)
    .eq("status", "active")
    .single()

  if (error) {
    console.error("[v0] Error fetching property by subdomain:", error)
    return null
  }

  return data
}

/**
 * Check if user has access to a property
 */
export async function hasPropertyAccess(userId: string, propertyId: string) {
  const supabase = await createClient()

  // Check if user is owner
  const { data: property } = await supabase.from("properties").select("owner_id").eq("id", propertyId).single()

  if (property?.owner_id === userId) {
    return true
  }

  // Check if user is staff member
  const { data: staff } = await supabase
    .from("property_staff")
    .select("id")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .single()

  return !!staff
}
