/**
 * Branding Applier
 *
 * Fetches per-property email branding and merges it with property colors/logo.
 * Falls back to sensible defaults when no branding row exists.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface BrandingConfig {
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  senderName: string
  senderEmail: string | null
  replyToEmail: string | null
  propertyName: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get the email branding configuration for a property.
 *
 * Merges the communication_branding row (sender info) with property-level
 * brand colors and logo. Falls back to property name as sender name and
 * 'CampOS' as ultimate default.
 */
export async function getPropertyBranding(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<BrandingConfig> {
  const { data, error } = await supabase
    .from('communication_branding')
    .select('logo_url, sender_name, sender_email, reply_to_email')
    .eq('property_id', propertyId)
    .maybeSingle()

  if (error) {
    console.error('[branding-applier] Failed to fetch branding:', error.message)
  }

  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('name, logo_url, brand_color_primary, brand_color_secondary')
    .eq('id', propertyId)
    .single()

  if (propError || !property) {
    console.error('[branding-applier] Failed to fetch property:', propError?.message ?? 'not found')
    return {
      logoUrl: data?.logo_url ?? null,
      primaryColor: null,
      secondaryColor: null,
      senderName: data?.sender_name ?? 'CampOS',
      senderEmail: data?.sender_email ?? null,
      replyToEmail: data?.reply_to_email ?? null,
      propertyName: 'CampOS',
    }
  }

  const propertyName = (property as Record<string, unknown>).name as string || 'CampOS'

  return {
    logoUrl: data?.logo_url ?? (property as Record<string, unknown>).logo_url as string ?? null,
    primaryColor: (property as Record<string, unknown>).brand_color_primary as string ?? null,
    secondaryColor: (property as Record<string, unknown>).brand_color_secondary as string ?? null,
    senderName: data?.sender_name ?? propertyName,
    senderEmail: data?.sender_email ?? null,
    replyToEmail: data?.reply_to_email ?? null,
    propertyName,
  }
}
