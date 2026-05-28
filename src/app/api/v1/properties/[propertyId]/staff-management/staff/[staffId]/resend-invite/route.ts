import { createHash, randomBytes } from 'crypto'
import { type NextRequest } from 'next/server'
import { createSupabaseClientForApiRoute } from '@/lib/supabase/api-route-client'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { success, errorFlatMessage } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { StaffManagementQueries } from '@/lib/dashboard/staff-management-queries'
import { resolveDashboardAccess, canManageStaffRoster } from '@/lib/rbac/dashboard-guards'
import { sendEmail } from '@/lib/email/emailit'
import { buildStaffSetupLinkEmailHtml } from '@/lib/email/templates/staff-setup-link'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { triggerStaffAutomations } from '@/lib/automations/run-pipeline'

const STAFF_SETUP_TOKEN_EXPIRY_DAYS = 7

function getInviteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; staffId: string }> },
) {
  try {
    const { propertyId, staffId } = await params
    const { supabase, user, error: authError } = await createSupabaseClientForApiRoute(request)

    if (authError || !user) {
      console.error('[ResendSetupEmail] Unauthorized', {
        propertyId,
        staffId,
        authError: authError?.message ?? null,
      })
      return errorFlatMessage(
        authError?.message ?? ErrorCodes.AUTH_001.message,
        ErrorCodes.AUTH_001.status,
        request,
      )
    }

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
        'Resending setup email requires an admin-level property role (owner, admin, or property_admin).',
        ErrorCodes.AUTH_002.status,
        request,
      )
    }

    const q = new StaffManagementQueries(supabase as any)

    // Look up the property_staff row — must exist and be pending
    const { data: staffRow, error: staffError } = await supabase
      .from('property_staff')
      .select('id, user_id, status')
      .eq('id', staffId)
      .eq('property_id', propertyId)
      .single()

    if (staffError || !staffRow) {
      return errorFlatMessage(
        'Staff member not found for this property.',
        ErrorCodes.RESOURCE_NOT_FOUND.status,
        request,
      )
    }

    if (staffRow.status !== 'pending') {
      return errorFlatMessage(
        'Can only resend setup email for pending staff members.',
        ErrorCodes.VALIDATION_ERROR.status,
        request,
      )
    }

    const userId = staffRow.user_id
    if (!userId) {
      return errorFlatMessage(
        'This pending staff member is missing a linked auth user.',
        ErrorCodes.RESOURCE_NOT_FOUND.status,
        request,
      )
    }

    const service = createServiceRoleClient()

    // Fetch the auth user to get email + existing metadata
    const { data: authUser, error: authUserError } =
      await service.auth.admin.getUserById(userId)

    if (authUserError || !authUser.user) {
      return errorFlatMessage(
        'Could not find the auth user for this staff member.',
        ErrorCodes.RESOURCE_NOT_FOUND.status,
        request,
      )
    }

    const email = authUser.user.email ?? ''
    const name =
      `${authUser.user.user_metadata?.first_name ?? ''} ${authUser.user.user_metadata?.last_name ?? ''}`.trim() ||
      email
    const appMetadata = authUser.user.app_metadata ?? {}

    // Generate a new setup token
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(
      Date.now() + STAFF_SETUP_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    // Update app_metadata with new token hash + expiry + sent_at
    const { error: metaError } = await service.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...appMetadata,
        staff_invite_token_hash: tokenHash,
        staff_invite_expires_at: expiresAt,
        staff_invite_sent_at: new Date().toISOString(),
      },
    })

    if (metaError) {
      console.error('[ResendSetupEmail] Failed to update token metadata', {
        message: metaError.message,
      })
      return errorFlatMessage(
        'Failed to regenerate setup token.',
        ErrorCodes.INTERNAL_ERROR.status,
        request,
      )
    }

    // Build setup URL
    const baseUrl = getInviteBaseUrl()
    const setupUrl = `${baseUrl}/staff-setup?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(userId)}`

    // Send email: primary via automation pipeline, fallback via direct send
    let emailSent = false
    try {
      const pipelineResult = await triggerStaffAutomations(
        'staff.created',
        propertyId,
        access.companyId!,
        {
          email,
          name,
          inviteUrl: setupUrl,
          inviterName: user.email ?? 'An administrator',
          expiryDays: STAFF_SETUP_TOKEN_EXPIRY_DAYS,
        },
      )
      emailSent = pipelineResult !== null && pipelineResult.executed > 0
    } catch (pipelineErr) {
      console.error('[ResendSetupEmail] Pipeline failed, falling back to direct send', pipelineErr)
    }

    if (!emailSent) {
      try {
        const html = await buildStaffSetupLinkEmailHtml(
          setupUrl,
          undefined,
          `${STAFF_SETUP_TOKEN_EXPIRY_DAYS} days`,
        )
        const emailResult = await sendEmail({
          to: email,
          subject: 'Set up your Camp OS account',
          html,
          text: `An administrator has added you as a staff member on Camp OS. Set up your account here (link expires in ${STAFF_SETUP_TOKEN_EXPIRY_DAYS} days):\n${setupUrl}\n`,
        })

        if (!emailResult.success) {
          console.error('[ResendSetupEmail] Fallback setup email failed', {
            error: emailResult.error,
          })
        } else {
          emailSent = true
        }
      } catch (fallbackErr) {
        console.error('[ResendSetupEmail] Fallback email send failed', fallbackErr)
      }
    }

    // Record activity log
    if (access.companyId) {
      await recordActivityLog(
        service,
        {
          companyId: access.companyId,
          propertyId,
          action: 'create',
          resource: 'staff_setup_email',
          userId: null,
          details: `System resent staff setup email to ${email}.`,
        },
        { failOpen: false },
      )
    }

    return success({ success: true, emailSent }, request)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ResendSetupEmail] Resend setup email failed', { message, err })
    return errorFlatMessage(message, ErrorCodes.INTERNAL_ERROR.status, request)
  }
}
