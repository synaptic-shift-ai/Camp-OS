import { describe, expect, it } from 'vitest'
import {
  CreateChecklistRequestSchema,
  UpdateChecklistRequestSchema,
  CreateHousekeepingTaskRequestSchema,
  ListHousekeepingTasksQuerySchema,
} from './housekeeping'

describe('CreateHousekeepingTaskRequestSchema', () => {
  it('rejects when title is empty after trim', () => {
    const siteId = '11111111-1111-4111-8111-111111111111'
    const result = CreateHousekeepingTaskRequestSchema.safeParse({
      siteId,
      title: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('accepts minimal valid input with only required fields', () => {
    const siteId = '22222222-2222-4222-8222-222222222222'
    const result = CreateHousekeepingTaskRequestSchema.safeParse({
      siteId,
      title: 'Strip linens',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        siteId,
        title: 'Strip linens',
      })
    }
  })

  it('accepts optional staffId null and description', () => {
    const siteId = '33333333-3333-4333-8333-333333333333'
    const result = CreateHousekeepingTaskRequestSchema.safeParse({
      siteId,
      title: 'Deep clean',
      staffId: null,
      description: 'Focus on bathroom',
      status: 'pending',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.staffId).toBeNull()
      expect(result.data.description).toBe('Focus on bathroom')
      expect(result.data.status).toBe('pending')
    }
  })
})

describe('ListHousekeepingTasksQuerySchema', () => {
  it('parses empty object with default pagination', () => {
    const result = ListHousekeepingTasksQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ page: 1, per_page: 10 })
    }
  })

  it('drops blank search and accepts assigneeId unassigned with siteId and status', () => {
    const siteId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee'
    const result = ListHousekeepingTasksQuerySchema.safeParse({
      search: '   ',
      siteId,
      assigneeId: 'unassigned',
      status: 'pending',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        siteId,
        assigneeId: 'unassigned',
        status: 'pending',
        page: 1,
        per_page: 10,
      })
    }
  })

  it('rejects invalid siteId uuid', () => {
    const result = ListHousekeepingTasksQuerySchema.safeParse({ siteId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('parses page and per_page from query strings', () => {
    const result = ListHousekeepingTasksQuerySchema.safeParse({ page: '3', per_page: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.per_page).toBe(50)
    }
  })
})

describe('CreateChecklistRequestSchema', () => {
  it('rejects empty items array', () => {
    const result = CreateChecklistRequestSchema.safeParse({
      name: 'Turnover',
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts minimal checklist with one item', () => {
    const result = CreateChecklistRequestSchema.safeParse({
      name: 'Standard Turnover Cleaning',
      items: [{ label: 'Strip beds' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Standard Turnover Cleaning')
      expect(result.data.items).toHaveLength(1)
    }
  })

  it('accepts description and item notes', () => {
    const result = CreateChecklistRequestSchema.safeParse({
      name: 'Deep clean',
      description: 'Between stays',
      items: [{ label: 'Bathroom', notes: 'Check grout' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateChecklistRequestSchema', () => {
  it('accepts the same payload as create checklist schema', () => {
    const body = {
      name: 'Turnover',
      description: 'Between stays',
      items: [{ label: 'Strip beds', notes: null as string | null }],
    }
    expect(CreateChecklistRequestSchema.safeParse(body).success).toBe(true)
    expect(UpdateChecklistRequestSchema.safeParse(body).success).toBe(true)
  })
})
