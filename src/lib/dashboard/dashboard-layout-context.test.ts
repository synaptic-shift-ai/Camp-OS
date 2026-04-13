import { describe, expect, test, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { resolveDashboardUserLabels } from '@/lib/dashboard/dashboard-layout-context'

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
