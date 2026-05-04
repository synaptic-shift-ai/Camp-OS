import { z } from 'zod'

const emptyStringToUndefined = (value: unknown) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value

function parsePageParam(value: string | undefined): number {
    if (value === undefined || value.trim() === '') return 1
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return 1
    return Math.min(parsed, 10_000)
}

function parsePerPageParam(value: string | undefined): number {
    if (value === undefined || value.trim() === '') return 10
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return 10
    return Math.min(parsed, 100)
}

const MAINTENANCE_STATUS_ENUM = ['open', 'in_progress', 'in_progress_vendor', 'on_hold', 'completed', 'cancelled'] as const
const MAINTENANCE_STATUS_ZOD = z.enum(MAINTENANCE_STATUS_ENUM)

export const CreateMaintenanceTaskRequestSchema = z.object({
    siteId: z.string().uuid(),
    staffId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).nullable().optional(),
    status: MAINTENANCE_STATUS_ZOD.optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    source: z.enum(['guest', 'housekeeping', 'staff', 'pm', 'checkout']).optional(),
    estimatedLaborCost: z.number().nonnegative().nullable().optional(),
    estimatedPartsCost: z.number().nonnegative().nullable().optional(),
    isSuspectedDamage: z.boolean().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    sla: z.number().int().nonnegative().max(87600).nullable().optional(),
    scheduledStart: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
})

export const UpdateMaintenanceTaskRequestSchema = z.object({
    siteId: z.string().uuid().optional(),
    staffId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: MAINTENANCE_STATUS_ZOD.optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    source: z.enum(['guest', 'housekeeping', 'staff', 'pm', 'checkout']).optional(),
    estimatedLaborCost: z.number().nonnegative().nullable().optional(),
    estimatedPartsCost: z.number().nonnegative().nullable().optional(),
    actualLaborCost: z.number().nonnegative().nullable().optional(),
    actualPartsCost: z.number().nonnegative().nullable().optional(),
    isSuspectedDamage: z.boolean().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    vendorInvoiceNumber: z.string().trim().max(100).nullable().optional(),
    vendorInvoiceCost: z.number().nonnegative().nullable().optional(),
    closeoutNotes: z.string().trim().max(5000).nullable().optional(),
    sla: z.number().int().nonnegative().max(87600).nullable().optional(),
    scheduledStart: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    on_hold_reason: z.string().optional().nullable(),
    cancelled_reason: z.string().optional().nullable(),
    /** Client wall time when resuming from on_hold; aligns shifted started_at with the UI clock. */
    resumeAt: z.string().datetime().optional(),
    /** Client wall time when entering on_hold; persisted so refresh matches the in-progress timer. */
    holdAt: z.string().datetime().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required',
})

export const ListMaintenanceTasksQuerySchema = z.object({
    search: z.preprocess(emptyStringToUndefined, z.string().trim().max(500).optional()),
    siteId: z.preprocess(emptyStringToUndefined, z.string().uuid().optional()),
    assigneeId: z.preprocess(
        emptyStringToUndefined,
        z.union([z.string().uuid(), z.literal('unassigned')]).optional(),
    ),
    status: MAINTENANCE_STATUS_ZOD.optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    source: z.enum(['guest', 'housekeeping', 'staff', 'pm', 'checkout']).optional(),
    category: z.preprocess(emptyStringToUndefined, z.string().trim().max(120).optional()),
    page: z
        .string()
        .optional()
        .transform((value) => parsePageParam(value)),
    per_page: z
        .string()
        .optional()
        .transform((value) => parsePerPageParam(value)),
})

export type CreateMaintenanceTaskRequest = z.infer<typeof CreateMaintenanceTaskRequestSchema>
export type UpdateMaintenanceTaskRequest = z.infer<typeof UpdateMaintenanceTaskRequestSchema>
export type ListMaintenanceTasksQuery = z.infer<typeof ListMaintenanceTasksQuerySchema>

export const MaintenanceReportQuerySchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Maintenance Schedule schemas
// ---------------------------------------------------------------------------

