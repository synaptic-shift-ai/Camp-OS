/**
 * GET /api/admin/reservations/[id]
 *
 * Fetch full reservation details with guest and site information.
 * Used for displaying reservation details and populating forms/dialogs.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reservationId } = await params

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

    // Fetch reservation with full guest and site details
    const { data: reservation, error: reservationError } = await supabase
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
      .eq('id', reservationId)
      .eq('property_id', propertyId) // Tenant isolation
      .single()

    if (reservationError || !reservation) {
      console.error('Reservation fetch error:', reservationError)
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    return NextResponse.json({
      reservation,
    })
  } catch (error) {
    console.error('GET /api/admin/reservations/[id] error:', error)
    Sentry.captureException(error, {
      tags: {
        endpoint: 'get_reservation',
        reservation_id: reservationId,
      },
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
