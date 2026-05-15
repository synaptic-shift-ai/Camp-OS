import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { z } from 'zod'

// ============================================================================
// Schema (partial update)
// ============================================================================

const UpdateSmsTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  body: z.string().min(1).max(1600).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(['draft', 'active']).optional(),
})

async function requireSmsTemplateAccess(
  supabase: any,
  userId: string,
  request: NextRequest,
  template: { property_id: string | null; company_id: string },
  accessPropertyId: string | null,
  permission: 'automations.edit_sms_templates' | 'automations.delete_sms_templates',
) {
  const propertyIdForAccess = template.property_id ?? accessPropertyId
  if (!propertyIdForAccess) {
    return error(ErrorCodes.VAL_002, request, {
      message: 'propertyId query parameter is required',
    })
  }

  const access = await requirePropertyAccess(supabase, userId, {
    propertyId: propertyIdForAccess,
    permission,
  })
  if (isDenied(access)) return access

  if (access.companyId && access.companyId !== template.company_id) {
    return error(ErrorCodes.AUTH_002, request, {
      message: 'Template does not belong to this company',
    })
  }

  return null
}

// ============================================================================
// GET — Single template
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const { id } = await params
    const db = supabase as any

    const { data: template, error: queryError } = await db
      .from('sms_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (queryError || !template) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'SMS template not found' })
    }

    return success({ smsTemplate: template }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

// ============================================================================
// PUT — Update template
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const { id } = await params
    const accessPropertyId = request.nextUrl.searchParams.get('propertyId')
    const body = await request.json()
    const parsed = UpdateSmsTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const readDb = createServiceRoleClient() as any

    const { data: existing, error: fetchError } = await readDb
      .from('sms_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'SMS template not found' })
    }

    const accessDenied = await requireSmsTemplateAccess(
      supabase,
      user.id,
      request,
      existing,
      accessPropertyId,
      'automations.edit_sms_templates',
    )
    if (accessDenied) return accessDenied

    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.body !== undefined) updates.body = parsed.data.body
    if (parsed.data.category !== undefined) updates.category = parsed.data.category
    if (parsed.data.status !== undefined) updates.status = parsed.data.status

    const { data: template, error: updateError } = await readDb
      .from('sms_templates')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: updateError.message })
    }

    try {
      const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')
      const serviceRole = createServiceRoleClient()
      await recordActivityLog(serviceRole, {
        companyId: existing.company_id,
        propertyId: existing.property_id ?? null,
        action: 'update',
        resource: 'sms_template',
        userId: user.id,
        details: `Updated SMS template '${template.name}'`,
      })
    } catch (logError) {
      console.error('[SMS Templates] Failed to log activity:', logError)
    }

    return success({ smsTemplate: template }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

// ============================================================================
// DELETE — Delete template
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const { id } = await params
    const accessPropertyId = request.nextUrl.searchParams.get('propertyId')
    const readDb = createServiceRoleClient() as any

    const { data: existing, error: fetchError } = await readDb
      .from('sms_templates')
      .select('id, name, is_system_default, company_id, property_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'SMS template not found' })
    }

    if (existing.is_system_default) {
      return error(ErrorCodes.AUTH_002, request, {
        message: 'System default templates cannot be deleted. Clone to customize.',
      })
    }

    const accessDenied = await requireSmsTemplateAccess(
      supabase,
      user.id,
      request,
      existing,
      accessPropertyId,
      'automations.delete_sms_templates',
    )
    if (accessDenied) return accessDenied

    const templateName = existing.name
    const templateCompanyId = existing.company_id
    const templatePropertyId = existing.property_id

    const { error: deleteError } = await readDb
      .from('sms_templates')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: deleteError.message })
    }

    try {
      const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')
      const serviceRole = createServiceRoleClient()
      await recordActivityLog(serviceRole, {
        companyId: templateCompanyId,
        propertyId: templatePropertyId ?? null,
        action: 'delete',
        resource: 'sms_template',
        userId: user.id,
        details: `Deleted SMS template '${templateName}'`,
      })
    } catch (logError) {
      console.error('[SMS Templates] Failed to log activity:', logError)
    }

    return success({ deleted: true }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
