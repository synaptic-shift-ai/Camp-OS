/**
 * Companies API v1 - Invite Token Generation
 *
 * Phase 4A: API Consolidation
 *
 * POST /api/v1/companies/[id]/invite - Generate invite token
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  GetCompanyQueryHandler,
  GenerateInviteTokenCommandHandler,
  SupabaseCompanyRepository,
} from '@/modules/CompanyManagement'

/**
 * POST /api/v1/companies/[id]/invite
 *
 * Generate an invite token for a company.
 * Used for onboarding new properties.
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

    // 3. Execute command
    const inviteHandler = new GenerateInviteTokenCommandHandler(repository)

    const result = await inviteHandler.execute({ companyId })

    // 4. Handle result
    if (!result.success) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, result.error.message),
        { status: 404 }
      )
    }

    // 5. Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/onboarding?token=${result.token.value}`

    // 6. Return response
    return NextResponse.json(
      success({
        token: result.token.value,
        expiresAt: result.token.expiresAt.toISOString(),
        inviteUrl,
      }),
      { status: 201 }
    )
  } catch (err: unknown) {
    console.error('[Companies API v1] Generate invite error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to generate invite', { message }),
      { status: 500 }
    )
  }
}
