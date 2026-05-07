import { describe, expect, test } from 'vitest'
import { CreateMaintenanceTaskRequestSchema, UpdateMaintenanceTaskRequestSchema } from './maintenance'

describe('UpdateMaintenanceTaskRequestSchema', () => {
  test('accepts scheduledStart with Z suffix from JavaScript', () => {
    const parsed = UpdateMaintenanceTaskRequestSchema.safeParse({
      scheduledStart: '2026-05-04T12:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })

  test('accepts scheduledStart with numeric timezone offset from Postgres/Supabase', () => {
    const parsed = UpdateMaintenanceTaskRequestSchema.safeParse({
      scheduledStart: '2026-05-04T12:00:00+00:00',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('CreateMaintenanceTaskRequestSchema', () => {
  test('rejects when dueDate is before scheduledStart', () => {
    const parsed = CreateMaintenanceTaskRequestSchema.safeParse({
      siteId: crypto.randomUUID(),
      title: 'Test',
      scheduledStart: '2026-05-12T12:00:00.000Z',
      dueDate: '2026-05-10T12:00:00.000Z',
    })
    expect(parsed.success).toBe(false)
  })
})
