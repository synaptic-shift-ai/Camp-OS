import { createHash, randomBytes } from 'crypto'
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  StaffManagementQueries,
  type UiRole,
} from '@/lib/dashboard/staff-management-queries'
import { sendEmail } from '@/lib/email/emailit'
import { buildStaffInviteLinkEmailHtml } from '@/lib/email/templates/staff-invite-link'

const STAFF_INVITE_TOKEN_EXPIRY_DAYS = 7

function hashStaffInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function getInviteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

const BodySchema = z
  .object({
    email: z.string().trim().email(),
    roleCategoryId: z.string().uuid().optional(),
    roleCategoryIds: z.array(z.string().uuid()).optional(),
    status: z.enum(['pending', 'active', 'inactive']).optional(),
    categories: z.array(z.string()).optional(),
  })
  .transform((data) => {
    const roleCategoryIds =
      data.roleCategoryIds && data.roleCategoryIds.length > 0
        ? [...new Set(data.roleCategoryIds)]
        : data.roleCategoryId
          ? [data.roleCategoryId]
          : []
    return {
      email: data.email,
      status: data.status,
      categories: data.categories,
      roleCategoryIds,
    }
  })
  .refine((data) => data.roleCategoryIds.length > 0, {
    message: 'At least one role category id is required',
    path: ['roleCategoryIds'],
  })

function isUiRole(value: string): value is UiRole {
  return value === 'owner' || value === 'admin' || value === 'manager' || value === 'staff'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[StaffManagementInviteStaff] Unauthorized', {
        propertyId,
        authError: authError?.message ?? null,
      })
      return error(ErrorCodes.AUTH_001, request)
    }

    const parsed = BodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.errors,
      })
    }

    const q = new StaffManagementQueries(supabase as any)
    const { hasAccess, isAdmin } = await q.verifyPropertyAccess({
      propertyId,
      userId: user.id,
    })

    if (!hasAccess) {
      return error(ErrorCodes.AUTH_002, request)
    }

    if (!isAdmin) {
      return error(ErrorCodes.AUTH_003, request)
    }

    const roleCategoryIds = parsed.data.roleCategoryIds

    const { data: roleCategoryRows, error: roleCategoriesError } = await supabase
      .from('property_role_categories')
      .select('id, role')
      .eq('property_id', propertyId)
      .in('id', roleCategoryIds)

    if (
      roleCategoriesError ||
      !roleCategoryRows ||
      roleCategoryRows.length !== roleCategoryIds.length
    ) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: 'One or more roleCategoryIds are invalid for this property',
      })
    }

    const firstRole = roleCategoryRows[0]!.role
    if (!roleCategoryRows.every((r) => r.role === firstRole)) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: 'All role categories must share the same role',
      })
    }

    if (!isUiRole(firstRole)) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        message: 'Invalid role on category records',
      })
    }

    const service = createServiceRoleClient()

    let newUserId: string
    try {
      const existingId = await q.findAuthUserIdByEmail(service, parsed.data.email)
      if (existingId) {
        return error(
          ErrorCodes.DUPLICATE_RESOURCE.code,
          'This email already exists',
          ErrorCodes.DUPLICATE_RESOURCE.status,
          request,
        )
      }

      const { data: created, error: createError } =
        await service.auth.admin.createUser({
          email: parsed.data.email,
          password: randomBytes(32).toString('hex'),
          email_confirm: false,
          user_metadata: {
            user_type: 'staff',
          },
        })

      if (createError || !created.user?.id) {
        const msg = createError?.message ?? 'Failed to create user'
        if (/already|registered|exists/i.test(msg)) {
          return error(
            ErrorCodes.DUPLICATE_RESOURCE.code,
            'This email already exists',
            ErrorCodes.DUPLICATE_RESOURCE.status,
            request,
          )
        }
        return error(ErrorCodes.INTERNAL_ERROR, request, { message: msg })
      }

      newUserId = created.user.id

      const inviteToken = randomBytes(32).toString('hex')
      const tokenHash = hashStaffInviteToken(inviteToken)
      const expiresAt = new Date(
        Date.now() + STAFF_INVITE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
      const appMetadata = created.user.app_metadata ?? {}

      const { error: metaError } = await service.auth.admin.updateUserById(
        newUserId,
        {
          app_metadata: {
            ...appMetadata,
            staff_invite_token_hash: tokenHash,
            staff_invite_expires_at: expiresAt,
            staff_invite_sent_at: new Date().toISOString(),
          },
        },
      )

      if (metaError) {
        console.error('[StaffManagementInviteStaff] Failed to store invite token', {
          message: metaError.message,
        })
        return error(ErrorCodes.INTERNAL_ERROR, request, { message: metaError.message })
      }

      const result = await q.inviteStaff({
        propertyId,
        userId: newUserId,
        role: firstRole,
        roleCategoryIds,
        status: parsed.data.status ?? 'pending',
      })

      const baseUrl = getInviteBaseUrl()
      const inviteUrl = `${baseUrl}/staff-invite?token=${encodeURIComponent(inviteToken)}&uid=${encodeURIComponent(newUserId)}`
      const html = await buildStaffInviteLinkEmailHtml(
        inviteUrl,
        undefined,
        `${STAFF_INVITE_TOKEN_EXPIRY_DAYS} days`,
      )
      const emailResult = await sendEmail({
        to: parsed.data.email,
        subject: "You're invited to CampOS — complete your registration",
        html,
        text: `You've been invited to join a property on CampOS. Create your password here (link expires in ${STAFF_INVITE_TOKEN_EXPIRY_DAYS} days):\n${inviteUrl}\n`,
      })

      if (!emailResult.success) {
        console.error('[StaffManagementInviteStaff] Invite email failed', {
          error: emailResult.error,
        })
        return error(ErrorCodes.INTERNAL_ERROR, request, {
          message: emailResult.error,
        })
      }

      return success({ ...result, emailSent: true }, request)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[StaffManagementInviteStaff] Invite failed', { message, err })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
