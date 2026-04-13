import { describe, expect, test, vi } from 'vitest'
import { userCanAccessOperationsDashboardModules } from '@/lib/dashboard/operations-modules-page-access'

function fluentChain(final: { maybeSingle: ReturnType<typeof vi.fn> }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.maybeSingle = final.maybeSingle
  return chain
}

describe('userCanAccessOperationsDashboardModules', () => {
  test('returns true when properties.owner_id matches userId', async () => {
    const supabase = {
      from: vi.fn(() =>
        fluentChain({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { company_id: 'co-1', owner_id: 'user-1' },
            error: null,
          }),
        }),
      ),
    }

    await expect(
      userCanAccessOperationsDashboardModules(supabase as never, 'prop-1', 'user-1'),
    ).resolves.toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('properties')
  })

  test('returns false when user is assigned basic staff role on the property', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'properties') {
          return fluentChain({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { company_id: 'co-1', owner_id: 'owner-1' },
              error: null,
            }),
          })
        }
        if (table === 'companies') {
          return fluentChain({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })
        }
        if (table === 'property_staff') {
          return fluentChain({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'staff' },
              error: null,
            }),
          })
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    await expect(
      userCanAccessOperationsDashboardModules(supabase as never, 'prop-1', 'user-staff'),
    ).resolves.toBe(false)
  })

  test('returns true when user has manager property_staff role', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'properties') {
          return fluentChain({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { company_id: 'co-1', owner_id: 'owner-1' },
              error: null,
            }),
          })
        }
        if (table === 'companies') {
          return fluentChain({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })
        }
        if (table === 'property_staff') {
          return fluentChain({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'manager' },
              error: null,
            }),
          })
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    await expect(
      userCanAccessOperationsDashboardModules(supabase as never, 'prop-1', 'user-mgr'),
    ).resolves.toBe(true)
  })
})
