/**
 * GET /api/admin/sites/[id]/reservations
 *
 * Fetch reservations for a specific site with optional filtering.
 * Used to find today's check-in for site-based check-in workflows.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params
  const { searchParams } = new URL(request.url)

  // Optional filters
  const checkInDate = searchParams.get('check_in_date')
  const status = searchParams.get('status')

  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's property (multi-tenant isolation)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const propertyId = property.id

    // Verify site belongs to this property
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, property_id')
      .eq('id', siteId)
      .eq('property_id', propertyId) // Tenant isolation
      .single()

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // Build query for reservations
    let query = supabase
      .from('reservations')
      .select(
        `
        *,
        guest:guests (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        site:sites (
          id,
          site_number,
          site_name,
          site_type
        )
      `
      )
      .eq('site_id', siteId)
      .eq('property_id', propertyId) // Tenant isolation

    // Apply filters
    if (checkInDate) {
      query = query.eq('check_in_date', checkInDate)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Order by check-in date descending (most recent first)
    query = query.order('check_in_date', { ascending: false })

    const { data: reservations, error: reservationsError } = await query

    if (reservationsError) {
      console.error('Reservations fetch error:', reservationsError)
      return NextResponse.json(
        { error: 'Failed to fetch reservations' },
        { status: 500 }
      )
    }

    // If filtering for a specific date/status, return single reservation
    if (checkInDate && status) {
      const reservation = reservations?.[0] || null

      if (!reservation) {
        return NextResponse.json(
          { error: 'No reservation found matching criteria' },
          { status: 404 }
        )
      }

      return NextResponse.json({ reservation })
    }

    // Otherwise return all matching reservations
    return NextResponse.json({
      reservations: reservations || [],
      count: reservations?.length || 0,
    })
  } catch (error) {
    console.error('GET /api/admin/sites/[id]/reservations error:', error)
    Sentry.captureException(error, {
      tags: {
        endpoint: 'get_site_reservations',
        site_id: siteId,
      },
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
