/**
 * Companies API v1 - Subscription Management
 *
 * Phase 4A: API Consolidation
 *
 * GET /api/v1/companies/[id]/subscription - Get subscription status
 * POST /api/v1/companies/[id]/subscription - Activate subscription
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { ActivateSubscriptionRequestSchema } from '@/types/api/v1/schemas/companies'
import {
  GetCompanyQueryHandler,
  GetSubscriptionStatusQueryHandler,
  ActivateSubscriptionCommandHandler,
  companyToDTO,
  SupabaseCompanyRepository,
} from '@/modules/CompanyManagement'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus'

/**
 * GET /api/v1/companies/[id]/subscription
 *
 * Get subscription status for a company.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params
    const supabase = await createClient()

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // 2. Verify ownership (BP-4: Tenant isolation)
    const repository = new SupabaseCompanyRepository(supabase)
    const getHandler = new GetCompanyQueryHandler(repository)
    const getResult = await getHandler.execute({ companyId })

    if (!getResult.success) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, getResult.error.message),
        { status: 404 }
      )
    }

    // result.company is already a CompanyDTO from the query handler
    if (getResult.company.ownerId !== user.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - not your company'),
        { status: 403 }
      )
    }

    // 3. Execute query
    const subscriptionHandler = new GetSubscriptionStatusQueryHandler(repository)
    const result = await subscriptionHandler.execute({ companyId })

    if (!result.success) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, result.error.message),
        { status: 404 }
      )
    }

    // 4. Return response
    return success(result.subscription)
  } catch (err: unknown) {
    console.error('[Companies API v1] Get subscription error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get subscription', { message }),
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/companies/[id]/subscription
 *
 * Activate a subscription for a company.
 * Usually triggered by Stripe webhook, but exposed for admin use.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params
    const supabase = await createClient()

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // 2. Verify ownership (BP-4: Tenant isolation)
    const repository = new SupabaseCompanyRepository(supabase)
    const getHandler = new GetCompanyQueryHandler(repository)
    const getResult = await getHandler.execute({ companyId })

    if (!getResult.success) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, getResult.error.message),
        { status: 404 }
      )
    }

    // result.company is already a CompanyDTO from the query handler
    if (getResult.company.ownerId !== user.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - not your company'),
        { status: 403 }
      )
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const validated = ActivateSubscriptionRequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 }
      )
    }

    // 4. Execute command
    const eventBus = new InMemoryEventBus()
    const activateHandler = new ActivateSubscriptionCommandHandler(repository, eventBus)

    const result = await activateHandler.execute({
      companyId,
      stripeCustomerId: validated.data.stripeCustomerId,
      subscriptionId: validated.data.subscriptionId,
      plan: validated.data.plan,
      billingCycle: validated.data.billingCycle,
    })

    // 5. Handle result
    if (!result.success) {
      const statusCode =
        result.error.code === 'NOT_FOUND' ? 404 :
        result.error.code === 'ALREADY_ACTIVE' ? 409 :
        400

      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.error.message),
        { status: statusCode }
      )
    }

    // 6. Return response
    return success(companyToDTO(result.company))
  } catch (err: unknown) {
    console.error('[Companies API v1] Activate subscription error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to activate subscription', { message }),
      { status: 500 }
    )
  }
}
