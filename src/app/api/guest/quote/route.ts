import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { quoteStay } from '@/modules/BookingEngine/application/queries/QuoteStayQuery'

/**
 * POST /api/guest/quote
 *
 * The authoritative price for a prospective stay. The booking portal renders
 * this and computes nothing itself, so what a guest is shown is what
 * reservations/create will charge — both call the same quoteStay query.
 *
 * Public, like the rest of the guest booking API: pricing is already visible on
 * a property's booking page. Tenant isolation is still applied when loading the
 * site, so a site_id from one property cannot be priced against another.
 */

const quoteRequestSchema = z.object({
  property_id: z.string().uuid(),
  site_id: z.string().uuid(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  num_adults: z.number().int().min(1).default(1),
  num_children: z.number().int().min(0).default(0),
  num_pets: z.number().int().min(0).default(0),
})

const MS_PER_NIGHT = 1000 * 60 * 60 * 24

export async function POST(request: NextRequest) {
  try {
    const parsed = quoteRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } },
        { status: 400 },
      )
    }
    const input = parsed.data

    const checkIn = new Date(input.check_in_date)
    const checkOut = new Date(input.check_out_date)
    const numberOfNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / MS_PER_NIGHT)
    if (numberOfNights < 1) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' },
        },
        { status: 400 },
      )
    }

    const supabase = createServiceRoleClient()

    const [{ data: property }, { data: site }] = await Promise.all([
      supabase
        .from('properties')
        .select(
          'id, pricing_config, rate_discounts_config, enabled_reservation_types, reservation_type_config, site_type_config',
        )
        .eq('id', input.property_id)
        .single(),
      supabase
        .from('sites')
        .select(
          'id, site_type, base_price, weekly_rate_cents, monthly_rate_cents, enabled_reservation_types_override, pricing_override',
        )
        .eq('id', input.site_id)
        .eq('property_id', input.property_id) // BP-4: tenant isolation
        .is('deleted_at', null)
        .single(),
    ])

    if (!site) {
      return NextResponse.json(
        { success: false, error: { code: 'SITE_NOT_FOUND', message: 'Site not found' } },
        { status: 404 },
      )
    }

    const { breakdown, lineItems } = quoteStay({
      site: {
        site_type: site.site_type ?? null,
        base_price: site.base_price ?? null,
        weekly_rate_cents: site.weekly_rate_cents ?? null,
        monthly_rate_cents: site.monthly_rate_cents ?? null,
        pricing_override: site.pricing_override,
        enabled_reservation_types_override: site.enabled_reservation_types_override,
      },
      property: property
        ? {
            pricing_config: property.pricing_config,
            rate_discounts_config: property.rate_discounts_config,
            reservation_type_config: property.reservation_type_config,
            site_type_config: property.site_type_config,
            enabled_reservation_types: property.enabled_reservation_types,
          }
        : null,
      checkInDate: input.check_in_date,
      checkOutDate: input.check_out_date,
      numberOfNights,
      numAdults: input.num_adults,
      numChildren: input.num_children,
      numPets: input.num_pets,
    })

    return NextResponse.json({
      success: true,
      data: { price_breakdown: breakdown, line_items: lineItems },
    })
  } catch (err: unknown) {
    console.error('[Guest Quote] error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to price stay' } },
      { status: 500 },
    )
  }
}
