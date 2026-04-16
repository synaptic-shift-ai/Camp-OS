import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/contracts/db'

type HousekeepingTaskRow = Database['public']['Tables']['housekeeping_tasks']['Row']
type SiteRow = Database['public']['Tables']['sites']['Row']

export type CreateHousekeepingTaskInput = {
    propertyId: string
    siteId: string
    createdBy: string
    title: string
    description?: string | null
    staffId?: string | null
    status?: 'pending' | 'in_progress' | 'done'
}

export type UpdateHousekeepingTaskInput = {
    id: string
    propertyId: string
    siteId?: string
    description?: string | null
    staffId?: string | null
    title?: string
    status?: 'pending' | 'in_progress' | 'done'
}

export type ListHousekeepingTasksFilters = {
    search?: string
    siteId?: string
    assigneeId?: 'unassigned' | string
    status?: 'pending' | 'in_progress' | 'done'
}

export type ListHousekeepingTasksPagination = {
    page: number
    perPage: number
}

export type ListHousekeepingTasksResult = {
    tasks: Array<HousekeepingTaskRow & { site: Pick<SiteRow, 'site_name' | 'site_number'> | null }>
    total: number
}

function escapeIlikePattern(raw: string): string {
    const noCommas = raw.replace(/,/g, '')
    return noCommas.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export class HousekeepingQueries {
    constructor(private supabase: SupabaseClient) {}

    static async create(): Promise<HousekeepingQueries> {
        const supabase = await createClient()
        return new HousekeepingQueries(supabase as unknown as SupabaseClient)
    }

    async createHousekeepingTask(input: CreateHousekeepingTaskInput): Promise<HousekeepingTaskRow> {
        const { data: siteRow, error: siteError } = await this.supabase
        .from('sites')
        .select('id')
        .eq('id', input.siteId)
        .eq('property_id', input.propertyId)
        .is('deleted_at', null)
        .maybeSingle()

        if (siteError || !siteRow) {
        console.error('[HousekeepingQueries] Site not found for property', {
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
            console.error('[HousekeepingQueries] Assignee not found for property', {
            staffError,
            propertyId: input.propertyId,
            staffId: input.staffId,
            })
            throw new Error('Assignee not found for this property')
        }
        }

        const insertRow: Database['public']['Tables']['housekeeping_tasks']['Insert'] = {
        property_id: input.propertyId,
        site_id: input.siteId,
        created_by: input.createdBy,
        title: input.title,
        description: input.description ?? null,
        staff_id: input.staffId ?? null,
        ...(input.status !== undefined ? { status: input.status } : {}),
        }

        const { data, error } = await this.supabase
        .from('housekeeping_tasks')
        .insert(insertRow)
        .select()
        .single()

        if (error) {
        console.error('[HousekeepingQueries] Failed to create housekeeping task', {
            error,
            propertyId: input.propertyId,
        })
        throw new Error(`Failed to create housekeeping task: ${error.message}`)
        }

        if (!data) {
        throw new Error('Failed to create housekeeping task: no row returned')
        }

        return data
    }

    async listHousekeepingTasks(
        propertyId: string,
        filters?: ListHousekeepingTasksFilters,
        pagination?: ListHousekeepingTasksPagination,
    ): Promise<ListHousekeepingTasksResult> {
        let query = this.supabase
            .from('housekeeping_tasks')
            .select(
                `
                *,
                site:sites(site_name, site_number)
            `,
                { count: 'exact' },
            )
            .eq('property_id', propertyId)

        if (filters?.siteId) {
            query = query.eq('site_id', filters.siteId)
        }

        if (filters?.assigneeId === 'unassigned') {
            query = query.is('staff_id', null)
        } else if (filters?.assigneeId) {
            query = query.eq('staff_id', filters.assigneeId)
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
                console.error('[HousekeepingQueries] Site search for housekeeping list failed', {
                    propertyId,
                    sitesError,
                })
                throw new Error(`Failed to search sites for housekeeping tasks: ${sitesError.message}`)
            }

            const siteIds = (matchingSites ?? []).map((row) => row.id)
            const orParts = [`title.ilike.${pattern}`, `description.ilike.${pattern}`]
            if (siteIds.length > 0) {
                orParts.push(`site_id.in.(${siteIds.join(',')})`)
            }
            query = query.or(orParts.join(','))
        }

        query = query.order('created_at', { ascending: false })

        const page = pagination?.page ?? 1
        const perPage = pagination?.perPage ?? 10
        const from = (page - 1) * perPage
        const to = from + perPage - 1
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error('[HousekeepingQueries] Failed to list housekeeping tasks', {
                propertyId,
                error,
            })
            throw new Error(`Failed to list housekeeping tasks: ${error.message}`)
        }

        return {
            tasks: (data ?? []) as Array<
                HousekeepingTaskRow & { site: Pick<SiteRow, 'site_name' | 'site_number'> | null }
            >,
            total: count ?? 0,
        }
    }

    async countOpenHousekeepingTasks(propertyId: string): Promise<number> {
        const { count, error } = await this.supabase
            .from('housekeeping_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .neq('status', 'done')

        if (error) {
            console.error('[HousekeepingQueries] Failed to count open housekeeping tasks', {
                propertyId,
                error,
            })
            throw new Error(`Failed to count housekeeping tasks: ${error.message}`)
        }

        return count ?? 0
    }

    async updateHousekeepingTask(input: UpdateHousekeepingTaskInput): Promise<HousekeepingTaskRow> {
        const updateRow: Database['public']['Tables']['housekeeping_tasks']['Update'] = {
            ...(input.siteId !== undefined ? { site_id: input.siteId } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.staffId !== undefined ? { staff_id: input.staffId } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
        }

        const { data, error } = await this.supabase
            .from('housekeeping_tasks')
            .update(updateRow)
            .eq('id', input.id)
            .eq('property_id', input.propertyId)
            .select()
            .single()
        
        if (error) {
            console.error('[HousekeepingQueries] Failed to update housekeeping task', {
                error,
                id: input.id,
            })
            throw new Error(`Failed to update housekeeping task: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to update housekeeping task: no row returned')
        }

        return data
    }

    async deleteHousekeepingTask(input: { id: string; propertyId: string }): Promise<void> {
        const { error } = await this.supabase
            .from('housekeeping_tasks')
            .delete()
            .eq('id', input.id)
            .eq('property_id', input.propertyId)

        if (error) {
            console.error('[HousekeepingQueries] Failed to delete housekeeping task', {
                error,
                id: input.id,
                propertyId: input.propertyId,
            })
            throw new Error(`Failed to delete housekeeping task: ${error.message}`)
        }
    }
}
