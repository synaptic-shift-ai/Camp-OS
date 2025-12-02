/**
 * Property Completion Status API v1
 *
 * Replaces: /api/onboarding/completion-status
 *
 * Following CLAUDE.md:
 * - BP-4: Multi-tenant isolation
 * - D-2: Tenant context enforced
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { generateBookingSlug } from '@/lib/booking/slug-utils'

/**
 * GET /api/v1/properties/[propertyId]/completion-status
 * Get completion status for a property (used in review-launch wizard step)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Use service role for complete data access
    const supabaseServiceRole = createServiceRoleClient()

    // Fetch the property
    const { data: property, error: propertyError } = await supabaseServiceRole
      .from('properties')
      .select('id, name, description, address, city, state, zip_code, phone, email, booking_page_slug, stripe_account_id, stripe_connected_at, company_id, created_at')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(error(ErrorCodes.RESOURCE_NOT_FOUND, 'Property not found'), { status: 404 })
    }

    // BP-4: Verify user owns this property's company
    const { data: company } = await supabaseServiceRole
      .from('companies')
      .select('id')
      .eq('id', property.company_id)
      .eq('owner_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(error(ErrorCodes.AUTH_002, 'Access denied'), { status: 403 })
    }

    // Fetch sites for this property
    const { data: sites, error: sitesError } = await supabaseServiceRole
      .from('sites')
      .select('id, property_id, site_number, site_name, site_type, base_price, status')
      .eq('property_id', propertyId)
      .order('site_number', { ascending: true })

    if (sitesError) {
      console.error('[v1/completion-status] Failed to fetch sites:', sitesError)
      return NextResponse.json(error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch sites'), { status: 500 })
    }

    // Generate booking slug if missing
    let bookingPageSlug = property.booking_page_slug
    if (!bookingPageSlug) {
      bookingPageSlug = generateBookingSlug(property.name, property.id)
      await supabaseServiceRole
        .from('properties')
        .update({ booking_page_slug: bookingPageSlug, updated_at: new Date().toISOString() })
        .eq('id', property.id)
    }

    // Get base URL for booking page
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const bookingPageUrl = `${baseUrl}/book/${bookingPageSlug}`

    // Count sites by type
    const siteTypeCounts: Record<string, number> = {}
    ;(sites || []).forEach((site) => {
      const type = site.site_type
      siteTypeCounts[type] = (siteTypeCounts[type] || 0) + 1
    })

    const siteBreakdown = Object.entries(siteTypeCounts)
      .map(([type, count]) => {
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
        return `${count} ${typeLabel}`
      })
      .join(', ') || 'No sites added'

    const propertyData = {
      id: property.id,
      name: property.name,
      description: property.description,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zip_code,
      phone: property.phone,
      email: property.email,
      bookingPageSlug: bookingPageSlug,
      stripeConnected: !!property.stripe_account_id,
      stripeConnectedAt: property.stripe_connected_at,
      bookingPageUrl: bookingPageUrl,
      sites: sites || [],
      totalSites: (sites || []).length,
      siteBreakdown: siteBreakdown,
    }

    // Build summary matching old API format for compatibility
    const totalSites = (sites || []).length
    const propertiesWithStripe = property.stripe_account_id ? 1 : 0

    return NextResponse.json(
      success({
        properties: [propertyData],
        summary: {
          totalProperties: 1,
          totalSites: totalSites,
          propertiesWithStripe: propertiesWithStripe,
          allStripeConnected: !!property.stripe_account_id,
        },
      })
    )
  } catch (err: any) {
    console.error('[v1/completion-status] Error:', err)
    return NextResponse.json(error(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch completion status'), { status: 500 })
  }
}
