import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { renderWithSampleData } from '@/lib/email/template-renderer'
import { sendEmail, getFrom } from '@/lib/email/emailit'
import { z } from 'zod'

const SendTestSchema = z.object({
  to: z.string().email(),
})

/**
 * POST /api/v1/automations/email-templates/[id]/send-test
 * Sends a test email with sample data substituted into the template.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)
    if (authError || !user) return error(ErrorCodes.AUTH_001, request)

    const { id } = await params

    // Validate request body
    const body = await request.json()
    const parsed = SendTestSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Valid "to" email address is required',
        details: parsed.error.flatten(),
      })
    }

    const db = supabase as any

    // Fetch template
    const { data: template, error: fetchError } = await db
      .from('email_templates')
      .select('subject_template, html_template')
      .eq('id', id)
      .single()

    if (fetchError || !template) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Email template not found' })
    }

    // Render with sample data
    const rendered = renderWithSampleData(template.subject_template, template.html_template)

    // Send test email
    const result = await sendEmail({
      from: getFrom(),
      to: parsed.data.to,
      subject: rendered.subject,
      html: rendered.html,
    })

    if (!result.success) {
      return error(ErrorCodes.INTERNAL_ERROR, request, {
        message: `Failed to send test email: ${result.error}`,
      })
    }

    return success({ id: result.id }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
