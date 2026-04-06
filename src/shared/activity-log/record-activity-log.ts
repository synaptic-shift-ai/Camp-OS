import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/contracts/db"

type DbClient = SupabaseClient<Database>

export type RecordActivityLog = {
    companyId: string
    propertyId: string
    action: string
    resource: string
    userId: string | null
    details?: string | null
}

export async function recordActivityLog(
    client: DbClient,
    input: RecordActivityLog,
    options: { failOpen?: boolean } = { failOpen: true }
): Promise<void> {
    const { error } = await client.from("activity_log").insert({
        company_id: input.companyId,
        property_id: input.propertyId,
        action: input.action,
        resource: input.resource,
        user_id: input.userId,
        ...(input.details != null && input.details !== '' ? { details: input.details } : {}),
    })

    if (error) {
        console.error('[activity-log] Failed to record activity log', error)
        if (!options.failOpen) throw error
    }
}