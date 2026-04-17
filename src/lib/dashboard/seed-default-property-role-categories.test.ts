import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROLE_CATEGORY_NAMES,
  defaultRoleCategoriesByRolePayload,
} from '@/lib/dashboard/seed-default-property-role-categories'

describe('defaultRoleCategoriesByRolePayload', () => {
  it('returns owner with no categories and nine default names across admin, manager, and staff', () => {
    const payload = defaultRoleCategoriesByRolePayload()

    expect(payload.owner).toEqual([])
    expect(payload.admin.map((c) => c.name)).toEqual(
      DEFAULT_ROLE_CATEGORY_NAMES.admin.map((c) => c.name),
    )
    expect(payload.manager.map((c) => c.name)).toEqual(
      DEFAULT_ROLE_CATEGORY_NAMES.manager.map((c) => c.name),
    )
    expect(payload.staff.map((c) => c.name)).toEqual(
      DEFAULT_ROLE_CATEGORY_NAMES.staff.map((c) => c.name),
    )

    const totalNamed =
      payload.admin.length + payload.manager.length + payload.staff.length
    expect(totalNamed).toBe(9)
  })
})
