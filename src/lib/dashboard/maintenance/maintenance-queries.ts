import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'
import { addDays, addMonths, addYears, format } from 'date-fns'

type MaintenanceTaskRow = Database['public']['Tables']['maintenance_tasks']['Row']
type SiteRow = Database['public']['Tables']['sites']['Row']

export async function generateWoNumber(
    propertyId: string,
    supabase: SupabaseClient,
): Promise<string> {
    const { data: counter, error: counterError } = await supabase
        .from('maintenance_wo_counter')
        .select('last_number')
        .eq('property_id', propertyId)
        .single()

    if (counterError && counterError.code !== 'PGRST116') {
        throw counterError
    }

    const nextNumber = (counter?.last_number ?? 0) + 1

    const { error: upsertError } = await supabase
        .from('maintenance_wo_counter')
        .upsert({ property_id: propertyId, last_number: nextNumber }, { onConflict: 'property_id' })

    if (upsertError) throw upsertError

    const { data: property } = await supabase
        .from('properties')
        .select('name')
        .eq('id', propertyId)
        .single()

    const rawPrefix = (property?.name ?? 'WO').substring(0, 4)
    const prefix = rawPrefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const year = new Date().getFullYear().toString().slice(-2)

    return `${prefix}-${year}-${nextNumber.toString().padStart(5, '0')}`
}

export type CreateMaintenanceTaskInput = {
    propertyId: string
    siteId: string
    createdBy: string
    title: string
    description?: string | null
    staffId?: string | null
    status?: 'open' | 'in_progress' | 'in_progress_vendor' | 'on_hold' | 'completed' | 'cancelled'
    priority?: 'low' | 'medium' | 'high' | 'emergency'
    category?: string
    source?: 'guest' | 'housekeeping' | 'staff' | 'pm' | 'checkout'
    estimatedLaborCost?: number | null
    estimatedPartsCost?: number | null
    isSuspectedDamage?: boolean
    vendorId?: string | null
    guideId?: string | null
    sla?: number | null
    scheduledStart?: string | null
    dueDate?: string | null
}

export type UpdateMaintenanceTaskInput = {
    id: string
    propertyId: string
    siteId?: string
    description?: string | null
    staffId?: string | null
    title?: string
    status?: 'open' | 'in_progress' | 'in_progress_vendor' | 'on_hold' | 'completed' | 'cancelled'
    priority?: 'low' | 'medium' | 'high' | 'emergency'
    category?: string
    source?: 'guest' | 'housekeeping' | 'staff' | 'pm' | 'checkout'
    estimatedLaborCost?: number | null
    estimatedPartsCost?: number | null
    actualLaborCost?: number | null
    actualPartsCost?: number | null
    isSuspectedDamage?: boolean
    vendorId?: string | null
    guideId?: string | null
    vendorInvoiceNumber?: string | null
    vendorInvoiceCost?: number | null
    closeoutNotes?: string | null
    sla?: number | null
    started_at?: string | null
    completed_at?: string | null
    on_hold_at?: string | null
    on_hold_reason?: string | null
    cancelled_at?: string | null
    cancelled_reason?: string | null
    scheduledStart?: string | null
    dueDate?: string | null
}

export type ListMaintenanceTasksFilters = {
    search?: string
    siteId?: string
    siteIds?: string[]
    assigneeId?: 'unassigned' | string
    status?: 'open' | 'in_progress' | 'in_progress_vendor' | 'on_hold' | 'completed' | 'cancelled'
    priority?: 'low' | 'medium' | 'high' | 'emergency'
    source?: 'guest' | 'housekeeping' | 'staff' | 'pm' | 'checkout'
    category?: string
}

export type ListMaintenanceTasksResult = {
    tasks: Array<MaintenanceTaskRow & { site: Pick<SiteRow, 'site_name' | 'site_number' | 'site_type'> | null }>
    total: number
}

export type ListMaintenanceTasksPagination = {
    page: number
    perPage: number
}

export type PropertyVendorListRow = {
    id: string
    name: string
    service_type: string
    email: string | null
    phone: string | null
}

export type CreatePropertyVendorInput = {
    propertyId: string
    name: string
    serviceType: string
    email?: string | null
    phone?: string | null
}

export type UpdatePropertyVendorInput = {
    id: string
    propertyId: string
    name?: string
    serviceType?: string
    email?: string | null
    phone?: string | null
}

type MaintenanceScheduleRow = {
    id: string
    property_id: string
    site_id: string | null
    assigned_to: string | null
    name: string
    description: string | null
    frequency: string
    days: string | null
    schedule_date: string | null
    created_by: string
    created_at: string
    updated_at: string
    // Enriched fields from listSchedules
    last_completed_at: string | null
    next_due_date: string | null
    total_generated: number
}

// NOTE: After running `npm run gen:db`, replace the manual MaintenanceScheduleRow above
// with: type MaintenanceScheduleRow = Database['public']['Tables']['maintenance_schedule']['Row']

export type CreateScheduleInput = {
    name: string
    description?: string | null
    siteId?: string | null
    assignedTo?: string | null
    frequency: 'weekly' | 'monthly' | 'annual'
    days?: string | null
    scheduleDate?: string | null
}

export type UpdateScheduleInput = Partial<CreateScheduleInput>

export type ListSchedulesFilters = {
    search?: string
    siteId?: string
}

