import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/sites/[siteId]/reservations
 *
 * Fetch reservations for a specific site within a date range.
 * Used by the site calendar view to display reservations.
 *
 * Query params:
 * - start: Start date (YYYY-MM-DD)
 * - end: End date (YYYY-MM-DD)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start and end dates are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the property this site belongs to
    const { data: site } = await supabase
      .from('sites')
      .select('property_id, properties!inner(owner_id)')
      .eq('id', siteId)
      .single()

    if (!site || (site.properties as any)?.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch reservations for this site within the date range
    // A reservation overlaps if:
    // - check_in is before or on end date
    // - check_out is after or on start date
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, guest_name, check_in, check_out, status, total_price')
      .eq('site_id', siteId)
      .gte('check_out', startDate)
      .lte('check_in', endDate)
      .order('check_in', { ascending: true })

    if (error) {
      console.error('Error fetching reservations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reservations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reservations: reservations || [] })
  } catch (error) {
    console.error('Error in GET /api/admin/sites/[siteId]/reservations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
