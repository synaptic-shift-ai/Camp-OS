/**
 * Companies API v1 - Get/Update Company
 *
 * Phase 4A: API Consolidation
 *
 * GET /api/v1/companies/[id] - Get company by ID
 * PATCH /api/v1/companies/[id] - Update company
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { UpdateCompanyRequestSchema } from '@/types/api/v1/schemas/companies'
import {
  GetCompanyQueryHandler,
  UpdateCompanyCommandHandler,
  companyToDTO,
  SupabaseCompanyRepository,
} from '@/modules/CompanyManagement'
import type { CompanyDTO } from '@/modules/CompanyManagement'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { userHasStaffAssignmentToCompany } from '@/lib/dashboard/company-access'

function companyDtoForStaffReader(dto: CompanyDTO): CompanyDTO {
  return {
    ...dto,
    subscription: {
      ...dto.subscription,
      stripeCustomerId: null,
      subscriptionId: null,
    },
    onboardingToken: null,
  }
}

/**
 * GET /api/v1/companies/[id]
 *
 * Company owner: full DTO (user-scoped Supabase when RLS allows).
 * Property staff assigned to a property under this company: branding + safe fields via
 * service-role load after assignment check (BP-4). Others: 403/404.
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

    const isStaffForCompany = await userHasStaffAssignmentToCompany(
      supabase,
      user.id,
      companyId
    )

    const repository = new SupabaseCompanyRepository(supabase)
    const handler = new GetCompanyQueryHandler(repository)
    const result = await handler.execute({ companyId })

    if (result.success) {
      const company = result.company
      if (company.ownerId === user.id) {
        return success(company)
      }
      if (isStaffForCompany) {
        return success(companyDtoForStaffReader(company))
      }
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - no access to this company'),
        { status: 403 }
      )
    }

    if (isStaffForCompany) {
      const serviceSupabase = createServiceRoleClient()
      const serviceRepo = new SupabaseCompanyRepository(serviceSupabase)
      const serviceHandler = new GetCompanyQueryHandler(serviceRepo)
      const sr = await serviceHandler.execute({ companyId })
      if (!sr.success) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, sr.error.message),
          { status: 404 }
        )
      }
      if (sr.company.id !== companyId) {
        return NextResponse.json(
          error(ErrorCodes.RESOURCE_NOT_FOUND, 'Company not found'),
          { status: 404 }
        )
      }
      return success(companyDtoForStaffReader(sr.company))
    }

    return NextResponse.json(
      error(ErrorCodes.RESOURCE_NOT_FOUND, result.error.message),
      { status: 404 }
    )
  } catch (err: unknown) {
    console.error('[Companies API v1] Get company error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get company', { message }),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/companies/[id]
 *
 * Update a company. User must be the owner.
 */
export async function PATCH(
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

    // 2. Verify ownership first (BP-4: Tenant isolation)
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
    const existingCompany: CompanyDTO = getResult.company
    if (existingCompany.ownerId !== user.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - not your company'),
        { status: 403 }
      )
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const validated = UpdateCompanyRequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 }
      )
    }

    // 4. Execute command
    const updateHandler = new UpdateCompanyCommandHandler(repository)

    // Build input, only including name if defined (exactOptionalPropertyTypes compatibility)
    const updateInput: { companyId: string; name?: string; companyLogoUrl?: string | null } = { companyId }
    if (validated.data.name !== undefined) {
      updateInput.name = validated.data.name
    }
    if (validated.data.companyLogoUrl !== undefined) {
      updateInput.companyLogoUrl = validated.data.companyLogoUrl
    }

    const result = await updateHandler.execute(updateInput)

    // 5. Handle result
    if (!result.success) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.error.message),
        { status: statusCode }
      )
    }

    // 6. Record activity log
    const supabaseServiceRole = createServiceRoleClient()
    await recordActivityLog(supabaseServiceRole, {
      companyId: companyId,
      propertyId: null,
      action: 'update',
      resource: 'company',
      userId: user.id,
      details: `Updated company (name: ${validated.data.name})`,
    })
    
    // 7. Return response
    return success(companyToDTO(result.company))
  } catch (err: unknown) {
    console.error('[Companies API v1] Update company error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to update company', { message }),
      { status: 500 }
    )
  }
}
