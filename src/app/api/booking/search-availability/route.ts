import { type NextRequest, NextResponse } from 'next/server'
import { searchAvailableSites } from '@/lib/booking/availability'
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
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validatedParams = searchParamsSchema.parse(body)

    // Filter out undefined values to match exactOptionalPropertyTypes
    const cleanParams = Object.fromEntries(
      Object.entries(validatedParams).filter(([_, value]) => value !== undefined)
    )

    // Call availability search function
    const result = await searchAvailableSites(cleanParams as any)

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
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
