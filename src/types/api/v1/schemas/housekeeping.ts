import { z } from 'zod'

export const CreateHousekeepingTaskRequestSchema = z.object({
  siteId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
})

export type CreateHousekeepingTaskRequest = z.infer<typeof CreateHousekeepingTaskRequestSchema>

export const UpdateHousekeepingTaskRequestSchema = z.object({
  siteId: z.string().uuid().optional(),
  staffId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required',
})

export type UpdateHousekeepingTaskRequest = z.infer<typeof UpdateHousekeepingTaskRequestSchema>

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

export const ListHousekeepingTasksQuerySchema = z.object({
  search: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
  siteId: z.preprocess(emptyStringToUndefined, z.string().uuid().optional()),
  assigneeId: z
    .preprocess(emptyStringToUndefined, z.union([z.literal('unassigned'), z.string().uuid()]).optional()),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
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
