/**
 * POST /api/v1/activity/record-login
 *
 * Records a company-level activity log row after sign-in.
 * Accepts Authorization: Bearer <access_token> (password login uses browser storage)
 * or an existing cookie session.
 */

import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { recordLoginActivityLogForUser } from '@/shared/activity-log/record-login-activity-log'

export async function POST(request: NextRequest) {
  let user: User | null = null

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token.length > 0) {
      const admin = createServiceRoleClient()
      const { data, error } = await admin.auth.getUser(token)
      if (!error && data.user) {
        user = data.user
      }
    }
  }

  if (!user) {
    const supabase = await createClient()
    const { data: { user: cookieUser }, error } = await supabase.auth.getUser()
    if (!error && cookieUser) {
      user = cookieUser
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await recordLoginActivityLogForUser(user)
  return NextResponse.json(result, { status: 200 })
}
