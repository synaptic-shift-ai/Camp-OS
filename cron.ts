/**
 * Standalone node-cron runner (FALLBACK / DEVELOPMENT ONLY)
 *
 * In production, Supabase Cron (pg_cron + pg_net) is the primary scheduling
 * mechanism. Register jobs via:
 *   SELECT setup_cron_jobs('https://your-app.com', 'your-cron-secret');
 *
 * This file is kept as a fallback for local development where pg_cron may not
 * be available, or for Docker/self-hosted deployments that prefer an in-process
 * scheduler.
 *
 * Usage: npx tsx cron.ts
 */

import cron from 'node-cron'
import 'dotenv/config'

const baseUrl = process.env.APP_URL
const cronSecret = process.env.CRON_SECRET

/** Secured cron routes expect `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set on the server. */
function cronHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cronSecret) {
    headers.Authorization = `Bearer ${cronSecret}`
  }
  return headers
}

console.log(`[Cron] Using APP_URL=${baseUrl}`)
if (!cronSecret) {
  console.warn(
    '[Cron] CRON_SECRET is unset — secured /api/cron/* routes return 401 if the Next.js server has CRON_SECRET set.',
  )
}

console.log(
  '[Cron] NOTE: In production, use Supabase Cron (pg_cron) instead of this standalone runner.',
)
console.log(
  '[Cron]       Register jobs via: SELECT setup_cron_jobs(\'https://your-app.com\', \'your-cron-secret\');',
)

cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      const res = await fetch(`${baseUrl}/api/cron/automation-scheduled`, {
        method: 'POST',
        headers: cronHeaders(),
      })

      const body = await res.json()
      console.log('[Cron] automation-scheduled:', res.status, body)
    } catch (error) {
      console.error('[Cron] Failed to call automation-scheduled endpoint:', error)
    }
  },
  {
    timezone: 'UTC',
  },
)

cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      const res = await fetch(`${baseUrl}/api/cron/cleanup-expired-reservations`, {
        method: 'POST',
        headers: cronHeaders(),
      })

      const body = await res.json()
      console.log('[Cron] cleanup-expired-reservations:', res.status, body)
    } catch (error) {
      console.error('[Cron] Failed to call cleanup-expired-reservations endpoint:', error)
    }
  },
  {
    timezone: 'UTC',
  },
)

cron.schedule(
  '0 0 * * *',
  async () => {
    try {
      const res = await fetch(`${baseUrl}/api/cron/update-housekeeping-status`, {
        method: 'POST',
        headers: cronHeaders(),
      })

      const body = await res.json()
      console.log('[Cron] update-housekeeping-status:', res.status, body)
    } catch (error) {
      console.error('[Cron] Failed to call update-housekeeping-status endpoint:', error)
    }
  },
  {
    timezone: 'UTC',
  },
)

cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      const res = await fetch(`${baseUrl}/api/cron/send-scheduled-campaigns`, {
        method: 'POST',
        headers: cronHeaders(),
      })

      const body = await res.json()
      console.log('[Cron] send-scheduled-campaigns:', res.status, body)
    } catch (error) {
      console.error('[Cron] Failed to call send-scheduled-campaigns endpoint:', error)
    }
  },
  {
    timezone: 'UTC',
  },
)
