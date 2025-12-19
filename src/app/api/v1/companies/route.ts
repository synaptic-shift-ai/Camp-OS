/**
 * Companies API v1 - Create Company
 *
 * Phase 4A: API Consolidation
 *
 * POST /api/v1/companies - Create a new company
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { CreateCompanyRequestSchema } from '@/types/api/v1/schemas/companies'
import { CreateCompanyCommandHandler, companyToDTO } from '@/modules/CompanyManagement'
import { SupabaseCompanyRepository } from '@/modules/CompanyManagement'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus'

/**
 * POST /api/v1/companies
 *
 * Create a new company for the authenticated user.
 * Each user can only own one company.
 */
export async function POST(request: NextRequest) {
  try {
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

    // 2. Parse and validate request body
    const body = await request.json()
    const validated = CreateCompanyRequestSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validated.error.errors,
        }),
        { status: 400 }
      )
    }

    // 3. Execute command
    const repository = new SupabaseCompanyRepository(supabase)
    const eventBus = new InMemoryEventBus()
    const handler = new CreateCompanyCommandHandler(repository, eventBus)

    const result = await handler.execute({
      name: validated.data.name,
      ownerId: user.id,
    })

    // 4. Handle result
    if (!result.success) {
      const statusCode = result.error.code === 'ALREADY_HAS_COMPANY' ? 409 : 400
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, result.error.message),
        { status: statusCode }
      )
    }

    // 5. Return response
    return NextResponse.json(
      success(companyToDTO(result.company)),
      { status: 201 }
    )
  } catch (err: unknown) {
    console.error('[Companies API v1] Create company error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to create company', { message }),
      { status: 500 }
    )
  }
}
