import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { z } from 'zod'

// ============================================================================
// Schemas
// ============================================================================

const UpdateBrandingSchema = z.object({
  logoUrl: z.string().max(500).nullable().optional(),
  senderName: z.string().min(1).max(200).optional(),
  senderEmail: z.string().email().max(300).nullable().optional(),
  replyToEmail: z.string().email().max(300).nullable().optional(),
  primaryColor: z.string().max(7).nullable().optional(),
  secondaryColor: z.string().max(7).nullable().optional(),
})

// ============================================================================
// Helpers
function mergeBranding(
  branding: Record<string, unknown> | null,
  property: Record<string, unknown>,
): Record<string, unknown> {
  return {
    logoUrl: (branding?.logo_url as string) ?? (property.logo_url as string) ?? null,
    primaryColor: (property.brand_color_primary as string) ?? null,
    secondaryColor: (property.brand_color_secondary as string) ?? null,
    senderName: (branding?.sender_name as string) ?? (property.name as string) ?? 'CampOS',
    senderEmail: (branding?.sender_email as string) ?? null,
    replyToEmail: (branding?.reply_to_email as string) ?? null,
    propertyName: (property.name as string) ?? 'CampOS',
  }
}

// ============================================================================
// GET — Fetch branding for a property
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const propertyId = request.nextUrl.searchParams.get('propertyId')
    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    const db = supabase as any

    const [{ data: branding }, { data: property }] = await Promise.all([
      db.from('communication_branding').select('*').eq('property_id', propertyId).maybeSingle(),
      db.from('properties').select('name, logo_url, brand_color_primary, brand_color_secondary').eq('id', propertyId).single(),
    ])

    if (!property) {
      return error(ErrorCodes.PROP_001, request)
    }

    return success({ branding: mergeBranding(branding, property) }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

// ============================================================================
// PUT — Upsert branding for a property
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const propertyId = request.nextUrl.searchParams.get('propertyId')
    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      minimumRole: 'admin',
      permission: 'guest_comms.configure_branding',
    })
    if (isDenied(access)) return access

    const body = await request.json()
    const parsed = UpdateBrandingSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const db = supabase as any

    // Get company_id for the property
    const { data: propRow } = await db
      .from('properties')
      .select('company_id')
      .eq('id', propertyId)
      .single()

    if (!propRow) {
      return error(ErrorCodes.PROP_001, request)
    }

    // Upsert branding row
    const brandingRow: Record<string, unknown> = {
      company_id: propRow.company_id,
      property_id: propertyId,
    }
    if (parsed.data.logoUrl !== undefined) brandingRow.logo_url = parsed.data.logoUrl
    if (parsed.data.senderName !== undefined) brandingRow.sender_name = parsed.data.senderName
    if (parsed.data.senderEmail !== undefined) brandingRow.sender_email = parsed.data.senderEmail
    if (parsed.data.replyToEmail !== undefined) brandingRow.reply_to_email = parsed.data.replyToEmail

    const { data: upserted, error: upsertError } = await db
      .from('communication_branding')
      .upsert(brandingRow, { onConflict: 'property_id' })
      .select('*')
      .single()

    if (upsertError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: upsertError.message })
    }

    // Update property colors if provided
    if (parsed.data.primaryColor !== undefined || parsed.data.secondaryColor !== undefined) {
      const propUpdate: Record<string, unknown> = {}
      if (parsed.data.primaryColor !== undefined) propUpdate.brand_color_primary = parsed.data.primaryColor
      if (parsed.data.secondaryColor !== undefined) propUpdate.brand_color_secondary = parsed.data.secondaryColor

      await db.from('properties').update(propUpdate).eq('id', propertyId)
    }

    // Re-fetch property for merged response
    const { data: property } = await db
      .from('properties')
      .select('name, logo_url, brand_color_primary, brand_color_secondary')
      .eq('id', propertyId)
      .single()

    return success({ branding: mergeBranding(upserted, property ?? {}) }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
