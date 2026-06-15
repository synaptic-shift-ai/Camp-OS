import { type NextRequest, NextResponse } from 'next/server'
import { searchAvailableSites } from '@/lib/booking/availability'
import { getActivePromoDisplay } from '@/lib/config/resolution'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { RateDiscountsConfig } from '@/lib/config/types'
import { z } from 'zod'

const searchParamsSchema = z.object({
  property_id: z.string().uuid(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  num_adults: z.number().int().min(1).optional(),
  num_children: z.number().int().min(0).optional(),
  site_type: z.enum(['rv', 'tent', 'cabin', 'glamping', 'yurt', 'other']).optional(),
  amenities: z.array(z.string()).optional(),
  reservation_type: z.enum(['nightly', 'weekly', 'monthly', 'seasonal']).optional(),
  respect_property_enabled_rate_types: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedParams = searchParamsSchema.parse(body)

    // Filter out undefined values to match exactOptionalPropertyTypes
    const cleanParams = Object.fromEntries(
      Object.entries(validatedParams).filter(([, value]) => value !== undefined)
    )

    // Call availability search function
    const result = await searchAvailableSites(cleanParams as any)

    if (result.success && result.data) {
      const propertyId = validatedParams.property_id
      const supabase = createServiceRoleClient()
      const { data: property } = await supabase
        .from('properties')
        .select('name, address, city, state, zip_code, rate_discounts_config, pricing_config, cancellation_policy')
        .eq('id', propertyId)
        .single()
      const activePromos = getActivePromoDisplay(
        (property?.rate_discounts_config as RateDiscountsConfig | null) ?? null
      )
      const propertyAddress = [property?.address, property?.city, property?.state, property?.zip_code]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .join(', ') || null
      return NextResponse.json({
        ...result,
        data: {
          ...result.data,
          property_name: property?.name?.trim() || null,
          property_address: propertyAddress,
          cancellation_policy: property?.cancellation_policy ?? null,
          active_promos: activePromos,
          rate_discounts_config: property?.rate_discounts_config ?? null,
          pricing_config: property?.pricing_config ?? null,
        },
      })
    }
    if (result.success) {
      return NextResponse.json(result)
    }
    return NextResponse.json(result, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Invalid search parameters',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    console.error('[API] Search availability error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}
