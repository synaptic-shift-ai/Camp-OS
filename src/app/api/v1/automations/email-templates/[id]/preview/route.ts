import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { renderWithSampleData } from '@/lib/email/template-renderer'

/**
 * POST /api/v1/automations/email-templates/[id]/preview
 * Renders template with sample data for preview.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const { id } = await params
    const db = supabase as any

    const { data: template, error: fetchError } = await db
      .from('email_templates')
      .select('subject_template, html_template')
      .eq('id', id)
      .single()

    if (fetchError || !template) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Email template not found' })
    }

    const rendered = renderWithSampleData(template.subject_template, template.html_template)

    return success({ subject: rendered.subject, html: rendered.html }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
