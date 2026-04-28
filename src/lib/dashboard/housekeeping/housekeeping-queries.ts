import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/contracts/db'

type HousekeepingTaskRow = Database['public']['Tables']['housekeeping_tasks']['Row']
type SiteRow = Database['public']['Tables']['sites']['Row']

export type PropertyChecklistListItem = Pick<
    Database['public']['Tables']['checklist']['Row'],
    'id' | 'name' | 'description' | 'item' | 'created_at'
>

type ChecklistRow = Database['public']['Tables']['checklist']['Row']

export type CreatePropertyChecklistInput = {
    propertyId: string
    createdBy: string
    name: string
    description: string | null
    items: Array<{ id: string; label: string; notes: string | null }>
}

export type ChecklistTemplateLine = {
    id: string | null
    label: string
    notes: string | null
}

export function parseChecklistTemplateLines(item: Json): ChecklistTemplateLine[] {
    if (!Array.isArray(item)) return []

    const lines: ChecklistTemplateLine[] = []
    for (const entry of item) {
        if (typeof entry === 'string') {
            const label = entry.trim()
            if (label.length > 0) lines.push({ id: null, label, notes: null })
            continue
        }
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            const record = entry as Record<string, unknown>
            const labelRaw = record.label ?? record.text ?? record.title
            if (typeof labelRaw !== 'string') continue
            const label = labelRaw.trim()
            if (!label) continue
            const idRaw = record.id
            const id = typeof idRaw === 'string' && idRaw.trim().length > 0 ? idRaw.trim() : null
            const notesRaw = record.notes
            const notes =
                typeof notesRaw === 'string' && notesRaw.trim().length > 0 ? notesRaw.trim() : null
            lines.push({ id, label, notes })
        }
    }
    return lines
}

export type UpdatePropertyChecklistInput = {
    id: string
    propertyId: string
    name: string
    description: string | null
    items: Array<{ id: string; label: string; notes: string | null }>
}

export type CreateHousekeepingTaskInput = {
    propertyId: string
    siteId: string
    createdBy: string
    title: string
    description?: string | null
    staffId?: string | null
    status?: 'pending' | 'in_progress' | 'done'
    reservationId?: string | null
    checklistId?: string | null
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    startDate?: string | null
    endDate?: string | null
    checklistItemDone?: Array<{
        item_id: string
        status: 'pending' | 'completed'
        completed_at?: string | null | undefined
    }>
}

export type UpdateHousekeepingTaskInput = {
    id: string
    propertyId: string
    siteId?: string
    description?: string | null
    staffId?: string | null
    title?: string
    status?: 'pending' | 'in_progress' | 'done'
    reservationId?: string | null
    checklistId?: string | null
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    startDate?: string | null
    startAt?: string | null
    endDate?: string | null
    checklistItemDone?: Array<{
        item_id: string
        status: 'pending' | 'completed'
        completed_at?: string | null | undefined
    }>
}

export type ListHousekeepingTasksFilters = {
    search?: string
    siteId?: string
    assigneeId?: 'unassigned' | string
    status?: 'pending' | 'in_progress' | 'done'
    priority?: 'low' | 'medium' | 'high' | 'urgent'
}

export type ListHousekeepingTasksPagination = {
    page: number
    perPage: number
}

export type ListHousekeepingTasksResult = {
    tasks: Array<
        HousekeepingTaskRow & {
            site: Pick<SiteRow, 'site_name' | 'site_number'> | null
            reservation: Pick<Database['public']['Tables']['reservations']['Row'], 'confirmation_number'> | null
        }
    >
    total: number
}

export type TaskImageTaskType = 'housekeeping' | 'maintenance'

export type TaskImageRow = {
    id: string
    property_id: string
    task_type: TaskImageTaskType
    task_id: string
    storage_path: string
    uploaded_by: string | null
    created_at: string
    updated_at: string
}

export type CreateTaskImageInput = {
    propertyId: string
    taskType: TaskImageTaskType
    taskId: string
    storagePath: string
    uploadedBy: string
}

export type ListTaskImagesInput = {
    propertyId: string
    taskType: TaskImageTaskType
    taskId: string
}

