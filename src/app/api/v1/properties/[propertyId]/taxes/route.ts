/**
 * GET  /api/v1/properties/[propertyId]/taxes — list configured taxes and the
 *       categories they can charge on.
 * POST /api/v1/properties/[propertyId]/taxes — add a tax.
 *
 * Thin by R-3: authenticate, authorize, validate, call the aggregate and
 * repository, format. Every invariant worth enforcing lives in PropertyTax.
 *
 * Gated on the property-settings module, the same gate as the rate and name
 * these taxes replace (`/api/properties/[id]/settings`), so a manager who can
 * configure pricing today can configure taxes. Writes go through the
 * service-role client as that route's do, with the explicit property filter the
 * repository carries (BP-4).
 */

import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import {
  canEditPropertySettingsModule,
  canViewPropertySettingsModule,
  PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE,
  PROPERTY_SETTINGS_VIEW_FORBIDDEN_MESSAGE,
} from '@/lib/dashboard/property-settings-module-edit'
import { CreatePropertyTaxRequestSchema } from '@/types/api/v1/schemas/taxes'
import { PropertyTax } from '@/modules/PropertyManagement/domain/PropertyTax'
import { SupabasePropertyTaxRepository } from '@/modules/PropertyManagement/infrastructure/SupabasePropertyTaxRepository'
import {
  toPropertyTaxDTO,
  toTaxCategoryDTO,
} from '@/modules/PropertyManagement/application/DTOs/PropertyTaxDTO'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    if (!(await canViewPropertySettingsModule(supabase, propertyId, user.id))) {
      return error(ErrorCodes.AUTH_002, PROPERTY_SETTINGS_VIEW_FORBIDDEN_MESSAGE, 403, request)
    }

    const repository = new SupabasePropertyTaxRepository(createServiceRoleClient())
    const [taxes, categories] = await Promise.all([
      repository.findByPropertyId(propertyId),
      repository.listCategories(propertyId),
    ])

    return success(
      {
        taxes: taxes.map(toPropertyTaxDTO),
        categories: categories.map(toTaxCategoryDTO),
      },
      request,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Taxes API v1] GET error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(access)) return access

    if (!(await canEditPropertySettingsModule(supabase, propertyId, user.id))) {
      return error(ErrorCodes.AUTH_002, PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE, 403, request)
    }

    const parsed = CreatePropertyTaxRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, { errors: parsed.error.format() })
    }

    let tax: PropertyTax
    try {
      tax = PropertyTax.create({ id: randomUUID(), propertyId, ...parsed.data })
    } catch (invariant) {
      // A coherent-but-invalid combination, e.g. a percentage tax with no rate.
      // The operator gets the aggregate's own wording rather than a 500.
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: invariant instanceof Error ? invariant.message : 'Invalid tax configuration',
      })
    }

    const service = createServiceRoleClient()
    await new SupabasePropertyTaxRepository(service).save(tax)

    if (access.companyId) {
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'create',
          resource: 'property_tax',
          userId: user.id,
          details: `Added tax "${tax.name}"${tax.authority ? ` (${tax.authority})` : ''}.`,
        },
        { failOpen: false },
      )
    }

    return success({ tax: toPropertyTaxDTO(tax) }, request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Taxes API v1] POST error:', err)
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
