import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { renderWithSampleData, renderWithContext } from '@/lib/email/template-renderer'
import { sendEmail, getFrom } from '@/lib/email/emailit'
import { z } from 'zod'

const SendTestSchema = z.object({
  to: z.string().email(),
  propertyId: z.string().uuid().optional(),
})

/**
 * POST /api/v1/automations/email-templates/[id]/send-test
 * Sends a test email with sample or property-specific data substituted into the template.
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

    let rendered: { subject: string; html: string; text?: string }

    if (parsed.data.propertyId) {
      const propertyId = parsed.data.propertyId

      const [guestRes, resRes, siteRes, propRes] = await Promise.all([
        db.from('guests').select('first_name, last_name, email, phone').eq('property_id', propertyId).limit(1),
        db.from('reservations').select('confirmation_number, check_in_date, check_out_date, total_amount, num_adults, num_children, status, guests(first_name, last_name, email)').eq('property_id', propertyId).limit(1),
        db.from('sites').select('site_number, site_name, site_type').eq('property_id', propertyId).limit(1),
        db.from('properties').select('name, phone, email, address, city, state, zip_code, check_in_time, check_out_time').eq('id', propertyId).single(),
      ])

      // If any query fails or returns no data, fall back to sample data
      if (
        guestRes.error || !guestRes.data?.length ||
        resRes.error || !resRes.data?.length ||
        siteRes.error || !siteRes.data?.length ||
        propRes.error || !propRes.data
      ) {
        const sampleRendered = renderWithSampleData(template.subject_template, template.html_template)
        rendered = sampleRendered
      } else {
        const guest = guestRes.data[0]
        const reservation = resRes.data[0]
        const site = siteRes.data[0]
        const property = propRes.data

        const contextData: Record<string, unknown> = {
          guest: {
            first_name: guest.first_name,
            last_name: guest.last_name,
            email: guest.email,
            phone: guest.phone,
          },
          reservation: {
            confirmation_number: reservation.confirmation_number,
            check_in_date: reservation.check_in_date,
            check_out_date: reservation.check_out_date,
            total_amount: reservation.total_amount,
            num_adults: reservation.num_adults,
            num_children: reservation.num_children,
            status: reservation.status,
          },
          site: {
            site_number: site.site_number,
            site_name: site.site_name,
            site_type: site.site_type,
          },
          property: {
            name: property.name,
            phone: property.phone,
            email: property.email,
            address: property.address,
            city: property.city,
            state: property.state,
            zip_code: property.zip_code,
            check_in_time: property.check_in_time,
            check_out_time: property.check_out_time,
          },
        }

        rendered = renderWithContext(template.subject_template, template.html_template, contextData)
      }
    } else {
      rendered = renderWithSampleData(template.subject_template, template.html_template)
    }

    // Send test email
    const emailPayload = {
      from: getFrom(),
      to: parsed.data.to,
      subject: rendered.subject,
      html: rendered.html,
      ...(rendered.text ? { text: rendered.text } : {}),
    }

    const result = await sendEmail(emailPayload)

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
