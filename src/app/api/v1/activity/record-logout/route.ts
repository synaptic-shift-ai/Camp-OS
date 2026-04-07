import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createClient } from '@/lib/supabase/server'
import { recordLogoutActivityLogForUser } from '@/shared/activity-log/record-login-activity-log'

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

    const result = await recordLogoutActivityLogForUser(user)
    return NextResponse.json(result, { status: 200 })
}