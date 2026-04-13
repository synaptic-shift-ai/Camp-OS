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

    expect(result).toEqual({ displayName: 'Pat Lee', roleLabel: 'Owner' })
  })

  test('returns capitalized user_type as roleLabel when user does not own a company', async () => {
    const user = {
      id: 'user-id-2',
      email: 'staff@example.com',
      user_metadata: { user_type: 'staff' },
    } as unknown as User

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }

    const result = await resolveDashboardUserLabels(supabase as never, user)

    expect(result.displayName).toBe('staff@example.com')
    expect(result.roleLabel).toBe('Staff')
  })
})