function escapeIlikePattern(raw: string): string {
    const noCommas = raw.replace(/,/g, '')
    return noCommas.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// ── Maintenance Guide types ──

export interface MaintenanceGuideStep {
    id: string
    label: string
    notes?: string
}

export interface MaintenanceGuideListItem {
    id: string
    name: string
    description: string | null
    steps: MaintenanceGuideStep[]
    created_at: string
}

export interface CreateMaintenanceGuideInput {
    propertyId: string
    createdBy: string
    name: string
    description?: string | null
    steps: MaintenanceGuideStep[]
}

export interface UpdateMaintenanceGuideInput extends CreateMaintenanceGuideInput {
    id: string
}

export class MaintenanceQueries {
    constructor(private supabase: SupabaseClient) {}

    async createMaintenanceTask(input: CreateMaintenanceTaskInput): Promise<MaintenanceTaskRow> {
        const { data: siteRow, error: siteError } = await this.supabase
            .from('sites')
            .select('id')
            .eq('id', input.siteId)
            .eq('property_id', input.propertyId)
            .is('deleted_at', null)
            .maybeSingle()

        if (siteError || !siteRow) {
            console.error('[MaintenanceQueries] Site not found for property', {
                siteError,
                propertyId: input.propertyId,
                siteId: input.siteId,
            })
            throw new Error('Site not found for this property')
        }

        if (input.staffId) {
            const { data: staffRow, error: staffError } = await this.supabase
                .from('property_staff')
                .select('id')
                .eq('id', input.staffId)
                .eq('property_id', input.propertyId)
                .maybeSingle()

            if (staffError || !staffRow) {
                console.error('[MaintenanceQueries] Assignee not found for property', {
                    staffError,
                    propertyId: input.propertyId,
                    staffId: input.staffId,
                })
                throw new Error('Assignee not found for this property')
            }
        }

        if (input.vendorId) {
            const { data: vendorRow, error: vendorError } = await this.supabase
                .from('property_vendor')
                .select('id')
                .eq('id', input.vendorId)
                .eq('property_id', input.propertyId)
                .maybeSingle()

            if (vendorError || !vendorRow) {
                console.error('[MaintenanceQueries] Vendor not found for property', {
                    vendorError,
                    propertyId: input.propertyId,
                    vendorId: input.vendorId,
                })
                throw new Error('Vendor not found for this property')
            }
        }

        // Generate WO number before insert
        const woNumber = await generateWoNumber(input.propertyId, this.supabase)

        const insertRow: Record<string, unknown> = {
            property_id: input.propertyId,
            site_id: input.siteId,
            created_by: input.createdBy,
            title: input.title,
            wo_number: woNumber,
            description: input.description ?? null,
            staff_id: input.staffId ?? null,
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.source !== undefined ? { source: input.source } : {}),
            ...(input.estimatedLaborCost !== undefined ? { estimated_labor_cost: input.estimatedLaborCost } : {}),
            ...(input.estimatedPartsCost !== undefined ? { estimated_parts_cost: input.estimatedPartsCost } : {}),
            ...(input.isSuspectedDamage !== undefined ? { is_suspected_damage: input.isSuspectedDamage } : {}),
            ...(input.vendorId !== undefined ? { vendor_id: input.vendorId } : {}),
            ...(input.guideId !== undefined ? { guide_id: input.guideId } : {}),
            ...(input.sla !== undefined ? { sla: input.sla } : {}),
            ...(input.scheduledStart !== undefined ? { scheduled_start: input.scheduledStart } : {}),
            ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        }

        const { data, error } = await this.supabase
            .from('maintenance_tasks')
            .insert(insertRow)
            .select()
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to create maintenance task', {
                error,
                propertyId: input.propertyId,
            })
            throw new Error(`Failed to create maintenance task: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to create maintenance task: no row returned')
        }

        return data
    }

    async listMaintenanceTasks(
        propertyId: string,
        filters?: ListMaintenanceTasksFilters,
        pagination?: ListMaintenanceTasksPagination,
    ): Promise<ListMaintenanceTasksResult> {
        let query = this.supabase
            .from('maintenance_tasks')
            .select(
                '*, site:sites(site_name, site_number, site_type)',
                { count: 'exact' },
            )
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false })

        if (filters?.siteId) {
            query = query.eq('site_id', filters.siteId)
        }
        if (filters?.siteIds) {
            if (filters.siteIds.length === 0) {
                return { tasks: [], total: 0 }
            }
            query = query.in('site_id', filters.siteIds)
        }

        if (filters?.assigneeId) {
            if (filters.assigneeId === 'unassigned') {
                query = query.is('staff_id', null)
            } else {
                query = query.eq('staff_id', filters.assigneeId)
            }
        }

        if (filters?.status) {
            query = query.eq('status', filters.status)
        }
        if (filters?.priority) {
            query = query.eq('priority', filters.priority)
        }
        if (filters?.source) {
            query = query.eq('source', filters.source)
        }
        if (filters?.category) {
            query = query.eq('category', filters.category)
        }

        const search = filters?.search?.trim()
        if (search && search.length > 0) {
            const pattern = `%${escapeIlikePattern(search)}%`

            const { data: matchingSites, error: sitesError } = await this.supabase
                .from('sites')
                .select('id')
                .eq('property_id', propertyId)
                .is('deleted_at', null)
                .or(`site_name.ilike.${pattern},site_number.ilike.${pattern}`)

            if (sitesError) {
                console.error('[MaintenanceQueries] Site search for maintenance list failed', {
                    propertyId,
                    sitesError,
                })
                throw new Error(`Failed to search sites for maintenance tasks: ${sitesError.message}`)
            }

            const siteIds = (matchingSites ?? []).map((row) => row.id)
            const orParts = [`title.ilike.${pattern}`, `description.ilike.${pattern}`]
            if (siteIds.length > 0) {
                orParts.push(`site_id.in.(${siteIds.join(',')})`)
            }
            query = query.or(orParts.join(','))
        }

        const page = pagination?.page ?? 1
        const perPage = pagination?.perPage ?? 10
        const from = (page - 1) * perPage
        const to = from + perPage - 1
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error('[MaintenanceQueries] Failed to list maintenance tasks', {
                error,
                propertyId,
                filters,
            })
            throw new Error(`Failed to list maintenance tasks: ${error.message}`)
        }

        return {
            tasks: (data ?? []) as ListMaintenanceTasksResult['tasks'],
            total: count ?? 0,
        }
    }

    async countOpenMaintenanceTasks(propertyId: string): Promise<number> {
        const { count, error } = await this.supabase
            .from('maintenance_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .neq('status', 'completed')

        if (error) {
            console.error('[MaintenanceQueries] Failed to count open maintenance tasks', {
                error,
                propertyId,
            })
            throw new Error(`Failed to count open maintenance tasks: ${error.message}`)
        }

        return count ?? 0
    }

    async listPropertyVendors(propertyId: string): Promise<PropertyVendorListRow[]> {
        const { data, error } = await this.supabase
            .from('property_vendor')
            .select('id, name, service_type, email, phone')
            .eq('property_id', propertyId)
            .order('name', { ascending: true })

        if (error) {
            console.error('[MaintenanceQueries] Failed to list property vendors', {
                error,
                propertyId,
            })
            throw new Error(`Failed to list vendors: ${error.message}`)
        }

        return (data ?? []) as PropertyVendorListRow[]
    }

    async countLinkedWorkOrdersByVendor(propertyId: string): Promise<Record<string, number>> {
        const { data, error } = await this.supabase
            .from('maintenance_tasks')
            .select('vendor_id')
            .eq('property_id', propertyId)
            .not('vendor_id', 'is', null)

        if (error) {
            console.error('[MaintenanceQueries] Failed to count linked work orders by vendor', {
                error,
                propertyId,
            })
            throw new Error(`Failed to count linked work orders: ${error.message}`)
        }

        const counts: Record<string, number> = {}
        for (const row of data ?? []) {
            const vendorId = row.vendor_id
            if (!vendorId) continue
            counts[vendorId] = (counts[vendorId] ?? 0) + 1
        }

        return counts
    }

    async createPropertyVendor(input: CreatePropertyVendorInput): Promise<PropertyVendorListRow> {
        const insertRow = {
            property_id: input.propertyId,
            name: input.name,
            service_type: input.serviceType,
            email: input.email ?? null,
            phone: input.phone ?? null,
        } as Record<string, unknown>

        const { data, error } = await this.supabase
            .from('property_vendor')
            .insert(insertRow)
            .select('id, name, service_type, email, phone')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to create property vendor', {
                error,
                propertyId: input.propertyId,
            })
            throw new Error(`Failed to create vendor: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to create vendor: no row returned')
        }

        return data as PropertyVendorListRow
    }

    async updatePropertyVendor(input: UpdatePropertyVendorInput): Promise<PropertyVendorListRow> {
        const updateRow: Database['public']['Tables']['property_vendor']['Update'] = {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.serviceType !== undefined ? { service_type: input.serviceType } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
        }

        const { data, error } = await this.supabase
            .from('property_vendor')
            .update(updateRow)
            .eq('id', input.id)
            .eq('property_id', input.propertyId)
            .select('id, name, service_type, email, phone')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to update property vendor', {
                error,
                propertyId: input.propertyId,
                id: input.id,
            })
            throw new Error(`Failed to update vendor: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to update vendor: no row returned')
        }

        return data as PropertyVendorListRow
    }

    async deletePropertyVendor(input: { id: string; propertyId: string }): Promise<void> {
        const { error } = await this.supabase
            .from('property_vendor')
            .delete()
            .eq('id', input.id)
            .eq('property_id', input.propertyId)

        if (error) {
            console.error('[MaintenanceQueries] Failed to delete property vendor', {
                error,
                propertyId: input.propertyId,
                id: input.id,
            })
            throw new Error(`Failed to delete vendor: ${error.message}`)
        }
    }

    async updateMaintenanceTask(input: UpdateMaintenanceTaskInput): Promise<MaintenanceTaskRow> {
        if (input.vendorId !== undefined && input.vendorId !== null) {
            const { data: vendorRow, error: vendorError } = await this.supabase
                .from('property_vendor')
                .select('id')
                .eq('id', input.vendorId)
                .eq('property_id', input.propertyId)
                .maybeSingle()

            if (vendorError || !vendorRow) {
                console.error('[MaintenanceQueries] Vendor not found for property', {
                    vendorError,
                    propertyId: input.propertyId,
                    vendorId: input.vendorId,
                })
                throw new Error('Vendor not found for this property')
            }
        }

        const updateRow: Record<string, unknown> = {
            ...(input.siteId !== undefined ? { site_id: input.siteId } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.staffId !== undefined ? { staff_id: input.staffId } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.source !== undefined ? { source: input.source } : {}),
            ...(input.estimatedLaborCost !== undefined ? { estimated_labor_cost: input.estimatedLaborCost } : {}),
            ...(input.estimatedPartsCost !== undefined ? { estimated_parts_cost: input.estimatedPartsCost } : {}),
            ...(input.actualLaborCost !== undefined ? { actual_labor_cost: input.actualLaborCost } : {}),
            ...(input.actualPartsCost !== undefined ? { actual_parts_cost: input.actualPartsCost } : {}),
            ...(input.isSuspectedDamage !== undefined ? { is_suspected_damage: input.isSuspectedDamage } : {}),
            ...(input.vendorId !== undefined ? { vendor_id: input.vendorId } : {}),
            ...(input.guideId !== undefined ? { guide_id: input.guideId } : {}),
            ...(input.vendorInvoiceNumber !== undefined ? { vendor_invoice_number: input.vendorInvoiceNumber } : {}),
            ...(input.vendorInvoiceCost !== undefined ? { vendor_invoice_cost: input.vendorInvoiceCost } : {}),
            ...(input.closeoutNotes !== undefined ? { closeout_notes: input.closeoutNotes } : {}),
            ...(input.sla !== undefined ? { sla: input.sla } : {}),
        }

        // Date/time fields
        const dateUpdates: Record<string, unknown> = {
            ...(input.scheduledStart !== undefined ? { scheduled_start: input.scheduledStart } : {}),
            ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        }
        const lifecycleUpdates: Record<string, unknown> = {
            ...(input.started_at !== undefined ? { started_at: input.started_at } : {}),
            ...(input.completed_at !== undefined ? { completed_at: input.completed_at } : {}),
            ...(input.on_hold_at !== undefined ? { on_hold_at: input.on_hold_at } : {}),
            ...(input.on_hold_reason !== undefined ? { on_hold_reason: input.on_hold_reason } : {}),
            ...(input.cancelled_at !== undefined ? { cancelled_at: input.cancelled_at } : {}),
            ...(input.cancelled_reason !== undefined ? { cancelled_reason: input.cancelled_reason } : {}),
        }

        const { data, error } = await this.supabase
            .from('maintenance_tasks')
            .update({ ...updateRow, ...lifecycleUpdates, ...dateUpdates })
            .eq('id', input.id)
            .eq('property_id', input.propertyId)
            .select()
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to update maintenance task', {
                error,
                id: input.id,
                propertyId: input.propertyId,
            })
            throw new Error(`Failed to update maintenance task: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to update maintenance task: no row returned')
        }

        return data
    }

    async getMaintenanceReportSummary(
        propertyId: string,
        dateRange?: { from?: string; to?: string },
    ): Promise<{
        totalWorkOrders: number
        activeWorkOrders: number
        completedWorkOrders: number
        totalEstimatedCost: number
        byStatus: Array<{ status: string; count: number }>
        byCategory: Array<{ category: string; count: number }>
        byPriority: Array<{ priority: string; count: number }>
    }> {
        let query = this.supabase
            .from('maintenance_tasks')
            .select('status, category, priority, estimated_labor_cost, estimated_parts_cost')
            .eq('property_id', propertyId)

        if (dateRange?.from) {
            query = query.gte('created_at', dateRange.from)
        }
        if (dateRange?.to) {
            query = query.lte('created_at', dateRange.to)
        }

        const { data, error } = await query

        if (error) {
            console.error('[MaintenanceQueries] Failed to fetch maintenance report summary', {
                error,
                propertyId,
                dateRange,
            })
            throw new Error(`Failed to fetch maintenance report summary: ${error.message}`)
        }

        const rows = data ?? []

        const byStatusMap: Record<string, number> = {}
        const byCategoryMap: Record<string, number> = {}
        const byPriorityMap: Record<string, number> = {}
        let totalEstimatedCost = 0
        let activeWorkOrders = 0
        let completedWorkOrders = 0

        for (const row of rows) {
            const status = row.status ?? 'unknown'
            const category = row.category ?? 'uncategorized'
            const priority = row.priority ?? 'unknown'

            byStatusMap[status] = (byStatusMap[status] ?? 0) + 1
            byCategoryMap[category] = (byCategoryMap[category] ?? 0) + 1
            byPriorityMap[priority] = (byPriorityMap[priority] ?? 0) + 1

            totalEstimatedCost += (row.estimated_labor_cost ?? 0) + (row.estimated_parts_cost ?? 0)

            if (status === 'open' || status === 'in_progress') {
                activeWorkOrders++
            }
            if (status === 'completed') {
                completedWorkOrders++
            }
        }

        return {
            totalWorkOrders: rows.length,
            activeWorkOrders,
            completedWorkOrders,
            totalEstimatedCost,
            byStatus: Object.entries(byStatusMap).map(([status, count]) => ({ status, count })),
            byCategory: Object.entries(byCategoryMap).map(([category, count]) => ({ category, count })),
            byPriority: Object.entries(byPriorityMap).map(([priority, count]) => ({ priority, count })),
        }
    }

    // -----------------------------------------------------------------------
    // Schedule CRUD
    // -----------------------------------------------------------------------

    async createSchedule(
        propertyId: string,
        data: CreateScheduleInput & { createdBy: string },
    ): Promise<MaintenanceScheduleRow> {
        const insertRow = {
            property_id: propertyId,
            name: data.name,
            description: data.description ?? null,
            site_id: data.siteId ?? null,
            assigned_to: data.assignedTo ?? null,
            frequency: data.frequency,
            days: data.days ?? null,
            schedule_date: data.scheduleDate ?? null,
            created_by: data.createdBy,
        }

        const { data: row, error } = await this.supabase
            .from('maintenance_schedule')
            .insert(insertRow)
            .select()
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to create schedule', { error, propertyId })
            throw new Error(`Failed to create schedule: ${error.message}`)
        }

        if (!row) {
            throw new Error('Failed to create schedule: no row returned')
        }

        return row as unknown as MaintenanceScheduleRow
    }

    async listSchedules(
        propertyId: string,
        filters?: ListSchedulesFilters,
    ): Promise<MaintenanceScheduleRow[]> {
        let query = this.supabase
            .from('maintenance_schedule')
            .select(`*,
                maintenance_tasks!schedule_id(count)
            `)
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false })

        if (filters?.siteId) {
            query = query.eq('site_id', filters.siteId)
        }

        const search = filters?.search?.trim()
        if (search && search.length > 0) {
            const pattern = `%${escapeIlikePattern(search)}%`
            query = query.ilike('name', pattern)
        }

        const { data, error } = await query

        if (error) {
            console.error('[MaintenanceQueries] Failed to list schedules', { error, propertyId, filters })
            throw new Error(`Failed to list schedules: ${error.message}`)
        }

        const rawRows = (data ?? []) as any[]

        // Fetch last_completed_at for each schedule via a single batch query
        const scheduleIds = rawRows.map((r) => r.id)
        const lastCompletedMap: Record<string, string | null> = {}
        if (scheduleIds.length > 0) {
            const { data: completedRows } = await this.supabase
                .from('maintenance_tasks')
                .select('schedule_id, completed_at')
                .eq('property_id', propertyId)
                .eq('status', 'completed')
                .not('schedule_id', 'is', null)
                .in('schedule_id', scheduleIds)
                .order('completed_at', { ascending: false })

            if (completedRows) {
                const seen = new Set<string>()
                for (const row of completedRows) {
                    const sid = row.schedule_id as string
                    if (!seen.has(sid)) {
                        seen.add(sid)
                        lastCompletedMap[sid] = row.completed_at as string
                    }
                }
            }
        }

        return rawRows.map((row) => {
            const lastCompletedAt = lastCompletedMap[row.id] ?? null
            const lastCompletedDate = lastCompletedAt ? new Date(lastCompletedAt) : null

            // Calculate next_due_date from last_completed_at + frequency interval
            let nextDueDate: string | null = null
            if (lastCompletedDate) {
                let next: Date
                switch (row.frequency) {
                    case 'weekly':
                        next = addDays(lastCompletedDate, 7)
                        break
                    case 'monthly':
                        next = addMonths(lastCompletedDate, 1)
                        break
                    case 'annual':
                        next = addYears(lastCompletedDate, 1)
                        break
                    default:
                        next = addMonths(lastCompletedDate, 1)
                }
                nextDueDate = format(next, 'yyyy-MM-dd')
            } else if (row.schedule_date) {
                // No completed WO yet — use the schedule's own schedule_date as next due
                nextDueDate = row.schedule_date
            }

            return {
                ...row,
                last_completed_at: lastCompletedAt,
                next_due_date: nextDueDate,
                total_generated: (row.maintenance_tasks as any[] | null)?.[0]?.count ?? 0,
            } as MaintenanceScheduleRow
        })
    }

    async updateSchedule(
        scheduleId: string,
        propertyId: string,
        data: UpdateScheduleInput,
    ): Promise<MaintenanceScheduleRow> {
        const updateRow: Record<string, unknown> = {}
        if (data.name !== undefined) updateRow.name = data.name
        if (data.description !== undefined) updateRow.description = data.description
        if (data.siteId !== undefined) updateRow.site_id = data.siteId
        if (data.assignedTo !== undefined) updateRow.assigned_to = data.assignedTo
        if (data.frequency !== undefined) updateRow.frequency = data.frequency
        if (data.days !== undefined) updateRow.days = data.days
        if (data.scheduleDate !== undefined) updateRow.schedule_date = data.scheduleDate

        const { data: row, error } = await this.supabase
            .from('maintenance_schedule')
            .update(updateRow)
            .eq('id', scheduleId)
            .eq('property_id', propertyId)
            .select()
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to update schedule', {
                error,
                scheduleId,
                propertyId,
            })
            throw new Error(`Failed to update schedule: ${error.message}`)
        }

        if (!row) {
            throw new Error('Failed to update schedule: no row returned')
        }

        return row as unknown as MaintenanceScheduleRow
    }

    async deleteSchedule(scheduleId: string, propertyId: string): Promise<void> {
        const { error } = await this.supabase
            .from('maintenance_schedule')
            .delete()
            .eq('id', scheduleId)
            .eq('property_id', propertyId)

        if (error) {
            console.error('[MaintenanceQueries] Failed to delete schedule', {
                error,
                scheduleId,
                propertyId,
            })
            throw new Error(`Failed to delete schedule: ${error.message}`)
        }
    }

    async generateWorkOrderForSchedule(
        scheduleId: string,
        propertyId: string,
    ): Promise<MaintenanceTaskRow> {
        // Duplicate prevention: check for open/in_progress PM WO linked to this schedule
        const { data: existing, error: dupError } = await this.supabase
            .from('maintenance_tasks')
            .select('id')
            .eq('property_id', propertyId)
            .eq('schedule_id', scheduleId)
            .in('status', ['open', 'in_progress'])
            .maybeSingle()

        if (dupError) {
            console.error('[MaintenanceQueries] Failed to check for duplicate PM work order', {
                error: dupError,
                scheduleId,
                propertyId,
            })
            throw new Error(`Failed to check for duplicate work order: ${dupError.message}`)
        }

        if (existing) {
            throw new Error('An open or in-progress work order already exists for this schedule')
        }

        // Fetch the schedule to seed the work order fields
        const { data: schedule, error: schedError } = await this.supabase
            .from('maintenance_schedule')
            .select('*')
            .eq('id', scheduleId)
            .eq('property_id', propertyId)
            .single()

        if (schedError || !schedule) {
            console.error('[MaintenanceQueries] Schedule not found', {
                error: schedError,
                scheduleId,
                propertyId,
            })
            throw new Error('Schedule not found')
        }

        // NOTE: schedule_id is typed via Record<string, unknown> because the generated
        // maintenance_tasks Insert type won't include it until `npm run gen:db` is run
        // after applying the migration 20260424030000.
        const sched = schedule as unknown as MaintenanceScheduleRow
        const scheduleDateOnly = typeof sched.schedule_date === 'string' && sched.schedule_date.trim()
            ? sched.schedule_date.trim()
            : null
        const dateParts = scheduleDateOnly ? scheduleDateOnly.split('-') : []
        const y = Number.parseInt(dateParts[0] ?? '', 10)
        const m = Number.parseInt(dateParts[1] ?? '', 10)
        const d = Number.parseInt(dateParts[2] ?? '', 10)
        const scheduledStart =
            Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
                ? new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
                : null
        const dueDate =
            Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
                ? new Date(y, m - 1, d, 23, 59, 0, 0).toISOString()
                : null
        const insertRow = {
            property_id: propertyId,
            site_id: sched.site_id ?? null,
            created_by: sched.created_by,
            title: `PM: ${sched.name}`,
            description: sched.description ?? null,
            staff_id: sched.assigned_to ?? null,
            status: 'open' as const,
            priority: 'medium' as const,
            source: 'pm' as const,
            category: 'preventive',
            schedule_id: scheduleId,
            scheduled_start: scheduledStart,
            due_date: dueDate,
        }

        const { data: task, error } = await this.supabase
            .from('maintenance_tasks')
            .insert(insertRow)
            .select()
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to generate PM work order', {
                error,
                scheduleId,
                propertyId,
            })
            throw new Error(`Failed to generate work order: ${error.message}`)
        }

        if (!task) {
            throw new Error('Failed to generate work order: no row returned')
        }

        return task
    }

    async generateNextWorkOrder(scheduleId: string, completedDate: Date): Promise<any | null> {
        try {
            // 1. Look up the schedule row
            const { data: schedule, error: schedError } = await this.supabase
                .from('maintenance_schedule')
                .select('*')
                .eq('id', scheduleId)
                .maybeSingle()

            if (schedError || !schedule) {
                console.warn('[MaintenanceQueries] Schedule not found for auto-generation, skipping', {
                    error: schedError,
                    scheduleId,
                })
                return null
            }

            // 2. Calculate next due date based on frequency
            const freq = schedule.frequency
            let nextDate: Date

            switch (freq) {
                case 'weekly':
                    nextDate = addDays(completedDate, 7)
                    break
                case 'monthly':
                    nextDate = addMonths(completedDate, 1)
                    break
                case 'annual':
                    nextDate = addYears(completedDate, 1)
                    break
                default:
                    console.warn('[MaintenanceQueries] Unsupported schedule frequency for auto-generation, skipping', {
                        frequency: freq,
                        scheduleId,
                    })
                    return null
            }

            const nextDateStr = format(nextDate, 'yyyy-MM-dd')
            const sched = schedule as unknown as MaintenanceScheduleRow

            // Duplicate prevention: don't create if an open/in_progress WO already exists
            const { data: existing, error: dupError } = await this.supabase
                .from('maintenance_tasks')
                .select('id')
                .eq('schedule_id', scheduleId)
                .in('status', ['open', 'in_progress'])
                .maybeSingle()

            if (dupError) {
                console.warn('[MaintenanceQueries] Failed to check for duplicate in auto-generation', {
                    error: dupError,
                    scheduleId,
                })
                return null
            }

            if (existing) {
                console.warn('[MaintenanceQueries] Skipping auto-generation: open WO already exists', {
                    scheduleId,
                })
                return null
            }

            // 3. Create the next maintenance task
            // NOTE: schedule_id is typed via plain object because the generated
            // maintenance_tasks Insert type won't include it until `npm run gen:db`
            // is run after applying the migration 20260424030000.
            const insertRow = {
                property_id: sched.property_id,
                site_id: sched.site_id ?? null,
                created_by: sched.created_by,
                title: `PM: ${sched.name}`,
                description: sched.description ?? null,
                staff_id: sched.assigned_to ?? null,
                status: 'open' as const,
                priority: 'medium' as const,
                source: 'pm' as const,
                category: 'preventive',
                schedule_id: scheduleId,
                scheduled_start: new Date(
                    Number.parseInt(nextDateStr.slice(0, 4), 10),
                    Number.parseInt(nextDateStr.slice(5, 7), 10) - 1,
                    Number.parseInt(nextDateStr.slice(8, 10), 10),
                    0,
                    0,
                    0,
                    0,
                ).toISOString(),
                due_date: new Date(
                    Number.parseInt(nextDateStr.slice(0, 4), 10),
                    Number.parseInt(nextDateStr.slice(5, 7), 10) - 1,
                    Number.parseInt(nextDateStr.slice(8, 10), 10),
                    23,
                    59,
                    0,
                    0,
                ).toISOString(),
            }

            const { data: task, error: taskError } = await this.supabase
                .from('maintenance_tasks')
                .insert(insertRow)
                .select()
                .single()

            if (taskError || !task) {
                console.warn('[MaintenanceQueries] Failed to auto-generate next work order', {
                    error: taskError,
                    scheduleId,
                })
                return null
            }

            // 4. Advance the schedule's schedule_date
            const { error: updateError } = await this.supabase
                .from('maintenance_schedule')
                .update({ schedule_date: nextDateStr })
                .eq('id', scheduleId)

            if (updateError) {
                console.warn('[MaintenanceQueries] Failed to advance schedule date, but task was created', {
                    error: updateError,
                    scheduleId,
                })
                // Task was already created — don't fail, just warn
            }

            return task
        } catch (err) {
            console.warn('[MaintenanceQueries] Auto-generation failed, not blocking completion', {
                error: err,
                scheduleId,
            })
            return null
        }
    }

    async deleteMaintenanceTask(input: { id: string; propertyId: string }): Promise<void> {
        const { error } = await this.supabase
            .from('maintenance_tasks')
            .delete()
            .eq('id', input.id)
            .eq('property_id', input.propertyId)

        if (error) {
            console.error('[MaintenanceQueries] Failed to delete maintenance task', {
                error,
                id: input.id,
                propertyId: input.propertyId,
            })
            throw new Error(`Failed to delete maintenance task: ${error.message}`)
        }
    }

    // -----------------------------------------------------------------------
    // Budget CRUD
    // -----------------------------------------------------------------------

    async listBudgets(propertyId: string): Promise<Record<string, unknown>[]> {
        const { data, error } = await this.supabase
            .from('maintenance_budgets')
            .select('*')
            .eq('property_id', propertyId)
            .order('category', { ascending: true })

        if (error) {
            console.error('[MaintenanceQueries] Failed to list budgets', { error, propertyId })
            throw new Error(`Failed to list budgets: ${error.message}`)
        }

        return (data ?? []) as Record<string, unknown>[]
    }

    async createBudget(input: {
        propertyId: string
        category: string
        period: 'monthly' | 'quarterly' | 'annual'
        amount: number
        createdBy?: string
    }): Promise<Record<string, unknown>> {
        const insertRow = {
            property_id: input.propertyId,
            category: input.category,
            period: input.period,
            amount: input.amount,
            created_by: input.createdBy ?? null,
        } as Record<string, unknown>

        const { data, error } = await this.supabase
            .from('maintenance_budgets')
            .insert(insertRow)
            .select('*')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to create budget', { error, propertyId: input.propertyId })
            throw new Error(`Failed to create budget: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to create budget: no row returned')
        }

        return data as Record<string, unknown>
    }

    async updateBudget(budgetId: string, propertyId: string, input: {
        category?: string
        period?: 'monthly' | 'quarterly' | 'annual'
        amount?: number
    }): Promise<Record<string, unknown>> {
        const updateRow: Record<string, unknown> = {}
        if (input.category !== undefined) updateRow.category = input.category
        if (input.period !== undefined) updateRow.period = input.period
        if (input.amount !== undefined) updateRow.amount = input.amount

        const { data, error } = await this.supabase
            .from('maintenance_budgets')
            .update(updateRow)
            .eq('id', budgetId)
            .eq('property_id', propertyId)
            .select('*')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to update budget', { error, budgetId })
            throw new Error(`Failed to update budget: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to update budget: no row returned')
        }

        return data as Record<string, unknown>
    }

    async getBudgetById(budgetId: string, propertyId: string): Promise<Record<string, unknown> | null> {
        const { data, error } = await this.supabase
            .from('maintenance_budgets')
            .select('*')
            .eq('id', budgetId)
            .eq('property_id', propertyId)
            .maybeSingle()

        if (error) {
            console.error('[MaintenanceQueries] Failed to get budget by ID', { error, budgetId, propertyId })
            throw new Error(`Failed to get budget: ${error.message}`)
        }

        return (data ?? null) as Record<string, unknown> | null
    }

    async deleteBudget(budgetId: string, propertyId: string): Promise<void> {
        const { error } = await this.supabase
            .from('maintenance_budgets')
            .delete()
            .eq('id', budgetId)
            .eq('property_id', propertyId)

        if (error) {
            console.error('[MaintenanceQueries] Failed to delete budget', { error, budgetId })
            throw new Error(`Failed to delete budget: ${error.message}`)
        }
    }

    // -----------------------------------------------------------------------
    // Spend Limit CRUD
    // -----------------------------------------------------------------------

    async listSpendLimits(propertyId: string): Promise<Record<string, unknown>[]> {
        const { data, error } = await this.supabase
            .from('maintenance_spend_limits')
            .select('*')
            .eq('property_id', propertyId)
            .order('category', { ascending: true })

        if (error) {
            console.error('[MaintenanceQueries] Failed to list spend limits', { error, propertyId })
            throw new Error(`Failed to list spend limits: ${error.message}`)
        }

        return (data ?? []) as Record<string, unknown>[]
    }

    async createSpendLimit(input: {
        propertyId: string
        category: string
        thresholdAmount: number
        alertEnabled?: boolean
        createdBy?: string
    }): Promise<Record<string, unknown>> {
        const insertRow = {
            property_id: input.propertyId,
            category: input.category,
            threshold_amount: input.thresholdAmount,
            alert_enabled: input.alertEnabled ?? true,
            created_by: input.createdBy ?? null,
        } as Record<string, unknown>

        const { data, error } = await this.supabase
            .from('maintenance_spend_limits')
            .insert(insertRow)
            .select('*')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to create spend limit', { error, propertyId: input.propertyId })
            throw new Error(`Failed to create spend limit: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to create spend limit: no row returned')
        }

        return data as Record<string, unknown>
    }

    async updateSpendLimit(limitId: string, propertyId: string, input: {
        category?: string
        thresholdAmount?: number
        alertEnabled?: boolean
    }): Promise<Record<string, unknown>> {
        const updateRow: Record<string, unknown> = {}
        if (input.category !== undefined) updateRow.category = input.category
        if (input.thresholdAmount !== undefined) updateRow.threshold_amount = input.thresholdAmount
        if (input.alertEnabled !== undefined) updateRow.alert_enabled = input.alertEnabled

        const { data, error } = await this.supabase
            .from('maintenance_spend_limits')
            .update(updateRow)
            .eq('id', limitId)
            .eq('property_id', propertyId)
            .select('*')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to update spend limit', { error, limitId })
            throw new Error(`Failed to update spend limit: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to update spend limit: no row returned')
        }

        return data as Record<string, unknown>
    }

    async deleteSpendLimit(limitId: string, propertyId: string): Promise<void> {
        const { error } = await this.supabase
            .from('maintenance_spend_limits')
            .delete()
            .eq('id', limitId)
            .eq('property_id', propertyId)

        if (error) {
            console.error('[MaintenanceQueries] Failed to delete spend limit', { error, limitId })
            throw new Error(`Failed to delete spend limit: ${error.message}`)
        }
    }

    // -----------------------------------------------------------------------
    // Spend check for enforcement
    // -----------------------------------------------------------------------

    async getCategorySpend(propertyId: string, category: string, period: 'monthly' | 'quarterly' | 'annual'): Promise<number> {
        const now = new Date()
        let fromDate: Date

        if (period === 'monthly') {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (period === 'quarterly') {
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3
            fromDate = new Date(now.getFullYear(), quarterMonth, 1)
        } else {
            fromDate = new Date(now.getFullYear(), 0, 1)
        }

        const { data, error } = await this.supabase
            .from('maintenance_tasks')
            .select('estimated_labor_cost, estimated_parts_cost, actual_labor_cost, actual_parts_cost, created_at')
            .eq('property_id', propertyId)
            .eq('category', category)
            .gte('created_at', fromDate.toISOString())

        if (error) {
            console.error('[MaintenanceQueries] Failed to calculate category spend', { error, propertyId, category, period })
            return 0
        }

        if (!data || data.length === 0) return 0

        return data.reduce((sum, row) => {
            return sum + (row.actual_labor_cost ?? row.estimated_labor_cost ?? 0) + (row.actual_parts_cost ?? row.estimated_parts_cost ?? 0)
        }, 0)
    }

    // ── Maintenance Guide CRUD ──

    async listMaintenanceGuides(propertyId: string): Promise<MaintenanceGuideListItem[]> {
        const { data, error } = await this.supabase
            .from('maintenance_guides')
            .select('id, name, description, steps, created_at')
            .eq('property_id', propertyId)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('[MaintenanceQueries] Failed to list maintenance guides', {
                propertyId,
                error,
            })
            throw new Error(`Failed to list maintenance guides: ${error.message}`)
        }

        return (data ?? []) as unknown as MaintenanceGuideListItem[]
    }

    async getMaintenanceGuideById(guideId: string): Promise<MaintenanceGuideListItem | null> {
        const { data, error } = await this.supabase
            .from('maintenance_guides')
            .select('id, name, description, steps, created_at')
            .eq('id', guideId)
            .maybeSingle()

        if (error) {
            console.error('[MaintenanceQueries] Failed to load maintenance guide', {
                guideId,
                error,
            })
            throw new Error(`Failed to load maintenance guide: ${error.message}`)
        }

        return (data ?? null) as unknown as MaintenanceGuideListItem | null
    }

    async createMaintenanceGuide(input: CreateMaintenanceGuideInput): Promise<MaintenanceGuideListItem> {
        const name = input.name.trim()
        if (!name) {
            throw new Error('Guide name is required.')
        }

        const { data: existingGuides, error: existingGuidesError } = await this.supabase
            .from('maintenance_guides')
            .select('id, name')
            .eq('property_id', input.propertyId)

        if (existingGuidesError) {
            console.error('[MaintenanceQueries] Failed to validate guide name uniqueness', {
                propertyId: input.propertyId,
                error: existingGuidesError,
            })
            throw new Error(`Failed to validate guide name: ${existingGuidesError.message}`)
        }

        const normalizedName = name.toLocaleLowerCase()
        const hasDuplicateName = (existingGuides ?? []).some((row) => {
            const existingName = typeof row.name === 'string' ? row.name.trim().toLocaleLowerCase() : ''
            return existingName.length > 0 && existingName === normalizedName
        })

        if (hasDuplicateName) {
            throw new Error('A guide with this name already exists.')
        }

        const stepRows = input.steps
            .map((step) => ({
                id: step.id,
                label: step.label.trim(),
                notes: step.notes?.trim() ? step.notes.trim() : null,
            }))
            .filter((step) => step.label.length > 0)

        if (stepRows.length === 0) {
            throw new Error('Add at least one step with a name.')
        }

        const { data, error } = await this.supabase
            .from('maintenance_guides')
            .insert({
                property_id: input.propertyId,
                created_by: input.createdBy,
                name,
                description: input.description?.trim() ? input.description.trim() : null,
                steps: stepRows,
            })
            .select('id, name, description, steps, created_at')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to create maintenance guide', {
                propertyId: input.propertyId,
                error,
            })
            throw new Error(`Failed to save maintenance guide: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to save maintenance guide: no row returned')
        }

        return data as unknown as MaintenanceGuideListItem
    }

    async updateMaintenanceGuide(input: UpdateMaintenanceGuideInput): Promise<MaintenanceGuideListItem> {
        const name = input.name.trim()
        if (!name) {
            throw new Error('Guide name is required.')
        }

        const { data: existingRow, error: fetchError } = await this.supabase
            .from('maintenance_guides')
            .select('id')
            .eq('id', input.id)
            .eq('property_id', input.propertyId)
            .maybeSingle()

        if (fetchError) {
            console.error('[MaintenanceQueries] Failed to load guide for update', {
                id: input.id,
                fetchError,
            })
            throw new Error(`Failed to load maintenance guide: ${fetchError.message}`)
        }
        if (!existingRow) {
            throw new Error('Maintenance guide not found for this property.')
        }

        const stepRows = input.steps
            .map((step) => ({
                id: step.id,
                label: step.label.trim(),
                ...(step.notes?.trim() ? { notes: step.notes.trim() } : {}),
            }))
            .filter((step) => step.label.length > 0)

        if (stepRows.length === 0) {
            throw new Error('Add at least one step with a name.')
        }

        const { data, error } = await this.supabase
            .from('maintenance_guides')
            .update({
                name,
                description: input.description?.trim() ? input.description.trim() : null,
                steps: stepRows,
            })
            .eq('id', input.id)
            .eq('property_id', input.propertyId)
            .select('id, name, description, steps, created_at')
            .single()

        if (error) {
            console.error('[MaintenanceQueries] Failed to update maintenance guide', {
                id: input.id,
                propertyId: input.propertyId,
                error,
            })
            throw new Error(`Failed to update maintenance guide: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to update maintenance guide: no row returned')
        }

        return data as unknown as MaintenanceGuideListItem
    }

    async deleteMaintenanceGuide(input: { id: string; propertyId: string }): Promise<void> {
        const { error } = await this.supabase
            .from('maintenance_guides')
            .delete()
            .eq('id', input.id)
            .eq('property_id', input.propertyId)

        if (error) {
            console.error('[MaintenanceQueries] Failed to delete maintenance guide', {
                error,
                id: input.id,
                propertyId: input.propertyId,
            })
            throw new Error(`Failed to delete maintenance guide: ${error.message}`)
        }
    }

    async findOverlappingMaintenance(
        siteId: string,
        startDate: string,
        endDate: string,
    ): Promise<Array<{ id: string; title: string; due_date: string | null; scheduled_start: string | null; status: string }>> {
        const parseWindowDate = (value: string): number => {
            // Accepts either YYYY-MM-DD or ISO datetime.
            // Date-only values are treated as UTC midnight to avoid local timezone shifts.
            const normalized = value.includes('T') ? value : `${value}T00:00:00.000Z`
            return new Date(normalized).getTime()
        }

        const windowStartMs = parseWindowDate(startDate)
        const windowEndMs = parseWindowDate(endDate)

        const { data, error } = await this.supabase
            .from('maintenance_tasks')
            .select('id, title, due_date, scheduled_start, started_at, created_at, status')
            .eq('site_id', siteId)
            .in('status', ['open', 'in_progress', 'in_progress_vendor', 'on_hold'])
            .order('due_date', { ascending: true })

        if (error) {
            console.error('[MaintenanceQueries] Failed to find overlapping maintenance', {
                siteId,
                startDate,
                endDate,
                error,
            })
            throw new Error(`Failed to find overlapping maintenance: ${error.message}`)
        }

        const overlaps = (data ?? []).filter((row) => {
            const startValue = row.scheduled_start ?? row.started_at ?? row.created_at ?? null
            const endValue = row.due_date ?? row.created_at ?? null
            if (!startValue || !endValue) return false

            const taskStartMs = new Date(startValue).getTime()
            const taskEndMs = new Date(endValue).getTime()

            // Overlap: taskStart < windowEnd AND taskEnd > windowStart
            return taskStartMs < windowEndMs && taskEndMs > windowStartMs
        })

        return overlaps.map((row) => ({
            id: row.id,
            title: row.title,
            due_date: row.due_date,
            scheduled_start: row.scheduled_start,
            status: row.status,
        }))
    }
}
