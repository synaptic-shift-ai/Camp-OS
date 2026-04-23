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

export const CreateMaintenanceTaskRequestSchema = z.object({
    siteId: z.string().uuid(),
    staffId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(['open', 'in_progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    source: z.enum(['guest', 'housekeeping', 'staff', 'pm', 'checkout']).optional(),
    estimatedLaborCost: z.number().nonnegative().nullable().optional(),
    estimatedPartsCost: z.number().nonnegative().nullable().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    sla: z.number().int().nonnegative().max(87600).nullable().optional(),
})

export const UpdateMaintenanceTaskRequestSchema = z.object({
    siteId: z.string().uuid().optional(),
    staffId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(['open', 'in_progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    source: z.enum(['guest', 'housekeeping', 'staff', 'pm', 'checkout']).optional(),
    estimatedLaborCost: z.number().nonnegative().nullable().optional(),
    estimatedPartsCost: z.number().nonnegative().nullable().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    sla: z.number().int().nonnegative().max(87600).nullable().optional(),
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
    status: z.enum(['open', 'in_progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    source: z.enum(['guest', 'housekeeping', 'staff', 'pm', 'checkout']).optional(),
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