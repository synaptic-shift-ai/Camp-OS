import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await context.params

    const supabase = createServiceRoleClient()
    const { data: property, error } = await supabase
      .from('properties')
      .select('cancellation_policy, settings')
      .eq('id', propertyId)
      .single()

    if (error || !property) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROPERTY_NOT_FOUND',
            message: 'Property not found',
          },
        },
        { status: 404 }
      )
    }

    const settingsPolicy =
      (property.settings as { cancellationPolicy?: string | null } | null)?.cancellationPolicy ?? null

    const finalPolicy: string | null =
      (property.cancellation_policy as string | null) ?? settingsPolicy ?? null

    return NextResponse.json({
      success: true,
      data: {
        cancellation_policy: finalPolicy,
      },
    })
  } catch (err) {
    console.error('[Guest] Cancellation policy fetch error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load cancellation policy',
        },
      },
      { status: 500 }
    )
  }
}

