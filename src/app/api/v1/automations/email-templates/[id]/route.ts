import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { z } from 'zod'

// ============================================================================
// Schema (partial update)
// ============================================================================

const UpdateEmailTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  subjectTemplate: z.string().max(500).optional(),
  htmlTemplate: z.string().max(2000000).optional(),
  category: z.enum(['welcome', 'reservation', 'payment', 'review', 'notification', 'custom']).optional(),
  isActive: z.boolean().optional(),
})

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
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (queryError || !template) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Email template not found' })
    }

    return success({ emailTemplate: template }, request)
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
    const body = await request.json()
    const parsed = UpdateEmailTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return error(ErrorCodes.VAL_001, request, {
        message: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const db = supabase as any

    // Check template exists
    const { data: existing, error: fetchError } = await db
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Email template not found' })
    }

    // Build update payload
    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.subjectTemplate !== undefined) updates.subject_template = parsed.data.subjectTemplate
    if (parsed.data.htmlTemplate !== undefined) updates.html_template = parsed.data.htmlTemplate
    if (parsed.data.category !== undefined) updates.category = parsed.data.category
    if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive

    const { data: template, error: updateError } = await db
      .from('email_templates')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: updateError.message })
    }

    return success({ emailTemplate: template }, request)
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
    const db = supabase as any

    // Check template exists and is not system default
    const { data: existing, error: fetchError } = await db
      .from('email_templates')
      .select('id, is_system_default')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, request, { message: 'Email template not found' })
    }

    if (existing.is_system_default) {
      return error(ErrorCodes.AUTH_002, request, { message: 'System default templates cannot be deleted. Clone to customize.' })
    }

    const { error: deleteError } = await db
      .from('email_templates')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return error(ErrorCodes.INTERNAL_ERROR, request, { message: deleteError.message })
    }

    return success({ deleted: true }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
