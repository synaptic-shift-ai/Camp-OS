/**
 * Financial API v1 - Release Security Deposit
 *
 * POST /api/v1/financial/deposits/[id]/release - Release a security deposit
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { ReleaseSecurityDepositCommandHandler } from '@/modules/Financial/application/commands/ReleaseSecurityDepositCommand'
import { SupabaseSecurityDepositRepository } from '@/modules/Financial/infrastructure/SupabaseSecurityDepositRepository'
import { toSecurityDepositDTO } from '@/modules/Financial/application/DTOs/SecurityDepositDTO'

/**
 * POST /api/v1/financial/deposits/[id]/release
 *
 * Release a security deposit back to the guest.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: depositId } = await params
    const supabase = await createClient()

    // Authenticate user
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

    // Verify deposit exists
    const depositRepository = new SupabaseSecurityDepositRepository(supabase)
    const existingDeposit = await depositRepository.findById(depositId)

    if (!existingDeposit) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Security deposit not found'),
        { status: 404 }
      )
    }

    // RBAC: verify user has refund access to this property
    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: existingDeposit.propertyId,
      minimumRole: 'admin',
      permission: 'financial.refund',
    })
    if (isDenied(access)) return access


    // Execute command
    const commandHandler = new ReleaseSecurityDepositCommandHandler(depositRepository)

    const deposit = await commandHandler.execute({ depositId })

    // Convert to DTO
    const depositDTO = toSecurityDepositDTO(deposit)

    return success(depositDTO)
  } catch (err: any) {
    console.error('[Financial API v1] Release deposit error:', err)

    // Handle domain errors
    if (err.message.includes('already been released')) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, err.message),
        { status: 400 }
      )
    }

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to release security deposit', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
