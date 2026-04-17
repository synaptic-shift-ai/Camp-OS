import { describe, expect, test, vi, afterEach } from 'vitest'
import type { User } from '@supabase/supabase-js'
import {
  resolveDashboardNavVisibility,
  resolveDashboardUserLabels,
} from '@/lib/dashboard/dashboard-layout-context'
import * as resolveAccess from '@/lib/rbac/resolve-access'

describe('resolveDashboardUserLabels', () => {
  test('returns displayName from name metadata and roleLabel Owner when companies row exists', async () => {
    const user = {
      id: 'user-id-1',
      email: 'owner@example.com',
      user_metadata: { first_name: 'Pat', last_name: 'Lee' },
    } as unknown as User

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'company-1' }, error: null }),
            }),
          }),
        }),
      }),
    }

    const result = await resolveDashboardUserLabels(supabase as never, user)

    expect(result).toEqual({ displayName: 'Pat Lee', roleLabel: 'Owner', isStaffUserType: false })
  })

  test('returns roleLabel from property_staff role when propertyId is provided', async () => {
    const user = {
      id: 'user-id-2',
      email: 'staff@example.com',
      user_metadata: { user_type: 'staff' },
    } as unknown as User

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'companies') {
          const eqChain = {
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue(eqChain),
            }),
          }
        }

        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { company_id: 'co-1', owner_id: 'owner-1' },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'property_staff') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { role: 'manager', role_category_id: [] },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        if (table === 'property_role_categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      }),
    }

    const result = await resolveDashboardUserLabels(supabase as never, user, 'prop-1')

    expect(result.displayName).toBe('staff@example.com')
    expect(result.roleLabel).toBe('Manager')
    expect(result.isStaffUserType).toBe(true)
  })
})

describe('resolveDashboardNavVisibility', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('exposes Staff Management in the sidebar when category module access grants staff-management view', async () => {
    const categoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

    vi.spyOn(resolveAccess, 'resolveUserPropertyAccess').mockResolvedValue({
      userId: 'user-1',
      propertyId: 'prop-1',
      companyId: 'co-1',
      role: 'staff',
      rawRole: 'staff',
      categories: ['housekeeping'],
      isOwner: false,
      isElevated: false,
      isPlatformAdmin: false,
    })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_staff') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        role: 'staff',
                        role_category_id: [categoryId],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        if (table === 'property_role_categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [
                      {
                        name: 'Housekeeping',
                        access: {
                          moduleAccessControl: {
                            'staff-management': { view: true },
                          },
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      }),
    }

    const nav = await resolveDashboardNavVisibility(supabase as never, 'prop-1', 'user-1')

    expect(nav.moduleNavVisible['staff-management']).toBe(true)
    expect(nav.staffManagementNavVisible).toBe(nav.moduleNavVisible['staff-management'])
  })

  test('exposes Payments in the sidebar when category module access grants payments view', async () => {
    const categoryId = 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'

    vi.spyOn(resolveAccess, 'resolveUserPropertyAccess').mockResolvedValue({
      userId: 'user-2',
      propertyId: 'prop-1',
      companyId: 'co-1',
      role: 'staff',
      rawRole: 'staff',
      categories: ['front_desk'],
      isOwner: false,
      isElevated: false,
      isPlatformAdmin: false,
    })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_staff') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        role: 'staff',
                        role_category_id: [categoryId],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        if (table === 'property_role_categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [
                      {
                        name: 'Front Desk',
                        access: {
                          moduleAccessControl: {
                            payments: { view: true },
                          },
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      }),
    }

    const nav = await resolveDashboardNavVisibility(supabase as never, 'prop-1', 'user-2')

    expect(nav.moduleNavVisible.payments).toBe(true)
    expect(nav.financialNavVisible).toBe(nav.moduleNavVisible.payments)
  })

  test('shows Overview in the sidebar for staff with a custom category when stored access has no moduleAccessControl', async () => {
    const categoryId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

    vi.spyOn(resolveAccess, 'resolveUserPropertyAccess').mockResolvedValue({
      userId: 'user-3',
      propertyId: 'prop-1',
      companyId: 'co-1',
      role: 'staff',
      rawRole: 'staff',
      categories: [],
      isOwner: false,
      isElevated: false,
      isPlatformAdmin: false,
    })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_staff') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        role: 'staff',
                        role_category_id: [categoryId],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        if (table === 'property_role_categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ name: 'Custom Training', access: {} }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      }),
    }

    const nav = await resolveDashboardNavVisibility(supabase as never, 'prop-1', 'user-3')

    expect(nav.moduleNavVisible.overview).toBe(true)
    expect(nav.accountProfileNavVisible).toBe(true)
    expect(nav.moduleNavVisible.reservations).toBe(false)
  })
})
