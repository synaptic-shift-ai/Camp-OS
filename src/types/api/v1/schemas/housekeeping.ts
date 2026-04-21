import { z } from 'zod'

const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const ChecklistItemDoneRequestSchema = z.object({
  item_id: z.string().trim().min(1).max(120),
  status: z.enum(['pending', 'completed']),
  completed_at: z.string().datetime().nullable().optional(),
})

export const CreateHousekeepingTaskRequestSchema = z.object({
  siteId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  reservationConfirmationId: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(120).optional(),
  ),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  startDate: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(64).optional()),
  dueDate: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(64).optional()),
  checklistTemplateId: z.preprocess(emptyStringToUndefined, z.string().uuid().optional()),
  checklistItemDone: z.array(ChecklistItemDoneRequestSchema).optional(),
})

export type CreateHousekeepingTaskRequest = z.infer<typeof CreateHousekeepingTaskRequestSchema>

export const UpdateHousekeepingTaskRequestSchema = z.object({
  siteId: z.string().uuid().optional(),
  staffId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  reservationConfirmationId: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(120).optional(),
  ),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  startDate: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(64).optional()),
  dueDate: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(64).optional()),
  checklistTemplateId: z.preprocess(emptyStringToUndefined, z.string().uuid().optional()),
  checklistItemDone: z.array(ChecklistItemDoneRequestSchema).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required',
})

export type UpdateHousekeepingTaskRequest = z.infer<typeof UpdateHousekeepingTaskRequestSchema>

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

export const ListHousekeepingTasksQuerySchema = z.object({
  search: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  siteId: z.preprocess(emptyStringToUndefined, z.string().uuid().optional()),
  assigneeId: z
    .preprocess(emptyStringToUndefined, z.union([z.literal('unassigned'), z.string().uuid()]).optional()),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  page: z
    .string()
    .optional()
    .transform((value) => parsePageParam(value)),
  per_page: z
    .string()
    .optional()
    .transform((value) => parsePerPageParam(value)),
})

export type ListHousekeepingTasksQuery = z.infer<typeof ListHousekeepingTasksQuerySchema>

export const ChecklistItemRequestSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const CreateChecklistRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  items: z.array(ChecklistItemRequestSchema).min(1).max(200),
})

export type CreateChecklistRequest = z.infer<typeof CreateChecklistRequestSchema>

/** Same shape as create; separate Zod object so bundlers always emit a real schema (alias caused undefined at runtime). */
export const UpdateChecklistRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  items: z.array(ChecklistItemRequestSchema).min(1).max(200),
})

export type UpdateChecklistRequest = z.infer<typeof UpdateChecklistRequestSchema>

export const CreateHousekeepingTaskImageRequestSchema = z.object({
  storagePath: z.string().trim().min(1).max(1000),
})

export type CreateHousekeepingTaskImageRequest = z.infer<
  typeof CreateHousekeepingTaskImageRequestSchema
>
