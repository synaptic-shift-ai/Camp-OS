import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/contracts/db'

type MaintenanceTaskRow = Database['public']['Tables']['maintenance_tasks']['Row']
type SiteRow = Database['public']['Tables']['sites']['Row']

export type CreateMaintenanceTaskInput = {
    propertyId: string
    siteId: string
    createdBy: string
    title: string
    description?: string | null
    staffId?: string | null
    status?: 'open' | 'in_progress' | 'completed'
}

export type UpdateMaintenanceTaskInput = {
    id: string
    propertyId: string
    siteId?: string
    description?: string | null
    staffId?: string | null
    title?: string
    status?: 'open' | 'in_progress' | 'completed'
}

export type ListMaintenanceTasksFilters = {
    search?: string
    siteId?: string
    assigneeId?: 'unassigned' | string
    status?: 'open' | 'in_progress' | 'completed'
}

export type ListMaintenanceTasksResult = {
    tasks: Array<MaintenanceTaskRow & { site: Pick<SiteRow, 'site_name' | 'site_number'> | null }>
    total: number
}

export type ListMaintenanceTasksPagination = {
    page: number
    perPage: number
}

function escapeIlikePattern(raw: string): string {
    const noCommas = raw.replace(/,/g, '')
    return noCommas.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export class MaintenanceQueries {
    constructor(private supabase: SupabaseClient) {}

    static async create(): Promise<MaintenanceQueries> {
        const supabase = await createClient()
        return new MaintenanceQueries(supabase as unknown as SupabaseClient)
    }

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

        const insertRow: Database['public']['Tables']['maintenance_tasks']['Insert'] = {
            property_id: input.propertyId,
            site_id: input.siteId,
            created_by: input.createdBy,
            title: input.title,
            description: input.description ?? null,
            staff_id: input.staffId ?? null,
            ...(input.status !== undefined ? { status: input.status } : {}),
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
                '*, site:sites(site_name, site_number)',
                { count: 'exact' },
            )
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false })

        if (filters?.siteId) {
            query = query.eq('site_id', filters.siteId)
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

    async updateMaintenanceTask(input: UpdateMaintenanceTaskInput): Promise<MaintenanceTaskRow> {
        const updateRow: Database['public']['Tables']['maintenance_tasks']['Update'] = {
            ...(input.siteId !== undefined ? { site_id: input.siteId } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.staffId !== undefined ? { staff_id: input.staffId } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
        }

        const { data, error } = await this.supabase
            .from('maintenance_tasks')
            .update(updateRow)
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
}