import { type NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { buildGuestCancellationPolicyData } from '@/lib/guest/guest-cancellation-policy'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await context.params

    const supabase = createServiceRoleClient()
    const { data: property, error } = await supabase
      .from('properties')
      .select('cancellation_policy, cancellation_policy_config, settings, terms_and_conditions')
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

    const payload = buildGuestCancellationPolicyData(property)

    const rawTerms =
      typeof property.terms_and_conditions === 'string' ? property.terms_and_conditions.trim() : ''
    const terms_and_conditions = rawTerms.length > 0 ? rawTerms : null

    return NextResponse.json({
      success: true,
      data: {
        ...payload,
        cancellation_policy:
          typeof property.cancellation_policy === 'string' && property.cancellation_policy.trim() !== ''
            ? property.cancellation_policy.trim()
            : null,
        terms_and_conditions,
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

