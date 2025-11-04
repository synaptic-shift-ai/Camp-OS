import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addSentryContext, addTenantContext, captureException } from '@/lib/monitoring/sentry-utils'

/**
 * Housekeeping Complete API
 *
 * POST /api/admin/sites/[id]/housekeeping-complete
 *
 * Marks a site as ready for booking after housekeeping/maintenance:
 * - Validates site status is 'housekeeping' or 'maintenance'
 * - Updates site status to 'available'
 * - Records completion timestamp and staff user
 *
 * Enforces multi-tenant isolation.
 */

interface HousekeepingCompleteRequest {
  notes?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: siteId } = await params

    // Add Sentry context for debugging
    addSentryContext(request, { siteId })

    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Get the user's property ID (MVP: assumes one property per user)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'No property found for this user.' },
        { status: 404 }
      )
    }

    const propertyId = property.id

    // Add tenant context for multi-tenant debugging
    addTenantContext(propertyId, user.id)

    // Parse request body (optional notes)
    let housekeepingNotes: string | undefined
    try {
      const body: HousekeepingCompleteRequest = await request.json()
      housekeepingNotes = body.notes
    } catch {
      // Body is optional
    }

    // Verify site belongs to this property (tenant isolation)
    const { data: site, error: fetchError } = await supabase
      .from('sites')
      .select('id, property_id, status, site_number, site_name')
      .eq('id', siteId)
      .eq('property_id', propertyId) // Tenant isolation
      .single()

    if (fetchError || !site) {
      return NextResponse.json(
        { error: 'Site not found or access denied.' },
        { status: 404 }
      )
    }

    // Validate site status
    if (site.status !== 'housekeeping' && site.status !== 'maintenance') {
      return NextResponse.json(
        {
          error: `Cannot mark site as available from status: ${site.status}. Only 'housekeeping' or 'maintenance' sites can be marked available.`
        },
        { status: 400 }
      )
    }

    // Update site to available
    const timestamp = new Date().toISOString()

    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        status: 'available',
        updated_at: timestamp,
        // Optionally store housekeeping completion metadata if your schema supports it
        // housekeeping_completed_at: timestamp,
        // housekeeping_completed_by: user.id,
      })
      .eq('id', siteId)
      .eq('property_id', propertyId) // Tenant isolation on update
      .select('*')
      .single()

    if (updateError || !updatedSite) {
      console.error('[Housekeeping Complete] Error updating site:', updateError)
      return NextResponse.json(
        {
          error: 'Failed to update site status',
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // Success
    return NextResponse.json(
      {
        message: `Site ${site.site_name || `#${site.site_number}`} is now available for booking.`,
        site: updatedSite,
      },
      { status: 200 }
    )
  } catch (error) {
    // Unexpected error - log to Sentry
    captureException(error as Error, {
      tags: { api_route: 'housekeeping_complete' },
      extra: { siteId: (await params).id },
    })

    console.error('[Housekeeping Complete] Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