function escapeIlikePattern(raw: string): string {
    const noCommas = raw.replace(/,/g, '')
    return noCommas.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export class HousekeepingQueries {
    constructor(private supabase: SupabaseClient) {}

    async getChecklistTemplateById(
        checklistId: string,
    ): Promise<Pick<ChecklistRow, 'id' | 'name' | 'item'> | null> {
        const { data, error } = await this.supabase
            .from('checklist')
            .select('id, name, item')
            .eq('id', checklistId)
            .maybeSingle()

        if (error) {
            console.error('[HousekeepingQueries] Failed to load checklist template', {
                checklistId,
                error,
            })
            throw new Error(`Failed to load checklist template: ${error.message}`)
        }

        return (data ?? null) as Pick<ChecklistRow, 'id' | 'name' | 'item'> | null
    }

    async getChecklistTemplateItem(checklistId: string): Promise<Json | null> {
        const template = await this.getChecklistTemplateById(checklistId)
        return template?.item ?? null
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
        reservation_id: input.reservationId ?? null,
        checklist_id: input.checklistId ?? null,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
        ...(input.endDate !== undefined ? { end_date: input.endDate } : {}),
        ...(input.checklistItemDone !== undefined
            ? { checklist_item_done: input.checklistItemDone as unknown as Json }
            : {}),
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
                site:sites(site_name, site_number),
                reservation:reservations(confirmation_number)
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

        if (filters?.priority === 'medium') {
            query = query.or('priority.eq.medium,priority.is.null')
        } else if (filters?.priority) {
            query = query.eq('priority', filters.priority)
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
                HousekeepingTaskRow & {
                    site: Pick<SiteRow, 'site_name' | 'site_number'> | null
                    reservation: Pick<Database['public']['Tables']['reservations']['Row'], 'confirmation_number'> | null
                }
            >,
            total: count ?? 0,
        }
    }

    async countOpenHousekeepingTasks(propertyId: string, options?: { assigneeId?: string }): Promise<number> {
        let query = this.supabase
            .from('housekeeping_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .neq('status', 'done')

        if (options?.assigneeId === 'unassigned') {
            query = query.is('staff_id', null)
        } else if (options?.assigneeId) {
            query = query.eq('staff_id', options.assigneeId)
        }

        const { count, error } = await query

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
            ...(input.reservationId !== undefined ? { reservation_id: input.reservationId } : {}),
            ...(input.checklistId !== undefined ? { checklist_id: input.checklistId } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
            ...(input.startAt !== undefined ? { start_at: input.startAt } : {}),
            ...(input.endDate !== undefined ? { end_date: input.endDate } : {}),
            ...(input.checklistItemDone !== undefined
                ? { checklist_item_done: input.checklistItemDone as unknown as Json }
                : {}),
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

    async listPropertyChecklists(propertyId: string): Promise<PropertyChecklistListItem[]> {
        const { data, error } = await this.supabase
            .from('checklist')
            .select('id, name, description, item, created_at')
            .eq('property_id', propertyId)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('[HousekeepingQueries] Failed to list property checklists', {
                propertyId,
                error,
            })
            throw new Error(`Failed to list checklists: ${error.message}`)
        }

        return (data ?? []) as PropertyChecklistListItem[]
    }

    async createPropertyChecklist(input: CreatePropertyChecklistInput): Promise<ChecklistRow> {
        const name = input.name.trim()
        if (!name) {
            throw new Error('Template name is required.')
        }

        const { data: existingChecklists, error: existingChecklistsError } = await this.supabase
            .from('checklist')
            .select('id, name')
            .eq('property_id', input.propertyId)

        if (existingChecklistsError) {
            console.error('[HousekeepingQueries] Failed to validate checklist name uniqueness', {
                propertyId: input.propertyId,
                error: existingChecklistsError,
            })
            throw new Error(`Failed to validate checklist name: ${existingChecklistsError.message}`)
        }

        const normalizedName = name.toLocaleLowerCase()
        const hasDuplicateName = (existingChecklists ?? []).some((row) => {
            const existingName = typeof row.name === 'string' ? row.name.trim().toLocaleLowerCase() : ''
            return existingName.length > 0 && existingName === normalizedName
        })

        if (hasDuplicateName) {
            throw new Error('A checklist with this title already exists.')
        }

        const itemRows = input.items
            .map((row) => ({
                id: row.id,
                label: row.label.trim(),
                notes: row.notes?.trim() ? row.notes.trim() : null,
            }))
            .filter((row) => row.label.length > 0)

        if (itemRows.length === 0) {
            throw new Error('Add at least one checklist item with a name.')
        }

        const insertRow: Database['public']['Tables']['checklist']['Insert'] = {
            property_id: input.propertyId,
            created_by: input.createdBy,
            name,
            description: input.description?.trim() ? input.description.trim() : null,
            item: itemRows as unknown as Json,
        }

        const { data, error } = await this.supabase.from('checklist').insert(insertRow).select().single()

        if (error) {
            console.error('[HousekeepingQueries] Failed to create checklist', {
                propertyId: input.propertyId,
                error,
            })
            throw new Error(`Failed to save checklist: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to save checklist: no row returned')
        }

        return data
    }

    async updatePropertyChecklist(input: UpdatePropertyChecklistInput): Promise<ChecklistRow> {
        const name = input.name.trim()
        if (!name) {
            throw new Error('Template name is required.')
        }

        const { data: existingRow, error: fetchError } = await this.supabase
            .from('checklist')
            .select('id')
            .eq('id', input.id)
            .eq('property_id', input.propertyId)
            .maybeSingle()

        if (fetchError) {
            console.error('[HousekeepingQueries] Failed to load checklist for update', {
                id: input.id,
                fetchError,
            })
            throw new Error(`Failed to load checklist: ${fetchError.message}`)
        }
        if (!existingRow) {
            throw new Error('Checklist not found for this property.')
        }

        const itemRows = input.items
            .map((row) => ({
                id: row.id,
                label: row.label.trim(),
                ...(row.notes?.trim() ? { notes: row.notes.trim() } : {}),
            }))
            .filter((row) => row.label.length > 0)

        if (itemRows.length === 0) {
            throw new Error('Add at least one checklist item with a name.')
        }

        const updateRow: Database['public']['Tables']['checklist']['Update'] = {
            name,
            description: input.description?.trim() ? input.description.trim() : null,
            item: itemRows as unknown as Json,
        }

        const { data, error } = await this.supabase
            .from('checklist')
            .update(updateRow)
            .eq('id', input.id)
            .eq('property_id', input.propertyId)
            .select()
            .single()

        if (error) {
            console.error('[HousekeepingQueries] Failed to update checklist', {
                id: input.id,
                propertyId: input.propertyId,
                error,
            })
            throw new Error(`Failed to update checklist: ${error.message}`)
        }

        if (!data) {
            throw new Error('Failed to update checklist: no row returned')
        }

        return data
    }

    async deletePropertyChecklist(input: { id: string; propertyId: string }): Promise<void> {
        const { error } = await this.supabase
            .from('checklist')
            .delete()
            .eq('id', input.id)
            .eq('property_id', input.propertyId)

        if (error) {
            console.error('[HousekeepingQueries] Failed to delete checklist', {
                error,
                id: input.id,
                propertyId: input.propertyId,
            })
            throw new Error(`Failed to delete checklist: ${error.message}`)
        }
    }

    async assertTaskExists(input: {
        propertyId: string
        taskType: TaskImageTaskType
        taskId: string
    }): Promise<void> {
        console.info('[HousekeepingQueries] assertTaskExists start', input)
        const tableName = input.taskType === 'housekeeping' ? 'housekeeping_tasks' : 'maintenance_tasks'
        const { data, error } = await this.supabase
            .from(tableName as 'housekeeping_tasks')
            .select('id')
            .eq('id', input.taskId)
            .eq('property_id', input.propertyId)
            .maybeSingle()

        if (error) {
            console.error('[HousekeepingQueries] assertTaskExists query failed', {
                ...input,
                tableName,
                error,
            })
            throw new Error(`Failed to validate ${input.taskType} task: ${error.message}`)
        }
        if (!data) {
            console.warn('[HousekeepingQueries] assertTaskExists no row found', {
                ...input,
                tableName,
            })
            throw new Error(`${input.taskType} task not found for this property.`)
        }
        console.info('[HousekeepingQueries] assertTaskExists success', {
            ...input,
            tableName,
        })
    }

    async createTaskImage(input: CreateTaskImageInput): Promise<TaskImageRow> {
        console.info('[HousekeepingQueries] createTaskImage start', {
            propertyId: input.propertyId,
            taskType: input.taskType,
            taskId: input.taskId,
            storagePath: input.storagePath,
            uploadedBy: input.uploadedBy,
        })
        await this.assertTaskExists({
            propertyId: input.propertyId,
            taskType: input.taskType,
            taskId: input.taskId,
        })

        const { data, error } = await this.supabase
            .from('task_images' as 'housekeeping_tasks')
            .insert({
                property_id: input.propertyId,
                task_type: input.taskType,
                task_id: input.taskId,
                storage_path: input.storagePath,
                uploaded_by: input.uploadedBy,
            } as never)
            .select('*')
            .single()

        if (error) {
            console.error('[HousekeepingQueries] createTaskImage insert failed', {
                propertyId: input.propertyId,
                taskType: input.taskType,
                taskId: input.taskId,
                storagePath: input.storagePath,
                error,
            })
            throw new Error(`Failed to create task image: ${error.message}`)
        }
        if (!data) {
            console.error('[HousekeepingQueries] createTaskImage insert returned no row', {
                propertyId: input.propertyId,
                taskType: input.taskType,
                taskId: input.taskId,
                storagePath: input.storagePath,
            })
            throw new Error('Failed to create task image: no row returned')
        }
        console.info('[HousekeepingQueries] createTaskImage success', {
            imageId: (data as unknown as TaskImageRow).id,
            propertyId: input.propertyId,
            taskType: input.taskType,
            taskId: input.taskId,
            storagePath: input.storagePath,
        })

        return data as unknown as TaskImageRow
    }

    async listTaskImages(input: ListTaskImagesInput): Promise<TaskImageRow[]> {
        const { data, error } = await this.supabase
            .from('task_images' as 'housekeeping_tasks')
            .select('*')
            .eq('property_id', input.propertyId)
            .eq('task_type', input.taskType)
            .eq('task_id', input.taskId)
            .order('created_at', { ascending: false })

        if (error) {
            throw new Error(`Failed to list task images: ${error.message}`)
        }

        return (data ?? []) as unknown as TaskImageRow[]
    }

    async deleteTaskImage(input: {
        propertyId: string
        taskType: TaskImageTaskType
        taskId: string
        imageId: string
    }): Promise<{ storagePath: string }> {
        const { data, error } = await this.supabase
            .from('task_images' as 'housekeeping_tasks')
            .delete()
            .eq('id', input.imageId)
            .eq('property_id', input.propertyId)
            .eq('task_type', input.taskType)
            .eq('task_id', input.taskId)
            .select('storage_path')
            .single()

        if (error) {
            throw new Error(`Failed to delete task image: ${error.message}`)
        }
        if (!data?.storage_path) {
            throw new Error('Failed to delete task image: storage path not found')
        }

        return { storagePath: data.storage_path as string }
    }

    async getNextReservationForSite(
        siteId: string,
        propertyId: string,
    ): Promise<{ check_in_date: string; status: string } | null> {
        const today = new Date().toISOString().slice(0, 10)

        const { data, error } = await this.supabase
            .from('reservations')
            .select('check_in_date, status')
            .eq('site_id', siteId)
            .eq('property_id', propertyId)
            .gte('check_in_date', today)
            .in('status', ['confirmed', 'upcoming'])
            .order('check_in_date', { ascending: true })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('[HousekeepingQueries] Failed to get next reservation for site', {
                siteId,
                propertyId,
                error,
            })
            throw new Error(`Failed to get next reservation for site: ${error.message}`)
        }

        return data
            ? { check_in_date: data.check_in_date as string, status: data.status as string }
            : null
    }

    async countOpenHousekeepingTasksForSite(propertyId: string, siteId: string): Promise<number> {
        const { count, error } = await this.supabase
            .from('housekeeping_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .eq('site_id', siteId)
            .neq('status', 'done')

        if (error) {
            console.error('[HousekeepingQueries] Failed to count open housekeeping task for site', {
                propertyId,
                siteId,
                error,
            })
            throw new Error(`Failed to count housekeeping task for: ${error.message}`)
        }

        return count ?? 0
    }
}
