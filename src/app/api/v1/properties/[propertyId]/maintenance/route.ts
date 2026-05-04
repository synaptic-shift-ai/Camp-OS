import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePropertyAccess, isDenied } from '@/lib/rbac'
import { error, success } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordActivityLog } from '@/shared/activity-log/record-activity-log'
import { resolveModuleActionAccess } from '@/lib/dashboard/module-action-access'
import { maintenanceFallbackForCategory } from '@/lib/dashboard/maintenance-module-access'
import { sendEmail, getFrom } from '@/lib/email/emailit'
import { renderWithContext } from '@/lib/email/template-renderer'
import { buildVendorWorkOrderAssignedEmailHtml } from '@/lib/email/templates/vendor-work-order-assigned'
import {
    CreateMaintenanceTaskRequestSchema,
    ListMaintenanceTasksQuerySchema,
} from '@/types/api/v1/schemas/maintenance'
import {
    MaintenanceQueries,
    type ListMaintenanceTasksFilters,
} from '@/lib/dashboard/maintenance/maintenance-queries'
import { getEventBus } from '@/shared/infrastructure/eventBus'
import { MaintenanceTaskCreatedEvent } from '@/modules/Maintenance/domain/events'

function toCanonicalSiteTypeKey(siteType: string | null | undefined): string {
    return (siteType ?? '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\bsite\b/g, '')
        .trim()
}

type ResolvedVendorEmailTemplate = {
    subject: string
    html: string
}

async function resolveConfiguredVendorEmailTemplate(
    supabase: SupabaseClient,
    propertyId: string,
    companyId: string | null,
): Promise<ResolvedVendorEmailTemplate | null> {
    const { data: automations } = await (supabase as any)
        .from('automations')
        .select('id')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .eq('trigger_type', 'maintenance.task_created')

    const automationIds = (automations ?? []).map((row: { id?: string }) => row.id).filter(Boolean)
    if (automationIds.length === 0) return null

    const { data: actions } = await (supabase as any)
        .from('automation_actions')
        .select('action_config, sort_order')
        .in('automation_id', automationIds)
        .eq('action_type', 'send_email')
        .order('sort_order', { ascending: true })

    const templateSlug = (actions ?? [])
        .map((action: { action_config?: Record<string, unknown> }) => action.action_config?.template)
        .find((slug: unknown): slug is string => typeof slug === 'string' && slug.trim().length > 0)

    if (!templateSlug) return null

    let template: { subject_template: string; html_template: string } | null = null
    if (companyId) {
        const { data } = await (supabase as any)
            .from('email_templates')
            .select('subject_template, html_template')
            .eq('company_id', companyId)
            .eq('property_id', propertyId)
            .eq('slug', templateSlug)
            .eq('is_active', true)
            .maybeSingle()
        if (data) template = data
    }

    if (!template) {
        const { data } = await (supabase as any)
            .from('email_templates')
            .select('subject_template, html_template')
            .eq('slug', templateSlug)
            .eq('is_system', true)
            .eq('is_active', true)
            .maybeSingle()
        if (data) template = data
    }

    if (!template) return null
    return {
        subject: template.subject_template,
        html: template.html_template,
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ propertyId: string }> },
) {
    try {
        const { propertyId } = await params
        const supabase = await createClient()

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return error(ErrorCodes.AUTH_001, request)
        }

        const access = await requirePropertyAccess(supabase, user.id, {
            propertyId,
            permission: 'maintenance.view_assigned',
        })
        if (isDenied(access)) return access

        const costAccess = await resolveModuleActionAccess({
            supabase: supabase as any,
            propertyId,
            userId: user.id,
            moduleKey: 'maintenance',
            actions: ['enter-labor-cost'],
            fallbackForCategory: maintenanceFallbackForCategory,
        })
        const canViewCosts = costAccess['enter-labor-cost'] === true

        const { searchParams } = new URL(request.url)
        const queryRaw = {
            search: searchParams.get('search') ?? undefined,
            siteId: searchParams.get('siteId') ?? undefined,
            assigneeId: searchParams.get('assigneeId') ?? undefined,
            status: searchParams.get('status') ?? undefined,
            priority: searchParams.get('priority') ?? undefined,
            source: searchParams.get('source') ?? undefined,
            category: searchParams.get('category') ?? undefined,
            page: searchParams.get('page') ?? undefined,
            per_page: searchParams.get('per_page') ?? undefined,
        }

        const parsed = ListMaintenanceTasksQuerySchema.safeParse(queryRaw)
        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const data = parsed.data
        const listFilters: ListMaintenanceTasksFilters = {}
        if (data.search !== undefined) listFilters.search = data.search
        if (data.siteId !== undefined) listFilters.siteId = data.siteId
        if (data.assigneeId !== undefined) listFilters.assigneeId = data.assigneeId
        if (data.status !== undefined) listFilters.status = data.status
        if (data.priority !== undefined) listFilters.priority = data.priority
        if (data.source !== undefined) listFilters.source = data.source
        if (data.category !== undefined) listFilters.category = data.category

        // Staff users should only see work orders assigned to themselves.
        if (access.role === 'staff') {
            const { data: selfStaff } = await supabase
                .from('property_staff')
                .select('id')
                .eq('property_id', propertyId)
                .eq('user_id', user.id)
                .in('status', ['active', 'pending'])
                .maybeSingle()

            const selfStaffId = (selfStaff?.id as string | undefined) ?? null
            listFilters.assigneeId = selfStaffId ?? '__no_staff_assignment__'
        }


        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const [listResult, openTaskCount] = await Promise.all([
            queries.listMaintenanceTasks(
                propertyId,
                Object.keys(listFilters).length > 0 ? listFilters : undefined,
                { page: data.page, perPage: data.per_page },
            ),
            queries.countOpenMaintenanceTasks(propertyId),
        ])

        const tasks = canViewCosts
            ? listResult.tasks
            : listResult.tasks.map((task: Record<string, unknown>) => {
                const stripped = { ...task }
                delete stripped.estimated_labor_cost
                delete stripped.estimated_parts_cost
                return stripped
            })

        return success(
            {
                tasks,
                total: listResult.total,
                page: data.page,
                per_page: data.per_page,
                openTaskCount,
            },
            request,
        )
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance API v1] GET error:', err)
        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ propertyId: string }> },
) {
    try {
        const { propertyId } = await params
        const supabase = await createClient()

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return error(ErrorCodes.AUTH_001, request)
        }

        const access = await requirePropertyAccess(supabase, user.id, {
            propertyId,
            permission: 'maintenance.create_wo',
        })

        if (isDenied(access)) return access

        const actionAccess = await resolveModuleActionAccess({
            supabase: supabase as any,
            propertyId,
            userId: user.id,
            moduleKey: 'maintenance',
            actions: ['create', 'enter-labor-cost'],
            fallbackForCategory: maintenanceFallbackForCategory,
        })
        if (!actionAccess.create) {
            return error(
                ErrorCodes.AUTH_002.code,
                'You do not have permission to create maintenance tasks.',
                ErrorCodes.AUTH_002.status,
                request,
            )
        }

        const body = await request.json()
        const parsed = CreateMaintenanceTaskRequestSchema.safeParse(body)

        if (parsed.success) {
            if (!actionAccess['enter-labor-cost']) {
                delete parsed.data.estimatedLaborCost
                delete parsed.data.estimatedPartsCost
            }
        }

        if (!parsed.success) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                errors: parsed.error.format(),
            })
        }

        const assignAccess = await resolveModuleActionAccess({
            supabase: supabase as any,
            propertyId,
            userId: user.id,
            moduleKey: 'maintenance',
            actions: ['assign-wo'],
            fallbackForCategory: maintenanceFallbackForCategory,
        })

        let staffId = parsed.data.staffId ?? null
        if (!assignAccess['assign-wo']) {
            const { data: selfStaff } = await supabase
                .from('property_staff')
                .select('id')
                .eq('property_id', propertyId)
                .eq('user_id', user.id)
                .in('status', ['active', 'pending'])
                .maybeSingle()
            staffId = (selfStaff?.id as string | undefined) ?? null
        }

        const { data: siteRow } = await supabase
            .from('sites')
            .select('id, site_type')
            .eq('id', parsed.data.siteId)
            .eq('property_id', propertyId)
            .is('deleted_at', null)
            .maybeSingle()

        if (!siteRow) {
            return error(ErrorCodes.VALIDATION_ERROR, request, {
                message: 'Site not found for this property',
            })
        }

        const { data: propertyRow } = await supabase
            .from('properties')
            .select('site_type_config')
            .eq('id', propertyId)
            .maybeSingle()

        const siteTypeConfig =
            (propertyRow?.site_type_config as {
                maintenance?: Record<string, boolean>
                allowed_site_types?: string[]
            } | null | undefined) ?? null

        const maintenanceMap = Object.fromEntries(
            Object.entries(siteTypeConfig?.maintenance ?? {}).map(([key, value]) => [
                toCanonicalSiteTypeKey(key),
                value,
            ]),
        )

        const allowedSiteTypeSet = new Set(
            Array.isArray(siteTypeConfig?.allowed_site_types)
                ? siteTypeConfig!.allowed_site_types.map((siteType) =>
                    toCanonicalSiteTypeKey(siteType),
                )
                : [],
        )

        const siteTypeKey = toCanonicalSiteTypeKey(siteRow.site_type as string | null | undefined)
        if (siteTypeKey) {
            if (allowedSiteTypeSet.size > 0 && !allowedSiteTypeSet.has(siteTypeKey)) {
                return error(ErrorCodes.VALIDATION_ERROR, request, {
                    message: 'The selected site is not available for maintenance',
                })
            }

            if (maintenanceMap[siteTypeKey] === false) {
                return error(ErrorCodes.VALIDATION_ERROR, request, {
                    message: 'The selected site is not available for maintenance',
                })
            }
        }

        // Enforce per-category spend limit against the requested estimate before creating a work order.
        if (parsed.data.category) {
            try {
                const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
                const spendLimits = await queries.listSpendLimits(propertyId)
                const matchedLimit = spendLimits.find(
                    (sl) => sl.category === parsed.data.category && sl.alert_enabled,
                )

                if (matchedLimit) {
                    const thresholdAmount = Number(matchedLimit.threshold_amount ?? 0)
                    const estimatedLaborCost = Number(parsed.data.estimatedLaborCost ?? 0)
                    const estimatedPartsCost = Number(parsed.data.estimatedPartsCost ?? 0)
                    const estimatedTotal = estimatedLaborCost + estimatedPartsCost

                    if (thresholdAmount > 0 && estimatedTotal > thresholdAmount) {
                        return error(ErrorCodes.VALIDATION_ERROR, request, {
                            message: `Estimated total cost (${estimatedTotal}) exceeds spend limit (${thresholdAmount}) for category ${parsed.data.category}.`,
                        })
                    }
                }
            } catch {
                // Non-blocking: if spend-limit lookup fails, continue with existing create flow.
            }
        }

        const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
        const maintenanceTask = await queries.createMaintenanceTask({
            propertyId,
            siteId: parsed.data.siteId,
            staffId,
            title: parsed.data.title,
            description: parsed.data.description ?? null,
            ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
            ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
            ...(parsed.data.source !== undefined ? { source: parsed.data.source } : {}),
            ...(parsed.data.estimatedLaborCost !== undefined ? { estimatedLaborCost: parsed.data.estimatedLaborCost } : {}),
            ...(parsed.data.estimatedPartsCost !== undefined ? { estimatedPartsCost: parsed.data.estimatedPartsCost } : {}),
            ...(parsed.data.isSuspectedDamage !== undefined ? { isSuspectedDamage: parsed.data.isSuspectedDamage } : {}),
            ...(parsed.data.vendorId !== undefined ? { vendorId: parsed.data.vendorId } : {}),
            ...(parsed.data.sla !== undefined ? { sla: parsed.data.sla } : {}),
            createdBy: user.id,
            ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        })

        // Spend limit informational check (no blocking)
        const spendLimitWarnings: Array<{ category: string; threshold: number; spent: number }> = []
        try {
            const queries = new MaintenanceQueries(supabase as unknown as SupabaseClient)
            if (parsed.data.category) {
                const spendLimits = await queries.listSpendLimits(propertyId)
                const matchedLimit = spendLimits.find(
                    (sl) => sl.category === parsed.data.category && sl.alert_enabled,
                )
                if (matchedLimit) {
                    const thresholdAmount = Number(matchedLimit.threshold_amount ?? 0)
                    const spent = await queries.getCategorySpend(propertyId, parsed.data.category, 'monthly')
                    if (spent >= thresholdAmount) {
                        spendLimitWarnings.push({
                            category: parsed.data.category,
                            threshold: thresholdAmount,
                            spent,
                        })
                    }
                }
            }
        } catch {
            // Non-blocking: spend limit check failures should not prevent WO creation
        }

        // Publish domain event (fire-and-forget)
        try {
            const eventBus = getEventBus()
            const task = maintenanceTask as any
            await eventBus.publish(new MaintenanceTaskCreatedEvent(
                propertyId,
                task.id,
                task.wo_number ?? '',
                task.category ?? '',
                task.priority ?? '',
            ))
        } catch {
            // Non-blocking: event publishing failures should not prevent WO creation
        }

        if (access.companyId) {
            const service = createServiceRoleClient()
            const { data: siteRow } = await supabase
                .from('sites')
                .select('site_name, site_number')
                .eq('id', maintenanceTask.site_id)
                .eq('property_id', propertyId)
                .maybeSingle()
            const auditSiteLabel = siteRow?.site_name?.trim()
                || siteRow?.site_number
                || maintenanceTask.site_id
            await recordActivityLog(
                service,
                {
                    companyId: access.companyId,
                    propertyId,
                    action: 'create',
                    resource: 'maintenance',
                    userId: user.id,
                    details: `Created maintenance task "${maintenanceTask.title}" for site ${auditSiteLabel}.`,
                },
                { failOpen: false },
            )
        }

        if (maintenanceTask.vendor_id) {
            try {
                const [{ data: vendorRow }, { data: propertyRow }, { data: siteRow }] = await Promise.all([
                    supabase
                        .from('property_vendor')
                        .select('name, email')
                        .eq('id', maintenanceTask.vendor_id)
                        .eq('property_id', propertyId)
                        .maybeSingle(),
                    supabase
                        .from('properties')
                        .select('name, address, city, state, zip_code, email')
                        .eq('id', propertyId)
                        .maybeSingle(),
                    supabase
                        .from('sites')
                        .select('site_name, site_number')
                        .eq('id', maintenanceTask.site_id)
                        .eq('property_id', propertyId)
                        .maybeSingle(),
                ])

                const vendorEmail = vendorRow?.email?.trim()
                if (vendorEmail) {
                    let emailResult: Awaited<ReturnType<typeof sendEmail>> | null = null
                    const template = await resolveConfiguredVendorEmailTemplate(
                        supabase as unknown as SupabaseClient,
                        propertyId,
                        access.companyId ?? null,
                    )
                    const propertyName = propertyRow?.name ?? 'Campground'
                    const propertyAddress = [
                        propertyRow?.address ?? null,
                        [propertyRow?.city ?? null, propertyRow?.state ?? null].filter(Boolean).join(', ') || null,
                        propertyRow?.zip_code ?? null,
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .trim() || 'Address not provided'
                    const propertyEmail = propertyRow?.email?.trim() || 'support@campos.com'
                    const siteLabel = siteRow?.site_name?.trim() || siteRow?.site_number || 'Unassigned site'

                    if (template) {
                        const rendered = renderWithContext(template.subject, template.html, {
                            property: {
                                name: propertyName,
                                address: propertyAddress,
                                email: propertyEmail,
                            },
                            vendor: { name: vendorRow?.name ?? 'Vendor' },
                            maintenance: {
                                wo_number: maintenanceTask.wo_number ?? maintenanceTask.id,
                                title: maintenanceTask.title,
                                category: maintenanceTask.category ?? 'Uncategorized',
                                priority: maintenanceTask.priority ?? 'medium',
                                description: maintenanceTask.description ?? '',
                                site_label: siteLabel,
                                estimated_labor_cost: maintenanceTask.estimated_labor_cost ?? null,
                            },
                        })

                        emailResult = await sendEmail({
                            from: getFrom(),
                            to: vendorEmail,
                            subject: rendered.subject,
                            html: rendered.html,
                            text: rendered.text,
                        })
                    } else {
                        const html = await buildVendorWorkOrderAssignedEmailHtml({
                            vendorName: vendorRow?.name ?? 'Vendor',
                            propertyName,
                            propertyAddress,
                            propertyEmail,
                            workOrderNumber: maintenanceTask.wo_number ?? maintenanceTask.id,
                            taskTitle: maintenanceTask.title,
                            category: maintenanceTask.category ?? null,
                            priority: maintenanceTask.priority ?? null,
                            siteLabel,
                            description: maintenanceTask.description ?? null,
                            estimatedLaborCost: maintenanceTask.estimated_labor_cost ?? null,
                        })
                        emailResult = await sendEmail({
                            from: getFrom(),
                            to: vendorEmail,
                            subject: `Work Order Invitation: ${maintenanceTask.wo_number ?? maintenanceTask.id}`,
                            html,
                        })
                    }

                    if (access.companyId) {
                        const service = createServiceRoleClient()
                        const action = emailResult?.success ? 'email_sent' : 'email_failed'
                        const woLabel = maintenanceTask.wo_number ?? maintenanceTask.id
                        const details = emailResult?.success
                            ? `Sent vendor assignment email for work order ${woLabel} to ${vendorEmail}.`
                            : `Failed to send vendor assignment email for work order ${woLabel} to ${vendorEmail}: ${emailResult?.error ?? 'Unknown error'}.`
                        await recordActivityLog(
                            service,
                            {
                                companyId: access.companyId,
                                propertyId,
                                action,
                                resource: 'maintenance',
                                userId: user.id,
                                details,
                            },
                            { failOpen: true },
                        )
                    }
                }
            } catch (emailErr) {
                console.error('[Maintenance API v1] Vendor assignment email failed:', emailErr)
            }
        }

        return success({ maintenanceTask, spendLimitWarnings }, request)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Maintenance API v1] POST error:', err)

        if (
            message === 'Site not found for this property' ||
            message === 'Assignee not found for this property' ||
            message === 'Vendor not found for this property'
        ) {
            return error(ErrorCodes.VALIDATION_ERROR, request, { message })
        }

        return error(ErrorCodes.INTERNAL_ERROR, request, { message })
    }
}