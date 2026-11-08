/**
 * PATCH  /api/v1/properties/[propertyId]/taxes/[taxId] — change a tax.
 * DELETE /api/v1/properties/[propertyId]/taxes/[taxId] — soft-delete it.
 *
 * Same gate as the collection route. A tax is loaded by both id and property,
 * so a tax belonging to another property reads as not found rather than being
 * editable (BP-4).
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import {
  canEditPropertySettingsModule,
  PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE,
} from '@/lib/dashboard/property-settings-module-edit'
import { UpdatePropertyTaxRequestSchema } from '@/types/api/v1/schemas/taxes'
import { SupabasePropertyTaxRepository } from '@/modules/PropertyManagement/infrastructure/SupabasePropertyTaxRepository'
import { toPropertyTaxDTO } from '@/modules/PropertyManagement/application/DTOs/PropertyTaxDTO'

type RouteParams = { params: Promise<{ propertyId: string; taxId: string }> }

/** Authenticate, authorize for editing, and resolve the company for the audit log. */
async function authorizeEdit(request: NextRequest, propertyId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { denied: error(ErrorCodes.AUTH_001, request) } as const

  const access = await requirePropertyAccess(supabase, user.id, {
    propertyId,
    minimumRole: 'staff',
  })
  if (isDenied(access)) return { denied: access } as const

  if (!(await canEditPropertySettingsModule(supabase, propertyId, user.id))) {
    return {
      denied: error(ErrorCodes.AUTH_002, PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE, 403, request),
    } as const
  }

  return { userId: user.id, companyId: access.companyId ?? null } as const
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { propertyId, taxId } = await params
    const authorized = await authorizeEdit(request, propertyId)
    if ('denied' in authorized) return authorized.denied

    const parsed = UpdatePropertyTaxRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, { errors: parsed.error.format() })
    }

    const service = createServiceRoleClient()
    const repository = new SupabasePropertyTaxRepository(service)

    const tax = await repository.findById(propertyId, taxId)
    if (!tax) return error(ErrorCodes.RESOURCE_NOT_FOUND, request)

    try {
      tax.update(parsed.data)
    } catch (invariant) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: invariant instanceof Error ? invariant.message : 'Invalid tax configuration',
      })
    }

    await repository.save(tax)

    if (authorized.companyId) {
      await recordActivityLog(
        service,
        {
          companyId: authorized.companyId,
          propertyId,
          action: 'update',
          resource: 'property_tax',
          userId: authorized.userId,
          details: `Updated tax "${tax.name}" (${Object.keys(parsed.data).join(', ')}).`,
        },
        { failOpen: false },
      )
    }

    return success({ tax: toPropertyTaxDTO(tax) }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Taxes API v1] PATCH error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { propertyId, taxId } = await params
    const authorized = await authorizeEdit(request, propertyId)
    if ('denied' in authorized) return authorized.denied

    const service = createServiceRoleClient()
    const repository = new SupabasePropertyTaxRepository(service)

    const tax = await repository.findById(propertyId, taxId)
    if (!tax) return error(ErrorCodes.RESOURCE_NOT_FOUND, request)

    await repository.softDelete(propertyId, taxId)

    if (authorized.companyId) {
      await recordActivityLog(
        service,
        {
          companyId: authorized.companyId,
          propertyId,
          action: 'delete',
          resource: 'property_tax',
          userId: authorized.userId,
          details: `Removed tax "${tax.name}". Existing tax lines keep the rate they were charged at.`,
        },
        { failOpen: false },
      )
    }

    return success({ id: taxId }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Taxes API v1] DELETE error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
