import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { z } from 'zod'

// ============================================================================
// Schemas
// ============================================================================

const CreateSmsTemplateSchema = z.object({
  companyId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  body: z.string().min(1).max(1600),
  category: z.string().max(100).optional(),
  status: z.enum(['draft', 'active']).optional(),
})

// ============================================================================
// Helpers
// ============================================================================

async function getCompanyId(supabase: any, propertyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('properties')
    .select('company_id')
    .eq('id', propertyId)
    .single()
  return data?.company_id ?? null
}

// ============================================================================
// GET — List templates
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const sp = request.nextUrl.searchParams
    const propertyId = sp.get('propertyId')
    if (!propertyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'propertyId query parameter is required' })
    }

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId,
      permission: 'automations.view_sms_templates',
    })
    if (isDenied(access)) return access

    const companyId = access.companyId ?? (await getCompanyId(supabase, propertyId))
    if (!companyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'Could not determine tenant for property' })
    }

    const db = createServiceRoleClient() as any

    let query = db
      .from('sms_templates')
      .select('*')
      .eq('company_id', companyId)
      .or(`property_id.is.null,property_id.eq.${propertyId}`)

    const category = sp.get('category')
    if (category) query = query.eq('category', category)

    const search = sp.get('search')
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
    }

    query = query.order('is_system_default', { ascending: false })
    query = query.order('name', { ascending: true })

    const { data: templates, error: queryError } = await query
    if (queryError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: queryError.message })
    }

    return success({ templates: templates ?? [] }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}

// ============================================================================
// POST — Create template
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const sp = request.nextUrl.searchParams
    const accessPropertyId = sp.get('propertyId')
    if (!accessPropertyId) {
      return error(ErrorCodes.VAL_002, request, {
        message: 'propertyId query parameter is required',
      })
    }

    const body = await request.json()
    const parsed = CreateSmsTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data

    const access = await requirePropertyAccess(supabase as any, user.id, {
      propertyId: accessPropertyId,
      permission: 'automations.add_sms_templates',
    })
    if (isDenied(access)) return access

    const tenantCompanyId = access.companyId
    if (!tenantCompanyId || data.companyId !== tenantCompanyId) {
      return error(ErrorCodes.AUTH_002, request, { message: 'Company mismatch for property' })
    }

    const db = createServiceRoleClient() as any

    const { data: template, error: insertError } = await db
      .from('sms_templates')
      .insert({
        company_id: tenantCompanyId,
        property_id: data.propertyId ?? null,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        body: data.body,
        category: data.category ?? 'custom',
        is_system_default: false,
        status: data.status ?? 'draft',
      })
      .select('*')
      .single()

    if (insertError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: insertError.message })
    }

    try {
      const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')
      const serviceRole = createServiceRoleClient()
      await recordActivityLog(serviceRole, {
        companyId: tenantCompanyId,
        propertyId: data.propertyId ?? null,
        action: 'create',
        resource: 'sms_template',
        userId: user.id,
        details: `Created SMS template '${template.name}' (category: ${template.category})`,
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
