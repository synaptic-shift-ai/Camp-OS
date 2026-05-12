import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { seedEmailTemplates } from '@/lib/automations/seed-defaults'
import { z } from 'zod'

// ============================================================================
// Schemas
// ============================================================================

const CreateEmailTemplateSchema = z.object({
  companyId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  subjectTemplate: z.string().max(500),
  htmlTemplate: z.string().max(2000000),
  category: z.string().max(100).optional(),
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
      permission: 'automations.view_email_templates',
    })
    if (isDenied(access)) return access

    const companyId = await getCompanyId(supabase, propertyId)
    if (!companyId) {
      return error(ErrorCodes.VAL_002, request, { message: 'Could not determine tenant for property' })
    }

    const db = supabase as any

    // Lazy seed: if no templates exist for this tenant, seed system defaults
    const { count } = await db
      .from('email_templates')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (count === 0) {
      await seedEmailTemplates(companyId)
    }

    // Query: tenant-level (property_id IS NULL) OR property-level
    let query = db
      .from('email_templates')
      .select('*')
      .eq('company_id', companyId)
      .or(`property_id.is.null,property_id.eq.${propertyId}`)

    // Optional filters
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

    return success({ emailTemplates: templates ?? [] }, request)
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

    const body = await request.json()
    console.log('[POST email-templates] body:', JSON.stringify(body))
    const parsed = CreateEmailTemplateSchema.safeParse(body)
    if (!parsed.success) {
      console.log('[POST email-templates] parse FAILED:', parsed.error.flatten())
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const data = parsed.data
    console.log('[POST email-templates] parsed data:', JSON.stringify(data))
    const propertyId = data.propertyId
    if (propertyId) {
      const access = await requirePropertyAccess(supabase as any, user.id, {
        propertyId,
        permission: 'automations.add_email_templates',
      })
      if (isDenied(access)) return access
    }

    const db = supabase as any

    const { data: template, error: insertError } = await db
      .from('email_templates')
      .insert({
        company_id: data.companyId,
        property_id: data.propertyId ?? null,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        subject_template: data.subjectTemplate,
        html_template: data.htmlTemplate,
        category: data.category ?? 'custom',
        is_system_default: false,
        status: 'draft',
      })
      .select('*')
      .single()

    console.log('[POST email-templates] insert result:', {
      template: template ? 'present' : 'null',
      error: insertError ? { message: insertError.message, code: insertError.code, details: insertError.details } : null,
    })

    if (insertError) {
      console.log('[POST email-templates] returning error response')
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: insertError.message })
    }

    // Activity log — non-blocking
    try {
      const { recordActivityLog } = await import('@/shared/activity-log/record-activity-log')
      const serviceRole = createServiceRoleClient()
      await recordActivityLog(serviceRole, {
        companyId: data.companyId,
        propertyId: data.propertyId ?? null,
        action: 'create',
        resource: 'email_template',
        userId: user.id,
        details: `Created email template '${template.name}' (category: ${template.category})`,
      })
    } catch (logError) {
      console.error('[Email Templates] Failed to log activity:', logError)
    }

    console.log('[POST email-templates] success, returning template:', template?.id)
    return success({ emailTemplate: template }, request)
  } catch (err: unknown) {
    console.log('[POST email-templates] caught error:', err instanceof Error ? err.message : err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
