import { createHash, randomBytes } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, error, errorFlatMessage } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import {
  StaffManagementQueries,
  type UiRole,
} from '@/lib/dashboard/staff-management-queries'
import { resolveDashboardAccess, canManageStaffRoster } from '@/lib/rbac/dashboard-guards'
import { sendEmail } from '@/lib/email/emailit'
import { buildStaffSetupLinkEmailHtml } from '@/lib/email/templates/staff-setup-link'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { triggerStaffAutomations } from '@/lib/automations/run-pipeline'

const STAFF_SETUP_TOKEN_EXPIRY_DAYS = 7

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
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    email: z.string().trim().email(),
    phone: z.string().trim().optional(),
    roleCategoryIds: z
      .array(z.string().uuid())
      .min(1, 'At least one role category is required')
      .transform((arr) => [...new Set(arr)]),
  })

function isUiRole(value: string): value is UiRole {
  return value === 'owner' || value === 'admin' || value === 'manager' || value === 'staff'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      console.error('[StaffManagementAddStaff] Unauthorized', {
        propertyId,
        authError: authError?.message ?? null,
      })
      return errorFlatMessage(
        authError?.message ?? ErrorCodes.AUTH_001.message,
        ErrorCodes.AUTH_001.status,
        request,
      )
    }

    const parsed = BodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return error(ErrorCodes.VALIDATION_ERROR, request, {
        errors: parsed.error.errors,
      })
    }

    const q = new StaffManagementQueries(supabase as any)
    const access = await resolveDashboardAccess(supabase as never, propertyId, user.id)
    if (!access) {
      return errorFlatMessage(
        'No access to this property. Confirm the property ID, and that your user is the company owner or has a property_staff row for this property.',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    if (!canManageStaffRoster(access)) {
      return errorFlatMessage(
        'Adding staff requires an admin-level property role (owner, admin, or property_admin).',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const { roleCategoryIds } = parsed.data

    // Validate role categories exist and derive the role
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

    const derivedRole: UiRole = firstRole

    const service = createServiceRoleClient()

    try {
      // ---- Duplicate check ----
      const existingId = await q.findAuthUserIdByEmail(service, parsed.data.email)
      if (existingId) {
        return errorFlatMessage(
          'This email already exists',
          ErrorCodes.DUPLICATE_RESOURCE.status,
          request,
        )
      }

      // ---- Create auth user (random password, email_confirm false) ----
      const { data: newUser, error: createError } =
        await service.auth.admin.createUser({
          email: parsed.data.email,
          password: randomBytes(32).toString('hex'),
          email_confirm: false,
          user_metadata: {
            first_name: parsed.data.firstName,
            last_name: parsed.data.lastName,
            contact_phone: parsed.data.phone || '',
            user_type: 'staff',
          },
        })

      if (createError || !newUser.user?.id) {
        const msg = createError?.message ?? 'Failed to create user'
        if (/already|registered|exists/i.test(msg)) {
          return errorFlatMessage(
            'This email already exists',
            ErrorCodes.DUPLICATE_RESOURCE.status,
            request,
          )
        }
        return error(ErrorCodes.INTERNAL_ERROR, request, { message: msg })
      }

      // ---- Generate setup token ----
      const setupToken = randomBytes(32).toString('hex')
      const tokenHash = hashStaffInviteToken(setupToken)
      const expiresAt = new Date(
        Date.now() + STAFF_SETUP_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
      const appMetadata = newUser.user.app_metadata ?? {}

      const { error: metaError } = await service.auth.admin.updateUserById(
        newUser.user.id,
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
        console.error('[StaffManagementAddStaff] Failed to store setup token', {
          message: metaError.message,
        })
        return error(ErrorCodes.INTERNAL_ERROR, request, { message: metaError.message })
      }

      // ---- Insert property_staff (with orphan cleanup) ----
      let staffResult
      try {
        staffResult = await q.inviteStaff({
          propertyId,
          userId: newUser.user.id,
          role: derivedRole,
          roleCategoryIds,
          status: 'pending',
        })
      } catch (inviteError) {
        await service.auth.admin.deleteUser(newUser.user.id)
        console.error('[add-staff] Failed to insert property_staff, rolling back auth user:', inviteError)
        return errorFlatMessage('Failed to add staff member', ErrorCodes.INTERNAL_ERROR.status, request)
      }

      // ---- Build setup URL ----
      const baseUrl = getInviteBaseUrl()
      const setupUrl = `${baseUrl}/staff-setup?token=${encodeURIComponent(setupToken)}&uid=${encodeURIComponent(newUser.user.id)}`

      // ---- Record activity log ----
      if (access.companyId) {
        await recordActivityLog(
          service,
          {
            companyId: access.companyId,
            propertyId,
            action: 'create',
            resource: 'staff',
            userId: user.id,
            details: `Added staff ${parsed.data.firstName} ${parsed.data.lastName} (${parsed.data.email}) with role ${derivedRole}.`,
          },
          { failOpen: false },
        )
      }

      // ---- Send setup email via automation pipeline (with fallback) ----
      let emailSent = false
      try {
        const pipelineResult = await triggerStaffAutomations(
          'staff.created',
          propertyId,
          access.companyId!,
          {
            email: parsed.data.email,
            name: `${parsed.data.firstName} ${parsed.data.lastName}`,
            inviteUrl: setupUrl,
            inviterName: user.email ?? 'An administrator',
            expiryDays: STAFF_SETUP_TOKEN_EXPIRY_DAYS,
          },
        )
        emailSent = pipelineResult !== null && pipelineResult.executed > 0
      } catch (pipelineErr) {
        console.error('[StaffManagementAddStaff] Pipeline failed, falling back to direct send', pipelineErr)
      }

      if (!emailSent) {
        try {
          const html = await buildStaffSetupLinkEmailHtml(
            setupUrl,
            undefined,
            `${STAFF_SETUP_TOKEN_EXPIRY_DAYS} days`,
          )
          const emailResult = await sendEmail({
            to: parsed.data.email,
            subject: 'Set up your Camp OS account',
            html,
            text: `An administrator has added you as a staff member on Camp OS. Set up your account here (link expires in ${STAFF_SETUP_TOKEN_EXPIRY_DAYS} days):\n${setupUrl}\n`,
          })

          if (!emailResult.success) {
            console.error('[StaffManagementAddStaff] Fallback setup email failed', {
              error: emailResult.error,
            })
          } else {
            emailSent = true
          }
        } catch (fallbackErr) {
          console.error('[StaffManagementAddStaff] Fallback email send failed', fallbackErr)
        }
      }

      // ---- Record email activity log ----
      if (access.companyId) {
        await recordActivityLog(
          service,
          {
            companyId: access.companyId,
            propertyId,
            action: 'create',
            resource: 'staff_setup_email',
            userId: null,
            details: `System sent staff setup email to ${parsed.data.email}.`,
          },
          { failOpen: false },
        )
      }

      const successResponse = success(
        { ...staffResult, emailSent },
        request,
      )

      return new NextResponse(successResponse.body, {
        status: 201,
        headers: successResponse.headers,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[StaffManagementAddStaff] Add staff failed', { message, err })
    return error(ErrorCodes.INTERNAL_ERROR, request, { message })
  }
}