export const ScheduleFrequencyEnum = z.enum(['weekly', 'monthly', 'annual'])

export const CreateScheduleSchema = z.object({
    name: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).nullable().optional(),
    site_id: z.string().uuid().nullable().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    frequency: ScheduleFrequencyEnum,
    days: z.string().trim().max(500).nullable().optional(),
    schedule_date: z.string().trim().nullable().optional(),
})

export const UpdateScheduleSchema = z.object({
    name: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    site_id: z.string().uuid().nullable().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    frequency: ScheduleFrequencyEnum.optional(),
    days: z.string().trim().max(500).nullable().optional(),
    schedule_date: z.string().trim().nullable().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required',
})

export const ScheduleResponseSchema = z.object({
    id: z.string().uuid(),
    property_id: z.string().uuid(),
    site_id: z.string().uuid().nullable(),
    assigned_to: z.string().uuid().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    frequency: z.string(),
    days: z.string().nullable(),
    schedule_date: z.string().nullable(),
    created_by: z.string().uuid(),
    created_at: z.string(),
    updated_at: z.string(),
})

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>
export type ScheduleResponse = z.infer<typeof ScheduleResponseSchema>

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type MaintenanceReportResponse = {
    totalWorkOrders: number
    activeWorkOrders: number
    completedWorkOrders: number
    totalEstimatedCost: number
    byStatus: Array<{ status: string; count: number }>
    byCategory: Array<{ category: string; count: number }>
    byPriority: Array<{ priority: string; count: number }>
}

// ---------------------------------------------------------------------------
// Budget & Spend Limit schemas
// ---------------------------------------------------------------------------

export const CreateBudgetRequestSchema = z.object({
    category: z.string().trim().min(1).max(120),
    period: z.enum(['monthly', 'quarterly', 'annual']),
    amount: z.number().min(0),
})

export const UpdateBudgetRequestSchema = z.object({
    category: z.string().trim().min(1).max(120).optional(),
    period: z.enum(['monthly', 'quarterly', 'annual']).optional(),
    amount: z.number().min(0).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required',
})

export const CreateSpendLimitRequestSchema = z.object({
    category: z.string().trim().min(1).max(120),
    thresholdAmount: z.number().min(0),
    alertEnabled: z.boolean().optional().default(true),
})

export const UpdateSpendLimitRequestSchema = z.object({
    category: z.string().trim().min(1).max(120).optional(),
    thresholdAmount: z.number().min(0).optional(),
    alertEnabled: z.boolean().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required',
})

export type CreateBudgetRequest = z.infer<typeof CreateBudgetRequestSchema>
export type UpdateBudgetRequest = z.infer<typeof UpdateBudgetRequestSchema>
export type CreateSpendLimitRequest = z.infer<typeof CreateSpendLimitRequestSchema>
export type UpdateSpendLimitRequest = z.infer<typeof UpdateSpendLimitRequestSchema>

// ── Maintenance Guide schemas ──

export const MaintenanceGuideStepSchema = z.object({
    id: z.string(),
    label: z.string().min(1, 'Step label is required'),
    notes: z.string().optional(),
})

export const CreateMaintenanceGuideSchema = z.object({
    name: z.string().trim().min(1, 'Guide name is required').max(200),
    description: z.string().trim().max(5000).nullable().optional(),
    steps: z.array(MaintenanceGuideStepSchema).min(1, 'At least one step is required'),
})

export type CreateMaintenanceGuideRequest = z.infer<typeof CreateMaintenanceGuideSchema>

/** Same shape as create; separate Zod object so bundlers always emit a real schema. */
export const UpdateMaintenanceGuideSchema = z.object({
    name: z.string().trim().min(1, 'Guide name is required').max(200),
    description: z.string().trim().max(5000).nullable().optional(),
    steps: z.array(MaintenanceGuideStepSchema).min(1, 'At least one step is required'),
})

export type UpdateMaintenanceGuideRequest = z.infer<typeof UpdateMaintenanceGuideSchema>
