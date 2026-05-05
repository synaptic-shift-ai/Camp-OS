/**
 * Guests API v1 - Stripe Customer Linking
 *
 * Phase 2, Week 7: Guest Management Module
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * NEW STANDARD ENDPOINT
 *
 * POST   /api/v1/guests/[id]/stripe - Link Stripe Customer ID to guest
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  LinkStripeCustomerRequestSchema,
  type LinkStripeCustomerRequest,
} from '@/types/api/v1/schemas/guests'
import { GetGuestQueryHandler } from '@/modules/GuestManagement/application/queries/GetGuestQuery'
import { LinkStripeCustomerCommandHandler } from '@/modules/GuestManagement/application/commands/LinkStripeCustomerCommand'
import { SupabaseGuestRepository } from '@/modules/GuestManagement/infrastructure/SupabaseGuestRepository'
/**
 * POST /api/v1/guests/[id]/stripe
 *
 * Link a Stripe Customer ID to a guest for saved payment methods.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(error(ErrorCodes.AUTH_001, 'Unauthorized'), { status: 401 })
    }

    // Verify guest exists
    const repository = new SupabaseGuestRepository(supabase)
    const queryHandler = new GetGuestQueryHandler(repository)
    const existingGuestDTO = await queryHandler.execute({ guestId: id })

    // Verify user has access to this guest's property (RBAC)
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingGuestDTO.propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    // Parse and validate request body
    const body = await request.json()
    const validatedRequest = LinkStripeCustomerRequestSchema.safeParse(body)

    if (!validatedRequest.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validatedRequest.error.format(),
        }),
        { status: 400 }
      )
    }

    const { stripeCustomerId }: LinkStripeCustomerRequest = validatedRequest.data

    // Execute command using application layer
    const commandHandler = new LinkStripeCustomerCommandHandler(repository)

    await commandHandler.execute({
      guestId: id,
      stripeCustomerId,
    })

    // Fetch updated guest
    const updatedGuestDTO = await queryHandler.execute({ guestId: id })

    return success(updatedGuestDTO)
  } catch (err: any) {
    console.error('[Guests API v1] POST Stripe link error:', err)

    if (err.message.includes('not found')) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Guest not found'),
        { status: 404 }
      )
    }

    if (err.message.includes('already linked')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Stripe customer already linked to this guest'),
        { status: 409 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to link Stripe customer', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
